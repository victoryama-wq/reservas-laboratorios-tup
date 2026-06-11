import {
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {
  AppUser,
  BlockedPeriodDoc,
  BlockedPeriodScope,
  LabDoc,
  LabSpecialRule,
} from "../../shared/models";
import {
  normalizeString,
  optionalBoolean,
  optionalDateStringYYYYMMDD,
  optionalTimeHHmm,
  parseIsoDate,
  parseStringArray,
  requireBoolean,
  requireRecord,
  sanitizeNullableString,
  sanitizeOptionalString,
  validateAllowedKeys,
  validateDateRange,
  validateDaysOfWeek,
  validateTimeHHmm,
  validateTimeRange,
} from "./admin-validation.utils";

const REGION = "us-central1";

const CREATE_SPECIAL_RULE_KEYS = new Set([
  "labId",
  "name",
  "active",
  "termStart",
  "termEnd",
  "daysOfWeek",
  "blockedStart",
  "blockedEnd",
  "fullDayBlocked",
  "reason",
]);
const UPDATE_SPECIAL_RULE_KEYS = new Set([
  "labId",
  "ruleId",
  "name",
  "active",
  "termStart",
  "termEnd",
  "daysOfWeek",
  "blockedStart",
  "blockedEnd",
  "fullDayBlocked",
  "reason",
]);
const CREATE_BLOCKED_PERIOD_KEYS = new Set([
  "name",
  "description",
  "reason",
  "scope",
  "labIds",
  "startAt",
  "endAt",
  "fullDay",
  "active",
]);
const UPDATE_BLOCKED_PERIOD_KEYS = new Set([
  "blockedPeriodId",
  "name",
  "description",
  "reason",
  "scope",
  "labIds",
  "startAt",
  "endAt",
  "fullDay",
  "active",
]);

interface AdminCreateSpecialRuleInput {
  labId: string;
  name: string;
  active: boolean;
  termStart?: string;
  termEnd?: string;
  daysOfWeek?: number[];
  blockedStart?: string;
  blockedEnd?: string;
  fullDayBlocked: boolean;
  reason: string;
}

interface AdminUpdateSpecialRuleInput {
  labId: string;
  ruleId: string;
  name?: string;
  active?: boolean;
  termStart?: string | null;
  termEnd?: string | null;
  daysOfWeek?: number[];
  blockedStart?: string | null;
  blockedEnd?: string | null;
  fullDayBlocked?: boolean;
  reason?: string;
}

interface AdminCreateBlockedPeriodInput {
  name: string;
  description?: string;
  reason: string;
  scope: BlockedPeriodScope;
  labIds?: string[];
  startAt: Date;
  endAt: Date;
  fullDay: boolean;
  active: boolean;
}

interface AdminUpdateBlockedPeriodInput {
  blockedPeriodId: string;
  name?: string;
  description?: string | null;
  reason?: string;
  scope?: BlockedPeriodScope;
  labIds?: string[];
  startAt?: Date;
  endAt?: Date;
  fullDay?: boolean;
  active?: boolean;
}

export interface AdminCreateSpecialRuleOutput {
  labId: string;
  ruleId: string;
  created: true;
  message: string;
}

export interface AdminUpdateSpecialRuleOutput {
  labId: string;
  ruleId: string;
  updated: true;
  message: string;
}

export interface AdminCreateBlockedPeriodOutput {
  blockedPeriodId: string;
  created: true;
  message: string;
}

export interface AdminUpdateBlockedPeriodOutput {
  blockedPeriodId: string;
  updated: true;
  message: string;
}

/**
 * Creates a lab special rule.
 */
export const adminCreateSpecialRule = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminCreateSpecialRuleOutput> => {
      const actorUid = requireAuth(request, "crear reglas especiales");
      const input = parseCreateSpecialRuleInput(request.data);
      const db = getFirestore();
      const actor = await getActiveAdmin(actorUid);
      const labRef = db.collection("labs").doc(input.labId);
      const auditRef = db.collection("auditEvents").doc();
      const now = Timestamp.now();
      const ruleId = db.collection("_ids").doc().id;

      await db.runTransaction(async (transaction) => {
        const labSnapshot = await transaction.get(labRef);
        if (!labSnapshot.exists) {
          throw new HttpsError("not-found", "El laboratorio no existe.");
        }
        const lab = labSnapshot.data() as LabDoc;
        const rule: LabSpecialRule = {
          id: ruleId,
          name: input.name,
          active: input.active,
          termStart: input.termStart,
          termEnd: input.termEnd,
          daysOfWeek: input.daysOfWeek,
          blockedStart: input.blockedStart,
          blockedEnd: input.blockedEnd,
          fullDayBlocked: input.fullDayBlocked,
          reason: input.reason,
        };
        const specialRules = [...(lab.specialRules ?? []), rule];

        transaction.update(labRef, {
          specialRules,
          updatedAt: now,
        });
        transaction.create(auditRef, buildAuditEvent({
          auditId: auditRef.id,
          actor,
          actorUid,
          targetCollection: "labs",
          targetId: input.labId,
          action: "ADMIN_CREATE_SPECIAL_RULE",
          description: `Regla especial creada: ${input.name}.`,
          metadata: {labId: input.labId, ruleId, active: input.active},
          now,
          actorEmail: request.auth?.token.email as string | undefined,
        }));
      });

      return {
        labId: input.labId,
        ruleId,
        created: true,
        message: "Regla especial creada correctamente.",
      };
    },
);

