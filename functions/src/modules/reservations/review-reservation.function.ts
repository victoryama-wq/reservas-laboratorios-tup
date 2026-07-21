import {getStorage} from "firebase-admin/storage";
import {
  getFirestore,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";

import {checkExternalCalendarConflicts} from
  "../calendar/calendar-availability.service";
import {GoogleCalendarService} from "../calendar/google-calendar.service";
import {GOOGLE_WORKSPACE_SECRETS} from
  "../google-workspace/google-workspace-auth.service";
import {ReservationLogRepository} from "../logs/reservation-log.repository";
import {buildReservationEmailTemplate} from
  "../notifications/email-templates";
import {NotificationDeliveryService} from
  "../notifications/notification-delivery.service";
import {
  CreatedNotification,
  NotificationRepository,
} from "../notifications/notification.repository";
import {
  AppUser,
  LabDoc,
  NotificationType,
  ProtocolFile,
  ReservationDoc,
  ReservationLogDoc,
  ReservationStatus,
  SystemSettingsDoc,
} from "../../shared/models";
import {ReservationRepository} from "./reservation.repository";
import {validateLab, validateReservationReviewTiming} from
  "./reservation.validators";

const REGION = "us-central1";

interface ApproveReservationInput {
  reservationId?: string;
  note?: string;
}

interface RejectReservationInput {
  reservationId?: string;
  reason?: string;
}

interface GetReservationProtocolAccessInput {
  reservationId?: string;
  storagePath?: string;
}

interface GetReservationReviewLogsInput {
  reservationId?: string;
}

interface GetMyReservationLogsInput {
  reservationId?: string;
}

interface ReviewReservationOutput {
  reservationId: string;
  folio: string;
  status: string;
  message: string;
}

interface ReservationProtocolAccessOutput {
  fileName: string;
  contentType: string;
  url: string;
  expiresInSeconds: number;
}

type ReviewTimelineSeverity =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

interface ReservationReviewTimelineItem {
  id: string;
  action: string;
  title: string;
  description: string;
  severity: ReviewTimelineSeverity;
  createdAt: string;
  actorLabel?: string;
}

interface GetReservationReviewLogsOutput {
  reservationId: string;
  logs: ReservationReviewTimelineItem[];
}

interface MyReservationTimelineItem {
  id: string;
  action: string;
  title: string;
  description: string;
  severity: ReviewTimelineSeverity;
  createdAt: string;
}

interface GetMyReservationLogsOutput {
  reservationId: string;
  items: MyReservationTimelineItem[];
}

const PROTOCOL_ACCESS_TTL_SECONDS = 10 * 60;

/**
 * Approves a pending risky reservation.
 */
export const approveReservation = onCall(
    {
      region: REGION,
      invoker: "public",
      secrets: GOOGLE_WORKSPACE_SECRETS,
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<ReviewReservationOutput> => {
      const input = parseApproveInput(request.data);
      const context = await loadReviewContext(request);
      const startAt = context.repository.toDate(context.reservation.startAt);
      const endAt = context.repository.toDate(context.reservation.endAt);

      assertCanReview(context.profile, context.reservation);
      assertPendingReservation(context.reservation);
      validateLab(context.lab);

      if (!startAt || !endAt) {
        throw new HttpsError(
            "failed-precondition",
            "La fecha de la reserva no es valida.",
        );
      }

      validateReservationReviewTiming(context.lab, startAt, endAt, new Date());
      await assertProtocolFilesExist(context.reservation);
      await assertNoBlockedPeriodConflict(context, startAt, endAt);
      await assertNoInternalConflict(context, startAt, endAt);

      try {
        await assertNoExternalConflict(
            context.lab,
            startAt,
            endAt,
            context.reservation.id,
        );
      } catch (error) {
        if (error instanceof HttpsError) {
          throw error;
        }

        logReviewError("validate_external_availability", error, context);
        return markCalendarError(context, input.note);
      }

      const approvedReservation = {
        ...context.reservation,
        startAt: Timestamp.fromDate(startAt),
        endAt: Timestamp.fromDate(endAt),
        status: "CONFIRMADA_TRAS_VALIDACION" as const,
        statusReason: input.note,
      };
      let calendarEventId: string;
      let calendarOutcome: "CREATED" | "REUSED" | "RECONCILED";

      try {
        const calendarResult = await context.calendarService
            .ensureReservationEvent({
              lab: context.lab,
              reservation: approvedReservation,
            });
        calendarEventId = calendarResult.eventId;
        calendarOutcome = calendarResult.outcome;
      } catch (error) {
        logReviewError("create_calendar_event", error, context);
        return markCalendarError(context, input.note);
      }

      const now = Timestamp.now();
      const createdNotification = await context.repository.runTransaction(
          async (transaction) => {
            context.repository.updateReservation(
                transaction,
                input.reservationId,
                {
                  status: "CONFIRMADA_TRAS_VALIDACION",
                  statusReason: input.note,
                  calendarEventId,
                  approvedBy: context.profile.uid,
                  approvedAt: now,
                  updatedAt: now,
                },
            );
            context.logRepository.createLog(transaction, {
              reservationId: context.reservation.id,
              action: "APPROVED",
              actorUid: context.profile.uid,
              actorEmail: context.profile.email,
              previousStatus: "PENDIENTE_VALIDACION",
              newStatus: "CONFIRMADA_TRAS_VALIDACION",
              note: input.note,
            });
            context.logRepository.createLog(transaction, {
              reservationId: context.reservation.id,
              action: "CALENDAR_EVENT_CREATED",
              actorUid: context.profile.uid,
              actorEmail: context.profile.email,
              newStatus: "CONFIRMADA_TRAS_VALIDACION",
              metadata: {calendarEventId, calendarOutcome},
              note: calendarOutcome === "RECONCILED" ?
                "Evento de Calendar reconciliado de forma idempotente." :
                undefined,
            });

            return createReviewNotification(context, transaction, {
              ...approvedReservation,
              calendarEventId,
            }, "RESERVATION_APPROVED", input.note);
          },
      );
      await sendNotificationSafely(context, createdNotification);

      return {
        reservationId: context.reservation.id,
        folio: context.reservation.folio,
        status: "CONFIRMADA_TRAS_VALIDACION",
        message: "Reserva aprobada y sincronizada con Google Calendar.",
      };
    },
);

/**
 * Rejects a pending risky reservation.
 */
export const rejectReservation = onCall(
    {
      region: REGION,
      invoker: "public",
      secrets: GOOGLE_WORKSPACE_SECRETS,
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<ReviewReservationOutput> => {
      const input = parseRejectInput(request.data);
      const context = await loadReviewContext(request);
      assertCanReview(context.profile, context.reservation);
      assertPendingReservation(context.reservation);

      const now = Timestamp.now();
      const rejectedReservation: ReservationDoc = {
        ...context.reservation,
        startAt: Timestamp.fromDate(
            context.repository.toDate(context.reservation.startAt) ??
            new Date(),
        ),
        endAt: Timestamp.fromDate(
            context.repository.toDate(context.reservation.endAt) ??
            new Date(),
        ),
        status: "RECHAZADA_POR_RESPONSABLE",
        rejectionReason: input.reason,
      };
      const createdNotification = await context.repository.runTransaction(
          async (transaction) => {
            context.repository.updateReservation(
                transaction,
                input.reservationId,
                {
                  status: "RECHAZADA_POR_RESPONSABLE",
                  statusReason: input.reason,
                  rejectedBy: context.profile.uid,
                  rejectedAt: now,
                  rejectionReason: input.reason,
                  updatedAt: now,
                },
            );
            context.logRepository.createLog(transaction, {
              reservationId: context.reservation.id,
              action: "REJECTED",
              actorUid: context.profile.uid,
              actorEmail: context.profile.email,
              previousStatus: "PENDIENTE_VALIDACION",
              newStatus: "RECHAZADA_POR_RESPONSABLE",
              note: input.reason,
            });

            return createReviewNotification(
                context,
                transaction,
                rejectedReservation,
                "RESERVATION_REJECTED",
                input.reason,
            );
          },
      );
      await sendNotificationSafely(context, createdNotification);

      return {
        reservationId: context.reservation.id,
        folio: context.reservation.folio,
        status: "RECHAZADA_POR_RESPONSABLE",
        message: "Reserva rechazada y notificada al docente.",
      };
    },
);

/**
 * Returns a short-lived signed URL for an attached protocol file.
 */
export const getReservationProtocolAccess = onCall(
    {
      region: REGION,
      invoker: "public",
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<ReservationProtocolAccessOutput> => {
      const input = parseProtocolAccessInput(request.data);
      const context = await loadProtocolAccessContext(request, input);

      assertCanAccessProtocol(context.profile, context.reservation);

      const protocolFile = findProtocolFile(
          context.reservation,
          input.storagePath,
      );
      const bucketFile = getStorage().bucket().file(protocolFile.storagePath);
      const [exists] = await bucketFile.exists();

      if (!exists) {
        throw new HttpsError(
            "not-found",
            "El archivo de protocolo no existe en Storage.",
        );
      }

      let url: string;

      try {
        [url] = await bucketFile.getSignedUrl({
          action: "read",
          expires: Date.now() + PROTOCOL_ACCESS_TTL_SECONDS * 1000,
          responseDisposition: buildInlineDisposition(protocolFile.fileName),
        });
      } catch (error) {
        logger.error("Protocol signed URL generation failed", {
          reservationId: context.reservation.id,
          labId: context.reservation.labId,
          fileName: protocolFile.fileName,
          ...toSafeErrorMetadata(error),
        });

        throw new HttpsError(
            "internal",
            [
              "No fue posible generar el acceso temporal al protocolo.",
              "Contacte a Sistemas si el problema continua.",
            ].join(" "),
        );
      }

      return {
        fileName: protocolFile.fileName,
        contentType: protocolFile.contentType,
        url,
        expiresInSeconds: PROTOCOL_ACCESS_TTL_SECONDS,
      };
    },
);

/**
 * Returns a safe, readable timeline for reservation reviewers.
 */
export const getReservationReviewLogs = onCall(
    {
      region: REGION,
      invoker: "public",
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<GetReservationReviewLogsOutput> => {
      const input = parseReviewLogsInput(request.data);
      const context = await loadReviewLogsContext(request, input);

      const allowed = canReviewReservation(
          context.profile,
          context.reservation,
      );

      logReviewLogsAccess({
        reservationId: input.reservationId,
        reservationFound: true,
        reservationLabId: context.reservation.labId,
        actorUid: context.profile.uid,
        actorRole: context.profile.role,
        labsAssignedCount: getAssignedLabIds(context.profile).length,
        allowed,
      });

      if (!allowed) {
        throw new HttpsError(
            "permission-denied",
            "No tiene permiso para consultar la bitacora de esta reserva.",
        );
      }

      const snapshot = await getFirestore()
          .collection("reservationLogs")
          .where("reservationId", "==", input.reservationId)
          .limit(100)
          .get();

      const logs = snapshot.docs
          .map((document) => toReviewTimelineItem(
              document.id,
              document.data() as ReservationLogDoc,
              context.repository,
          ))
          .sort((first, second) =>
            first.createdAt.localeCompare(second.createdAt),
          );

      logReviewLogsAccess({
        reservationId: input.reservationId,
        reservationFound: true,
        reservationLabId: context.reservation.labId,
        actorUid: context.profile.uid,
        actorRole: context.profile.role,
        labsAssignedCount: getAssignedLabIds(context.profile).length,
        allowed: true,
        logsCount: logs.length,
      });

      return {
        reservationId: input.reservationId,
        logs,
      };
    },
);

/**
 * Returns a safe, readable timeline for the reservation owner.
 */
export const getMyReservationLogs = onCall(
    {
      region: REGION,
      invoker: "public",
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<GetMyReservationLogsOutput> => {
      const input = parseMyReservationLogsInput(request.data);
      const context = await loadMyReservationLogsContext(request, input);

      if (context.reservation.teacherUid !== context.profile.uid) {
        throw new HttpsError(
            "permission-denied",
            "No tiene permiso para consultar la bitacora de esta reserva.",
        );
      }

      const snapshot = await getFirestore()
          .collection("reservationLogs")
          .where("reservationId", "==", input.reservationId)
          .limit(100)
          .get();

      const items = snapshot.docs
          .map((document) => toMyReservationTimelineItem(
              document.id,
              document.data() as ReservationLogDoc,
              context.repository,
          ))
          .sort((first, second) =>
            first.createdAt.localeCompare(second.createdAt),
          );

      return {
        reservationId: input.reservationId,
        items,
      };
    },
);

/**
 * Marks a reservation as ERROR_CALENDAR after a Calendar failure.
 *
 * @param {ReviewContext} context Review context.
 * @param {string | undefined} note Optional review note.
 * @return {Promise<ReviewReservationOutput>} Callable output.
 */
async function markCalendarError(
    context: ReviewContext,
    note?: string,
): Promise<ReviewReservationOutput> {
  const reason = [
    "No fue posible completar la operacion en Google Calendar.",
    "Admin/Sistemas debe revisar la integracion.",
  ].join(" ");
  const now = Timestamp.now();
  const calendarErrorReservation: ReservationDoc = {
    ...context.reservation,
    startAt: Timestamp.fromDate(
        context.repository.toDate(context.reservation.startAt) ??
        new Date(),
    ),
    endAt: Timestamp.fromDate(
        context.repository.toDate(context.reservation.endAt) ??
        new Date(),
    ),
    status: "ERROR_CALENDAR",
    statusReason: reason,
  };

  const createdNotification = await context.repository.runTransaction(
      async (transaction) => {
        context.repository.updateReservation(
            transaction,
            context.reservation.id,
            {
              status: "ERROR_CALENDAR",
              statusReason: reason,
              updatedAt: now,
            },
        );
        context.logRepository.createLog(transaction, {
          reservationId: context.reservation.id,
          action: "CALENDAR_ERROR",
          actorUid: context.profile.uid,
          actorEmail: context.profile.email,
          previousStatus: "PENDIENTE_VALIDACION",
          newStatus: "ERROR_CALENDAR",
          note: note ?? reason,
        });

        return createReviewNotification(
            context,
            transaction,
            calendarErrorReservation,
            "CALENDAR_ERROR",
            reason,
        );
      },
  );
  await sendNotificationSafely(context, createdNotification);

  return {
    reservationId: context.reservation.id,
    folio: context.reservation.folio,
    status: "ERROR_CALENDAR",
    message: reason,
  };
}

interface ReviewContext {
  uid: string;
  profile: AppUser;
  reservation: ReservationDoc;
  lab: LabDoc;
  systemSettings: SystemSettingsDoc | null;
  repository: ReservationRepository;
  logRepository: ReservationLogRepository;
  notificationRepository: NotificationRepository;
  deliveryService: NotificationDeliveryService;
  calendarService: GoogleCalendarService;
}

/**
 * Loads shared review context.
 *
 * @param {CallableRequest<unknown>} request Callable request.
 * @return {Promise<ReviewContext>} Review context.
 */
async function loadReviewContext(
    request: CallableRequest<unknown>,
): Promise<ReviewContext> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesion para revisar reservas.",
    );
  }

  const reservationId = (request.data as {reservationId?: unknown})
      ?.reservationId;
  if (typeof reservationId !== "string" || !reservationId.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar la reserva a revisar.",
    );
  }

  const db = getFirestore();
  const repository = new ReservationRepository(db);
  const logRepository = new ReservationLogRepository(db);
  const notificationRepository = new NotificationRepository(db);
  const deliveryService = new NotificationDeliveryService(db);
  const calendarService = new GoogleCalendarService();
  const profile = await repository.getUserProfile(uid);

  if (!profile?.active) {
    throw new HttpsError(
        "permission-denied",
        "Su perfil institucional no esta activo.",
    );
  }

  const reservation = await repository.getReservationById(reservationId);
  if (!reservation) {
    throw new HttpsError("not-found", "La reserva no existe.");
  }

  const lab = await repository.getLab(reservation.labId, undefined);
  if (!lab) {
    throw new HttpsError("not-found", "El laboratorio no existe.");
  }

  return {
    uid,
    profile,
    reservation,
    lab,
    systemSettings: await repository.getSystemSettings(),
    repository,
    logRepository,
    notificationRepository,
    deliveryService,
    calendarService,
  };
}

/**
 * Parses approve input.
 *
 * @param {unknown} data Callable data.
 * @return {object} Parsed input.
 */
function parseApproveInput(data: unknown): {
  reservationId: string;
  note?: string;
} {
  const input = data as ApproveReservationInput;
  if (typeof input?.reservationId !== "string" ||
      !input.reservationId.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar la reserva a aprobar.",
    );
  }

  return {
    reservationId: input.reservationId.trim(),
    note: input.note?.trim() || undefined,
  };
}

/**
 * Parses reject input.
 *
 * @param {unknown} data Callable data.
 * @return {{reservationId: string, reason: string}} Parsed input.
 */
function parseRejectInput(data: unknown): {
  reservationId: string;
  reason: string;
} {
  const input = data as RejectReservationInput;
  if (typeof input?.reservationId !== "string" ||
      !input.reservationId.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar la reserva a rechazar.",
    );
  }

  if (typeof input.reason !== "string" || !input.reason.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar el motivo de rechazo.",
    );
  }

  return {
    reservationId: input.reservationId.trim(),
    reason: input.reason.trim(),
  };
}

