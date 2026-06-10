import {HttpsError} from "firebase-functions/v2/https";

import {
  AppUser,
  LabDoc,
  LabSpecialRule,
  UserRole,
} from "../../shared/models";
import {
  CreateReservationInput,
  ProtocolFileInput,
  RejectionDecision,
} from "./reservation.types";
import {
  getInstitutionalDayIndex,
  getScheduleDayKey,
  toInstitutionalDateKey,
  toTimeString,
} from "./reservation.utils";

const INSTITUTIONAL_DOMAIN = "@tecplayacar.edu.mx";
const MAX_PROTOCOL_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_PROTOCOL_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_PRACTICE_TYPES = [
  "Teórica",
  "Simulación",
  "Taller",
  "Evaluación práctica",
  "Investigación",
  "Otro",
] as const;
const MAX_PRACTICE_TYPE_OTHER_LENGTH = 120;
const ALLOWED_ROLES: UserRole[] = [
  "docente",
  "responsable_laboratorio",
  "admin_sistemas",
];

/**
 * Validates callable input shape.
 *
 * @param {unknown} data Callable data.
 * @return {CreateReservationInput} Typed input.
 */
export function parseCreateReservationInput(
    data: unknown,
): CreateReservationInput {
  const input = data as Partial<CreateReservationInput>;

  if (!input.labId && !input.labSlug) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar el laboratorio solicitado.",
    );
  }

  const requiredTextFields = [
    "subject",
    "group",
    "practiceName",
    "objective",
    "practiceType",
    "startAt",
    "endAt",
  ] as const;

  for (const field of requiredTextFields) {
    if (!isNonEmptyString(input[field])) {
      throw new HttpsError(
          "invalid-argument",
          `El campo ${field} es obligatorio.`,
      );
    }
  }

  if (typeof input.risky !== "boolean") {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar si la practica es riesgosa.",
    );
  }

  if (typeof input.externalParticipants !== "boolean") {
    throw new HttpsError(
        "invalid-argument",
        [
          "Debe indicar si participan pacientes, usuarios simulados",
          "o poblacion externa.",
        ].join(" "),
    );
  }

  const practiceType = validatePracticeType(
      input.practiceType?.trim() ?? "",
      input.practiceTypeOther,
  );

  return {
    labId: input.labId,
    labSlug: input.labSlug,
    subject: input.subject?.trim() ?? "",
    group: input.group?.trim() ?? "",
    practiceName: input.practiceName?.trim() ?? "",
    objective: input.objective?.trim() ?? "",
    materialRequired: input.materialRequired?.trim() ?? "",
    practiceType: practiceType.practiceType,
    practiceTypeOther: practiceType.practiceTypeOther,
    risky: input.risky,
    externalParticipants: input.externalParticipants,
    startAt: input.startAt ?? "",
    endAt: input.endAt ?? "",
    protocolFiles: input.protocolFiles ?? [],
    source: parseSource(input.source),
  };
}

/**
 * Validates user profile and institutional account.
 *
 * @param {AppUser | null} profile User profile.
 * @param {string | undefined} authEmail Auth email.
 */
export function validateUserProfile(
    profile: AppUser | null,
    authEmail: string | undefined,
): void {
  if (!profile) {
    throw new HttpsError(
        "permission-denied",
        "Su perfil institucional no existe.",
    );
  }

  if (!profile.active) {
    throw new HttpsError(
        "permission-denied",
        "Su perfil institucional esta inactivo.",
    );
  }

  if (!ALLOWED_ROLES.includes(profile.role)) {
    throw new HttpsError("permission-denied", "El rol no es valido.");
  }

  const email = authEmail ?? profile.email;
  if (!email.endsWith(INSTITUTIONAL_DOMAIN)) {
    throw new HttpsError(
        "permission-denied",
        "Use su correo institucional para reservar.",
    );
  }
}

/**
 * Validates laboratory base state.
 *
 * @param {LabDoc | null} lab Laboratory.
 */
export function validateLab(lab: LabDoc | null): void {
  if (!lab) {
    throw new HttpsError("not-found", "El laboratorio no existe.");
  }

  if (!lab.active) {
    throw new HttpsError(
        "failed-precondition",
        "El laboratorio no esta activo.",
    );
  }
}

/**
 * Returns rejection decision for schedule-related validations.
 *
 * @param {CreateReservationInput} input Create reservation input.
 * @param {LabDoc} lab Laboratory.
 * @param {Date} startAt Start date.
 * @param {Date} endAt End date.
 * @param {Date} now Current date.
 * @return {RejectionDecision | null} Rejection decision.
 */