/**
 * Updates a lab special rule.
 */
export const adminUpdateSpecialRule = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminUpdateSpecialRuleOutput> => {
      const actorUid = requireAuth(request, "editar reglas especiales");
      const input = parseUpdateSpecialRuleInput(request.data);
      const db = getFirestore();
      const actor = await getActiveAdmin(actorUid);
      const labRef = db.collection("labs").doc(input.labId);
      const auditRef = db.collection("auditEvents").doc();
      const now = Timestamp.now();

      await db.runTransaction(async (transaction) => {
        const labSnapshot = await transaction.get(labRef);
        if (!labSnapshot.exists) {
          throw new HttpsError("not-found", "El laboratorio no existe.");
        }
        const lab = labSnapshot.data() as LabDoc;
        const ruleIndex = (lab.specialRules ?? []).findIndex((rule) =>
          rule.id === input.ruleId,
        );
        if (ruleIndex < 0) {
          throw new HttpsError("not-found", "La regla especial no existe.");
        }

        const specialRules = [...(lab.specialRules ?? [])];
        specialRules[ruleIndex] = buildSpecialRulePatch(
            specialRules[ruleIndex],
            input,
        );

        transaction.update(labRef, {specialRules, updatedAt: now});
        transaction.create(auditRef, buildAuditEvent({
          auditId: auditRef.id,
          actor,
          actorUid,
          targetCollection: "labs",
          targetId: input.labId,
          action: "ADMIN_UPDATE_SPECIAL_RULE",
          description: [
            "Regla especial actualizada:",
            `${specialRules[ruleIndex].name}.`,
          ].join(" "),
          metadata: {
            labId: input.labId,
            ruleId: input.ruleId,
            active: specialRules[ruleIndex].active,
          },
          now,
          actorEmail: request.auth?.token.email as string | undefined,
        }));
      });

      return {
        labId: input.labId,
        ruleId: input.ruleId,
        updated: true,
        message: "Regla especial actualizada correctamente.",
      };
    },
);

/**
 * Creates a blocked period.
 */
