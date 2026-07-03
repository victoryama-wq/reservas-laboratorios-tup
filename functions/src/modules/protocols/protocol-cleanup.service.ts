import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

import {ReservationDoc} from "../../shared/models";

const PROTOCOL_UPLOADS_PREFIX = "protocolUploads/";
const DEFAULT_MIN_AGE_HOURS = 72;
const DEFAULT_MAX_DELETE = 50;
const MAX_DELETE_LIMIT = 200;

export interface CleanupOrphanProtocolUploadsOptions {
  dryRun?: boolean;
  minAgeHours?: number;
  maxDelete?: number;
}

export interface CleanupOrphanProtocolUploadError {
  storagePath: string;
  message: string;
}

export interface CleanupOrphanProtocolUploadsResult {
  dryRun: boolean;
  minAgeHours: number;
  maxDelete: number;
  scannedFiles: number;
  referencedFiles: number;
  orphanCandidates: number;
  deletedFiles: number;
  skippedRecentFiles: number;
  skippedReferencedFiles: number;
  errors: CleanupOrphanProtocolUploadError[];
}

interface CleanupCandidate {
  storagePath: string;
}

/**
 * Detects and optionally removes orphan protocol uploads.
 */
export class ProtocolCleanupService {
  private readonly db = getFirestore();
  private readonly bucket = getStorage().bucket();

  /**
   * Runs a safe cleanup pass for protocol uploads.
   *
   * @param {CleanupOrphanProtocolUploadsOptions} options Cleanup options.
   * @return {Promise<CleanupOrphanProtocolUploadsResult>} Cleanup summary.
   */
  async cleanupOrphanProtocolUploads(
      options: CleanupOrphanProtocolUploadsOptions = {},
  ): Promise<CleanupOrphanProtocolUploadsResult> {
    const dryRun = options.dryRun !== false;
    const minAgeHours = normalizeMinAgeHours(options.minAgeHours, dryRun);
    const maxDelete = normalizeMaxDelete(options.maxDelete);
    const referencedPaths = await this.listReferencedProtocolPaths();
    const [files] = await this.bucket.getFiles({
      prefix: PROTOCOL_UPLOADS_PREFIX,
    });
    const nowMs = Date.now();
    const candidates: CleanupCandidate[] = [];
    let scannedFiles = 0;
    let skippedRecentFiles = 0;
    let skippedReferencedFiles = 0;
    const errors: CleanupOrphanProtocolUploadError[] = [];

    for (const file of files) {
      const storagePath = file.name;
      if (!isProtocolUploadPath(storagePath) || storagePath.endsWith("/")) {
        continue;
      }

      scannedFiles += 1;

      if (referencedPaths.has(storagePath)) {
        skippedReferencedFiles += 1;
        continue;
      }

      const ageHours = calculateAgeHours(file.metadata.timeCreated, nowMs);
      if (ageHours === null) {
        errors.push({
          storagePath,
          message: "El archivo no tiene metadata timeCreated valida.",
        });
        continue;
      }

      if (ageHours < minAgeHours) {
        skippedRecentFiles += 1;
        continue;
      }

      candidates.push({storagePath});
    }

    let deletedFiles = 0;
    if (!dryRun) {
      for (const candidate of candidates.slice(0, maxDelete)) {
        try {
          await this.bucket.file(candidate.storagePath).delete();
          deletedFiles += 1;
        } catch (error) {
          errors.push({
            storagePath: candidate.storagePath,
            message: error instanceof Error ?
              error.message :
              "No fue posible borrar el archivo.",
          });
        }
      }
    }

    return {
      dryRun,
      minAgeHours,
      maxDelete,
      scannedFiles,
      referencedFiles: referencedPaths.size,
      orphanCandidates: candidates.length,
      deletedFiles,
      skippedRecentFiles,
      skippedReferencedFiles,
      errors,
    };
  }

  /**
   * Reads all reservation protocol storage paths that must be preserved.
   *
   * @return {Promise<Set<string>>} Referenced storage paths.
   */
  private async listReferencedProtocolPaths(): Promise<Set<string>> {
    const snapshot = await this.db.collection("reservations").get();
    const referencedPaths = new Set<string>();

    for (const reservationSnapshot of snapshot.docs) {
      const reservation = reservationSnapshot.data() as ReservationDoc;
      for (const protocolFile of reservation.protocolFiles ?? []) {
        const storagePath = protocolFile.storagePath;
        if (isProtocolUploadPath(storagePath)) {
          referencedPaths.add(storagePath);
        }
      }
    }

    return referencedPaths;
  }
}

/**
 * Normalizes min age while keeping destructive cleanup conservative.
 *
 * @param {number | undefined} value Input value.
 * @param {boolean} dryRun Whether execution is dry run.
 * @return {number} Normalized min age.
 */
export function normalizeMinAgeHours(
    value: number | undefined,
    dryRun: boolean,
): number {
  if (value === undefined) {
    return DEFAULT_MIN_AGE_HOURS;
  }

  if (!Number.isFinite(value) || value < 0) {
    return DEFAULT_MIN_AGE_HOURS;
  }

  if (!dryRun && value < 24) {
    return 24;
  }

  return Math.floor(value);
}

/**
 * Normalizes max delete limit.
 *
 * @param {number | undefined} value Input value.
 * @return {number} Normalized max delete.
 */
export function normalizeMaxDelete(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MAX_DELETE;
  }

  if (!Number.isInteger(value) || value < 1) {
    return DEFAULT_MAX_DELETE;
  }

  return Math.min(value, MAX_DELETE_LIMIT);
}

/**
 * Checks whether a path belongs to protocolUploads.
 *
 * @param {unknown} storagePath Candidate path.
 * @return {boolean} Whether path is eligible prefix.
 */
function isProtocolUploadPath(storagePath: unknown): storagePath is string {
  return typeof storagePath === "string" &&
    storagePath.startsWith(PROTOCOL_UPLOADS_PREFIX);
}

/**
 * Calculates file age in hours.
 *
 * @param {string | undefined} timeCreated Storage metadata value.
 * @param {number} nowMs Current timestamp.
 * @return {number | null} Age in hours or null.
 */
function calculateAgeHours(
    timeCreated: string | undefined,
    nowMs: number,
): number | null {
  if (!timeCreated) {
    return null;
  }

  const createdAt = new Date(timeCreated);
  const createdAtMs = createdAt.getTime();
  if (Number.isNaN(createdAtMs)) {
    return null;
  }

  return (nowMs - createdAtMs) / (60 * 60 * 1000);
}

/**
 * Builds safe audit metadata for cleanup runs.
 *
 * @param {CleanupOrphanProtocolUploadsResult} result Cleanup result.
 * @return {Record<string, unknown>} Audit metadata.
 */
export function buildCleanupAuditMetadata(
    result: CleanupOrphanProtocolUploadsResult,
): Record<string, unknown> {
  return {
    dryRun: result.dryRun,
    minAgeHours: result.minAgeHours,
    scannedFiles: result.scannedFiles,
    orphanCandidates: result.orphanCandidates,
    deletedFiles: result.deletedFiles,
    maxDelete: result.maxDelete,
    errors: result.errors.length,
    createdAt: Timestamp.now(),
  };
}
