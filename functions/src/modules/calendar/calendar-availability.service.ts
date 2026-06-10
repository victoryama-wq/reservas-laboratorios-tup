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
 * @return {Promise<ExternalCalendarConflictResult>} Conflict result.
 */
export async function checkExternalCalendarConflicts(
    params: {
      calendarId: string;
      startAt: Date;
      endAt: Date;
    },
): Promise<ExternalCalendarConflictResult> {
  const service = new GoogleCalendarService();
  const conflicts = await service.findConflicts(params);

  return {
    hasConflict: conflicts.eventCount > 0,
    conflictCount: conflicts.eventCount,
  };
}
