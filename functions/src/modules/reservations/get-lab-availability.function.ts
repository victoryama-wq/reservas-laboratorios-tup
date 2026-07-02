import {getFirestore} from "firebase-admin/firestore";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {
  AppUser,
  BlockedPeriodDoc,
  LabDoc,
  LabSpecialRule,
  ReservationDoc,
} from "../../shared/models";
import {ReservationRepository} from "./reservation.repository";

const REGION = "us-central1";
const MAX_RANGE_DAYS = 62;

type AvailabilityBlockKind =
  | "reservation"
  | "blockedPeriod"
  | "specialRule"
  | "weeklySchedule";

type AvailabilityBlockStatus = "busy" | "pending" | "blocked";

type AvailabilityBlockLabel =
  | "Ocupado"
  | "Pendiente de validacion"
  | "No disponible";

interface GetLabAvailabilityInput {
  labId?: unknown;
  from?: unknown;
  to?: unknown;
}

interface AvailabilityBusyBlock {
  id: string;
  startAt: string;
  endAt: string;
  label: AvailabilityBlockLabel;
  kind: AvailabilityBlockKind;
  status: AvailabilityBlockStatus;
}

interface GetLabAvailabilityOutput {
  labId: string;
  from: string;
  to: string;
  busyBlocks: AvailabilityBusyBlock[];
  blockedPeriods: AvailabilityBusyBlock[];
}

/**
 * Returns sanitized internal availability blocks for a laboratory.
 */
export const getLabAvailability = onCall(
    {
      region: REGION,
      invoker: "public",
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<GetLabAvailabilityOutput> => {
      const uid = request.auth?.uid;

      if (!uid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para consultar disponibilidad.",
        );
      }

      const input = parseInput(request.data);
      const db = getFirestore();
      const repository = new ReservationRepository(db);
      const profile = await repository.getUserProfile(uid);

      validateProfile(profile);

      const lab = await repository.getLab(input.labId, undefined);
      validateLab(lab);
      validateRange(input.from, input.to);

      const reservations = await findBlockingReservations(
          repository,
          input.labId,
          input.from,
          input.to,
      );
      const blockedPeriods = await repository.findActiveBlockedPeriods(
          input.labId,
          input.from,
          input.to,
      );

      return {
        labId: input.labId,
        from: input.from.toISOString(),
        to: input.to.toISOString(),
        busyBlocks: reservations.map((reservation) =>
          toReservationBlock(repository, reservation),
        ),
        blockedPeriods: [
          ...blockedPeriods.map((blockedPeriod) =>
            toBlockedPeriodBlock(repository, blockedPeriod),
          ),
          ...toSpecialRuleBlocks(lab, input.from, input.to),
        ],
      };
    },
);

/**
 * Parses callable input.
 *
 * @param {unknown} data Callable data.
 * @return {{labId: string, from: Date, to: Date}} Parsed input.
 */
function parseInput(data: unknown): {labId: string; from: Date; to: Date} {
  const record = data as GetLabAvailabilityInput;
  const labId = normalizeString(record?.labId);
  const from = parseDate(record?.from, "from");
  const to = parseDate(record?.to, "to");

  if (!labId) {
    throw new HttpsError(
        "invalid-argument",
        "El laboratorio es obligatorio.",
    );
  }

  return {labId, from, to};
}

/**
 * Builds sanitized blocks from active lab special rules.
 *
 * @param {LabDoc} lab Laboratory.
 * @param {Date} rangeFrom Visible range start.
 * @param {Date} rangeTo Visible range end.
 * @return {AvailabilityBusyBlock[]} Sanitized special rule blocks.
 */
function toSpecialRuleBlocks(
    lab: LabDoc,
    rangeFrom: Date,
    rangeTo: Date,
): AvailabilityBusyBlock[] {
  return (lab.specialRules ?? [])
      .filter((rule) => rule.active)
      .flatMap((rule) => blocksForSpecialRule(rule, rangeFrom, rangeTo));
}

