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
  checkExternalCalendarConflicts,
} from "../calendar/calendar-availability.service";
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
  LabDoc,
  ProtocolFile,
  ReservationDoc,
  ReservationStatus,
  SystemSettingsDoc,
} from "../../shared/models";
import {ReservationRepository} from "./reservation.repository";
import {
  CreateReservationInput,
  CreateReservationOutput,
  ProtocolFileInput,
  RejectionDecision,
} from "./reservation.types";
import {
  generateReservationFolio,
  toTimestamp,
} from "./reservation.utils";
import {
  parseCreateReservationInput,
  parseReservationDates,
  validateLab,
  validateProtocolFiles,
  validateReservationTiming,
  validateUserProfile,
} from "./reservation.validators";

const REGION = "us-central1";

/**
 * Creates a reservation with backend validation.
 */
export const createReservation = onCall(
    {
      region: REGION,
      invoker: "public",
      secrets: GOOGLE_WORKSPACE_SECRETS,
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<CreateReservationOutput> => {
      const uid = request.auth?.uid;
      const email = request.auth?.token.email as string | undefined;

      if (!uid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para reservar.",
        );
      }

      const input = parseCreateReservationInput(request.data);
      const db = getFirestore();
      const reservationRepository = new ReservationRepository(db);
      const logRepository = new ReservationLogRepository(db);
      const notificationRepository = new NotificationRepository(db);
      const notificationDeliveryService =
        new NotificationDeliveryService(db);
      const calendarService = new GoogleCalendarService();

      const profile = await reservationRepository.getUserProfile(uid);
      validateUserProfile(profile, email);

      if (!profile) {
        throw new HttpsError("permission-denied", "Perfil no disponible.");
      }

      const lab = await reservationRepository.getLab(
          input.labId,
          input.labSlug,
      );
      validateLab(lab);

      if (!lab) {
        throw new HttpsError("not-found", "Laboratorio no disponible.");
      }
      const systemSettings = await reservationRepository.getSystemSettings();

      const {startAt, endAt} = parseReservationDates(input);
      validateProtocolFiles(input, lab, uid);

      const timingRejection = validateReservationTiming(
          input,
          lab,
          startAt,
          endAt,
          new Date(),
      );

      let rejectionDecision = timingRejection;
      let calendarErrorReason: string | undefined;

      if (!rejectionDecision) {
        const conflicts = await reservationRepository.runTransaction(
            (transaction) => reservationRepository.findBlockingConflicts(
                transaction,
                lab.id,
                startAt,
                endAt,
            ),
        );

        if (conflicts.length) {
          rejectionDecision = {
            status: "RECHAZADA_CONFLICTO",
            reason: "Existe una reserva traslapada para este laboratorio.",
          };
        }
      }

      if (!rejectionDecision) {
        try {
          const externalConflict = await checkExternalCalendarConflicts({
            calendarId: lab.calendarId,
            startAt,
            endAt,
          });

          if (externalConflict.hasConflict) {
            rejectionDecision = {
              status: "RECHAZADA_CONFLICTO",
              reason: [
                "El laboratorio ya tiene un evento ocupado",
                "en Google Calendar para ese horario.",
              ].join(" "),
            };
          }
        } catch (error) {
          logCalendarError("validate_external_availability", error, lab);
          calendarErrorReason = [
            "No fue posible validar Google Calendar.",
            "Admin/Sistemas debe revisar la integracion.",
          ].join(" ");
        }
      }

      const reservationRef = reservationRepository.createReservationRef();
      const folio = generateReservationFolio(new Date());
      let calendarEventId: string | null = null;

      if (
        !rejectionDecision &&
        !calendarErrorReason &&
        !requiresManualReview(input)
      ) {
        try {
          const draftReservation = buildReservation(
              reservationRepository,
              reservationRef.id,
              folio,
              input,
              lab,
              {
                uid,
                email: profile.email,
                displayName: profile.displayName,
              },
              startAt,
              endAt,
              "CONFIRMADA",
              undefined,
              null,
          );
          calendarEventId = await calendarService.createReservationEvent({
            lab,
            reservation: draftReservation,
          });
        } catch (error) {
          logCalendarError("create_calendar_event", error, lab);
          calendarErrorReason = [
            "Hubo un error tecnico al crear el evento",
            "en Google Calendar.",
          ].join(" ");
        }
      }

      const createdNotification: { value: CreatedNotification | null } = {
        value: null,
      };
      const output = await reservationRepository.runTransaction(
          async (transaction) => {
            const status = calendarErrorReason ?
              "ERROR_CALENDAR" :
              resolveStatus(input, rejectionDecision);
            const reservation = buildReservation(
                reservationRepository,
                reservationRef.id,
                folio,
                input,
                lab,
                {
                  uid,
                  email: profile.email,
                  displayName: profile.displayName,
                },
                startAt,
                endAt,
                status,
                calendarErrorReason ?? rejectionDecision?.reason,
                calendarEventId,
            );

            reservationRepository.createReservation(
                transaction,
                reservationRef,
                reservation,
            );
            createLogs(
                logRepository,
                transaction,
                reservation,
                profile.email,
                rejectionDecision,
                calendarErrorReason,
            );
            createdNotification.value = createNotification(
                notificationRepository,
                transaction,
                reservation,
                lab,
                systemSettings,
                rejectionDecision,
                calendarErrorReason,
            );

            return {
              reservationId: reservation.id,
              folio: reservation.folio,
              status: reservation.status,
              message: getOutputMessage(
                  reservation.status,
                  rejectionDecision,
                  calendarErrorReason,
              ),
            };
          },
      );

      if (createdNotification.value) {
        try {
          await notificationDeliveryService.sendNotification(
              createdNotification.value.notification,
          );
        } catch (error) {
          logger.error("Email notification delivery failed", {
            reservationId: createdNotification.value.notification
                .reservationId,
            notificationId: createdNotification.value.id,
            ...toSafeErrorMetadata(error),
          });
        }
      }

      return output;
    },
);

