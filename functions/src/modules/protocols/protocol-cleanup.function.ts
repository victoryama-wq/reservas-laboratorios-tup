import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions";

import {AppUser} from "../../shared/models";
import {
  requireRecord,
  validateAllowedKeys,
} from "../admin/admin-validation.utils";
import {
  buildCleanupAuditMetadata,
  CleanupOrphanProtocolUploadsResult,
  ProtocolCleanupService,
} from "./protocol-cleanup.service";

const REGION = "us-central1";
const CLEANUP_INPUT_KEYS = new Set([
  "dryRun",
  "minAgeHours",
  "maxDelete",
]);

interface AdminCleanupOrphanProtocolUploadsInput {
  dryRun: boolean;
  minAgeHours?: number;
  maxDelete?: number;
}

/**
 * Allows Admin/Sistemas to preview or execute orphan protocol cleanup.
 */
export const adminCleanupOrphanProtocolUploads = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<CleanupOrphanProtocolUploadsResult> => {
      const actorUid = requireAuth(request);
      const input = parseCleanupInput(request.data);
      const actor = await getActiveAdmin(actorUid);
      const service = new ProtocolCleanupService();
      const result = await service.cleanupOrphanProtocolUploads(input);

      await writeCleanupAuditEvent({
        actor,
        actorUid,
        actorEmail: request.auth?.token.email as string | undefined,
        result,
      });

      return result;
    },
);

/**
 * Runs a conservative daily cleanup for orphan protocol uploads.
 */
export const scheduledCleanupOrphanProtocolUploads = onSchedule(
    {
      region: REGION,
      schedule: "0 3 * * *",
      timeZone: "America/Cancun",
    },
    async () => {
      const service = new ProtocolCleanupService();
      const result = await service.cleanupOrphanProtocolUploads({
        dryRun: false,
        minAgeHours: 72,
        maxDelete: 100,
      });

      logger.info("Resumen de limpieza programada de protocolos huerfanos.", {
        dryRun: result.dryRun,
        minAgeHours: result.minAgeHours,
        maxDelete: result.maxDelete,
        scannedFiles: result.scannedFiles,
        referencedFiles: result.referencedFiles,
        orphanCandidates: result.orphanCandidates,
        deletedFiles: result.deletedFiles,
        skippedRecentFiles: result.skippedRecentFiles,
        skippedReferencedFiles: result.skippedReferencedFiles,
        errors: result.errors.length,
      });
    },
);

/**
 * Requires callable auth.
 *
 * @param {CallableRequest<unknown>} request Callable request.
 * @return {string} Actor uid.
 */
function requireAuth(request: CallableRequest<unknown>): string {
  const actorUid = request.auth?.uid;
  if (!actorUid) {
    throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesion para limpiar protocolos huerfanos.",
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
        "Solo Admin/Sistemas puede limpiar protocolos huerfanos.",
    );
  }

  return actor;
}

/**
 * Parses cleanup callable input.
 *
 * @param {unknown} data Callable payload.
 * @return {AdminCleanupOrphanProtocolUploadsInput} Parsed input.
 */
function parseCleanupInput(
    data: unknown,
): AdminCleanupOrphanProtocolUploadsInput {
  const record = data === undefined ? {} : requireRecord(data);
  validateAllowedKeys(record, CLEANUP_INPUT_KEYS);

  return {
    dryRun: record.dryRun === undefined ?
      true :
      parseBoolean(record.dryRun, "dryRun"),
    minAgeHours: parseOptionalNumber(record.minAgeHours, "minAgeHours"),
    maxDelete: parseOptionalNumber(record.maxDelete, "maxDelete"),
  };
}

/**
 * Parses a boolean.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {boolean} Parsed boolean.
 */
function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe ser booleano.`,
    );
  }
  return value;
}

/**
 * Parses an optional number.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {number | undefined} Parsed number.
 */
function parseOptionalNumber(
    value: unknown,
    field: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe ser numerico.`,
    );
  }
  if (value < 0) {
    throw new HttpsError(
        "invalid-argument",
        `${field} no puede ser negativo.`,
    );
  }
  return value;
}

/**
 * Writes an admin audit event for controlled cleanup runs.
 *
 * @param {object} params Audit params.
 */
async function writeCleanupAuditEvent(params: {
  actor: AppUser;
  actorUid: string;
  actorEmail?: string;
  result: CleanupOrphanProtocolUploadsResult;
}): Promise<void> {
  const db = getFirestore();
  const auditRef = db.collection("auditEvents").doc();
  const now = Timestamp.now();

  await auditRef.create({
    id: auditRef.id,
    type: "ADMIN_ACTION",
    actorUid: params.actorUid,
    actorEmail: params.actor.email ?? params.actorEmail,
    targetCollection: "storage",
    targetId: "protocolUploads",
    action: "ADMIN_CLEANUP_ORPHAN_PROTOCOL_UPLOADS",
    description: params.result.dryRun ?
      "Revision de protocolos huerfanos ejecutada en modo dry run." :
      "Limpieza de protocolos huerfanos ejecutada.",
    metadata: buildCleanupAuditMetadata(params.result),
    createdAt: now,
  });
}
