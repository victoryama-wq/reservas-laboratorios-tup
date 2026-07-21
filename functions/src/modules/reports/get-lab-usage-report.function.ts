import {
  DocumentSnapshot,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {
  AppUser,
  LabDoc,
  ReservationDoc,
} from "../../shared/models";
import {INSTITUTIONAL_TIME_ZONE} from
  "../reservations/reservation.utils";
import {
  GetLabUsageReportInput,
  GetLabUsageReportOutput,
  LabUsageSummary,
  ReportLabOption,
  ReportRole,
} from "./lab-usage-report.types";

const REGION = "us-central1";
const MIN_REPORT_YEAR = 2020;
const EFFECTIVE_USAGE_STATUSES = new Set([
  "CONFIRMADA",
  "CONFIRMADA_TRAS_VALIDACION",
]);
const ALLOWED_INPUT_FIELDS = new Set([
  "year",
  "monthFrom",
  "monthTo",
  "labIds",
]);

interface ParsedReportInput {
  year: number;
  monthFrom: number;
  monthTo: number;
  labIds?: string[];
}

interface UsageAccumulator {
  reservations: number;
  reservedMinutes: number;
}

/**
 * Returns aggregate laboratory usage without personal reservation data.
 */
export const getLabUsageReport = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<GetLabUsageReportOutput> => {
      const uid = request.auth?.uid;

      if (!uid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para consultar reportes.",
        );
      }

      const input = parseInput(request.data);
      const db = getFirestore();
      const profileSnapshot = await db.collection("users").doc(uid).get();
      const profile = profileSnapshot.exists ?
        profileSnapshot.data() as AppUser :
        null;
      const role = validateProfile(profile);
      const authorizedLabs = await readAuthorizedLabs(profile, role);
      const selectedLabs = selectLabs(
          authorizedLabs,
          input.labIds,
          role,
      );

      if (selectedLabs.length === 0) {
        return emptyReport(input, role, authorizedLabs);
      }

      const rangeStart = zonedMonthBoundary(
          input.year,
          input.monthFrom,
      );
      const rangeEnd = zonedMonthBoundary(
          input.monthTo === 12 ? input.year + 1 : input.year,
          input.monthTo === 12 ? 1 : input.monthTo + 1,
      );
      const reservationsSnapshot = await db
          .collection("reservations")
          .where("startAt", ">=", Timestamp.fromDate(rangeStart))
          .where("startAt", "<", Timestamp.fromDate(rangeEnd))
          .get();
      const report = aggregateUsage(
          reservationsSnapshot.docs.map((document) => ({
            ...(document.data() as ReservationDoc),
            id: document.id,
          })),
          input,
          role,
          authorizedLabs,
          selectedLabs,
      );

      logger.info("Reporte agregado de uso de laboratorios generado.", {
        actorUid: uid,
        role,
        year: input.year,
        monthFrom: input.monthFrom,
        monthTo: input.monthTo,
        selectedLabsCount: selectedLabs.length,
        reservationsCount: report.summary.confirmedReservations,
      });

      return report;
    },
);

/**
 * Parses and validates callable input.
 *
 * @param {unknown} data Raw callable input.
 * @return {ParsedReportInput} Validated input.
 */
function parseInput(data: unknown): ParsedReportInput {
  const record = (isRecord(data) ? data : {}) as
    Partial<GetLabUsageReportInput> & Record<string, unknown>;
  const unknownField = Object.keys(record)
      .find((field) => !ALLOWED_INPUT_FIELDS.has(field));

  if (unknownField) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${unknownField} no esta permitido.`,
    );
  }

  const currentYear = getInstitutionalYear(new Date());
  const year = record.year === undefined ? currentYear : record.year;
  const monthFrom = record.monthFrom === undefined ? 1 : record.monthFrom;
  const monthTo = record.monthTo === undefined ? 12 : record.monthTo;

  if (typeof year !== "number" || !Number.isInteger(year)) {
    throw new HttpsError(
        "invalid-argument",
        "El anio debe ser un numero entero.",
    );
  }

  if (year < MIN_REPORT_YEAR || year > currentYear + 1) {
    throw new HttpsError(
        "invalid-argument",
        `El anio debe estar entre ${MIN_REPORT_YEAR} y ${currentYear + 1}.`,
    );
  }

  validateMonth(monthFrom, "monthFrom");
  validateMonth(monthTo, "monthTo");

  if (monthFrom > monthTo) {
    throw new HttpsError(
        "invalid-argument",
        "El mes inicial no puede ser posterior al mes final.",
    );
  }

  return {
    year,
    monthFrom,
    monthTo,
    labIds: parseLabIds(record.labIds),
  };
}

/**
 * Validates one month value.
 *
 * @param {unknown} value Month value.
 * @param {string} field Field name.
 */
function validateMonth(value: unknown, field: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 12) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${field} debe ser un mes entre 1 y 12.`,
    );
  }
}

