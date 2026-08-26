/* eslint-disable max-len, require-jsdoc, valid-jsdoc, quotes */
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
import {randomUUID} from "node:crypto";

import {
  checkExternalCalendarConflicts,
} from "../calendar/calendar-availability.service";
import {
  CalendarEnsureOutcome,
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
  validateReservationModeForProfile,
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
      validateReservationModeForProfile(input, profile, lab);
      const systemSettings = await reservationRepository.getSystemSettings();
      validateProtocolFiles(input, lab, uid);
      const occurrences = input.occurrences?.length ?
        input.occurrences : [{startAt: input.startAt, endAt: input.endAt}];
      const groupId = occurrences.length > 1 ? randomUUID() : undefined;
      const processed: ProcessedOccurrence[] = [];

      for (const [index, occurrence] of occurrences.entries()) {
        processed.push(await processOccurrence({
          input: {
            ...input,
            startAt: occurrence.startAt,
            endAt: occurrence.endAt,
            occurrences: undefined,
          },
          groupId,
          groupSize: occurrences.length,
          groupIndex: index,
          uid,
          profile,
          lab,
          systemSettings,
          reservationRepository,
          logRepository,
          notificationRepository,
          notificationDeliveryService,
          calendarService,
          notifyIndividually: occurrences.length === 1,
        }));
      }

      if (groupId) {
        await createAndSendBatchNotification({
          groupId,
          processed,
          lab,
          systemSettings,
          notificationRepository,
          notificationDeliveryService,
        });
      }

      const first = processed[0];
      return {
        ...first.output,
        reservationGroupId: groupId,
        results: groupId ? processed.map((item) => ({
          ...item.output,
          startAt: item.startAt.toISOString(),
          endAt: item.endAt.toISOString(),
        })) : undefined,
        message: groupId ? buildBatchOutputMessage(processed) :
          first.output.message,
      };
    },
);

interface ProcessedOccurrence {
  output: CreateReservationOutput;
  reservation: ReservationDoc;
  startAt: Date;
  endAt: Date;
}

interface ProcessOccurrenceParams {
  input: CreateReservationInput;
  groupId?: string;
  groupSize: number;
  groupIndex: number;
  uid: string;
  profile: NonNullable<Awaited<ReturnType<ReservationRepository["getUserProfile"]>>>;
  lab: LabDoc;
  systemSettings: SystemSettingsDoc | null;
  reservationRepository: ReservationRepository;
  logRepository: ReservationLogRepository;
  notificationRepository: NotificationRepository;
  notificationDeliveryService: NotificationDeliveryService;
  calendarService: GoogleCalendarService;
  notifyIndividually: boolean;
}

interface BatchNotificationParams {
  groupId: string;
  processed: ProcessedOccurrence[];
  lab: LabDoc;
  systemSettings: SystemSettingsDoc | null;
  notificationRepository: NotificationRepository;
  notificationDeliveryService: NotificationDeliveryService;
}

/** Writes and sends one consolidated result for a multi-date request. */
async function createAndSendBatchNotification(
    params: BatchNotificationParams,
): Promise<void> {
  const representative = params.processed[0].reservation;
  const template = buildBatchEmail(params.processed, params.lab.name);
  const created = await getFirestore().runTransaction(async (transaction) =>
    params.notificationRepository.createPendingNotification(transaction, {
      reservationId: representative.id,
      type: "RESERVATION_BATCH_RESULT",
      to: uniqueEmails([
        representative.teacherEmail,
        representative.guestTeacherEmail ?? "",
        ...params.lab.responsibleEmails,
        ...params.lab.defaultNotifyEmails,
        ...(params.processed.some((item) => item.output.status === "ERROR_CALENDAR") ?
          params.systemSettings?.adminEmails ?? [] : []),
      ]),
      subject: template.subject,
      body: template.body,
      htmlBody: template.htmlBody,
    }),
  );
  await sendNotificationSafely(params.notificationDeliveryService, created);
}

