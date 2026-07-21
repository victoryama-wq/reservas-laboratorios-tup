import {createHash} from "node:crypto";

import {logger} from "firebase-functions";
import {calendar_v3 as calendarApi, google} from "googleapis";

import {
  LabDoc,
  ReservationDoc,
} from "../../shared/models";
import {createWorkspaceJwt} from
  "../google-workspace/google-workspace-auth.service";
import {INSTITUTIONAL_TIME_ZONE} from "../reservations/reservation.utils";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const CALENDAR_SOURCE_SYSTEM = "reservas-laboratorios-tup";
const CALENDAR_IDEMPOTENCY_VERSION = "1";

export interface CalendarConflict {
  eventCount: number;
}

export interface CreateCalendarEventParams {
  lab: LabDoc;
  reservation: ReservationDoc;
}

export type CalendarEnsureOutcome = "CREATED" | "REUSED" | "RECONCILED";

export interface CalendarEnsureResult {
  eventId: string;
  outcome: CalendarEnsureOutcome;
}

export interface CalendarDeleteResult {
  eventId: string | null;
  outcome: "DELETED" | "ABSENT";
}

/**
 * Builds a stable, Calendar-compatible event id without personal data.
 *
 * @param {string} reservationId Firestore reservation id.
 * @return {string} Deterministic Google Calendar event id.
 */
export function buildReservationCalendarEventId(
    reservationId: string,
): string {
  const digest = createHash("sha256")
      .update(`${CALENDAR_SOURCE_SYSTEM}:${reservationId}`, "utf8")
      .digest("hex");
  return `tup${digest}`;
}

/** Controlled inconsistency between Firestore and Google Calendar. */
export class CalendarEventConsistencyError extends Error {
  /**
   * Creates a consistency error.
   *
   * @param {string} message Safe technical message.
   */
  constructor(message: string) {
    super(message);
    this.name = "CalendarEventConsistencyError";
  }
}

export type CalendarValidationReason =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INSUFFICIENT_PERMISSION"
  | "INVALID_ID"
  | "TECHNICAL_ERROR";

export interface CalendarValidationResult {
  valid: boolean;
  calendarId: string;
  summary?: string;
  timeZone?: string;
  accessRole?: string;
  canWrite?: boolean;
  message: string;
  reason?: CalendarValidationReason;
}

/**
 * Handles Google Calendar operations using Workspace domain delegation.
 */
export class GoogleCalendarService {
  private calendarClient?: calendarApi.Calendar;

  /**
   * Creates the service, optionally with an injected Calendar client for tests.
   *
   * @param {function(): Promise<calendarApi.Calendar> | undefined}
   * clientFactory Calendar client factory.
   */
  constructor(
    private readonly clientFactory?: () => Promise<calendarApi.Calendar>,
  ) {}

  /**
   * Checks Google Calendar events that overlap the requested range.
   *
   * @param {object} params Calendar check params.
   * @param {string} params.calendarId Calendar id.
   * @param {Date} params.startAt Requested start.
   * @param {Date} params.endAt Requested end.
   * @return {Promise<CalendarConflict>} Conflict summary.
   */
  async findConflicts(params: {
    calendarId: string;
    startAt: Date;
    endAt: Date;
    excludeReservationId?: string;
  }): Promise<CalendarConflict> {
    const client = await this.getCalendarClient();
    const response = await client.events.list({
      calendarId: params.calendarId,
      timeMin: params.startAt.toISOString(),
      timeMax: params.endAt.toISOString(),
      singleEvents: true,
      showDeleted: false,
    });

    const events = response.data.items ?? [];
    const overlappingEvents = events.filter((event) => {
      if (
        params.excludeReservationId &&
        this.eventBelongsToReservation(event, params.excludeReservationId)
      ) {
        return false;
      }
      return event.status !== "cancelled" &&
        this.eventOverlapsRange(event, params.startAt, params.endAt);
    });

    return {
      eventCount: overlappingEvents.length,
    };
  }