export const adminCreateBlockedPeriod = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminCreateBlockedPeriodOutput> => {
      const actorUid = requireAuth(request, "crear bloqueos");
      const input = parseCreateBlockedPeriodInput(request.data);
      const db = getFirestore();
      const actor = await getActiveAdmin(actorUid);
      await assertLabsExist(input.labIds ?? []);

      const now = Timestamp.now();
      const blockedPeriodRef = db.collection("blockedPeriods").doc();
      const auditRef = db.collection("auditEvents").doc();
      const document: BlockedPeriodDoc = {
        id: blockedPeriodRef.id,
        name: input.name,
        description: input.description,
        reason: input.reason,
        scope: input.scope,
        labIds: input.scope === "lab" ? input.labIds : [],
        startAt: Timestamp.fromDate(input.startAt),
        endAt: Timestamp.fromDate(input.endAt),
        fullDay: input.fullDay,
        active: input.active,
        createdBy: actorUid,
        createdAt: now,
        updatedAt: now,
      };

      await db.runTransaction(async (transaction) => {
        transaction.create(blockedPeriodRef, removeUndefined(document));
        transaction.create(auditRef, buildAuditEvent({
          auditId: auditRef.id,
          actor,
          actorUid,
          targetCollection: "blockedPeriods",
          targetId: blockedPeriodRef.id,
          action: "ADMIN_CREATE_BLOCKED_PERIOD",
          description: `Bloqueo extraordinario creado: ${input.name}.`,
          metadata: {
            blockedPeriodId: blockedPeriodRef.id,
            scope: input.scope,
            labIds: document.labIds ?? [],
            active: input.active,
          },
          now,
          actorEmail: request.auth?.token.email as string | undefined,
        }));
      });

      return {
        blockedPeriodId: blockedPeriodRef.id,
        created: true,
        message: "Bloqueo extraordinario creado correctamente.",
      };
    },
);

/**
 * Updates a blocked period.
 */
export const adminUpdateBlockedPeriod = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminUpdateBlockedPeriodOutput> => {
      const actorUid = requireAuth(request, "editar bloqueos");
      const input = parseUpdateBlockedPeriodInput(request.data);
      const db = getFirestore();
      const actor = await getActiveAdmin(actorUid);
      const blockedPeriodRef = db
          .collection("blockedPeriods")
          .doc(input.blockedPeriodId);
      const auditRef = db.collection("auditEvents").doc();
      const now = Timestamp.now();

      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(blockedPeriodRef);
        if (!snapshot.exists) {
          throw new HttpsError("not-found", "El bloqueo no existe.");
        }
        const current = snapshot.data() as BlockedPeriodDoc;
        const patch = await buildBlockedPeriodPatch(input, current);
        const changedFields = Object.keys(patch).filter((field) =>
          field !== "updatedAt",
        );
        if (changedFields.length === 0) {
          throw new HttpsError(
              "invalid-argument",
              "Debe enviar al menos un campo modificable.",
          );
        }

        patch.updatedAt = now;
        transaction.update(blockedPeriodRef, removeUndefined(patch));
        transaction.create(auditRef, buildAuditEvent({
          auditId: auditRef.id,
          actor,
          actorUid,
          targetCollection: "blockedPeriods",
          targetId: input.blockedPeriodId,
          action: "ADMIN_UPDATE_BLOCKED_PERIOD",
          description: `Bloqueo extraordinario actualizado: ${current.name}.`,
          metadata: {blockedPeriodId: input.blockedPeriodId, changedFields},
          now,
          actorEmail: request.auth?.token.email as string | undefined,
        }));
      });

      return {
        blockedPeriodId: input.blockedPeriodId,
        updated: true,
        message: "Bloqueo extraordinario actualizado correctamente.",
      };
    },
);

/**
 * Requires callable auth.
 *
 * @param {CallableRequest<unknown>} request Callable request.
 * @param {string} action Action label.
 * @return {string} Actor uid.
 */
function requireAuth(
    request: CallableRequest<unknown>,
    action: string,
): string {
  const actorUid = request.auth?.uid;
  if (!actorUid) {
    throw new HttpsError(
        "unauthenticated",
        `Debe iniciar sesion para ${action}.`,
    );
  }
  return actorUid;
}

/**
 * Ensures the actor is active Admin/Sistemas.
 *
 * @param {string} actorUid Actor uid.
 * @return {Promise<AppUser>} Actor profile.
 */