/** Builds a compact, consolidated multi-date email. */
function buildBatchEmail(
    processed: ProcessedOccurrence[],
    labName: string,
): {subject: string; body: string; htmlBody: string} {
  const rows = processed.map((item) => {
    const date = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "long",
      timeZone: "America/Cancun",
    }).format(item.startAt);
    const time = new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Cancun",
    });
    return {
      folio: item.output.folio,
      date,
      time: `${time.format(item.startAt)} - ${time.format(item.endAt)}`,
      status: item.output.status,
      message: item.output.message,
    };
  });
  const textRows = rows.map((row) =>
    `- ${row.date}, ${row.time}: ${row.status}. ${row.message} (${row.folio})`,
  ).join("\n");
  const htmlRows = rows.map((row) => [
    "<tr>",
    `<td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeEmail(row.date)}</td>`,
    `<td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeEmail(row.time)}</td>`,
    `<td style="padding:10px;border-bottom:1px solid #e5e7eb"><strong>${escapeEmail(row.status)}</strong><br>${escapeEmail(row.message)}</td>`,
    "</tr>",
  ].join("")).join("");

  return {
    subject: `Resultado de reservas multiples - ${labName}`,
    body: [
      "Sistema Web de Reservas de Laboratorios",
      `Laboratorio: ${labName}`,
      "Resultado por fecha:",
      textRows,
      "Las fechas rechazadas indican el conflicto o regla que impidio reservar.",
    ].join("\n\n"),
    htmlBody: [
      '<div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#111827">',
      '<div style="max-width:720px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">',
      '<div style="background:#271e5d;color:#fff;padding:22px"><strong>Sistema Web de Reservas de Laboratorios</strong><h2 style="margin:8px 0 0">Resultado de solicitud multiple</h2></div>',
      `<div style="padding:22px"><p><strong>Laboratorio:</strong> ${escapeEmail(labName)}</p>`,
      '<table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Fecha</th><th align="left">Horario</th><th align="left">Resultado</th></tr></thead>',
      `<tbody>${htmlRows}</tbody></table>`,
      '<p style="color:#4b5563">Las fechas rechazadas muestran el motivo correspondiente. No se envian correos separados por cada fecha.</p></div></div></div>',
    ].join(""),
  };
}

/** Produces the callable summary for a multi-date request. */
function buildBatchOutputMessage(processed: ProcessedOccurrence[]): string {
  const accepted = processed.filter((item) =>
    !item.output.status.startsWith("RECHAZADA"),
  ).length;
  const rejected = processed.length - accepted;
  return `Se procesaron ${processed.length} fechas: ${accepted} aceptadas y ${rejected} rechazadas.`;
}

/** Sends a persisted notification without changing reservation status. */
async function sendNotificationSafely(
    delivery: NotificationDeliveryService,
    created: CreatedNotification,
): Promise<void> {
  try {
    await delivery.sendNotification(created.notification);
  } catch (error) {
    logger.error("Email notification delivery failed", {
      reservationId: created.notification.reservationId,
      notificationId: created.id,
      ...toSafeErrorMetadata(error),
    });
  }
}

