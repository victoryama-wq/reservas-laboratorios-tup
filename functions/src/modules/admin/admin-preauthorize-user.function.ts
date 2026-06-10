import {
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {AppUser} from "../../shared/models";

const REGION = "us-central1";
const INSTITUTIONAL_DOMAIN = "@tecplayacar.edu.mx";
const DOCENTE_EMAIL_PATTERN = /^tup-d\d+@tecplayacar\.edu\.mx$/i;
const ALLOWED_INPUT_KEYS = new Set([
  "email",
  "displayName",
  "role",
  "active",
  "labsAssigned",
]);

export interface AdminPreauthorizeUserInput {
  email?: unknown;
  displayName?: unknown;
  role?: unknown;
  active?: unknown;
  labsAssigned?: unknown;
}

export interface AdminPreauthorizeUserOutput {
  email: string;
  created: boolean;
  updated: boolean;
  message: string;
}

type PreauthorizedRole = "responsable_laboratorio" | "admin_sistemas";

interface ParsedInput {
  email: string;
  displayName?: string;
  role: PreauthorizedRole;
  active: boolean;
  labsAssigned: string[];
}

/**
 * Preauthorizes a responsible/coordinator institutional account by email.
 */
export const adminPreauthorizeUser = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminPreauthorizeUserOutput> => {
      const actorUid = request.auth?.uid;
      if (!actorUid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para preautorizar usuarios.",
        );
      }

      const input = parseInput(request.data);
      const db = getFirestore();
      const actorRef = db.collection("users").doc(actorUid);
      const preauthRef = db.collection("preauthorizedUsers").doc(input.email);
      const auditRef = db.collection("auditEvents").doc();

      const actorSnapshot = await actorRef.get();
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
            "Solo Admin/Sistemas puede preautorizar usuarios.",
        );
      }

      await assertNoExistingUserByEmail(input.email);
      await assertLabsExist(input.labsAssigned);

      let created = false;
      let updated = false;
      const now = Timestamp.now();

      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(preauthRef);

        if (snapshot.exists && snapshot.data()?.claimedByUid) {
          throw new HttpsError(
              "failed-precondition",
              "La prealta ya fue reclamada. Use adminUpdateUser.",
          );
        }

        const payload = {
          email: input.email,
          displayName: input.displayName ?? "",
          role: input.role,
          labsAssigned: input.role === "responsable_laboratorio" ?
            input.labsAssigned :
            [],
          active: input.active,
          createdBy: snapshot.exists ? snapshot.data()?.createdBy : actorUid,
          createdAt: snapshot.exists ? snapshot.data()?.createdAt : now,
          updatedAt: now,
        };

        transaction.set(preauthRef, payload, {merge: false});
        transaction.create(auditRef, {
          id: auditRef.id,
          type: "ADMIN_ACTION",
          actorUid,
          actorEmail: actor.email ?? request.auth?.token.email,
          targetCollection: "preauthorizedUsers",
          targetId: input.email,
          action: "ADMIN_PREAUTHORIZE_USER",
          description: `Prealta administrativa para ${input.email}.`,
          metadata: {
            email: input.email,
            role: input.role,
            active: input.active,
            labsAssigned: payload.labsAssigned,
            operation: snapshot.exists ? "updated" : "created",
          },
          createdAt: now,
        });

        created = !snapshot.exists;
        updated = snapshot.exists;
      });

      return {
        email: input.email,
        created,
        updated,
        message: created ?
          "Prealta administrativa creada correctamente." :
          "Prealta administrativa actualizada correctamente.",
      };
    },
);

/**
 * Parses input and rejects arbitrary fields.
 *
 * @param {unknown} data Callable payload.
 * @return {ParsedInput} Parsed input.
 */
function parseInput(data: unknown): ParsedInput {
  if (!isRecord(data)) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud de prealta no es valida.",
    );
  }

  const unknownKeys = Object.keys(data).filter(
      (key) => !ALLOWED_INPUT_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud contiene campos no permitidos.",
    );
  }

  const email = normalizeEmail(data.email);
  if (!email) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar un correo institucional.",
    );
  }

  if (!email.endsWith(INSTITUTIONAL_DOMAIN)) {
    throw new HttpsError(
        "invalid-argument",
        "El correo debe pertenecer al dominio institucional.",
    );
  }

  if (DOCENTE_EMAIL_PATTERN.test(email)) {
    throw new HttpsError(
        "failed-precondition",
        "Los docentes con patron tup-dNUMEROS se registran automaticamente.",
    );
  }

  if (!isPreauthorizedRole(data.role)) {
    throw new HttpsError(
        "invalid-argument",
        "El rol de prealta debe ser responsable_laboratorio o admin_sistemas.",
    );
  }

  if (typeof data.active !== "boolean") {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar si la prealta estara activa.",
    );
  }

  return {
    email,
    displayName: normalizeOptionalText(data.displayName),
    role: data.role,
    active: data.active,
    labsAssigned: parseLabsAssigned(data.labsAssigned, data.role),
  };
}

/**
 * Parses assigned labs.
 *
 * @param {unknown} value Candidate value.
 * @param {PreauthorizedRole} role Target role.
 * @return {string[]} Lab IDs.
 */
function parseLabsAssigned(
    value: unknown,
    role: PreauthorizedRole,
): string[] {
  if (role === "admin_sistemas") {
    return [];
  }

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpsError(
        "invalid-argument",
        "labsAssigned debe ser un arreglo.",
    );
  }

  return [
    ...new Set(value.map((labId) => {
      if (typeof labId !== "string" || !labId.trim()) {
        throw new HttpsError(
            "invalid-argument",
            "Cada laboratorio asignado debe ser un ID valido.",
        );
      }
      return labId.trim();
    })),
  ];
}

/**
 * Ensures no existing user has the target email.
 *
 * @param {string} email Normalized email.
 */
async function assertNoExistingUserByEmail(email: string): Promise<void> {
  const snapshot = await getFirestore()
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

  if (!snapshot.empty) {
    throw new HttpsError(
        "already-exists",
        "El usuario ya existe. Use adminUpdateUser para modificarlo.",
    );
  }
}

/**
 * Ensures every assigned lab exists.
 *
 * @param {string[]} labsAssigned Lab IDs.
 */
async function assertLabsExist(labsAssigned: string[]): Promise<void> {
  if (!labsAssigned.length) {
    return;
  }

  const db = getFirestore();
  const snapshots = await Promise.all(
      labsAssigned.map((labId) => db.collection("labs").doc(labId).get()),
  );
  const missingLabs = snapshots
      .map((snapshot, index) => snapshot.exists ? null : labsAssigned[index])
      .filter((labId): labId is string => typeof labId === "string");

  if (missingLabs.length > 0) {
    throw new HttpsError(
        "failed-precondition",
        `No existen laboratorios asignados: ${missingLabs.join(", ")}.`,
    );
  }
}

/**
 * Checks record-like payloads.
 *
 * @param {unknown} value Candidate value.
 * @return {boolean} Whether value is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
 * Normalizes optional text.
 *
 * @param {unknown} value Candidate text.
 * @return {string | undefined} Normalized text.
 */
function normalizeOptionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        "El nombre debe ser texto.",
    );
  }

  return value.trim() || undefined;
}

/**
 * Checks allowed preauthorized roles.
 *
 * @param {unknown} value Candidate role.
 * @return {boolean} Whether role is allowed.
 */
function isPreauthorizedRole(value: unknown): value is PreauthorizedRole {
  return value === "responsable_laboratorio" || value === "admin_sistemas";
}