async function getActiveAdmin(actorUid: string): Promise<AppUser> {
  const snapshot = await getFirestore().collection("users").doc(actorUid).get();
  if (!snapshot.exists) {
    throw new HttpsError(
        "permission-denied",
        "El perfil de Admin/Sistemas no existe.",
    );
  }
  const actor = snapshot.data() as AppUser;
  if (!actor.active || actor.role !== "admin_sistemas") {
    throw new HttpsError(
        "permission-denied",
        "Solo Admin/Sistemas puede gestionar reglas y bloqueos.",
    );
  }
  return actor;
}

/**
 * Parses create special rule input.
 *
 * @param {unknown} data Callable payload.
 * @return {AdminCreateSpecialRuleInput} Parsed input.
 */
function parseCreateSpecialRuleInput(
    data: unknown,
): AdminCreateSpecialRuleInput {
  const record = requireRecord(data);
  validateAllowedKeys(record, CREATE_SPECIAL_RULE_KEYS);
  const fullDayBlocked = record.fullDayBlocked === undefined ?
    false :
    requireBoolean(record.fullDayBlocked, "fullDayBlocked");
  const parsed = parseSpecialRuleBase(record, true);

  return {
    labId: normalizeString(record.labId, "Debe indicar el laboratorio."),
    name: normalizeString(record.name, "El nombre es obligatorio."),
    active: requireBoolean(record.active, "active"),
    termStart: parsed.termStart ?? undefined,
    termEnd: parsed.termEnd ?? undefined,
    daysOfWeek: parsed.daysOfWeek,
    blockedStart: parsed.blockedStart ?? undefined,
    blockedEnd: parsed.blockedEnd ?? undefined,
    fullDayBlocked,
    reason: normalizeString(record.reason, "El motivo es obligatorio."),
  };
}

/**
 * Parses update special rule input.
 *
 * @param {unknown} data Callable payload.
 * @return {AdminUpdateSpecialRuleInput} Parsed input.
 */
function parseUpdateSpecialRuleInput(
    data: unknown,
): AdminUpdateSpecialRuleInput {
  const record = requireRecord(data);
  validateAllowedKeys(record, UPDATE_SPECIAL_RULE_KEYS);
  const fullDayBlocked = optionalBoolean(
      record.fullDayBlocked,
      "fullDayBlocked",
  );
  const parsed = parseSpecialRuleBase(record, false);

  return {
    labId: normalizeString(record.labId, "Debe indicar el laboratorio."),
    ruleId: normalizeString(record.ruleId, "Debe indicar la regla."),
    name: record.name === undefined ?
      undefined :
      normalizeString(record.name, "El nombre es obligatorio."),
    active: optionalBoolean(record.active, "active"),
    termStart: parsed.termStart,
    termEnd: parsed.termEnd,
    daysOfWeek: parsed.daysOfWeek,
    blockedStart: parsed.blockedStart,
    blockedEnd: parsed.blockedEnd,
    fullDayBlocked,
    reason: record.reason === undefined ?
      undefined :
      normalizeString(record.reason, "El motivo es obligatorio."),
  };
}

/**
 * Parses shared special rule values.
 *
 * @param {Record<string, unknown>} record Payload.
 * @param {boolean} requireBlockedRange Whether range is required.
 * @return {Partial<AdminUpdateSpecialRuleInput>} Parsed values.
 */