/** Escapes dynamic text included in an email body. */
function escapeEmail(value: string): string {
  return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

/** Creates and validates one occurrence in a multi-date request. */
async function processOccurrence(
    params: ProcessOccurrenceParams,
): Promise<ProcessedOccurrence> {
  const {
    input, lab, uid, profile, reservationRepository, logRepository,
    notificationRepository, notificationDeliveryService, calendarService,
  } = params;
  const {startAt, endAt} = parseReservationDates(input);
  let rejectionDecision = validateReservationTiming(
      input, lab, startAt, endAt, new Date(),
  );
  let calendarErrorReason: string | undefined;
  const reservationRef = reservationRepository.createReservationRef();
  const folio = generateReservationFolio(new Date());

  if (!rejectionDecision) {
    const blockedPeriods = await reservationRepository
        .findActiveBlockedPeriods(lab.id, startAt, endAt);
    if (blockedPeriods.length) {
      rejectionDecision = {
        status: "RECHAZADA_REGLA_HORARIO",
        reason: "El horario solicitado esta bloqueado por una restriccion institucional.",
      };
    }
  }

  if (!rejectionDecision) {
    const conflicts = await reservationRepository.runTransaction(
        (transaction) => reservationRepository.findBlockingConflicts(
            transaction, lab.id, startAt, endAt,
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
        excludeReservationId: reservationRef.id,
      });
      if (externalConflict.hasConflict) {
        rejectionDecision = {
          status: "RECHAZADA_CONFLICTO",
          reason: "El laboratorio ya tiene un evento ocupado en Google Calendar para ese horario.",
        };
      }
    } catch (error) {
      logCalendarError("validate_external_availability", error, lab);
      calendarErrorReason = "No fue posible validar Google Calendar. Admin/Sistemas debe revisar la integracion.";
    }
  }

  let calendarEventId: string | null = null;
  let calendarEnsureOutcome: CalendarEnsureOutcome | null = null;
  if (!rejectionDecision && !calendarErrorReason && !requiresManualReview(input)) {
    try {
      const draft = buildReservation(
          reservationRepository, reservationRef.id, folio, input, lab,
          {uid, email: profile.email, displayName: profile.displayName},
          startAt, endAt, "CONFIRMADA", undefined, null,
          params.groupId, params.groupSize, params.groupIndex, profile.role,
          profile.requesterType,
      );
      const calendarResult = await calendarService.ensureReservationEvent({
        lab,
        reservation: draft,
      });
      calendarEventId = calendarResult.eventId;
      calendarEnsureOutcome = calendarResult.outcome;
    } catch (error) {
      logCalendarError("create_calendar_event", error, lab);
      calendarErrorReason = "Hubo un error tecnico al crear el evento en Google Calendar.";
    }
  }

  const createdNotification: {value: CreatedNotification | null} = {value: null};
  const saved = await reservationRepository.runTransaction(async (transaction) => {
    const status = calendarErrorReason ? "ERROR_CALENDAR" :
      resolveStatus(input, rejectionDecision);
    const reservation = buildReservation(
        reservationRepository, reservationRef.id, folio, input, lab,
        {uid, email: profile.email, displayName: profile.displayName},
        startAt, endAt, status,
        calendarErrorReason ?? rejectionDecision?.reason, calendarEventId,
        params.groupId, params.groupSize, params.groupIndex, profile.role,
        profile.requesterType,
    );
    reservationRepository.createReservation(transaction, reservationRef, reservation);
    createLogs(
        logRepository, transaction, reservation, profile.email,
        rejectionDecision, calendarErrorReason, calendarEnsureOutcome,
    );
    if (params.notifyIndividually) {
      createdNotification.value = createNotification(
          notificationRepository, transaction, reservation, lab,
          params.systemSettings, rejectionDecision, calendarErrorReason,
      );
    }
    return reservation;
  });

  if (createdNotification.value) {
    await sendNotificationSafely(
        notificationDeliveryService, createdNotification.value,
    );
  }

  return {
    reservation: saved,
    startAt,
    endAt,
    output: {
      reservationId: saved.id,
      folio: saved.folio,
      status: saved.status,
      message: getOutputMessage(saved.status, rejectionDecision, calendarErrorReason),
    },
  };
}

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
 * @param {string | undefined} groupId Multi-date request id.
 * @param {number} groupSize Number of requested dates.
 * @param {number} groupIndex Zero-based occurrence index.
 * @param {string} requestedByRole Authenticated role.
 * @param {string} requesterType Requester category.
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
    groupId?: string,
    groupSize = 1,
    groupIndex = 0,
    requestedByRole?: "docente" | "responsable_laboratorio" | "admin_sistemas",
    requesterType?: "docente" | "administrativo",
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
    requestedByRole,
    requesterType,
    guestTeacherEmail: input.guestTeacherEmail,
    reservationMode: input.reservationMode ?? "academic",
    reservationGroupId: groupId,
    reservationGroupSize: groupId ? groupSize : undefined,
    reservationGroupIndex: groupId ? groupIndex : undefined,
    subject: input.subject,
    group: input.group,
    practiceName: input.practiceName,
    practiceNumber: input.practiceNumber,
    description: input.description,
    objective: input.objective,
    materialRequired: input.materialRequired,
    practiceType: input.practiceType,
    practiceTypeOther: input.practiceTypeOther,
    risky: input.risky,
    externalParticipants: input.externalParticipants,
    protocolRequired: input.risky || input.externalParticipants,
    protocolFiles: toProtocolFiles(input.protocolFiles ?? []),
    evidenceFiles: [],
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
 * @param {CalendarEnsureOutcome | null} calendarEnsureOutcome Ensure result.
 */
function createLogs(
    repository: ReservationLogRepository,
    transaction: Transaction,
    reservation: ReservationDoc,
    actorEmail: string,
    rejection: RejectionDecision | null,
    calendarErrorReason: string | undefined,
    calendarEnsureOutcome: CalendarEnsureOutcome | null,
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
        calendarOutcome: calendarEnsureOutcome,
      },
      note: calendarEnsureOutcome === "RECONCILED" ?
        "Evento de Calendar reconciliado de forma idempotente." : undefined,
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
