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
        await assertNoExternalConflict(context.lab, startAt, endAt);
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

      try {
        calendarEventId = await context.calendarService
            .createReservationEvent({
              lab: context.lab,
              reservation: approvedReservation,
            });
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
              metadata: {calendarEventId},
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

interface ProtocolAccessContext {
  profile: AppUser;
  reservation: ReservationDoc;
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
 * Validates reviewer permissions.
 *
 * @param {AppUser} profile Reviewer profile.
 * @param {ReservationDoc} reservation Reservation.
 */
function assertCanReview(profile: AppUser, reservation: ReservationDoc): void {
  if (profile.role === "admin_sistemas") {
    return;
  }

  if (
    profile.role === "responsable_laboratorio" &&
    profile.labsAssigned.includes(reservation.labId)
  ) {
    return;
  }

  throw new HttpsError(
      "permission-denied",
      "No tiene permiso para revisar esta reserva.",
  );
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
    profile.labsAssigned.includes(reservation.labId)
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
 */
async function assertNoExternalConflict(
    lab: LabDoc,
    startAt: Date,
    endAt: Date,
): Promise<void> {
  const externalConflict = await checkExternalCalendarConflicts({
    calendarId: lab.calendarId,
    startAt,
    endAt,
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