/**
 * Parses optional laboratory ids.
 *
 * @param {unknown} value Candidate ids.
 * @return {string[] | undefined} Normalized ids.
 */
function parseLabIds(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) =>
    typeof item !== "string" || item.trim().length === 0)) {
    throw new HttpsError(
        "invalid-argument",
        "labIds debe ser un arreglo de identificadores validos.",
    );
  }

  return [...new Set(value.map((item) => item.trim()))];
}

/**
 * Validates active report roles.
 *
 * @param {AppUser | null} profile User profile.
 * @return {ReportRole} Authorized role.
 */
function validateProfile(profile: AppUser | null): ReportRole {
  if (!profile || profile.active !== true) {
    throw new HttpsError(
        "permission-denied",
        "El perfil institucional no esta activo.",
    );
  }

  if (
    profile.role !== "admin_sistemas" &&
    profile.role !== "responsable_laboratorio"
  ) {
    throw new HttpsError(
        "permission-denied",
        "No tiene permiso para consultar reportes.",
    );
  }

  return profile.role;
}

/**
 * Reads the laboratories visible to the actor.
 *
 * @param {AppUser | null} profile User profile.
 * @param {ReportRole} role Authorized role.
 * @return {Promise<ReportLabOption[]>} Authorized labs.
 */
async function readAuthorizedLabs(
    profile: AppUser | null,
    role: ReportRole,
): Promise<ReportLabOption[]> {
  const db = getFirestore();

  if (role === "admin_sistemas") {
    const snapshot = await db.collection("labs").get();
    return snapshot.docs
        .map(toLabOption)
        .sort(compareLabNames);
  }

  const assignedIds = normalizeAssignedLabs(profile?.labsAssigned);

  if (assignedIds.length === 0) {
    return [];
  }

  const snapshots = await db.getAll(
      ...assignedIds.map((labId) => db.collection("labs").doc(labId)),
  );

  return snapshots
      .filter((snapshot) => snapshot.exists)
      .map(toLabOption)
      .sort(compareLabNames);
}

/**
 * Selects requested labs and enforces the actor scope.
 *
 * @param {ReportLabOption[]} authorizedLabs Actor labs.
 * @param {string[] | undefined} requestedLabIds Requested ids.
 * @param {ReportRole} role Actor role.
 * @return {ReportLabOption[]} Selected labs.
 */
function selectLabs(
    authorizedLabs: ReportLabOption[],
    requestedLabIds: string[] | undefined,
    role: ReportRole,
): ReportLabOption[] {
  if (!requestedLabIds?.length) {
    return authorizedLabs;
  }

  const authorizedById = new Map(
      authorizedLabs.map((lab) => [lab.id, lab]),
  );
  const unauthorizedId = requestedLabIds.find((id) => !authorizedById.has(id));

  if (unauthorizedId) {
    throw new HttpsError(
        role === "responsable_laboratorio" ?
          "permission-denied" :
          "invalid-argument",
        role === "responsable_laboratorio" ?
          "No tiene permiso para consultar uno de los laboratorios." :
          "Uno de los laboratorios solicitados no existe.",
    );
  }

  return requestedLabIds.map((id) => authorizedById.get(id)!);
}

/**
 * Aggregates effective reservations into the report contract.
 *
 * @param {ReservationDoc[]} reservations Reservation documents.
 * @param {ParsedReportInput} input Report scope.
 * @param {ReportRole} role Actor role.
 * @param {ReportLabOption[]} authorizedLabs Actor labs.
 * @param {ReportLabOption[]} selectedLabs Selected labs.
 * @return {GetLabUsageReportOutput} Aggregated report.
 */