function parseSpecialRuleBase(
    record: Record<string, unknown>,
    requireBlockedRange: boolean,
): Partial<AdminUpdateSpecialRuleInput> {
  const termStart = optionalDateStringYYYYMMDD(record.termStart, "termStart");
  const termEnd = optionalDateStringYYYYMMDD(record.termEnd, "termEnd");
  validateDateRange(termStart, termEnd);
  const daysOfWeek = validateDaysOfWeek(record.daysOfWeek);
  const blockedStart = optionalTimeHHmm(record.blockedStart, "blockedStart");
  const blockedEnd = optionalTimeHHmm(record.blockedEnd, "blockedEnd");

  if (requireBlockedRange) {
    const fullDayBlocked = record.fullDayBlocked === undefined ?
      false :
      requireBoolean(record.fullDayBlocked, "fullDayBlocked");
    if (!fullDayBlocked && (!blockedStart || !blockedEnd)) {
      throw new HttpsError(
          "invalid-argument",
          "Debe indicar hora de inicio y fin si no es bloqueo de dia completo.",
      );
    }
    if (!fullDayBlocked && blockedStart && blockedEnd) {
      validateTimeRange(blockedStart, blockedEnd);
    }
  } else if (blockedStart && blockedEnd) {
    validateTimeRange(blockedStart, blockedEnd);
  }

  return {
    termStart,
    termEnd,
    daysOfWeek,
    blockedStart,
    blockedEnd,
  };
}

/**
 * Builds updated special rule.
 *
 * @param {LabSpecialRule} current Current rule.
 * @param {AdminUpdateSpecialRuleInput} input Parsed input.
 * @return {LabSpecialRule} Updated rule.
 */
function buildSpecialRulePatch(
    current: LabSpecialRule,
    input: AdminUpdateSpecialRuleInput,
): LabSpecialRule {
  const next: LabSpecialRule = {...current};
  setRuleField(next, "name", input.name);
  setRuleField(next, "active", input.active);
  setRuleField(next, "daysOfWeek", input.daysOfWeek);
  setRuleField(next, "fullDayBlocked", input.fullDayBlocked);
  setRuleField(next, "reason", input.reason);
  setNullableRuleField(next, "termStart", input.termStart);
  setNullableRuleField(next, "termEnd", input.termEnd);
  setNullableRuleField(next, "blockedStart", input.blockedStart);
  setNullableRuleField(next, "blockedEnd", input.blockedEnd);
  validateFinalSpecialRule(next);
  return next;
}

/**
 * Validates a special rule after merging partial updates.
 *
 * @param {LabSpecialRule} rule Updated rule.
 */
function validateFinalSpecialRule(rule: LabSpecialRule): void {
  if (!rule.name?.trim() || !rule.reason?.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "La regla debe conservar nombre y motivo.",
    );
  }
  validateDateRange(rule.termStart, rule.termEnd);
  if (rule.fullDayBlocked) {
    return;
  }
  if (!rule.blockedStart || !rule.blockedEnd) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar hora de inicio y fin si no es bloqueo de dia completo.",
    );
  }
  validateTimeHHmm(rule.blockedStart, "blockedStart");
  validateTimeHHmm(rule.blockedEnd, "blockedEnd");
  validateTimeRange(rule.blockedStart, rule.blockedEnd);
}

/**
 * Sets a rule field when defined.
 *
 * @param {LabSpecialRule} rule Rule object.
 * @param {string} key Field key.
 * @param {unknown} value Value.
 */
function setRuleField<K extends keyof LabSpecialRule>(
    rule: LabSpecialRule,
    key: K,
    value: LabSpecialRule[K] | undefined,
): void {
  if (value !== undefined) {
    rule[key] = value;
  }
}

/**
 * Sets or removes an optional rule string.
 *
 * @param {LabSpecialRule} rule Rule object.
 * @param {K} key Field key.
 * @param {string | null | undefined} value Value.
 */
function setNullableRuleField<K extends keyof Pick<
  LabSpecialRule,
  "termStart" | "termEnd" | "blockedStart" | "blockedEnd"
>>(
    rule: LabSpecialRule,
    key: K,
    value: string | null | undefined,
): void {
  if (value === undefined) {
    return;
  }
  if (value === null || value === "") {
    delete rule[key];
    return;
  }
  rule[key] = value;
}

/**
 * Parses create blocked period input.
 *
 * @param {unknown} data Callable payload.
 * @return {AdminCreateBlockedPeriodInput} Parsed input.
 */
