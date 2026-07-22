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

import {
  CalendarDeleteResult,
  GoogleCalendarService,
} from "../calendar/google-calendar.service";
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
  ReservationDoc,
  ReservationStatus,
  SystemSettingsDoc,
} from "../../shared/models";
import {ReservationRepository} from "./reservation.repository";
import {buildCancellationReasonTransition} from
  "./reservation-transition-reasons.utils";

const REGION = "us-central1";

type CancelableStatus =
  | "PENDIENTE_VALIDACION"
  | "CONFIRMADA"
  | "CONFIRMADA_TRAS_VALIDACION"
  | "ERROR_CALENDAR";

interface CancelReservationInput {
  reservationId?: string;
  reason?: string;
}

interface CancelReservationOutput {
  reservationId: string;
  folio: string;
  status: "CANCELADA";
  message: string;
}

interface CancelContext {
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
 * Cancels a future reservation through controlled backend validation.
 */
export const cancelReservation = onCall(
    {
      region: REGION,
      invoker: "public",
      secrets: GOOGLE_WORKSPACE_SECRETS,
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<CancelReservationOutput> => {
      const input = parseCancelInput(request.data);
      const context = await loadCancelContext(request);
      const startAt = context.repository.toDate(context.reservation.startAt);
      const previousStatus = context.reservation.status;

      assertCanCancel(context.profile, context.reservation);
      assertCancelableStatus(context.profile, context.reservation);

      if (!startAt) {
        throw new HttpsError(
            "failed-precondition",
            "La fecha de la reserva no es valida.",
        );
      }

      if (startAt.getTime() <= Date.now()) {
        throw new HttpsError(
            "failed-precondition",
            "Solo se pueden cancelar reservas futuras.",
        );
      }

      const calendarDeleteResult = await deleteCalendarEventOrFail(context);

      const now = Timestamp.now();
      const cancellationReason = buildCancellationReasonTransition(
          input.reason,
      );
      const cancelledReservation: ReservationDoc = {
        ...context.reservation,
        status: "CANCELADA",
        statusReason: undefined,
        cancelledBy: context.profile.uid,
        cancelledAt: now,
        cancellationReason: cancellationReason.cancellationReason,
        updatedAt: now,
      };
      const createdNotification = await context.repository.runTransaction(
          async (transaction) => {
            context.repository.updateReservation(
                transaction,
                input.reservationId,
                {
                  status: "CANCELADA",
                  cancelledBy: context.profile.uid,
                  cancelledAt: now,
                  cancellationReason:
                    cancellationReason.cancellationReason,
                  updatedAt: now,
                },
                cancellationReason.fieldsToDelete,
            );
            context.logRepository.createLog(transaction, {
              reservationId: context.reservation.id,
              action: "CANCELLED",
              actorUid: context.profile.uid,
              actorEmail: context.profile.email,
              previousStatus,
              newStatus: "CANCELADA",
              note: cancellationReason.logNote,
            });

            if (calendarDeleteResult.outcome === "DELETED") {
              context.logRepository.createLog(transaction, {
                reservationId: context.reservation.id,
                action: "CALENDAR_EVENT_CANCELLED",
                actorUid: context.profile.uid,
                actorEmail: context.profile.email,
                previousStatus,
                newStatus: "CANCELADA",
                metadata: {
                  calendarEventId: calendarDeleteResult.eventId,
                },
              });
            }

            return createCancellationNotification(
                context,
                transaction,
                cancelledReservation,
                cancellationReason.notificationReason,
            );
          },
      );

      await sendNotificationSafely(context, createdNotification);

      return {
        reservationId: context.reservation.id,
        folio: context.reservation.folio,
        status: "CANCELADA",
        message: "Reserva cancelada correctamente.",
      };
    },
);

/**
 * Parses cancelReservation input.
 *
 * @param {unknown} data Callable payload.
 * @return {object} Parsed input.
 */
function parseCancelInput(data: unknown): {
  reservationId: string;
  reason?: string;
} {
  const input = data as CancelReservationInput;
  if (typeof input?.reservationId !== "string" ||
      !input.reservationId.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar la reserva a cancelar.",
    );
  }

  const reason = typeof input.reason === "string" ?
    input.reason.trim() :
    "";

  if (reason.length > 500) {
    throw new HttpsError(
        "invalid-argument",
        "El motivo de cancelacion no debe exceder 500 caracteres.",
    );
  }

  return {
    reservationId: input.reservationId.trim(),
    reason: reason || undefined,
  };
}

/**
 * Loads cancellation context.
 *
 * @param {CallableRequest<unknown>} request Callable request.
 * @return {Promise<CancelContext>} Cancellation context.
 */
async function loadCancelContext(
    request: CallableRequest<unknown>,
): Promise<CancelContext> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesion para cancelar reservas.",
    );
  }

  const reservationId = (request.data as {reservationId?: unknown})
      ?.reservationId;
  if (typeof reservationId !== "string" || !reservationId.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar la reserva a cancelar.",
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

  const reservation = await repository.getReservationById(
      reservationId.trim(),
  );
  if (!reservation) {
    throw new HttpsError("not-found", "La reserva no existe.");
  }

  const lab = await repository.getLab(reservation.labId, undefined);
  if (!lab) {
    throw new HttpsError("not-found", "El laboratorio no existe.");
  }

  return {
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
 * Validates role and ownership permissions.
 *
 * @param {AppUser} profile User profile.
 * @param {ReservationDoc} reservation Reservation.
 */
function assertCanCancel(
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
      "No tiene permiso para cancelar esta reserva.",
  );
}

/**
 * Validates whether current status can be cancelled by this role.
 *
 * @param {AppUser} profile User profile.
 * @param {ReservationDoc} reservation Reservation.
 */
function assertCancelableStatus(
    profile: AppUser,
    reservation: ReservationDoc,
): void {
  if (reservation.status === "ERROR_CALENDAR") {
    if (
      profile.role === "admin_sistemas" ||
      (
        profile.role === "responsable_laboratorio" &&
        profile.labsAssigned.includes(reservation.labId)
      )
    ) {
      return;
    }

    throw new HttpsError(
        "permission-denied",
        [
          "Una reserva con error de calendario debe ser atendida",
          "por el equipo responsable.",
        ].join(" "),
    );
  }

  if (!isCancelableStatus(reservation.status)) {
    throw new HttpsError(
        "failed-precondition",
        "Esta reserva ya no puede cancelarse.",
    );
  }
}

/**
 * Checks regular cancelable reservation statuses.
 *
 * @param {ReservationStatus} status Reservation status.
 * @return {boolean} Whether status is cancelable.
 */
function isCancelableStatus(status: ReservationStatus): status is
  CancelableStatus {
  return [
    "PENDIENTE_VALIDACION",
    "CONFIRMADA",
    "CONFIRMADA_TRAS_VALIDACION",
  ].includes(status);
}

/**
 * Deletes Calendar event or writes a controlled Calendar error log.
 *
 * @param {CancelContext} context Cancellation context.
 */
async function deleteCalendarEventOrFail(
    context: CancelContext,
): Promise<CalendarDeleteResult> {
  try {
    return await context.calendarService.deleteReservationEvent({
      lab: context.lab,
      reservation: context.reservation,
    });
  } catch (error) {
    if (isCalendarEventAlreadyDeleted(error)) {
      logger.warn("Reservation Calendar event was already deleted", {
        reservationId: context.reservation.id,
        labId: context.lab.id,
        calendarEventId: context.reservation.calendarEventId,
        ...toSafeErrorMetadata(error),
      });
      return {
        eventId: context.reservation.calendarEventId ?? null,
        outcome: "ABSENT",
      };
    }

    logger.error("Reservation cancellation Calendar delete failed", {
      reservationId: context.reservation.id,
      labId: context.lab.id,
      ...toSafeErrorMetadata(error),
    });
    await context.logRepository.createLogDocument({
      reservationId: context.reservation.id,
      action: "CALENDAR_ERROR",
      actorUid: context.profile.uid,
      actorEmail: context.profile.email,
      previousStatus: context.reservation.status,
      note: "No fue posible cancelar el evento en Google Calendar.",
      metadata: toSafeErrorMetadata(error),
    });

    throw new HttpsError(
        "failed-precondition",
        [
          "No fue posible cancelar el evento en Google Calendar.",
          "Intente mas tarde o contacte a Admin/Sistemas.",
        ].join(" "),
    );
  }
}

/**
 * Checks Calendar errors that mean the external event is already gone.
 *
 * @param {unknown} error Calendar API error.
 * @return {boolean} Whether cancellation can continue.
 */
function isCalendarEventAlreadyDeleted(error: unknown): boolean {
  const metadata = toSafeErrorMetadata(error);
  const status = metadata.httpStatus ?? metadata.errorCode;
  const googleError = metadata.googleError as {
    code?: unknown;
    message?: unknown;
    errors?: Array<{reason?: unknown}>;
  } | undefined;
  const reason = googleError?.errors?.[0]?.reason;

  return (
    status === 404 ||
    status === 410 ||
    googleError?.code === 404 ||
    googleError?.code === 410 ||
    reason === "notFound" ||
    reason === "deleted"
  );
}

/**
 * Creates cancellation notification inside the transaction.
 *
 * @param {CancelContext} context Cancellation context.
 * @param {Transaction} transaction Firestore transaction.
 * @param {ReservationDoc} reservation Cancelled reservation snapshot.
 * @param {string | undefined} reason Optional cancellation reason.
 * @return {CreatedNotification} Notification metadata.
 */
function createCancellationNotification(
    context: CancelContext,
    transaction: Transaction,
    reservation: ReservationDoc,
    reason?: string,
): CreatedNotification {
  const template = buildReservationEmailTemplate({
    type: "RESERVATION_CANCELLED",
    reservation,
    lab: context.lab,
    reason,
  });

  return context.notificationRepository.createPendingNotification(transaction, {
    reservationId: reservation.id,
    type: "RESERVATION_CANCELLED",
    to: resolveCancellationRecipients(
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
 * Sends notification without blocking cancellation on email errors.
 *
 * @param {CancelContext} context Cancellation context.
 * @param {CreatedNotification} notification Notification metadata.
 */
async function sendNotificationSafely(
    context: CancelContext,
    notification: CreatedNotification,
): Promise<void> {
  try {
    await context.deliveryService.sendNotification(notification.notification);
  } catch (error) {
    logger.error("Cancellation email delivery failed", {
      reservationId: context.reservation.id,
      notificationId: notification.id,
      ...toSafeErrorMetadata(error),
    });
  }
}

/**
 * Resolves recipients for cancellation emails.
 *
 * @param {ReservationDoc} reservation Reservation.
 * @param {LabDoc} lab Laboratory.
 * @param {SystemSettingsDoc | null} systemSettings Global settings.
 * @return {string[]} Recipients.
 */
function resolveCancellationRecipients(
    reservation: ReservationDoc,
    lab: LabDoc,
    systemSettings: SystemSettingsDoc | null,
): string[] {
  return uniqueEmails([
    reservation.teacherEmail,
    ...lab.responsibleEmails,
    ...lab.defaultNotifyEmails,
    ...(systemSettings?.adminEmails ?? []),
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