export function validateReservationTiming(
    input: CreateReservationInput,
    lab: LabDoc,
    startAt: Date,
    endAt: Date,
    now: Date,
): RejectionDecision | null {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new HttpsError(
        "invalid-argument",
        "La fecha u hora de la reserva no es valida.",
    );
  }

  if (endAt <= startAt) {
    throw new HttpsError(
        "invalid-argument",
        "La hora final debe ser mayor que la hora inicial.",
    );
  }

  const today = toInstitutionalDateKey(now);
  const reservationDay = toInstitutionalDateKey(startAt);

  if (reservationDay < today) {
    return {
      status: "RECHAZADA_REGLA_HORARIO",
      reason: "La fecha no puede ser anterior a hoy.",
    };
  }

  const minNoticeDate = new Date(now);
  minNoticeDate.setHours(minNoticeDate.getHours() + lab.minNoticeHours);
  if (lab.minNoticeHours > 0 && startAt < minNoticeDate) {
    return {
      status: "RECHAZADA_MIN_ANTICIPACION",
      reason: "No cumple las horas minimas de anticipacion.",
    };
  }

  const scheduleDecision = validateWeeklySchedule(lab, startAt, endAt);
  if (scheduleDecision) {
    return scheduleDecision;
  }

  return validateSpecialRules(lab.specialRules, startAt, endAt, input);
}

/**
 * Validates timing rules when a pending reservation is reviewed.
 *
 * @param {LabDoc} lab Laboratory.
 * @param {Date} startAt Reservation start.
 * @param {Date} endAt Reservation end.
 * @param {Date} now Current date.
 */
export function validateReservationReviewTiming(
    lab: LabDoc,
    startAt: Date,
    endAt: Date,
    now: Date,
): void {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new HttpsError(
        "failed-precondition",
        "La fecha u hora de la reserva no es valida.",
    );
  }

  if (endAt <= startAt) {
    throw new HttpsError(
        "failed-precondition",
        "La hora final debe ser mayor que la hora inicial.",
    );
  }

  if (endAt <= now) {
    throw new HttpsError(
        "failed-precondition",
        "La reserva ya vencio y no puede aprobarse.",
    );
  }

  const scheduleDecision = validateWeeklySchedule(lab, startAt, endAt);
  if (scheduleDecision) {
    throw new HttpsError("failed-precondition", scheduleDecision.reason);
  }

  const specialRulesDecision = validateSpecialRules(
      lab.specialRules,
      startAt,
      endAt,
      {
        labId: lab.id,
        subject: "",
        group: "",
        practiceName: "",
        objective: "",
        materialRequired: "",
        practiceType: "Teórica",
        risky: false,
        externalParticipants: false,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        protocolFiles: [],
        source: "web",
      },
  );
  if (specialRulesDecision) {
    throw new HttpsError("failed-precondition", specialRulesDecision.reason);
  }
}

/**
 * Validates protocol files ownership.
 *
 * @param {CreateReservationInput} input Create reservation input.
 * @param {LabDoc} lab Laboratory.
 * @param {string} uid Authenticated user uid.
 */
export function validateProtocolFiles(
    input: CreateReservationInput,
    lab: LabDoc,
    uid: string,
): void {
  const protocolFiles = input.protocolFiles ?? [];
  const protocolRequired = input.risky || input.externalParticipants;

  void lab;

  if (protocolRequired && !protocolFiles.length) {
    throw new HttpsError(
        "failed-precondition",
        [
          "Esta solicitud requiere protocolo porque involucra",
          "material riesgoso o participacion de pacientes, usuarios",
          "simulados o poblacion externa.",
        ].join(" "),
    );
  }

  for (const file of protocolFiles) {
    validateProtocolFile(file, uid);
  }
}

/**
 * Parses reservation dates.
 *
 * @param {CreateReservationInput} input Create reservation input.
 * @return {{startAt: Date, endAt: Date}} Date range.
 */
export function parseReservationDates(
    input: CreateReservationInput,
): { startAt: Date; endAt: Date } {
  return {
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
  };
}

/**
 * Checks whether a string is useful input.
 *
 * @param {unknown} value Value to check.
 * @return {boolean} Whether value is non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates reservation source.
 *
 * @param {unknown} source Source value.
 * @return {"web" | "qr" | "admin"} Valid source.
 */
function parseSource(source: unknown): "web" | "qr" | "admin" {
  if (source === "web" || source === "qr" || source === "admin") {
    return source;
  }

  return "web";
}

/**
 * Validates official practice type and optional custom value.
 *
 * @param {string} practiceType Practice type.
 * @param {unknown} practiceTypeOther Custom type.
 * @return {object} Parsed practice type.
 */
function validatePracticeType(
    practiceType: string,
    practiceTypeOther: unknown,
): { practiceType: string; practiceTypeOther?: string } {
  if (!ALLOWED_PRACTICE_TYPES.includes(
      practiceType as typeof ALLOWED_PRACTICE_TYPES[number],
  )) {
    throw new HttpsError(
        "invalid-argument",
        "El tipo de practica no es valido.",
    );
  }

  if (practiceType !== "Otro") {
    return {practiceType};
  }

  if (!isNonEmptyString(practiceTypeOther)) {
    throw new HttpsError(
        "invalid-argument",
        "Debe especificar el tipo de practica.",
    );
  }

  const trimmed = practiceTypeOther.trim();
  if (trimmed.length > MAX_PRACTICE_TYPE_OTHER_LENGTH) {
    throw new HttpsError(
        "invalid-argument",
        "La especificacion del tipo de practica es demasiado larga.",
    );
  }

  return {
    practiceType,
    practiceTypeOther: trimmed,
  };
}