function parseCreateBlockedPeriodInput(
    data: unknown,
): AdminCreateBlockedPeriodInput {
  const record = requireRecord(data);
  validateAllowedKeys(record, CREATE_BLOCKED_PERIOD_KEYS);
  const startAt = parseIsoDate(record.startAt, "startAt");
  const endAt = parseIsoDate(record.endAt, "endAt");
  validateDateOrder(startAt, endAt);
  const scope = parseScope(record.scope);
  const labIds = parseLabIds(record.labIds, scope);

  return {
    name: normalizeString(record.name, "El nombre es obligatorio."),
    description: sanitizeOptionalString(record.description),
    reason: normalizeString(record.reason, "El motivo es obligatorio."),
    scope,
    labIds,
    startAt,
    endAt,
    fullDay: requireBoolean(record.fullDay, "fullDay"),
    active: requireBoolean(record.active, "active"),
  };
}

/**
 * Parses update blocked period input.
 *
 * @param {unknown} data Callable payload.
 * @return {AdminUpdateBlockedPeriodInput} Parsed input.
 */
function parseUpdateBlockedPeriodInput(
    data: unknown,
): AdminUpdateBlockedPeriodInput {
  const record = requireRecord(data);
  validateAllowedKeys(record, UPDATE_BLOCKED_PERIOD_KEYS);
  return {
    blockedPeriodId: normalizeString(
        record.blockedPeriodId,
        "Debe indicar el bloqueo.",
    ),
    name: record.name === undefined ?
      undefined :
      normalizeString(record.name, "El nombre es obligatorio."),
    description: sanitizeNullableString(record.description),
    reason: record.reason === undefined ?
      undefined :
      normalizeString(record.reason, "El motivo es obligatorio."),
    scope: record.scope === undefined ? undefined : parseScope(record.scope),
    labIds: parseStringArray(record.labIds, "labIds"),
    startAt: record.startAt === undefined ?
      undefined :
      parseIsoDate(record.startAt, "startAt"),
    endAt: record.endAt === undefined ?
      undefined :
      parseIsoDate(record.endAt, "endAt"),
    fullDay: optionalBoolean(record.fullDay, "fullDay"),
    active: optionalBoolean(record.active, "active"),
  };
}

/**
 * Builds blocked period update patch.
 *
 * @param {AdminUpdateBlockedPeriodInput} input Parsed input.
 * @param {BlockedPeriodDoc} current Current doc.
 * @return {Promise<Partial<BlockedPeriodDoc>>} Firestore patch.
 */
async function buildBlockedPeriodPatch(
    input: AdminUpdateBlockedPeriodInput,
    current: BlockedPeriodDoc,
): Promise<Partial<BlockedPeriodDoc>> {
  const finalScope = input.scope ?? current.scope;
  const finalLabIds = input.labIds ?? current.labIds ?? [];
  const normalizedLabIds = parseLabIds(finalLabIds, finalScope);
  await assertLabsExist(normalizedLabIds ?? []);
  const finalStartAt = input.startAt ?? toDate(current.startAt);
  const finalEndAt = input.endAt ?? toDate(current.endAt);
  validateDateOrder(finalStartAt, finalEndAt);

  const patch: Partial<BlockedPeriodDoc> = {};
  setBlockedField(patch, "name", input.name);
  setBlockedField(patch, "reason", input.reason);
  setBlockedField(patch, "scope", input.scope);
  setBlockedField(
      patch,
      "labIds",
      finalScope === "global" ? [] : normalizedLabIds,
  );
  setBlockedField(patch, "startAt", input.startAt ?
    Timestamp.fromDate(input.startAt) :
    undefined);
  setBlockedField(patch, "endAt", input.endAt ?
    Timestamp.fromDate(input.endAt) :
    undefined);
  setBlockedField(patch, "fullDay", input.fullDay);
  setBlockedField(patch, "active", input.active);
  if (input.description !== undefined) {
    patch.description = input.description ?? "";
  }

  return patch;
}

