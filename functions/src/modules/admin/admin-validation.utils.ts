import {HttpsError} from "firebase-functions/v2/https";

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Ensures a value is a plain object.
 *
 * @param {unknown} value Candidate value.
 * @return {Record<string, unknown>} Plain record.
 */
export function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud no tiene un formato valido.",
    );
  }

  return value as Record<string, unknown>;
}

/**
 * Rejects unknown input keys.
 *
 * @param {Record<string, unknown>} data Payload.
 * @param {Set<string>} allowedKeys Allowed keys.
 */
export function validateAllowedKeys(
    data: Record<string, unknown>,
    allowedKeys: Set<string>,
): void {
  const unknownKeys = Object.keys(data).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud contiene campos no permitidos.",
    );
  }
}

/**
 * Normalizes a required string.
 *
 * @param {unknown} value Candidate value.
 * @param {string} message Error message.
 * @return {string} Normalized string.
 */
export function normalizeString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", message);
  }

  return value.trim();
}

/**
 * Normalizes an optional string.
 *
 * @param {unknown} value Candidate value.
 * @return {string | undefined} Normalized string.
 */
export function sanitizeOptionalString(
    value: unknown,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        "Los campos de texto deben ser cadenas validas.",
    );
  }

  return value.trim();
}

/**
 * Parses an optional nullable string.
 *
 * @param {unknown} value Candidate value.
 * @return {string | null | undefined} Parsed value.
 */
export function sanitizeNullableString(
    value: unknown,
): string | null | undefined {
  if (value === null) {
    return null;
  }

  return sanitizeOptionalString(value);
}

/**
 * Parses a required boolean.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {boolean} Parsed value.
 */
export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe ser booleano.`,
    );
  }

  return value;
}

/**
 * Parses an optional boolean.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {boolean | undefined} Parsed value.
 */
export function optionalBoolean(
    value: unknown,
    field: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requireBoolean(value, field);
}

/**
 * Validates a YYYY-MM-DD date string.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {string} Date string.
 */
export function validateDateStringYYYYMMDD(
    value: unknown,
    field: string,
): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe usar formato YYYY-MM-DD.`,
    );
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) ||
      value !== parsed.toISOString().slice(0, 10)) {
    throw new HttpsError(
        "invalid-argument",
        `${field} no es una fecha valida.`,
    );
  }

  return value;
}

/**
 * Validates an optional nullable YYYY-MM-DD date.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {string | null | undefined} Parsed value.
 */
export function optionalDateStringYYYYMMDD(
    value: unknown,
    field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  return validateDateStringYYYYMMDD(value, field);
}

/**
 * Validates an HH:mm time.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {string} Time string.
 */
export function validateTimeHHmm(value: unknown, field: string): string {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe usar formato HH:mm.`,
    );
  }

  return value;
}

/**
 * Validates an optional nullable HH:mm time.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {string | null | undefined} Parsed value.
 */
export function optionalTimeHHmm(
    value: unknown,
    field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  return validateTimeHHmm(value, field);
}

/**
 * Validates an optional date range.
 *
 * @param {string | undefined | null} start Start date.
 * @param {string | undefined | null} end End date.
 */
export function validateDateRange(
    start: string | undefined | null,
    end: string | undefined | null,
): void {
  if (start && end && end < start) {
    throw new HttpsError(
        "invalid-argument",
        "La fecha final debe ser igual o posterior a la fecha inicial.",
    );
  }
}

/**
 * Validates a required time range.
 *
 * @param {string} start Start time.
 * @param {string} end End time.
 */
export function validateTimeRange(start: string, end: string): void {
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    throw new HttpsError(
        "invalid-argument",
        "La hora final debe ser mayor que la hora inicial.",
    );
  }
}

/**
 * Parses optional days of week.
 *
 * @param {unknown} value Candidate value.
 * @return {number[] | undefined} Days 0-6.
 */
export function validateDaysOfWeek(value: unknown): number[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new HttpsError(
        "invalid-argument",
        "daysOfWeek debe ser un arreglo.",
    );
  }

  const days = [
    ...new Set(value.map((day) => {
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw new HttpsError(
            "invalid-argument",
            "daysOfWeek solo permite numeros de 0 a 6.",
        );
      }
      return day;
    })),
  ];

  return days.sort((first, second) => first - second);
}

/**
 * Parses an ISO date string.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {Date} Parsed date.
 */
export function parseIsoDate(value: unknown, field: string): Date {
  if (typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe ser una fecha ISO valida.`,
    );
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe ser una fecha ISO valida.`,
    );
  }

  return parsed;
}

/**
 * Parses a string array.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {string[] | undefined} Parsed array.
 */
export function parseStringArray(
    value: unknown,
    field: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe ser un arreglo.`,
    );
  }

  return [
    ...new Set(value.map((item) => normalizeString(
        item,
        `${field} contiene valores invalidos.`,
    ))),
  ];
}

/**
 * Converts HH:mm to minutes.
 *
 * @param {string} value Time value.
 * @return {number} Minutes.
 */
export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
