import {calendar_v3 as calendarApi, google} from "googleapis";

import {
  LabDoc,
  ReservationDoc,
} from "../../shared/models";
import {createWorkspaceJwt} from
  "../google-workspace/google-workspace-auth.service";
import {INSTITUTIONAL_TIME_ZONE} from "../reservations/reservation.utils";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export interface CalendarConflict {
  eventCount: number;
}

export interface CreateCalendarEventParams {
  lab: LabDoc;
  reservation: ReservationDoc;
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
    const overlappingEvents = events.filter((event) =>
      event.status !== "cancelled" &&
      this.eventOverlapsRange(event, params.startAt, params.endAt),
    );

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
  async createReservationEvent(
      params: CreateCalendarEventParams,
  ): Promise<string> {
    const client = await this.getCalendarClient();
    const response = await client.events.insert({
      calendarId: params.lab.calendarId,
      requestBody: this.buildReservationEvent(params.reservation),
      sendUpdates: "all",
    });

    const eventId = response.data.id;
    if (!eventId) {
      throw new Error("Google Calendar no devolvio eventId.");
    }

    return eventId;
  }

  /**
   * Deletes the Calendar event associated with a cancelled reservation.
   *
   * @param {object} params Delete params.
   * @param {string} params.calendarId Calendar id.
   * @param {string} params.eventId Calendar event id.
   */
  async deleteReservationEvent(params: {
    calendarId: string;
    eventId: string;
  }): Promise<void> {
    const client = await this.getCalendarClient();
    await client.events.delete({
      calendarId: params.calendarId,
      eventId: params.eventId,
      sendUpdates: "all",
    });
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
