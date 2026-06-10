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
    });
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
