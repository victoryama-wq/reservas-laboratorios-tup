import {
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {AppUser, UserRole} from "../../shared/models";

const REGION = "us-central1";
const VALID_ROLES: UserRole[] = [
  "docente",
  "responsable_laboratorio",
  "admin_sistemas",
];
const ALLOWED_INPUT_KEYS = new Set([
  "uid",
  "role",
  "active",
  "labsAssigned",
]);

export interface AdminUpdateUserInput {
  uid?: unknown;
  role?: unknown;
  active?: unknown;
  labsAssigned?: unknown;
}

export interface AdminUpdateUserOutput {
  uid: string;
  updated: true;
  message: string;
}

/**
 * Updates institutional user role, status and assigned labs.
 */
export const adminUpdateUser = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminUpdateUserOutput> => {
      const actorUid = request.auth?.uid;
      if (!actorUid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para administrar usuarios.",
        );
      }

      const input = parseInput(request.data);
      const db = getFirestore();
      const actorRef = db.collection("users").doc(actorUid);
      const targetRef = db.collection("users").doc(input.uid);
      const auditRef = db.collection("auditEvents").doc();

      await db.runTransaction(async (transaction) => {
        const [actorSnapshot, targetSnapshot] = await Promise.all([
          transaction.get(actorRef),
          transaction.get(targetRef),
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
              "Solo Admin/Sistemas puede actualizar usuarios.",
          );
        }

        if (!targetSnapshot.exists) {
          throw new HttpsError("not-found", "El usuario objetivo no existe.");
        }

        const target = targetSnapshot.data() as AppUser;
        assertSafeSelfUpdate(actorUid, target, input);

        const nextRole = input.role ?? target.role;
        const nextLabsAssigned = resolveNextLabsAssigned(input, nextRole);
        await assertLabsExist(transaction, nextLabsAssigned);

        const patch = buildUserPatch(input, nextRole, nextLabsAssigned);
        const changedFields = Object.keys(patch).filter(
            (field) => field !== "updatedAt",
        );

        if (changedFields.length === 0) {
          throw new HttpsError(
              "invalid-argument",
              "Debe enviar al menos un campo modificable.",
          );
        }

        transaction.update(targetRef, patch);
        transaction.create(auditRef, {
          id: auditRef.id,
          type: "ADMIN_ACTION",
          actorUid,
          actorEmail: actor.email ?? request.auth?.token.email,
          targetCollection: "users",
          targetId: input.uid,
          action: "ADMIN_UPDATE_USER",
          description: buildAuditDescription(target, input),
          metadata: {
            changedFields,
            previousRole: target.role,
            newRole: patch.role ?? target.role,
            previousActive: target.active,
            newActive: patch.active ?? target.active,
            previousLabsAssigned: target.labsAssigned ?? [],
            newLabsAssigned:
              patch.labsAssigned ?? target.labsAssigned ?? [],
          },
          createdAt: Timestamp.now(),
        });
      });

      return {
        uid: input.uid,
        updated: true,
        message: "Usuario actualizado correctamente.",
      };
    },
);

interface ParsedInput {
  uid: string;
  role?: UserRole;
  active?: boolean;
  labsAssigned?: string[];
}

/**
 * Parses and validates callable input.
 *
 * @param {unknown} data Callable payload.
 * @return {ParsedInput} Parsed input.
 */
