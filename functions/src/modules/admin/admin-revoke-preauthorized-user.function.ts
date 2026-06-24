import {
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {AppUser, PreauthorizedUserDoc} from "../../shared/models";

const REGION = "us-central1";
const ALLOWED_INPUT_KEYS = new Set(["email", "reason"]);
const MAX_REASON_LENGTH = 280;
const FALLBACK_ACTOR_EMAIL = "sin-correo-registrado";
const FALLBACK_ROLE = "sin_rol";

export interface AdminRevokePreauthorizedUserInput {
  email?: unknown;
  reason?: unknown;
}

export interface AdminRevokePreauthorizedUserOutput {
  email: string;
  revoked: true;
  message: string;
}

interface ParsedInput {
  email: string;
  reason?: string;
}

/**
 * Revokes an unclaimed preauthorized account without deleting the document.
 */
export const adminRevokePreauthorizedUser = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminRevokePreauthorizedUserOutput> => {
      const actorUid = request.auth?.uid;
      if (!actorUid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para revocar prealtas.",
        );
      }

      const input = parseInput(request.data);
      const db = getFirestore();
      const actorRef = db.collection("users").doc(actorUid);
      const preauthRef = db.collection("preauthorizedUsers").doc(input.email);
      const auditRef = db.collection("auditEvents").doc();
      const now = Timestamp.now();

      await db.runTransaction(async (transaction) => {
        const [actorSnapshot, preauthSnapshot] = await Promise.all([
          transaction.get(actorRef),
          transaction.get(preauthRef),
        ]);

        if (!actorSnapshot.exists) {
          throw new HttpsError(
              "permission-denied",
              "El perfil de Admin/Sistemas no existe.",
          );
        }

        const actor = actorSnapshot.data() as AppUser;
        if (!actor.active || actor.role !== "admin_sistemas") {
          throw new HttpsError(
              "permission-denied",
              "Solo Admin/Sistemas puede revocar prealtas.",
          );
        }

        if (!preauthSnapshot.exists) {
          throw new HttpsError("not-found", "La prealta no existe.");
        }

        const preauth = preauthSnapshot.data() as PreauthorizedUserDoc;
        if (preauth.claimedByUid) {
          throw new HttpsError(
              "failed-precondition",
              "La prealta ya fue reclamada. Use adminUpdateUser.",
          );
        }

        const patch: Partial<PreauthorizedUserDoc> = {
          active: false,
          revokedBy: actorUid,
          revokedAt: now,
          updatedAt: now,
        };

        if (input.reason) {
          patch.revocationReason = input.reason;
        }

        transaction.update(preauthRef, patch);
        transaction.create(auditRef, {
          id: auditRef.id,
          type: "ADMIN_ACTION",
          actorUid,
          actorEmail: actor.email ?? request.auth?.token.email ??
            FALLBACK_ACTOR_EMAIL,
          targetCollection: "preauthorizedUsers",
          targetId: input.email,
          action: "ADMIN_REVOKE_PREAUTHORIZED_USER",
          description: `Prealta revocada para ${input.email}.`,
          metadata: {
            email: input.email,
            role: preauth.role ?? FALLBACK_ROLE,
            labsAssigned: normalizeStringArray(preauth.labsAssigned),
            reason: input.reason ?? "",
          },
          createdAt: now,
        });
      });

      return {
        email: input.email,
        revoked: true,
        message: "Prealta revocada correctamente.",
      };
    },
);

/**
 * Parses revoke preauthorization input.
 *
 * @param {unknown} data Callable payload.
 * @return {ParsedInput} Parsed input.
 */
function parseInput(data: unknown): ParsedInput {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud de revocacion no es valida.",
    );
  }

  const record = data as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter(
      (key) => !ALLOWED_INPUT_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud contiene campos no permitidos.",
    );
  }

  const email = normalizeEmail(record.email);
  if (!email) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar el correo de la prealta.",
    );
  }

  return {
    email,
    reason: normalizeOptionalReason(record.reason),
  };
}

/**
 * Normalizes emails.
 *
 * @param {unknown} value Candidate email.
 * @return {string} Normalized email.
 */
function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Sanitizes optional revocation reason.
 *
 * @param {unknown} value Candidate reason.
 * @return {string | undefined} Sanitized reason.
 */
function normalizeOptionalReason(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        "El motivo de revocacion debe ser texto.",
    );
  }

  const reason = value.trim();
  if (!reason) {
    return undefined;
  }

  if (reason.length > MAX_REASON_LENGTH) {
    throw new HttpsError(
        "invalid-argument",
        `El motivo no debe exceder ${MAX_REASON_LENGTH} caracteres.`,
    );
  }

  return reason;
}

/**
 * Keeps audit metadata free of undefined or invalid array values.
 *
 * @param {unknown} value Candidate string array.
 * @return {string[]} Safe string array.
 */
function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ?
    value.filter((item): item is string => typeof item === "string") :
    [];
}