  /**
   * Creates the institutional Google Calendar event for a reservation.
   *
   * @param {CreateCalendarEventParams} params Event params.
   * @return {Promise<string>} Google Calendar event id.
   */
  async ensureReservationEvent(
      params: CreateCalendarEventParams,
  ): Promise<CalendarEnsureResult> {
    const client = await this.getCalendarClient();
    const calendarId = params.lab.calendarId;
    const reservation = params.reservation;
    const deterministicId = buildReservationCalendarEventId(reservation.id);

    if (reservation.calendarEventId) {
      const linkedEvent = await this.getEventIfPresent(
          client,
          calendarId,
          reservation.calendarEventId,
      );
      if (linkedEvent) {
        this.validateReservationEvent(linkedEvent, reservation, {
          expectedEventId: reservation.calendarEventId,
          allowLegacyProperties: true,
        });
        return this.logEnsureResult(params, {
          eventId: reservation.calendarEventId,
          outcome: "REUSED",
        });
      }
    }

    const deterministicEvent = await this.getEventIfPresent(
        client,
        calendarId,
        deterministicId,
    );
    if (deterministicEvent) {
      this.validateReservationEvent(deterministicEvent, reservation, {
        expectedEventId: deterministicId,
        allowLegacyProperties: false,
      });
      return this.logEnsureResult(params, {
        eventId: deterministicId,
        outcome: "REUSED",
      });
    }

    const matchingEvents = await this.findReservationEvents(
        client,
        calendarId,
        reservation.id,
    );
    if (matchingEvents.length > 1) {
      throw new CalendarEventConsistencyError(
          "Google Calendar contiene multiples eventos para la reserva.",
      );
    }
    if (matchingEvents.length === 1) {
      const matchingEvent = matchingEvents[0];
      this.validateReservationEvent(matchingEvent, reservation, {
        expectedEventId: matchingEvent.id ?? "",
        allowLegacyProperties: false,
      });
      return this.logEnsureResult(params, {
        eventId: matchingEvent.id ?? "",
        outcome: "RECONCILED",
      });
    }

    const requestBody = this.buildReservationEvent(reservation);
    requestBody.id = deterministicId;

    try {
      const response = await client.events.insert({
        calendarId,
        requestBody,
        sendUpdates: "all",
      });

      const eventId = response.data.id;
      if (!eventId) {
        throw new Error("Google Calendar no devolvio eventId.");
      }

      return this.logEnsureResult(params, {
        eventId,
        outcome: "CREATED",
      });
    } catch (error) {
      const eventAfterFailure = await this.getEventIfPresent(
          client,
          calendarId,
          deterministicId,
      );
      if (eventAfterFailure) {
        this.validateReservationEvent(eventAfterFailure, reservation, {
          expectedEventId: deterministicId,
          allowLegacyProperties: false,
        });
        return this.logEnsureResult(params, {
          eventId: deterministicId,
          outcome: this.getErrorStatus(error) === 409 ?
            "REUSED" : "RECONCILED",
        });
      }

      throw error;
    }
  }