/**
 * Parses protocol access input.
 *
 * @param {unknown} data Callable data.
 * @return {{reservationId: string, storagePath: string}} Parsed input.
 */
function parseProtocolAccessInput(data: unknown): {
  reservationId: string;
  storagePath: string;
} {
  const input = data as GetReservationProtocolAccessInput;
  if (typeof input?.reservationId !== "string" ||
      !input.reservationId.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar la reserva del protocolo.",
    );
  }

  if (typeof input.storagePath !== "string" || !input.storagePath.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar el archivo de protocolo.",
    );
  }

  return {
    reservationId: input.reservationId.trim(),
    storagePath: input.storagePath.trim(),
  };
}

/**
 * Parses review logs input.
 *
 * @param {unknown} data Callable data.
 * @return {{reservationId: string}} Parsed input.
 */
function parseReviewLogsInput(data: unknown): {
  reservationId: string;
} {
  const input = data as GetReservationReviewLogsInput;
  if (typeof input?.reservationId !== "string" ||
      !input.reservationId.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar la reserva para consultar la bitacora.",
    );
  }

  return {
    reservationId: input.reservationId.trim(),
  };
}

/**
 * Parses owner reservation logs input.
 *
 * @param {unknown} data Callable data.
 * @return {{reservationId: string}} Parsed input.
 */
