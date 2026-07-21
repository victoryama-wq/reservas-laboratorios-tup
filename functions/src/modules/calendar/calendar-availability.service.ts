import {GoogleCalendarService} from "./google-calendar.service";

export interface ExternalCalendarConflictResult {
  hasConflict: boolean;
  conflictCount: number;
}

/**
 * Checks Google Calendar availability for the requested range.
 *
 * @param {object} params Calendar check params.
 * @param {string} params.calendarId Google Calendar id.
 * @param {Date} params.startAt Start date.
 * @param {Date} params.endAt End date.
 * @param {string | undefined} params.excludeReservationId Reservation to skip.
 * @return {Promise<ExternalCalendarConflictResult>} Conflict result.
 */
export async function checkExternalCalendarConflicts(
    params: {
      calendarId: string;
      startAt: Date;
      endAt: Date;
      excludeReservationId?: string;
    },
): Promise<ExternalCalendarConflictResult> {
  const service = new GoogleCalendarService();
  const conflicts = await service.findConflicts(params);

  return {
    hasConflict: conflicts.eventCount > 0,
    conflictCount: conflicts.eventCount,
  };
}