/**
 * Resolves final reservation status.
 *
 * @param {CreateReservationInput} input Input.
 * @param {RejectionDecision | null} rejection Rejection decision.
 * @return {ReservationStatus} Status.
 */
function resolveStatus(
    input: CreateReservationInput,
    rejection: RejectionDecision | null,
): ReservationStatus {
  if (rejection) {
    return rejection.status;
  }

  return requiresManualReview(input) ? "PENDIENTE_VALIDACION" : "CONFIRMADA";
}

/**
 * Checks whether the reservation must be reviewed before confirmation.
 *
 * @param {CreateReservationInput} input Create reservation input.
 * @return {boolean} Whether manual review is required.
 */
function requiresManualReview(input: CreateReservationInput): boolean {
  return input.risky || input.externalParticipants;
}

/**
 * Builds the reservation document.
 *
 * @param {ReservationRepository} repository Reservation repository.
 * @param {string} id Reservation id.
 * @param {string} folio Reservation folio.
 * @param {CreateReservationInput} input Callable input.
 * @param {LabDoc} lab Laboratory.
 * @param {{uid: string, email: string, displayName: string}} user User data.
 * @param {Date} startAt Reservation start.
 * @param {Date} endAt Reservation end.
 * @param {ReservationStatus} status Reservation status.
 * @param {string | undefined} statusReason Status reason.
 * @param {string | null} calendarEventId Google Calendar event id.
 * @return {ReservationDoc} Reservation document.
 */