function aggregateUsage(
    reservations: ReservationDoc[],
    input: ParsedReportInput,
    role: ReportRole,
    authorizedLabs: ReportLabOption[],
    selectedLabs: ReportLabOption[],
): GetLabUsageReportOutput {
  const selectedIds = new Set(selectedLabs.map((lab) => lab.id));
  const monthly = createMonthlyAccumulators(input.monthFrom, input.monthTo);
  const byLab = new Map<string, UsageAccumulator>(
      selectedLabs.map((lab) => [lab.id, emptyAccumulator()]),
  );

  for (const reservation of reservations) {
    if (
      !EFFECTIVE_USAGE_STATUSES.has(reservation.status) ||
      !selectedIds.has(reservation.labId)
    ) {
      continue;
    }

    const startAt = toDate(reservation.startAt);
    const endAt = toDate(reservation.endAt);

    if (!startAt || !endAt || endAt <= startAt) {
      logger.warn("Reserva omitida del reporte por fechas invalidas.", {
        reservationId: reservation.id,
        labId: reservation.labId,
      });
      continue;
    }

    const dateParts = getInstitutionalYearMonth(startAt);

    if (
      dateParts.year !== input.year ||
      dateParts.month < input.monthFrom ||
      dateParts.month > input.monthTo
    ) {
      continue;
    }

    const durationMinutes = Math.round(
        (endAt.getTime() - startAt.getTime()) / 60_000,
    );
    const monthAccumulator = monthly.get(dateParts.month);
    const labAccumulator = byLab.get(reservation.labId);

    if (!monthAccumulator || !labAccumulator) {
      continue;
    }

    monthAccumulator.reservations += 1;
    monthAccumulator.reservedMinutes += durationMinutes;
    labAccumulator.reservations += 1;
    labAccumulator.reservedMinutes += durationMinutes;
  }

  const monthlyUsage = [...monthly.entries()].map(([month, value]) => ({
    year: input.year,
    month,
    reservations: value.reservations,
    reservedHours: minutesToHours(value.reservedMinutes),
  }));
  const labNames = new Map(selectedLabs.map((lab) => [lab.id, lab.name]));
  const usageByLab = [...byLab.entries()]
      .map(([labId, value]): LabUsageSummary => ({
        labId,
        labName: labNames.get(labId) ?? "Laboratorio",
        reservations: value.reservations,
        reservedHours: minutesToHours(value.reservedMinutes),
      }))
      .sort(compareLabUsage);
  const confirmedReservations = monthlyUsage.reduce(
      (total, month) => total + month.reservations,
      0,
  );
  const totalReservedMinutes = [...monthly.values()].reduce(
      (total, month) => total + month.reservedMinutes,
      0,
  );
  const mostUsedLab = usageByLab.find((lab) => lab.reservations > 0);

  return {
    scope: {
      year: input.year,
      monthFrom: input.monthFrom,
      monthTo: input.monthTo,
      role,
      selectedLabIds: selectedLabs.map((lab) => lab.id),
    },
    summary: {
      confirmedReservations,
      totalReservedHours: minutesToHours(totalReservedMinutes),
      averageReservationHours: confirmedReservations > 0 ?
        minutesToHours(totalReservedMinutes / confirmedReservations) :
        0,
      mostUsedLabId: mostUsedLab?.labId,
      mostUsedLabName: mostUsedLab?.labName,
      mostUsedLabReservations: mostUsedLab?.reservations,
    },
    monthlyUsage,
    usageByLab,
    authorizedLabs,
  };
}

/**
 * Creates a zero-valued report.
 *
 * @param {ParsedReportInput} input Report scope.
 * @param {ReportRole} role Actor role.
 * @param {ReportLabOption[]} authorizedLabs Actor labs.
 * @return {GetLabUsageReportOutput} Empty report.
 */
function emptyReport(
    input: ParsedReportInput,
    role: ReportRole,
    authorizedLabs: ReportLabOption[],
): GetLabUsageReportOutput {
  return {
    scope: {
      year: input.year,
      monthFrom: input.monthFrom,
      monthTo: input.monthTo,
      role,
      selectedLabIds: [],
    },
    summary: {
      confirmedReservations: 0,
      totalReservedHours: 0,
      averageReservationHours: 0,
    },
    monthlyUsage: [...createMonthlyAccumulators(
        input.monthFrom,
        input.monthTo,
    ).keys()].map((month) => ({
      year: input.year,
      month,
      reservations: 0,
      reservedHours: 0,
    })),
    usageByLab: [],
    authorizedLabs,
  };
}

/**
 * Converts a lab snapshot into the safe report option.
 *
 * @param {DocumentSnapshot} snapshot Lab snapshot.
 * @return {ReportLabOption} Safe option.
 */
function toLabOption(snapshot: DocumentSnapshot): ReportLabOption {
  const lab = snapshot.data() as Partial<LabDoc> | undefined;
  return {
    id: snapshot.id,
    name: typeof lab?.name === "string" && lab.name.trim() ?
      lab.name.trim() :
      "Laboratorio sin nombre",
  };
}