function parseMyReservationLogsInput(data: unknown): {
  reservationId: string;
} {
  const input = data as GetMyReservationLogsInput;
  if (typeof input?.reservationId !== "string" ||
      !input.reservationId.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar la reserva para consultar la bitacora.",
    );
  }

  return {
    reservationId: input.reservationId.trim(),
  };
}

interface ProtocolAccessContext {
  profile: AppUser;
  reservation: ReservationDoc;
}

interface ReviewLogsContext {
  profile: AppUser;
  reservation: ReservationDoc;
  repository: ReservationRepository;
}

interface MyReservationLogsContext {
  profile: AppUser;
  reservation: ReservationDoc;
  repository: ReservationRepository;
}

/**
 * Loads context required to open a protocol file.
 *
 * @param {CallableRequest<unknown>} request Callable request.
 * @param {{reservationId: string}} input Parsed input.
 * @return {Promise<ProtocolAccessContext>} Protocol context.
 */
async function loadProtocolAccessContext(
    request: CallableRequest<unknown>,
    input: {reservationId: string},
): Promise<ProtocolAccessContext> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesion para abrir el protocolo.",
    );
  }

  const repository = new ReservationRepository(getFirestore());
  const profile = await repository.getUserProfile(uid);

  if (!profile?.active) {
    throw new HttpsError(
        "permission-denied",
        "Su perfil institucional no esta activo.",
    );
  }

  const reservation = await repository.getReservationById(input.reservationId);
  if (!reservation) {
    throw new HttpsError("not-found", "La reserva no existe.");
  }

  return {profile, reservation};
}