function buildReservation(
    repository: ReservationRepository,
    id: string,
    folio: string,
    input: CreateReservationInput,
    lab: LabDoc,
    user: { uid: string; email: string; displayName: string },
    startAt: Date,
    endAt: Date,
    status: ReservationStatus,
    statusReason: string | undefined,
    calendarEventId: string | null,
): ReservationDoc {
  const now = Timestamp.now();

  return repository.buildReservationDoc({
    id,
    folio,
    labId: lab.id,
    labName: lab.name,
    teacherUid: user.uid,
    teacherName: user.displayName,
    teacherEmail: user.email,
    subject: input.subject,
    group: input.group,
    practiceName: input.practiceName,
    objective: input.objective,
    materialRequired: input.materialRequired,
    practiceType: input.practiceType,
    practiceTypeOther: input.practiceTypeOther,
    risky: input.risky,
    externalParticipants: input.externalParticipants,
    protocolRequired: input.risky || input.externalParticipants,
    protocolFiles: toProtocolFiles(input.protocolFiles ?? []),
    startAt: toTimestamp(startAt.toISOString()),
    endAt: toTimestamp(endAt.toISOString()),
    status,
    statusReason,
    calendarEventId,
    createdAt: now,
    updatedAt: now,
    source: input.source,
  });
}

/**
 * Converts callable protocol metadata to reservation protocol files.
 *
 * @param {ProtocolFileInput[]} files Protocol file inputs.
 * @return {ProtocolFile[]} Reservation protocol files.
 */
function toProtocolFiles(files: ProtocolFileInput[]): ProtocolFile[] {
  return files.map((file) => ({
    storagePath: file.storagePath,
    fileName: file.fileName,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    uploadedByUid: file.uploadedByUid,
    uploadedAt: toTimestamp(file.uploadedAt),
  }));
}

/**
 * Creates reservation log entries.
 *
 * @param {ReservationLogRepository} repository Log repository.
 * @param {Transaction} transaction Transaction.
 * @param {ReservationDoc} reservation Reservation.
 * @param {string} actorEmail Actor email.
 * @param {RejectionDecision | null} rejection Rejection decision.
 * @param {string | undefined} calendarErrorReason Calendar error reason.
 */
function createLogs(
    repository: ReservationLogRepository,
    transaction: Transaction,
    reservation: ReservationDoc,
    actorEmail: string,
    rejection: RejectionDecision | null,
    calendarErrorReason: string | undefined,
): void {
  repository.createLog(transaction, {
    reservationId: reservation.id,
    action: "CREATED",
    actorUid: reservation.teacherUid,
    actorEmail,
    newStatus: reservation.status,
  });

  if (reservation.status === "CONFIRMADA") {
    repository.createLog(transaction, {
      reservationId: reservation.id,
      action: "AUTO_CONFIRMED",
      actorUid: reservation.teacherUid,
      actorEmail,
      newStatus: reservation.status,
    });
    repository.createLog(transaction, {
      reservationId: reservation.id,
      action: "CALENDAR_EVENT_CREATED",
      actorUid: reservation.teacherUid,
      actorEmail,
      newStatus: reservation.status,
      metadata: {
        calendarEventId: reservation.calendarEventId ?? null,
      },
    });
    return;
  }

  if (reservation.status === "ERROR_CALENDAR") {
    repository.createLog(transaction, {
      reservationId: reservation.id,
      action: "CALENDAR_ERROR",
      actorUid: reservation.teacherUid,
      actorEmail,
      newStatus: reservation.status,
      note: calendarErrorReason,
    });
    return;
  }

  if (reservation.status === "PENDIENTE_VALIDACION") {
    repository.createLog(transaction, {
      reservationId: reservation.id,
      action: "PENDING_APPROVAL",
      actorUid: reservation.teacherUid,
      actorEmail,
      newStatus: reservation.status,
    });
    return;
  }

  repository.createLog(transaction, {
    reservationId: reservation.id,
    action: "STATUS_CHANGED",
    actorUid: reservation.teacherUid,
    actorEmail,
    newStatus: reservation.status,
    note: rejection?.reason,
  });
}