/**
 * Expands one special rule into visual availability blocks.
 *
 * @param {LabSpecialRule} rule Special rule.
 * @param {Date} rangeFrom Visible range start.
 * @param {Date} rangeTo Visible range end.
 * @return {AvailabilityBusyBlock[]} Sanitized blocks.
 */
function blocksForSpecialRule(
    rule: LabSpecialRule,
    rangeFrom: Date,
    rangeTo: Date,
): AvailabilityBusyBlock[] {
  const startDate = maxDate(startOfDay(rangeFrom), parseDay(rule.termStart));
  const termEndDate = parseDay(rule.termEnd);
  const endDate = minDate(
      startOfDay(rangeTo),
      termEndDate ? addDays(termEndDate, 1) : startOfDay(rangeTo),
  );

  if (!startDate || !endDate || startDate >= endDate) {
    return [];
  }

  const blocks: AvailabilityBusyBlock[] = [];

  for (
    let day = startOfDay(startDate);
    day < endDate;
    day = addDays(day, 1)
  ) {
    if (rule.daysOfWeek?.length && !rule.daysOfWeek.includes(day.getDay())) {
      continue;
    }

    const block = specialRuleBlockForDay(rule, day, rangeFrom, rangeTo);

    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

/**
 * Builds one block for a day if it overlaps the requested range.
 *
 * @param {LabSpecialRule} rule Special rule.
 * @param {Date} day Day.
 * @param {Date} rangeFrom Visible range start.
 * @param {Date} rangeTo Visible range end.
 * @return {AvailabilityBusyBlock | null} Block or null.
 */
function specialRuleBlockForDay(
    rule: LabSpecialRule,
    day: Date,
    rangeFrom: Date,
    rangeTo: Date,
): AvailabilityBusyBlock | null {
  const startAt = rule.fullDayBlocked ?
    day :
    timeOnDay(day, rule.blockedStart);
  const endAt = rule.fullDayBlocked ?
    addDays(day, 1) :
    timeOnDay(day, rule.blockedEnd);

  if (!startAt || !endAt || startAt >= endAt) {
    return null;
  }

  if (startAt >= rangeTo || endAt <= rangeFrom) {
    return null;
  }

  return {
    id: `special-rule-${rule.id}-${dateKey(day)}`,
    startAt: toIso(startAt),
    endAt: toIso(endAt),
    label: "No disponible",
    kind: "specialRule",
    status: "blocked",
  };
}

/**
 * Validates user profile for availability reads.
 *
 * @param {AppUser | null} profile User profile.
 */
function validateProfile(profile: AppUser | null): void {
  if (!profile || profile.active !== true) {
    throw new HttpsError(
        "permission-denied",
        "El perfil institucional no esta activo.",
    );
  }

  if (!["docente", "responsable_laboratorio", "admin_sistemas"].includes(
      profile.role,
  )) {
    throw new HttpsError(
        "permission-denied",
        "El rol institucional no es valido.",
    );
  }
}

/**
 * Validates target lab.
 *
 * @param {LabDoc | null} lab Laboratory.
 */
function validateLab(lab: LabDoc | null): asserts lab is LabDoc {
  if (!lab || lab.active !== true) {
    throw new HttpsError(
        "failed-precondition",
        "El laboratorio no esta disponible.",
    );
  }
}

/**
 * Validates requested range.
 *
 * @param {Date} from Range start.
 * @param {Date} to Range end.
 */
function validateRange(from: Date, to: Date): void {
  if (from >= to) {
    throw new HttpsError(
        "invalid-argument",
        "El rango de disponibilidad no es valido.",
    );
  }

  const days = (to.getTime() - from.getTime()) / 86_400_000;

  if (days > MAX_RANGE_DAYS) {
    throw new HttpsError(
        "invalid-argument",
        "El rango de disponibilidad es demasiado amplio.",
    );
  }
}

/**
 * Finds blocking reservations for the requested lab and range.
 *
 * @param {ReservationRepository} repository Reservation repository.
 * @param {string} labId Laboratory id.
 * @param {Date} from Range start.
 * @param {Date} to Range end.
 * @return {Promise<ReservationDoc[]>} Matching reservations.
 */
async function findBlockingReservations(
    repository: ReservationRepository,
    labId: string,
    from: Date,
    to: Date,
): Promise<ReservationDoc[]> {
  return repository.runTransaction((transaction) =>
    repository.findBlockingConflicts(transaction, labId, from, to),
  );
}

/**
 * Builds a sanitized reservation availability block.
 *
 * @param {ReservationRepository} repository Reservation repository.
 * @param {ReservationDoc} reservation Reservation document.
 * @return {AvailabilityBusyBlock} Sanitized block.
 */
function toReservationBlock(
    repository: ReservationRepository,
    reservation: ReservationDoc,
): AvailabilityBusyBlock {
  const startAt = repository.toDate(reservation.startAt);
  const endAt = repository.toDate(reservation.endAt);
  const pending = reservation.status === "PENDIENTE_VALIDACION";

  return {
    id: reservation.id,
    startAt: toIso(startAt),
    endAt: toIso(endAt),
    label: pending ? "Pendiente de validacion" : "Ocupado",
    kind: "reservation",
    status: pending ? "pending" : "busy",
  };
}

/**
 * Builds a sanitized blocked-period availability block.
 *
 * @param {ReservationRepository} repository Reservation repository.
 * @param {BlockedPeriodDoc} blockedPeriod Blocked period document.
 * @return {AvailabilityBusyBlock} Sanitized block.
 */
function toBlockedPeriodBlock(
    repository: ReservationRepository,
    blockedPeriod: BlockedPeriodDoc,
): AvailabilityBusyBlock {
  return {
    id: blockedPeriod.id,
    startAt: toIso(repository.toDate(blockedPeriod.startAt)),
    endAt: toIso(repository.toDate(blockedPeriod.endAt)),
    label: "No disponible",
    kind: "blockedPeriod",
    status: "blocked",
  };
}

/**
 * Parses a date input.
 *
 * @param {unknown} value Date value.
 * @param {string} field Field name.
 * @return {Date} Parsed date.
 */
function parseDate(value: unknown, field: string): Date {
  if (typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${field} debe ser una fecha valida.`,
    );
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${field} debe ser una fecha valida.`,
    );
  }

  return parsed;
}

/**
 * Normalizes strings.
 *
 * @param {unknown} value Value.
 * @return {string} Normalized string.
 */
function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Converts nullable date to ISO.
 *
 * @param {Date | null} date Date.
 * @return {string} ISO date.
 */
function toIso(date: Date | null): string {
  if (!date) {
    throw new HttpsError(
        "internal",
        "La disponibilidad contiene una fecha no valida.",
    );
  }

  return date.toISOString();
}

/**
 * Parses a YYYY-MM-DD day.
 *
 * @param {string | undefined} value Day value.
 * @return {Date | null} Parsed day.
 */
function parseDay(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Returns start of day.
 *
 * @param {Date} date Date.
 * @return {Date} Start of day.
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Adds days.
 *
 * @param {Date} date Date.
 * @param {number} days Days.
 * @return {Date} Result.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Combines a day and HH:mm time.
 *
 * @param {Date} day Day.
 * @param {string | undefined} time Time.
 * @return {Date | null} Combined date.
 */
function timeOnDay(day: Date, time: string | undefined): Date | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Returns max non-null date.
 *
 * @param {Date | null} first First date.
 * @param {Date | null} second Second date.
 * @return {Date | null} Max date.
 */
function maxDate(first: Date | null, second: Date | null): Date | null {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return first > second ? first : second;
}

/**
 * Returns min non-null date.
 *
 * @param {Date | null} first First date.
 * @param {Date | null} second Second date.
 * @return {Date | null} Min date.
 */
function minDate(first: Date | null, second: Date | null): Date | null {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return first < second ? first : second;
}

/**
 * Builds a local date key.
 *
 * @param {Date} date Date.
 * @return {string} YYYY-MM-DD key.
 */
function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