/**
 * Loads context required to read safe review logs.
 *
 * @param {CallableRequest<unknown>} request Callable request.
 * @param {{reservationId: string}} input Parsed input.
 * @return {Promise<ReviewLogsContext>} Review logs context.
 */
async function loadReviewLogsContext(
    request: CallableRequest<unknown>,
    input: {reservationId: string},
): Promise<ReviewLogsContext> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesion para consultar la bitacora.",
    );
  }

  const repository = new ReservationRepository(getFirestore());
  const profile = await repository.getUserProfile(uid);

  if (!profile?.active) {
    throw new HttpsError(
        "permission-denied",
        "Su perfil institucional no esta activo.",
    );
  }

  const reservation = await repository.getReservationById(input.reservationId);
  if (!reservation) {
    logReviewLogsAccess({
      reservationId: input.reservationId,
      reservationFound: false,
      actorUid: profile.uid,
      actorRole: profile.role,
      labsAssignedCount: getAssignedLabIds(profile).length,
      allowed: false,
    });

    throw new HttpsError("not-found", "La reserva no existe.");
  }

  return {profile, reservation, repository};
}

/**
 * Loads context required to read personal reservation logs.
 *
 * @param {CallableRequest<unknown>} request Callable request.
 * @param {{reservationId: string}} input Parsed input.
 * @return {Promise<MyReservationLogsContext>} Personal logs context.
 */
async function loadMyReservationLogsContext(
    request: CallableRequest<unknown>,
    input: {reservationId: string},
): Promise<MyReservationLogsContext> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesion para consultar la bitacora.",
    );
  }

  const repository = new ReservationRepository(getFirestore());
  const profile = await repository.getUserProfile(uid);

  if (!profile?.active) {
    throw new HttpsError(
        "permission-denied",
        "Su perfil institucional no esta activo.",
    );
  }

  const reservation = await repository.getReservationById(input.reservationId);
  if (!reservation) {
    throw new HttpsError("not-found", "La reserva no existe.");
  }

  return {profile, reservation, repository};
}