/**
 * Creates a pending notification record.
 *
 * @param {NotificationRepository} repository Notification repository.
 * @param {Transaction} transaction Transaction.
 * @param {ReservationDoc} reservation Reservation.
 * @param {LabDoc} lab Laboratory.
 * @param {SystemSettingsDoc | null} systemSettings Global settings.
 * @param {RejectionDecision | null} rejection Rejection decision.
 * @param {string | undefined} calendarErrorReason Calendar error reason.
 * @return {CreatedNotification} Created notification.
 */
function createNotification(
    repository: NotificationRepository,
    transaction: Transaction,
    reservation: ReservationDoc,
    lab: LabDoc,
    systemSettings: SystemSettingsDoc | null,
    rejection: RejectionDecision | null,
    calendarErrorReason: string | undefined,
): CreatedNotification {
  const type = reservation.status === "CONFIRMADA" ?
    "RESERVATION_CONFIRMED" :
    reservation.status === "PENDIENTE_VALIDACION" ?
      "RESERVATION_PENDING_APPROVAL" :
      reservation.status === "ERROR_CALENDAR" ?
        "CALENDAR_ERROR" :
        "RESERVATION_REJECTED";
  const template = buildReservationEmailTemplate({
    type,
    reservation,
    lab,
    reason: calendarErrorReason ?? rejection?.reason,
  });

  return repository.createPendingNotification(transaction, {
    reservationId: reservation.id,
    type,
    to: resolveNotificationRecipients(
        type,
        reservation,
        lab,
        systemSettings,
    ),
    subject: template.subject,
    body: template.body,
    htmlBody: template.htmlBody,
  });
}

/**
 * Resolves notification recipients without exposing protocols publicly.
 *
 * @param {string} type Notification type.
 * @param {ReservationDoc} reservation Reservation document.
 * @param {LabDoc} lab Laboratory document.
 * @param {SystemSettingsDoc | null} systemSettings Global settings.
 * @return {string[]} Recipient emails.
 */
function resolveNotificationRecipients(
    type: string,
    reservation: ReservationDoc,
    lab: LabDoc,
    systemSettings: SystemSettingsDoc | null,
): string[] {
  if (type === "CALENDAR_ERROR" || type === "TECHNICAL_ERROR") {
    return uniqueEmails([
      ...(systemSettings?.adminEmails ?? []),
      ...lab.defaultNotifyEmails,
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
 * Builds output message for callable response.
 *
 * @param {ReservationStatus} status Reservation status.
 * @param {RejectionDecision | null} rejection Rejection decision.
 * @param {string | undefined} calendarErrorReason Calendar error reason.
 * @return {string} User-facing message.
 */
function getOutputMessage(
    status: ReservationStatus,
    rejection: RejectionDecision | null,
    calendarErrorReason: string | undefined,
): string {
  if (status === "CONFIRMADA") {
    return "Reserva confirmada y sincronizada con Google Calendar.";
  }

  if (status === "PENDIENTE_VALIDACION") {
    return "Solicitud recibida y pendiente de validacion.";
  }

  if (status === "ERROR_CALENDAR") {
    return calendarErrorReason ?? [
      "La reserva requiere revision tecnica",
      "por un error de Google Calendar.",
    ].join(" ");
  }

  return rejection?.reason ?? "La solicitud fue rechazada por reglas internas.";
}

/**
 * Logs Calendar errors without exposing secrets or external event details.
 *
 * @param {string} operation Calendar operation.
 * @param {unknown} error Error object.
 * @param {LabDoc} lab Laboratory.
 */
function logCalendarError(
    operation: string,
    error: unknown,
    lab: LabDoc,
): void {
  const safeError = toSafeErrorMetadata(error);
  logger.error("Google Calendar operation failed", {
    operation,
    labId: lab.id,
    labSlug: lab.slug,
    calendarId: lab.calendarId,
    ...safeError,
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