  /**
   * Deletes the Calendar event associated with a cancelled reservation.
   *
   * @param {CreateCalendarEventParams} params Reservation and laboratory.
   * @return {Promise<CalendarDeleteResult>} Deletion outcome.
   */
  async deleteReservationEvent(params: CreateCalendarEventParams):
    Promise<CalendarDeleteResult> {
    const client = await this.getCalendarClient();
    const calendarId = params.lab.calendarId;
    const reservation = params.reservation;
    const deterministicId = buildReservationCalendarEventId(reservation.id);

    let event: calendarApi.Schema$Event | null = null;
    if (reservation.calendarEventId) {
      event = await this.getEventIfPresent(
          client,
          calendarId,
          reservation.calendarEventId,
      );
      if (event) {
        this.validateReservationEvent(event, reservation, {
          expectedEventId: reservation.calendarEventId,
          allowLegacyProperties: true,
          allowCancelled: true,
        });
      }
    }

    if (!event) {
      event = await this.getEventIfPresent(client, calendarId, deterministicId);
      if (event) {
        this.validateReservationEvent(event, reservation, {
          expectedEventId: deterministicId,
          allowLegacyProperties: false,
          allowCancelled: true,
        });
      }
    }

    if (!event) {
      const matchingEvents = await this.findReservationEvents(
          client,
          calendarId,
          reservation.id,
      );
      if (matchingEvents.length > 1) {
        throw new CalendarEventConsistencyError(
            "Google Calendar contiene multiples eventos para la reserva.",
        );
      }
      event = matchingEvents[0] ?? null;
      if (event) {
        this.validateReservationEvent(event, reservation, {
          expectedEventId: event.id ?? "",
          allowLegacyProperties: false,
          allowCancelled: true,
        });
      }
    }

    if (!event || event.status === "cancelled" || !event.id) {
      return {eventId: event?.id ?? null, outcome: "ABSENT"};
    }

    try {
      await client.events.delete({
        calendarId,
        eventId: event.id,
        sendUpdates: "all",
      });
    } catch (error) {
      if (this.isMissingEventError(error)) {
        return {eventId: event.id, outcome: "ABSENT"};
      }
      throw error;
    }

    logger.info("Reservation Calendar event deleted", {
      reservationId: reservation.id,
      folio: reservation.folio,
      labId: params.lab.id,
      eventId: event.id,
      outcome: "DELETED",
      deterministicIdUsed: event.id === deterministicId,
    });
    return {eventId: event.id, outcome: "DELETED"};
  }