/**
 * Validates reviewer permissions.
 *
 * @param {AppUser} profile Reviewer profile.
 * @param {ReservationDoc} reservation Reservation.
 */
function assertCanReview(profile: AppUser, reservation: ReservationDoc): void {
  if (canReviewReservation(profile, reservation)) {
    return;
  }

  throw new HttpsError(
      "permission-denied",
      "No tiene permiso para revisar esta reserva.",
  );
}

/**
 * Determines if a profile can review a reservation.
 *
 * @param {AppUser} profile Reviewer profile.
 * @param {ReservationDoc} reservation Reservation.
 * @return {boolean} True when access is allowed.
 */
function canReviewReservation(
    profile: AppUser,
    reservation: ReservationDoc,
): boolean {
  if (profile.role === "admin_sistemas") {
    return true;
  }

  if (profile.role !== "responsable_laboratorio") {
    return false;
  }

  return getAssignedLabIds(profile).includes(reservation.labId);
}

/**
 * Normalizes assigned laboratory ids from user profile.
 *
 * @param {AppUser} profile User profile.
 * @return {string[]} Assigned lab ids.
 */
function getAssignedLabIds(profile: AppUser): string[] {
  if (!Array.isArray(profile.labsAssigned)) {
    return [];
  }

  return profile.labsAssigned.filter(
      (labId): labId is string => typeof labId === "string" && labId.length > 0,
  );
}

/**
 * Writes safe diagnostics for reservation review log access.
 *
 * @param {object} details Safe diagnostic fields.
 */
function logReviewLogsAccess(details: {
  reservationId: string;
  reservationFound: boolean;
  reservationLabId?: string;
  actorUid: string;
  actorRole: string;
  labsAssignedCount: number;
  allowed: boolean;
  logsCount?: number;
}): void {
  logger.info("Reservation review logs access", details);
}

/**
 * Validates whether a user can open a reservation protocol.
 *
 * @param {AppUser} profile User profile.
 * @param {ReservationDoc} reservation Reservation.
 */
function assertCanAccessProtocol(
    profile: AppUser,
    reservation: ReservationDoc,
): void {
  if (profile.role === "admin_sistemas") {
    return;
  }

  if (
    profile.role === "responsable_laboratorio" &&
    getAssignedLabIds(profile).includes(reservation.labId)
  ) {
    return;
  }

  if (
    profile.role === "docente" &&
    reservation.teacherUid === profile.uid
  ) {
    return;
  }

  throw new HttpsError(
      "permission-denied",
      "No tiene permiso para abrir este protocolo.",
  );
}

/**
 * Converts a raw reservation log into a safe timeline item for reviewers.
 *
 * @param {string} documentId Firestore document id.
 * @param {ReservationLogDoc} log Raw reservation log.
 * @param {ReservationRepository} repository Repository for date parsing.
 * @return {ReservationReviewTimelineItem} Safe timeline item.
 */
function toReviewTimelineItem(
    documentId: string,
    log: ReservationLogDoc,
    repository: ReservationRepository,
): ReservationReviewTimelineItem {
  const text = buildTimelineText(log);
  const safeNote = toSafeTimelineNote(log.note);
  const createdAt = repository.toDate(log.createdAt)?.toISOString() ?? "";

  return {
    id: log.id || documentId,
    action: log.action,
    title: text.title,
    description: safeNote ?? text.description,
    severity: text.severity,
    createdAt,
    actorLabel: toSafeActorLabel(log),
  };
}

/**
 * Converts a raw reservation log into a safe timeline item for the owner.
 *
 * @param {string} documentId Firestore document id.
 * @param {ReservationLogDoc} log Raw reservation log.
 * @param {ReservationRepository} repository Repository for date parsing.
 * @return {MyReservationTimelineItem} Safe timeline item.
 */
function toMyReservationTimelineItem(
    documentId: string,
    log: ReservationLogDoc,
    repository: ReservationRepository,
): MyReservationTimelineItem {
  const text = buildMyReservationTimelineText(log);
  const safeNote = toSafeOwnerTimelineNote(log.note);
  const createdAt = repository.toDate(log.createdAt)?.toISOString() ?? "";

  return {
    id: log.id || documentId,
    action: log.action,
    title: text.title,
    description: safeNote ?? text.description,
    severity: text.severity,
    createdAt,
  };
}

/**
 * Builds readable title, description and severity for a log.
 *
 * @param {ReservationLogDoc} log Reservation log.
 * @return {object} Readable timeline text.
 */