/**
 * Parses scope.
 *
 * @param {unknown} value Candidate value.
 * @return {BlockedPeriodScope} Scope.
 */
function parseScope(value: unknown): BlockedPeriodScope {
  if (value === "global" || value === "lab") {
    return value;
  }
  throw new HttpsError(
      "invalid-argument",
      "El alcance debe ser global o lab.",
  );
}

/**
 * Parses lab ids according to scope.
 *
 * @param {unknown} value Candidate lab ids.
 * @param {BlockedPeriodScope} scope Scope.
 * @return {string[] | undefined} Parsed lab ids.
 */
function parseLabIds(
    value: unknown,
    scope: BlockedPeriodScope,
): string[] | undefined {
  const labIds = parseStringArray(value, "labIds") ?? [];
  if (scope === "global") {
    return [];
  }
  if (!labIds.length) {
    throw new HttpsError(
        "invalid-argument",
        "Debe seleccionar al menos un laboratorio.",
    );
  }
  return labIds;
}

/**
 * Validates date order.
 *
 * @param {Date} startAt Start date.
 * @param {Date} endAt End date.
 */
function validateDateOrder(startAt: Date, endAt: Date): void {
  if (endAt <= startAt) {
    throw new HttpsError(
        "invalid-argument",
        "La fecha final debe ser mayor que la fecha inicial.",
    );
  }
}

/**
 * Ensures labs exist.
 *
 * @param {string[]} labIds Lab ids.
 */
async function assertLabsExist(labIds: string[]): Promise<void> {
  if (!labIds.length) {
    return;
  }
  const db = getFirestore();
  const snapshots = await Promise.all(
      labIds.map((labId) => db.collection("labs").doc(labId).get()),
  );
  const missing = snapshots
      .map((snapshot, index) => snapshot.exists ? null : labIds[index])
      .filter((labId): labId is string => typeof labId === "string");
  if (missing.length) {
    throw new HttpsError(
        "failed-precondition",
        `No existen laboratorios: ${missing.join(", ")}.`,
    );
  }
}

/**
 * Converts stored timestamp to Date.
 *
 * @param {unknown} value Stored value.
 * @return {Date} Parsed date.
 */
function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpsError(
        "failed-precondition",
        "El bloqueo tiene fechas invalidas.",
    );
  }
  return parsed;
}

/**
 * Sets blocked period patch field.
 *
 * @param {Partial<BlockedPeriodDoc>} patch Patch object.
 * @param {string} key Field key.
 * @param {unknown} value Value.
 */
function setBlockedField<K extends keyof BlockedPeriodDoc>(
    patch: Partial<BlockedPeriodDoc>,
    key: K,
    value: BlockedPeriodDoc[K] | undefined,
): void {
  if (value !== undefined) {
    (patch as Record<string, unknown>)[key] = value;
  }
}

/**
 * Builds an audit event document.
 *
 * @param {object} params Audit params.
 * @return {object} Audit event.
 */
function buildAuditEvent(params: {
  auditId: string;
  actor: AppUser;
  actorUid: string;
  actorEmail?: string;
  targetCollection: string;
  targetId: string;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  now: Timestamp;
}): Record<string, unknown> {
  return {
    id: params.auditId,
    type: "ADMIN_ACTION",
    actorUid: params.actorUid,
    actorEmail: params.actor.email ?? params.actorEmail,
    targetCollection: params.targetCollection,
    targetId: params.targetId,
    action: params.action,
    description: params.description,
    metadata: params.metadata,
    createdAt: params.now,
  };
}

/**
 * Removes undefined values from an object.
 *
 * @param {T} value Object value.
 * @return {Partial<T>} Object without undefined values.
 */
function removeUndefined<T extends object>(
    value: T,
): Partial<T> {
  return Object.fromEntries(
      Object.entries(value).filter(([, entryValue]) =>
        entryValue !== undefined,
      ),
  ) as Partial<T>;
}
