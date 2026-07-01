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
        blockedPeriods: blockedPeriods.map((blockedPeriod) =>
          toBlockedPeriodBlock(repository, blockedPeriod),
        ),
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