function buildTimelineText(log: ReservationLogDoc): {
  title: string;
  description: string;
  severity: ReviewTimelineSeverity;
} {
  if (log.action === "STATUS_CHANGED") {
    const status = log.newStatus;
    return {
      title: status ? statusToReadableLabel(status) : "Estatus actualizado",
      description: "El estatus de la reserva fue actualizado.",
      severity: status ? severityFromStatus(status) : "info",
    };
  }

  const fallback: Record<ReservationLogDoc["action"], {
    title: string;
    description: string;
    severity: ReviewTimelineSeverity;
  }> = {
    APPROVED: {
      title: "Solicitud aprobada",
      description: "La solicitud fue aprobada por el responsable.",
      severity: "success",
    },
    AUTO_CONFIRMED: {
      title: "Reserva confirmada automaticamente",
      description: "La reserva fue confirmada automaticamente por el sistema.",
      severity: "success",
    },
    CALENDAR_ERROR: {
      title: "Error de calendario",
      description: "Hubo un problema al sincronizar con Google Calendar.",
      severity: "danger",
    },
    CALENDAR_EVENT_CANCELLED: {
      title: "Evento de calendario cancelado",
      description: "El evento asociado fue cancelado en el calendario.",
      severity: "neutral",
    },
    CALENDAR_EVENT_CREATED: {
      title: "Agendada en calendario",
      description: "El evento fue creado en el calendario institucional.",
      severity: "success",
    },
    CANCELLED: {
      title: "Reserva cancelada",
      description: "La reserva fue cancelada.",
      severity: "neutral",
    },
    CREATED: {
      title: "Solicitud registrada",
      description: "La solicitud fue recibida por el sistema.",
      severity: "info",
    },
    EMAIL_ERROR: {
      title: "Error al enviar notificacion",
      description: "No fue posible enviar una notificacion por correo.",
      severity: "warning",
    },
    EMAIL_SENT: {
      title: "Notificacion enviada",
      description: "Se envio la notificacion correspondiente.",
      severity: "info",
    },
    PENDING_APPROVAL: {
      title: "Pendiente de validacion",
      description: "La solicitud requiere revision del responsable.",
      severity: "warning",
    },
    REJECTED: {
      title: "Solicitud rechazada",
      description: "La solicitud fue rechazada por el responsable.",
      severity: "danger",
    },
    STATUS_CHANGED: {
      title: "Estatus actualizado",
      description: "El estatus de la reserva fue actualizado.",
      severity: "info",
    },
  };

  return fallback[log.action];
}

/**
 * Builds readable owner-facing text for a reservation log.
 *
 * @param {ReservationLogDoc} log Reservation log.
 * @return {object} Readable timeline text.
 */
function buildMyReservationTimelineText(log: ReservationLogDoc): {
  title: string;
  description: string;
  severity: ReviewTimelineSeverity;
} {
  if (log.action === "STATUS_CHANGED") {
    return {
      title: "Estado actualizado",
      description: "El estado de la reserva fue actualizado.",
      severity: "info",
    };
  }

  const fallback: Record<ReservationLogDoc["action"], {
    title: string;
    description: string;
    severity: ReviewTimelineSeverity;
  }> = {
    APPROVED: {
      title: "Solicitud aprobada",
      description: [
        "La solicitud fue aprobada por el responsable",
        "del laboratorio.",
      ].join(" "),
      severity: "success",
    },
    AUTO_CONFIRMED: {
      title: "Reserva confirmada",
      description: "La reserva fue confirmada automaticamente.",
      severity: "success",
    },
    CALENDAR_ERROR: {
      title: "Error de calendario",
      description: [
        "La reserva requiere revision tecnica",
        "por sincronizacion de calendario.",
      ].join(" "),
      severity: "danger",
    },
    CALENDAR_EVENT_CANCELLED: {
      title: "Evento de calendario cancelado",
      description: "El evento institucional asociado fue cancelado.",
      severity: "neutral",
    },
    CALENDAR_EVENT_CREATED: {
      title: "Agendada en calendario institucional",
      description: [
        "La reserva fue registrada en el calendario",
        "institucional del laboratorio.",
      ].join(" "),
      severity: "success",
    },
    CANCELLED: {
      title: "Reserva cancelada",
      description: "La reserva fue cancelada.",
      severity: "neutral",
    },
    CREATED: {
      title: "Solicitud registrada",
      description: "Tu solicitud fue recibida por el sistema.",
      severity: "info",
    },
    EMAIL_ERROR: {
      title: "Error de notificacion",
      description: [
        "No fue posible enviar una notificacion",
        "por correo institucional.",
      ].join(" "),
      severity: "warning",
    },
    EMAIL_SENT: {
      title: "Notificacion enviada",
      description: [
        "Se envio la notificacion correspondiente",
        "por correo institucional.",
      ].join(" "),
      severity: "success",
    },
    PENDING_APPROVAL: {
      title: "Pendiente de validacion",
      description: [
        "La solicitud esta pendiente de revision",
        "por el responsable del laboratorio.",
      ].join(" "),
      severity: "warning",
    },
    REJECTED: {
      title: "Solicitud rechazada",
      description: [
        "La solicitud fue rechazada por el responsable",
        "del laboratorio.",
      ].join(" "),
      severity: "danger",
    },
    STATUS_CHANGED: {
      title: "Estado actualizado",
      description: "El estado de la reserva fue actualizado.",
      severity: "info",
    },
  };

  return fallback[log.action];
}

/**
 * Converts official reservation status into a readable label.
 *
 * @param {ReservationStatus} status Reservation status.
 * @return {string} Readable status.
 */
function statusToReadableLabel(status: ReservationStatus): string {
  const labels: Record<ReservationStatus, string> = {
    CANCELADA: "Reserva cancelada",
    CONFIRMADA: "Reserva confirmada",
    CONFIRMADA_TRAS_VALIDACION: "Reserva aprobada",
    ERROR_CALENDAR: "Error de calendario",
    PENDIENTE_VALIDACION: "Pendiente de validacion",
    RECIBIDA: "Solicitud recibida",
    RECHAZADA_CONFLICTO: "Rechazada por conflicto",
    RECHAZADA_MIN_ANTICIPACION: "Rechazada por anticipacion minima",
    RECHAZADA_POR_RESPONSABLE: "Rechazada por responsable",
    RECHAZADA_REGLA_HORARIO: "Rechazada por regla de horario",
  };

  return labels[status];
}

/**
 * Maps reservation status to visual severity.
 *
 * @param {ReservationStatus} status Reservation status.
 * @return {ReviewTimelineSeverity} Timeline severity.
 */