function parseInput(data: unknown): ParsedInput {
  if (!isRecord(data)) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud de actualizacion no es valida.",
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

  if (typeof data.uid !== "string" || !data.uid.trim()) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar el usuario objetivo.",
    );
  }

  const parsed: ParsedInput = {uid: data.uid.trim()};

  if (data.role !== undefined) {
    if (!isUserRole(data.role)) {
      throw new HttpsError(
          "invalid-argument",
          "El rol indicado no es valido.",
      );
    }
    parsed.role = data.role;
  }

  if (data.active !== undefined) {
    if (typeof data.active !== "boolean") {
      throw new HttpsError(
          "invalid-argument",
          "El campo active debe ser booleano.",
      );
    }
    parsed.active = data.active;
  }

  if (data.labsAssigned !== undefined) {
    if (!Array.isArray(data.labsAssigned)) {
      throw new HttpsError(
          "invalid-argument",
          "labsAssigned debe ser un arreglo.",
      );
    }

    parsed.labsAssigned = [
      ...new Set(data.labsAssigned.map((labId) => {
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

  return parsed;
}

/**
 * Ensures the actor cannot lock themselves out.
 *
 * @param {string} actorUid Acting admin uid.
 * @param {AppUser} target Current target user.
 * @param {ParsedInput} input Parsed input.
 */
function assertSafeSelfUpdate(
    actorUid: string,
    target: AppUser,
    input: ParsedInput,
): void {
  if (actorUid !== input.uid) {
    return;
  }

  if (input.active === false) {
    throw new HttpsError(
        "failed-precondition",
        "No puede desactivar su propia cuenta administrativa.",
    );
  }

  if (input.role !== undefined && input.role !== "admin_sistemas") {
    throw new HttpsError(
        "failed-precondition",
        "No puede quitarse su propio rol de Admin/Sistemas.",
    );
  }

  if (target.role === "admin_sistemas") {
    return;
  }

  throw new HttpsError(
      "failed-precondition",
      "No puede modificar su propio perfil administrativo.",
  );
}

/**
 * Resolves lab assignments from input and resulting role.
 *
 * @param {ParsedInput} input Parsed input.
 * @param {UserRole} nextRole Resulting role.
 * @return {string[] | undefined} Next assigned labs.
 */
function resolveNextLabsAssigned(
    input: ParsedInput,
    nextRole: UserRole,
): string[] | undefined {
  if (nextRole !== "responsable_laboratorio") {
    return input.role !== undefined || input.labsAssigned !== undefined ?
      [] :
      undefined;
  }

  return input.labsAssigned;
}

/**
 * Validates every assigned laboratory exists.
 *
 * @param {FirebaseFirestore.Transaction} transaction Firestore transaction.
 * @param {string[] | undefined} labsAssigned Assigned lab IDs.
 */
async function assertLabsExist(
    transaction: FirebaseFirestore.Transaction,
    labsAssigned: string[] | undefined,
): Promise<void> {
  if (!labsAssigned?.length) {
    return;
  }

  const db = getFirestore();
  const labRefs = labsAssigned.map((labId) =>
    db.collection("labs").doc(labId),
  );
  const labSnapshots = await Promise.all(
      labRefs.map((labRef) => transaction.get(labRef)),
  );
  const missingLabs = labSnapshots
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
 * Builds the allowed user update patch.
 *
 * @param {ParsedInput} input Parsed input.
 * @param {UserRole} nextRole Resulting role.
 * @param {string[] | undefined} nextLabsAssigned Resulting labs.
 * @return {Partial<AppUser>} Firestore patch.
 */
function buildUserPatch(
    input: ParsedInput,
    nextRole: UserRole,
    nextLabsAssigned: string[] | undefined,
): Partial<AppUser> {
  const patch: Partial<AppUser> = {
    updatedAt: Timestamp.now(),
  };

  if (input.role !== undefined) {
    patch.role = nextRole;
  }

  if (input.active !== undefined) {
    patch.active = input.active;
  }

  if (nextLabsAssigned !== undefined) {
    patch.labsAssigned = nextLabsAssigned;
  }

  return patch;
}

/**
 * Builds a readable audit description.
 *
 * @param {AppUser} target Target user before update.
 * @param {ParsedInput} input Parsed input.
 * @return {string} Audit description.
 */
function buildAuditDescription(
    target: AppUser,
    input: ParsedInput,
): string {
  const parts = [`Actualizacion administrativa de ${target.email}.`];

  if (input.role !== undefined) {
    parts.push(`Rol: ${target.role} -> ${input.role}.`);
  }

  if (input.active !== undefined) {
    parts.push(`Activo: ${target.active} -> ${input.active}.`);
  }

  if (input.labsAssigned !== undefined) {
    parts.push("Laboratorios asignados actualizados.");
  }

  return parts.join(" ");
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
 * Checks official user roles.
 *
 * @param {unknown} value Candidate role.
 * @return {boolean} Whether role is official.
 */
function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" &&
    VALID_ROLES.includes(value as UserRole);
}