/**
 * Normalizes assigned lab ids.
 *
 * @param {unknown} value Candidate assigned labs.
 * @return {string[]} Valid unique ids.
 */
function normalizeAssignedLabs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string =>
    typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim()))];
}

/**
 * Creates monthly zero accumulators.
 *
 * @param {number} monthFrom First month.
 * @param {number} monthTo Last month.
 * @return {Map<number, UsageAccumulator>} Monthly map.
 */
function createMonthlyAccumulators(
    monthFrom: number,
    monthTo: number,
): Map<number, UsageAccumulator> {
  const monthly = new Map<number, UsageAccumulator>();

  for (let month = monthFrom; month <= monthTo; month += 1) {
    monthly.set(month, emptyAccumulator());
  }

  return monthly;
}

/**
 * Creates an empty usage accumulator.
 *
 * @return {UsageAccumulator} Empty accumulator.
 */
function emptyAccumulator(): UsageAccumulator {
  return {reservations: 0, reservedMinutes: 0};
}

/**
 * Converts stored dates into JavaScript dates.
 *
 * @param {unknown} value Stored date.
 * @return {Date | null} Parsed date.
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (isLegacyTimestampShape(value)) {
    return new Timestamp(value._seconds, value._nanoseconds ?? 0).toDate();
  }

  if (isClientTimestampShape(value)) {
    return new Timestamp(value.seconds, value.nanoseconds ?? 0).toDate();
  }

  return null;
}

/**
 * Checks a supported serialized Timestamp shape.
 *
 * @param {unknown} value Candidate value.
 * @return {boolean} Whether the shape is supported.
 */
function isLegacyTimestampShape(value: unknown): value is {
  _seconds: number;
  _nanoseconds?: number;
} {
  return isRecord(value) && typeof value._seconds === "number";
}

/**
 * Checks a serialized client Timestamp shape.
 *
 * @param {unknown} value Candidate value.
 * @return {boolean} Whether the shape is supported.
 */
function isClientTimestampShape(value: unknown): value is {
  seconds: number;
  nanoseconds?: number;
} {
  return isRecord(value) && typeof value.seconds === "number";
}

/**
 * Gets the current institutional year.
 *
 * @param {Date} date Date.
 * @return {number} Institutional year.
 */
function getInstitutionalYear(date: Date): number {
  return getInstitutionalYearMonth(date).year;
}

/**
 * Gets institutional year and month.
 *
 * @param {Date} date Date.
 * @return {{year: number, month: number}} Date parts.
 */
function getInstitutionalYearMonth(date: Date): {
  year: number;
  month: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: INSTITUTIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  });
  const parts = Object.fromEntries(
      formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
  };
}

/**
 * Converts a local institutional month boundary to UTC.
 *
 * @param {number} year Institutional year.
 * @param {number} month Institutional month, 1 to 12.
 * @return {Date} UTC instant for local month start.
 */
function zonedMonthBoundary(year: number, month: number): Date {
  const targetUtc = Date.UTC(year, month - 1, 1, 0, 0, 0);
  let candidate = new Date(targetUtc);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = getInstitutionalDateTime(candidate);
    const representedUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
    );
    candidate = new Date(candidate.getTime() + targetUtc - representedUtc);
  }

  return candidate;
}

/**
 * Gets institutional numeric date-time parts.
 *
 * @param {Date} date Date.
 * @return {{year: number, month: number, day: number, hour: number,
 * minute: number}} Parts.
 */
function getInstitutionalDateTime(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: INSTITUTIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
      formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/**
 * Converts minutes to rounded decimal hours.
 *
 * @param {number} minutes Minutes.
 * @return {number} Hours with two decimals.
 */
function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Sorts lab options by Spanish name.
 *
 * @param {ReportLabOption} first First lab.
 * @param {ReportLabOption} second Second lab.
 * @return {number} Sort result.
 */
function compareLabNames(
    first: ReportLabOption,
    second: ReportLabOption,
): number {
  return first.name.localeCompare(second.name, "es");
}

/**
 * Sorts usage from most to least reservations.
 *
 * @param {LabUsageSummary} first First usage.
 * @param {LabUsageSummary} second Second usage.
 * @return {number} Sort result.
 */
function compareLabUsage(
    first: LabUsageSummary,
    second: LabUsageSummary,
): number {
  return second.reservations - first.reservations ||
    second.reservedHours - first.reservedHours ||
    first.labName.localeCompare(second.labName, "es");
}

/**
 * Checks whether a value is a plain record.
 *
 * @param {unknown} value Candidate value.
 * @return {boolean} Whether it is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