function severityFromStatus(
    status: ReservationStatus,
): ReviewTimelineSeverity {
  if (status === "CONFIRMADA" ||
      status === "CONFIRMADA_TRAS_VALIDACION") {
    return "success";
  }

  if (status === "PENDIENTE_VALIDACION" || status === "RECIBIDA") {
    return "warning";
  }

  if (status === "CANCELADA") {
    return "neutral";
  }

  return "danger";
}

/**
 * Keeps only safe human notes for the reviewer timeline.
 *
 * @param {string | undefined} note Raw note.
 * @return {string | undefined} Safe note.
 */
function toSafeTimelineNote(note?: string): string | undefined {
  if (typeof note !== "string") {
    return undefined;
  }

  const trimmed = note.trim();
  if (!trimmed) {
    return undefined;
  }

  const unsafePattern =
    /[{}`]|protocolUploads\/|labImages\/|storagePath|calendarId|stack/i;
  if (unsafePattern.test(trimmed)) {
    return undefined;
  }

  return trimmed.length > 260 ? `${trimmed.slice(0, 257)}...` : trimmed;
}

/**
 * Keeps only safe human notes for the reservation owner timeline.
 *
 * @param {string | undefined} note Raw note.
 * @return {string | undefined} Safe note.
 */
function toSafeOwnerTimelineNote(note?: string): string | undefined {
  const safeNote = toSafeTimelineNote(note);
  if (!safeNote) {
    return undefined;
  }

  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  if (emailPattern.test(safeNote)) {
    return undefined;
  }

  return safeNote;
}

/**
 * Returns a non-sensitive actor label.
 *
 * @param {ReservationLogDoc} log Reservation log.
 * @return {string | undefined} Actor label.
 */
function toSafeActorLabel(log: ReservationLogDoc): string | undefined {
  if (log.action === "CREATED") {
    return "Docente";
  }

  if (log.action === "APPROVED" || log.action === "REJECTED") {
    return "Responsable";
  }

  if (
    log.action === "AUTO_CONFIRMED" ||
    log.action === "PENDING_APPROVAL" ||
    log.action === "CALENDAR_EVENT_CREATED" ||
    log.action === "CALENDAR_EVENT_CANCELLED" ||
    log.action === "CALENDAR_ERROR" ||
    log.action === "EMAIL_SENT" ||
    log.action === "EMAIL_ERROR" ||
    log.action === "STATUS_CHANGED"
  ) {
    return "Sistema";
  }

  if (log.action === "CANCELLED") {
    return "Usuario institucional";
  }

  if (log.actorUid || log.actorEmail) {
    return "Sistema";
  }

  return undefined;
}

/**
 * Finds a protocol file that belongs exactly to the reservation.
 *
 * @param {ReservationDoc} reservation Reservation.
 * @param {string} storagePath Requested storage path.
 * @return {ProtocolFile} Matching protocol file.
 */
function findProtocolFile(
    reservation: ReservationDoc,
    storagePath: string,
): ProtocolFile {
  const protocolFile = (reservation.protocolFiles ?? []).find(
      (file) => file.storagePath === storagePath,
  );

  if (!protocolFile) {
    throw new HttpsError(
        "permission-denied",
        "El archivo solicitado no pertenece a esta reserva.",
    );
  }

  return protocolFile;
}

/**
 * Builds a safe inline content disposition for signed URLs.
 *
 * @param {string} fileName File name.
 * @return {string} Content disposition value.
 */
function buildInlineDisposition(fileName: string): string {
  const safeFileName = fileName.replace(/["\\]/g, "");
  return `inline; filename="${safeFileName}"`;
}

/**
 * Validates pending status.
 *
 * @param {ReservationDoc} reservation Reservation.
 */
function assertPendingReservation(reservation: ReservationDoc): void {
  if (reservation.status !== "PENDIENTE_VALIDACION") {
    throw new HttpsError(
        "failed-precondition",
        "Solo se pueden revisar reservas pendientes de validacion.",
    );
  }
}

/**
 * Validates protocol files if the reservation required them.
 *
 * @param {ReservationDoc} reservation Reservation.
 */
async function assertProtocolFilesExist(
    reservation: ReservationDoc,
): Promise<void> {
  const protocolRequired = reservation.protocolRequired ||
    reservation.risky ||
    reservation.externalParticipants;

  if (!protocolRequired) {
    return;
  }

  if (!reservation.protocolFiles.length) {
    throw new HttpsError(
        "failed-precondition",
        "La reserva requiere protocolo y no tiene archivos vinculados.",
    );
  }

  const bucket = getStorage().bucket();
  for (const file of reservation.protocolFiles) {
    const [exists] = await bucket.file(file.storagePath).exists();
    if (!exists) {
      throw new HttpsError(
          "failed-precondition",
          `No existe el archivo de protocolo: ${file.fileName}.`,
      );
    }
  }
}

/**
 * Validates internal Firestore conflicts excluding the reviewed reservation.
 *
 * @param {ReviewContext} context Review context.
 * @param {Date} startAt Start date.
 * @param {Date} endAt End date.
 * @param {string} reservationId Reservation to exclude.
 */
async function assertNoInternalConflict(
    context: ReviewContext,
    startAt: Date,
    endAt: Date,
): Promise<void> {
  const conflicts = await context.repository.runTransaction((transaction) =>
    context.repository.findBlockingConflicts(
        transaction,
        context.reservation.labId,
        startAt,
        endAt,
        context.reservation.id,
    ),
  );

  if (conflicts.length) {
    throw new HttpsError(
        "failed-precondition",
        "Existe una reserva traslapada para este laboratorio.",
    );
  }
}

/**
 * Validates configured blocked periods before approval.
 *
 * @param {ReviewContext} context Review context.
 * @param {Date} startAt Start date.
 * @param {Date} endAt End date.
 */
async function assertNoBlockedPeriodConflict(
    context: ReviewContext,
    startAt: Date,
    endAt: Date,
): Promise<void> {
  const blockedPeriods = await context.repository.findActiveBlockedPeriods(
      context.reservation.labId,
      startAt,
      endAt,
  );

  if (blockedPeriods.length) {
    throw new HttpsError(
        "failed-precondition",
        [
          "El horario solicitado esta bloqueado",
          "por una restriccion institucional.",
        ].join(" "),
    );
  }
}

/**
 * Validates external Google Calendar conflicts.
 *
 * @param {LabDoc} lab Laboratory.
 * @param {Date} startAt Start date.
 * @param {Date} endAt End date.
 * @param {string} reservationId Reservation to exclude.
 */
async function assertNoExternalConflict(
    lab: LabDoc,
    startAt: Date,
    endAt: Date,
    reservationId: string,
): Promise<void> {
  const externalConflict = await checkExternalCalendarConflicts({
    calendarId: lab.calendarId,
    startAt,
    endAt,
    excludeReservationId: reservationId,
  });

  if (externalConflict.hasConflict) {
    throw new HttpsError(
        "failed-precondition",
        "El laboratorio ya tiene un evento ocupado en Google Calendar.",
    );
  }
}

/**
 * Creates the review notification inside a transaction.
 *
 * @param {ReviewContext} context Review context.
 * @param {Transaction} transaction Firestore transaction.
 * @param {ReservationDoc} reservation Reservation.
 * @param {NotificationType} type Notification type.
 * @param {string | undefined} reason Optional reason.
 * @return {CreatedNotification} Notification metadata.
 */
function createReviewNotification(
    context: ReviewContext,
    transaction: Transaction,
    reservation: ReservationDoc,
    type: NotificationType,
    reason?: string,
): CreatedNotification {
  const template = buildReservationEmailTemplate({
    type,
    reservation,
    lab: context.lab,
    reason,
  });

  return context.notificationRepository.createPendingNotification(transaction, {
    reservationId: reservation.id,
    type,
    to: resolveNotificationRecipients(
        type,
        reservation,
        context.lab,
        context.systemSettings,
    ),
    subject: template.subject,
    body: template.body,
    htmlBody: template.htmlBody,
  });
}

/**
 * Sends notification without changing the reservation status on email errors.
 *
 * @param {ReviewContext} context Review context.
 * @param {CreatedNotification} notification Notification metadata.
 */
async function sendNotificationSafely(
    context: ReviewContext,
    notification: CreatedNotification,
): Promise<void> {
  try {
    await context.deliveryService.sendNotification(notification.notification);
  } catch (error) {
    logger.error("Review email delivery failed", {
      reservationId: context.reservation.id,
      notificationId: notification.id,
      ...toSafeErrorMetadata(error),
    });
  }
}

/**
 * Resolves recipients for review notifications.
 *
 * @param {NotificationType} type Notification type.
 * @param {ReservationDoc} reservation Reservation.
 * @param {LabDoc} lab Laboratory.
 * @param {SystemSettingsDoc | null} systemSettings Global settings.
 * @return {string[]} Recipients.
 */
function resolveNotificationRecipients(
    type: NotificationType,
    reservation: ReservationDoc,
    lab: LabDoc,
    systemSettings: SystemSettingsDoc | null,
): string[] {
  if (type === "CALENDAR_ERROR" || type === "TECHNICAL_ERROR") {
    return uniqueEmails([
      ...(systemSettings?.adminEmails ?? []),
      ...lab.defaultNotifyEmails,
      reservation.teacherEmail,
    ]);
  }

  return uniqueEmails([
    reservation.teacherEmail,
    ...lab.responsibleEmails,
    ...lab.defaultNotifyEmails,
  ]);
}

/**
 * Returns unique non-empty email strings.
 *
 * @param {string[]} emails Candidate emails.
 * @return {string[]} Unique emails.
 */
function uniqueEmails(emails: string[]): string[] {
  return [...new Set(
      emails
          .map((email) => email.trim())
          .filter((email) => email.length > 0),
  )];
}

/**
 * Logs a safe review error.
 *
 * @param {string} operation Operation.
 * @param {unknown} error Error.
 * @param {ReviewContext} context Review context.
 */
function logReviewError(
    operation: string,
    error: unknown,
    context: ReviewContext,
): void {
  logger.error("Reservation review operation failed", {
    operation,
    reservationId: context.reservation.id,
    labId: context.lab.id,
    ...toSafeErrorMetadata(error),
  });
}

/**
 * Extracts non-sensitive error metadata.
 *
 * @param {unknown} error Error object.
 * @return {Record<string, unknown>} Safe metadata.
 */
function toSafeErrorMetadata(error: unknown): Record<string, unknown> {
  const record = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    response?: {
      status?: unknown;
      statusText?: unknown;
      data?: {
        error?: unknown;
        error_description?: unknown;
        message?: unknown;
      };
    };
  };

  return {
    errorName: typeof record.name === "string" ? record.name : undefined,
    errorMessage: typeof record.message === "string" ?
      record.message :
      undefined,
    errorCode: record.code,
    httpStatus: record.status ?? record.response?.status,
    httpStatusText: record.response?.statusText,
    googleError: record.response?.data?.error,
    googleErrorDescription: record.response?.data?.error_description,
    googleMessage: record.response?.data?.message,
  };
}