/**
 * Validates one protocol file.
 *
 * @param {ProtocolFile} file Protocol file.
 * @param {string} uid User uid.
 */
function validateProtocolFile(file: ProtocolFileInput, uid: string): void {
  if (!isNonEmptyString(file.storagePath) ||
      !isNonEmptyString(file.fileName) ||
      !isNonEmptyString(file.contentType) ||
      !isNonEmptyString(file.uploadedAt)) {
    throw new HttpsError(
        "invalid-argument",
        "La metadata del protocolo esta incompleta.",
    );
  }

  if (file.uploadedByUid !== uid) {
    throw new HttpsError(
        "permission-denied",
        "El archivo de protocolo no pertenece al usuario autenticado.",
    );
  }

  if (!file.storagePath.startsWith(`protocolUploads/${uid}/`)) {
    throw new HttpsError(
        "permission-denied",
        "La ruta del protocolo no es valida para este usuario.",
    );
  }

  if (!ALLOWED_PROTOCOL_CONTENT_TYPES.includes(file.contentType)) {
    throw new HttpsError(
        "invalid-argument",
        "El tipo de archivo de protocolo no esta permitido.",
    );
  }

  if (file.sizeBytes <= 0 || file.sizeBytes > MAX_PROTOCOL_SIZE_BYTES) {
    throw new HttpsError(
        "invalid-argument",
        "El protocolo excede el tamano maximo permitido.",
    );
  }

  if (Number.isNaN(new Date(file.uploadedAt).getTime())) {
    throw new HttpsError(
        "invalid-argument",
        "La fecha de carga del protocolo no es valida.",
    );
  }
}

/**
 * Validates weekly lab schedule.
 *
 * @param {LabDoc} lab Laboratory.
 * @param {Date} startAt Start date.
 * @param {Date} endAt End date.
 * @return {RejectionDecision | null} Rejection decision.
 */
function validateWeeklySchedule(
    lab: LabDoc,
    startAt: Date,
    endAt: Date,
): RejectionDecision | null {
  const dayKey = getScheduleDayKey(startAt) as keyof typeof lab.weeklySchedule;
  const schedule = lab.weeklySchedule[dayKey];

  if (!schedule?.enabled) {
    return {
      status: "RECHAZADA_REGLA_HORARIO",
      reason: "El laboratorio no esta disponible ese dia.",
    };
  }

  const startTime = toTimeString(startAt);
  const endTime = toTimeString(endAt);

  if (startTime < schedule.start || endTime > schedule.end) {
    return {
      status: "RECHAZADA_REGLA_HORARIO",
      reason: "El horario solicitado esta fuera del horario permitido.",
    };
  }

  return null;
}

/**
 * Validates active special rules.
 *
 * @param {LabSpecialRule[]} specialRules Lab special rules.
 * @param {Date} startAt Start date.
 * @param {Date} endAt End date.
 * @param {CreateReservationInput} input Create reservation input.
 * @return {RejectionDecision | null} Rejection decision.
 */
function validateSpecialRules(
    specialRules: LabSpecialRule[],
    startAt: Date,
    endAt: Date,
    input: CreateReservationInput,
): RejectionDecision | null {
  void input;

  const startTime = toTimeString(startAt);
  const endTime = toTimeString(endAt);

  for (const rule of specialRules.filter((item) => item.active)) {
    if (!ruleAppliesToDate(rule, startAt)) {
      continue;
    }

    if (rule.fullDayBlocked) {
      return {
        status: "RECHAZADA_REGLA_HORARIO",
        reason: rule.reason,
      };
    }

    if (
      rule.blockedStart &&
      rule.blockedEnd &&
      startTime < rule.blockedEnd &&
      rule.blockedStart < endTime
    ) {
      return {
        status: "RECHAZADA_REGLA_HORARIO",
        reason: rule.reason,
      };
    }
  }

  return null;
}

/**
 * Checks whether a special rule applies to a date.
 *
 * @param {LabSpecialRule} rule Special rule.
 * @param {Date} date Reservation date.
 * @return {boolean} Whether rule applies.
 */
function ruleAppliesToDate(rule: LabSpecialRule, date: Date): boolean {
  const dateKey = toInstitutionalDateKey(date);

  if (rule.termStart && rule.termStart > dateKey) {
    return false;
  }

  if (rule.termEnd && rule.termEnd < dateKey) {
    return false;
  }

  if (
    rule.daysOfWeek?.length &&
    !rule.daysOfWeek.includes(getInstitutionalDayIndex(date))
  ) {
    return false;
  }

  return true;
}
