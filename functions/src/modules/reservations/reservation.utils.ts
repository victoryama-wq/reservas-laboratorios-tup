import {randomBytes} from "crypto";
import {Timestamp} from "firebase-admin/firestore";
import {ReservationStatus} from "../../shared/models";

export const INSTITUTIONAL_TIME_ZONE = "America/Cancun";

export const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  "PENDIENTE_VALIDACION",
  "CONFIRMADA",
  "CONFIRMADA_TRAS_VALIDACION",
  "ERROR_CALENDAR",
];

const WEEKDAY_TO_SCHEDULE_KEY: Record<string, string> = {
  sunday: "sunday",
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
};

const WEEKDAY_TO_DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Builds a readable non-sequential reservation folio.
 *
 * @param {Date} date Reference date.
 * @return {string} Reservation folio.
 */
export function generateReservationFolio(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const suffix = randomBytes(2).toString("hex").toUpperCase();

  return `RES-${year}${month}${day}-${suffix}`;
}

/**
 * Converts ISO-like input into an Admin Timestamp.
 *
 * @param {string} value Date input.
 * @return {Timestamp} Firestore timestamp.
 */
export function toTimestamp(value: string): Timestamp {
  return Timestamp.fromDate(new Date(value));
}

/**
 * Returns true when time ranges overlap.
 *
 * @param {Date} startA First start.
 * @param {Date} endA First end.
 * @param {Date} startB Second start.
 * @param {Date} endB Second end.
 * @return {boolean} Whether the ranges overlap.
 */
export function rangesOverlap(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date,
): boolean {
  return startA < endB && startB < endA;
}

/**
 * Returns YYYY-MM-DD using the institutional timezone.
 *
 * @param {Date} date Reservation date.
 * @return {string} Local institutional date key.
 */
export function toInstitutionalDateKey(date: Date): string {
  const parts = getInstitutionalDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Returns the day index using the institutional timezone.
 *
 * @param {Date} date Reservation date.
 * @return {number} Day index, 0 sunday to 6 saturday.
 */
export function getInstitutionalDayIndex(date: Date): number {
  const weekday = getInstitutionalDateParts(date).weekday;
  return WEEKDAY_TO_DAY_INDEX[weekday];
}

/**
 * Returns a normalized day key for lab weeklySchedule.
 *
 * @param {Date} date Reservation date.
 * @return {string} Weekly schedule key.
 */
export function getScheduleDayKey(date: Date): string {
  const weekday = getInstitutionalDateParts(date).weekday;
  return WEEKDAY_TO_SCHEDULE_KEY[weekday];
}

/**
 * Extracts HH:mm from a date using the institutional timezone.
 *
 * @param {Date} date Date to format.
 * @return {string} Time string.
 */
export function toTimeString(date: Date): string {
  const parts = getInstitutionalDateParts(date);
  return `${parts.hour}:${parts.minute}`;
}

/**
 * Extracts stable date/time parts for institutional calendar rules.
 *
 * @param {Date} date Date to format.
 * @return {{weekday: string, year: string, month: string, day: string,
 * hour: string, minute: string}} Local date parts.
 */
function getInstitutionalDateParts(date: Date): {
  weekday: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: INSTITUTIONAL_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
      formatter
          .formatToParts(date)
          .map((part) => [part.type, part.value]),
  );

  return {
    weekday: (parts.weekday ?? "").toLowerCase(),
    year: parts.year ?? "0000",
    month: parts.month ?? "00",
    day: parts.day ?? "00",
    hour: parts.hour ?? "00",
    minute: parts.minute ?? "00",
  };
}