  /**
   * Reads an event and maps Calendar's missing responses to null.
   *
   * @param {calendarApi.Calendar} client Calendar client.
   * @param {string} calendarId Calendar id.
   * @param {string} eventId Event id.
   * @return {Promise<calendarApi.Schema$Event | null>} Event or null.
   */
  private async getEventIfPresent(
      client: calendarApi.Calendar,
      calendarId: string,
      eventId: string,
  ): Promise<calendarApi.Schema$Event | null> {
    try {
      const response = await client.events.get({calendarId, eventId});
      return response.data;
    } catch (error) {
      if (this.isMissingEventError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Finds events tagged with the reservation's private idempotency metadata.
   *
   * @param {calendarApi.Calendar} client Calendar client.
   * @param {string} calendarId Calendar id.
   * @param {string} reservationId Reservation id.
   * @return {Promise<calendarApi.Schema$Event[]>} Matching events.
   */
  private async findReservationEvents(
      client: calendarApi.Calendar,
      calendarId: string,
      reservationId: string,
  ): Promise<calendarApi.Schema$Event[]> {
    const response = await client.events.list({
      calendarId,
      privateExtendedProperty: [
        `reservationId=${reservationId}`,
        `sourceSystem=${CALENDAR_SOURCE_SYSTEM}`,
      ],
      showDeleted: true,
      singleEvents: true,
    });
    return response.data.items ?? [];
  }

  /**
   * Validates that a Calendar event belongs to the expected reservation.
   *
   * @param {calendarApi.Schema$Event} event Calendar event.
   * @param {ReservationDoc} reservation Reservation.
   * @param {object} options Validation options.
   * @param {string} options.expectedEventId Expected event id.
   * @param {boolean} options.allowLegacyProperties Accept linked legacy event.
   * @param {boolean | undefined} options.allowCancelled Accept cancelled event.
   */
  private validateReservationEvent(
      event: calendarApi.Schema$Event,
      reservation: ReservationDoc,
      options: {
        expectedEventId: string;
        allowLegacyProperties: boolean;
        allowCancelled?: boolean;
      },
  ): void {
    if (!event.id || event.id !== options.expectedEventId) {
      throw new CalendarEventConsistencyError(
          "Google Calendar devolvio un identificador de evento inesperado.",
      );
    }

    if (event.status === "cancelled") {
      if (options.allowCancelled) {
        return;
      }
      throw new CalendarEventConsistencyError(
          "El evento asociado a la reserva esta cancelado en Google Calendar.",
      );
    }
    if (event.status && event.status !== "confirmed") {
      throw new CalendarEventConsistencyError(
          "El evento asociado no esta confirmado en Google Calendar.",
      );
    }

    const privateProperties = event.extendedProperties?.private ?? {};
    const hasIdempotencyProperties = Boolean(
        privateProperties.reservationId ||
        privateProperties.sourceSystem ||
        privateProperties.idempotencyVersion,
    );
    if (!options.allowLegacyProperties || hasIdempotencyProperties) {
      if (
        privateProperties.reservationId !== reservation.id ||
        privateProperties.sourceSystem !== CALENDAR_SOURCE_SYSTEM ||
        privateProperties.idempotencyVersion !== CALENDAR_IDEMPOTENCY_VERSION
      ) {
        throw new CalendarEventConsistencyError(
            "El evento de Calendar no pertenece a la reserva esperada.",
        );
      }
    }

    const eventStart = this.parseEventDate(event.start);
    const eventEnd = this.parseEventDate(event.end);
    if (
      (eventStart && eventStart.getTime() !==
        reservation.startAt.toDate().getTime()) ||
      (eventEnd && eventEnd.getTime() !== reservation.endAt.toDate().getTime())
    ) {
      throw new CalendarEventConsistencyError(
          "El horario del evento de Calendar no coincide con la reserva.",
      );
    }
  }

  /**
   * Emits safe observability metadata for an idempotent Calendar operation.
   *
   * @param {CreateCalendarEventParams} params Event params.
   * @param {CalendarEnsureResult} result Ensure result.
   * @return {CalendarEnsureResult} Unchanged result.
   */
  private logEnsureResult(
      params: CreateCalendarEventParams,
      result: CalendarEnsureResult,
  ): CalendarEnsureResult {
    logger.info("Reservation Calendar event ensured", {
      reservationId: params.reservation.id,
      folio: params.reservation.folio,
      labId: params.lab.id,
      eventId: result.eventId,
      outcome: result.outcome,
      deterministicIdUsed: result.eventId ===
        buildReservationCalendarEventId(params.reservation.id),
    });
    return result;
  }

  /**
   * Checks Calendar responses that mean an event no longer exists.
   *
   * @param {unknown} error Calendar API error.
   * @return {boolean} Whether the event is absent.
   */
  private isMissingEventError(error: unknown): boolean {
    const status = this.getErrorStatus(error);
    const reason = this.getErrorReason(error);
    return status === 404 || status === 410 ||
      reason === "notFound" || reason === "deleted";
  }

  /**
   * Validates whether the delegated Workspace account can access a calendar.
   *
   * @param {string} calendarId Calendar id to validate.
   * @return {Promise<CalendarValidationResult>} Validation result.
   */
  async validateCalendarAccess(
      calendarId: string,
  ): Promise<CalendarValidationResult> {
    const normalizedCalendarId = calendarId.trim();
    if (!normalizedCalendarId || /\s/.test(normalizedCalendarId)) {
      return {
        valid: false,
        calendarId: normalizedCalendarId,
        canWrite: false,
        message: "El ID del calendario no parece valido.",
        reason: "INVALID_ID",
      };
    }

    const client = await this.getCalendarClient();
    try {
      const response = await client.calendarList.get({
        calendarId: normalizedCalendarId,
      });
      const accessRole = response.data.accessRole ?? undefined;
      const canWrite = accessRole === "owner" || accessRole === "writer";

      return {
        valid: canWrite,
        calendarId: normalizedCalendarId,
        summary: response.data.summary ?? undefined,
        timeZone: response.data.timeZone ?? undefined,
        accessRole,
        canWrite,
        message: canWrite ?
          "Calendario validado con permisos de escritura." :
          "La cuenta operativa no tiene permisos suficientes sobre " +
            "este calendario.",
        reason: canWrite ? undefined : "INSUFFICIENT_PERMISSION",
      };
    } catch (calendarListError) {
      const fallback = await this.validateCalendarMetadata(
          client,
          normalizedCalendarId,
      );
      if (fallback) {
        return fallback;
      }

      return this.toCalendarValidationError(
          normalizedCalendarId,
          calendarListError,
      );
    }
  }

  /**
   * Returns an authenticated Google Calendar client.
   *
   * @return {Promise<calendarApi.Calendar>} Calendar client.
   */
  private async getCalendarClient(): Promise<calendarApi.Calendar> {
    if (this.calendarClient) {
      return this.calendarClient;
    }

    if (this.clientFactory) {
      this.calendarClient = await this.clientFactory();
      return this.calendarClient;
    }

    const auth = await createWorkspaceJwt([CALENDAR_SCOPE]);
    this.calendarClient = google.calendar({version: "v3", auth});
    return this.calendarClient;
  }

  /**
   * Attempts metadata validation when CalendarList does not expose accessRole.
   *
   * @param {calendarApi.Calendar} client Calendar client.
   * @param {string} calendarId Calendar id.
   * @return {Promise<CalendarValidationResult | null>} Partial result.
   */
  private async validateCalendarMetadata(
      client: calendarApi.Calendar,
      calendarId: string,
  ): Promise<CalendarValidationResult | null> {
    try {
      const response = await client.calendars.get({calendarId});

      return {
        valid: false,
        calendarId,
        summary: response.data.summary ?? undefined,
        timeZone: response.data.timeZone ?? undefined,
        canWrite: false,
        message: "El calendario existe, pero no fue posible confirmar " +
          "permisos de escritura para la cuenta operativa.",
        reason: "INSUFFICIENT_PERMISSION",
      };
    } catch {
      return null;
    }
  }

  /**
   * Maps Google Calendar API errors to user-safe validation messages.
   *
   * @param {string} calendarId Calendar id.
   * @param {unknown} error Google API error.
   * @return {CalendarValidationResult} Safe validation result.
   */
  private toCalendarValidationError(
      calendarId: string,
      error: unknown,
  ): CalendarValidationResult {
    const status = this.getErrorStatus(error);
    const reason = this.getErrorReason(error);

    if (status === 404) {
      return {
        valid: false,
        calendarId,
        canWrite: false,
        message: "No se encontro el calendario configurado.",
        reason: "NOT_FOUND",
      };
    }

    if (status === 403) {
      return {
        valid: false,
        calendarId,
        canWrite: false,
        message: "La cuenta operativa no tiene permisos suficientes sobre " +
          "este calendario.",
        reason: reason === "insufficientPermissions" ?
          "INSUFFICIENT_PERMISSION" :
          "FORBIDDEN",
      };
    }

    if (status === 400) {
      return {
        valid: false,
        calendarId,
        canWrite: false,
        message: "El ID del calendario no parece valido.",
        reason: "INVALID_ID",
      };
    }

    return {
      valid: false,
      calendarId,
      canWrite: false,
      message: "No fue posible validar el calendario. Revise permisos " +
        "o intente nuevamente.",
      reason: "TECHNICAL_ERROR",
    };
  }

  /**
   * Extracts a Google API status code without exposing sensitive details.
   *
   * @param {unknown} error Google API error.
   * @return {number | undefined} HTTP status code.
   */
  private getErrorStatus(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }

    const candidate = error as {
      code?: number | string;
      response?: {status?: number};
      status?: number;
    };
    const status = candidate.response?.status ?? candidate.status ??
      Number(candidate.code);

    return Number.isFinite(status) ? Number(status) : undefined;
  }

  /**
   * Extracts a Google API reason without exposing raw error payloads.
   *
   * @param {unknown} error Google API error.
   * @return {string | undefined} Error reason.
   */
  private getErrorReason(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }

    const candidate = error as {
      errors?: Array<{reason?: string}>;
      response?: {data?: {error?: {errors?: Array<{reason?: string}>}}};
    };

    return candidate.errors?.[0]?.reason ??
      candidate.response?.data?.error?.errors?.[0]?.reason;
  }

  /**
   * Builds a Calendar event from a reservation.
   *
   * @param {ReservationDoc} reservation Reservation.
   * @return {calendarApi.Schema$Event} Calendar event.
   */
  private buildReservationEvent(
      reservation: ReservationDoc,
  ): calendarApi.Schema$Event {
    const protocolRequired = reservation.protocolRequired ||
      reservation.risky ||
      reservation.externalParticipants;

    return {
      summary: `Reserva ${reservation.folio} - ${reservation.labName}`,
      description: [
        `📌 Folio: ${reservation.folio}`,
        "",
        `👨‍🏫 Reservado por: ${reservation.teacherName} (${
          reservation.teacherEmail
        })`,
        `🏫 Laboratorio: ${reservation.labName}`,
        `📚 Asignatura: ${reservation.subject}`,
        `🎓 Grupo: ${reservation.group}`,
        "",
        `🧪 Tipo de práctica: ${reservation.practiceType}`,
        reservation.practiceType === "Otro" ?
          `🧾 Especificación: ${
            reservation.practiceTypeOther || "No indicada"
          }` :
          undefined,
        `⚠️ Material riesgoso: ${reservation.risky ? "Sí" : "No"}`,
        `👥 Pacientes, usuarios simulados o población externa: ${
          reservation.externalParticipants ? "Sí" : "No"
        }`,
        `📎 Protocolo requerido: ${
          protocolRequired ? "Sí" : "No"
        }`,
        `📄 Protocolo adjunto: ${
          reservation.protocolFiles.length ? "Sí" : "No"
        }`,
        reservation.protocolFiles.length ?
          `📁 Archivo(s): ${reservation.protocolFiles
              .map((file) => file.fileName)
              .join(", ")}` :
          undefined,
        "",
        "⚒️ Material requerido:",
        reservation.materialRequired || "No indicado",
        "",
        "📝 Práctica / Objetivo:",
        `${reservation.practiceName} / ${reservation.objective}`,
        "",
        "✅ Generado por: Sistema Web de Reservas de Laboratorios",
      ].filter((line): line is string => Boolean(line)).join("\n"),
      start: {
        dateTime: reservation.startAt.toDate().toISOString(),
        timeZone: INSTITUTIONAL_TIME_ZONE,
      },
      end: {
        dateTime: reservation.endAt.toDate().toISOString(),
        timeZone: INSTITUTIONAL_TIME_ZONE,
      },
      attendees: [
        {
          email: reservation.teacherEmail,
          displayName: reservation.teacherName,
        },
      ],
      extendedProperties: {
        private: {
          reservationId: reservation.id,
          sourceSystem: CALENDAR_SOURCE_SYSTEM,
          idempotencyVersion: CALENDAR_IDEMPOTENCY_VERSION,
        },
      },
    };
  }

  /**
   * Checks whether a Calendar event overlaps the requested range.
   *
   * @param {calendarApi.Schema$Event} event Calendar event.
   * @param {Date} startAt Requested start.
   * @param {Date} endAt Requested end.
   * @return {boolean} Whether the event overlaps.
   */
  private eventOverlapsRange(
      event: calendarApi.Schema$Event,
      startAt: Date,
      endAt: Date,
  ): boolean {
    const eventStart = this.parseEventDate(event.start);
    const eventEnd = this.parseEventDate(event.end);

    if (!eventStart || !eventEnd) {
      return false;
    }

    return startAt < eventEnd && eventStart < endAt;
  }

  /**
   * Checks whether an event is the idempotent event of a reservation.
   *
   * @param {calendarApi.Schema$Event} event Calendar event.
   * @param {string} reservationId Reservation id.
   * @return {boolean} Whether the event belongs to the reservation.
   */
  private eventBelongsToReservation(
      event: calendarApi.Schema$Event,
      reservationId: string,
  ): boolean {
    if (event.id === buildReservationCalendarEventId(reservationId)) {
      return true;
    }
    const privateProperties = event.extendedProperties?.private;
    return privateProperties?.reservationId === reservationId &&
      privateProperties?.sourceSystem === CALENDAR_SOURCE_SYSTEM;
  }

  /**
   * Parses timed or all-day Calendar date fields.
   *
   * @param {calendarApi.Schema$EventDateTime | undefined} value Date field.
   * @return {Date | null} Parsed date.
   */
  private parseEventDate(
      value: calendarApi.Schema$EventDateTime | undefined,
  ): Date | null {
    if (!value) {
      return null;
    }

    if (value.dateTime) {
      return new Date(value.dateTime);
    }

    if (value.date) {
      return new Date(`${value.date}T00:00:00-05:00`);
    }

    return null;
  }
}
