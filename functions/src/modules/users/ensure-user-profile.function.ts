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
  SystemSettingsDoc,
  UserRequesterType,
  UserRole,
} from "../../shared/models";

const REGION = "us-central1";
const INSTITUTIONAL_DOMAIN = "@tecplayacar.edu.mx";
const DOCENTE_EMAIL_PATTERN = /^tup-d\d+@tecplayacar\.edu\.mx$/i;
const STUDENT_EMAIL_PATTERN = /^tup\d+@tecplayacar\.edu\.mx$/i;
const ADMINISTRATIVE_EMAIL_PATTERN =
  /^[a-z]+(?:[._][a-z]+)+@tecplayacar\.edu\.mx$/i;
const DEFAULT_ACCESS_EXCLUDED_EMAILS = [
  "escenarios.tup@tecplayacar.edu.mx",
  "centro.computo@tecplayacar.edu.mx",
  "noreply@tecplayacar.edu.mx",
  "no-reply@tecplayacar.edu.mx",
];

export type AutomaticAccessClassification =
  | "docente"
  | "administrativo"
  | "estudiante"
  | "excluded"
  | "pending";

export type EnsureUserProfileStatus =
  | "EXISTING_PROFILE"
  | "DOCENTE_PROFILE_CREATED"
  | "ADMINISTRATIVE_PROFILE_CREATED"
  | "PREAUTHORIZED_PROFILE_CREATED"
  | "ACCESS_DENIED"
  | "PENDING_ACCESS";

export interface EnsureUserProfileOutput {
  status: EnsureUserProfileStatus;
  uid: string;
  email: string;
  role?: UserRole;
  requesterType?: UserRequesterType;
  active?: boolean;
  message: string;
}

interface PreauthorizedUserDoc {
  email: string;
  displayName?: string;
  role: "responsable_laboratorio" | "admin_sistemas";
  labsAssigned: string[];
  active: boolean;
  claimedByUid?: string;
  claimedAt?: Timestamp;
  revokedBy?: string;
  revokedAt?: Timestamp;
  revocationReason?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Ensures an authenticated institutional user has a profile when allowed.
 */
export const ensureUserProfile = onCall(
    {region: REGION, invoker: "public"},
    async (
        request: CallableRequest<unknown>,
    ): Promise<EnsureUserProfileOutput> => {
      const uid = request.auth?.uid;
      const email = normalizeEmail(request.auth?.token.email);
      const displayName = normalizeDisplayName(
          request.auth?.token.name,
          request.auth?.token.email,
      );

      if (!uid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion con Google institucional.",
        );
      }

      if (!email) {
        throw new HttpsError(
            "failed-precondition",
            "La cuenta de Google no proporciono correo institucional.",
        );
      }

      if (!email.endsWith(INSTITUTIONAL_DOMAIN)) {
        throw new HttpsError(
            "permission-denied",
            "Solo se permite acceso con correo institucional.",
        );
      }

      const db = getFirestore();
      const userRef = db.collection("users").doc(uid);
      const existingSnapshot = await userRef.get();

      if (existingSnapshot.exists) {
        const profile = existingSnapshot.data() as AppUser;
        return {
          status: "EXISTING_PROFILE",
          uid,
          email,
          role: profile.role,
          requesterType: profile.requesterType,
          active: profile.active,
          message: "Perfil institucional existente.",
        };
      }

      const preauthorizedResult = await claimPreauthorizedProfile(
          uid,
          email,
          displayName,
      );
      if (preauthorizedResult) {
        return preauthorizedResult;
      }

      const classification = classifyInstitutionalEmail(
          email,
          await loadAccessExcludedEmails(),
      );

      if (classification === "docente" || classification === "administrativo") {
        return createRequesterProfile(
            uid,
            email,
            displayName,
            classification,
        );
      }

      if (classification === "estudiante") {
        return {
          status: "ACCESS_DENIED",
          uid,
          email,
          message: "Las cuentas de estudiantes no tienen acceso al sistema.",
        };
      }

      if (classification === "excluded") {
        return {
          status: "ACCESS_DENIED",
          uid,
          email,
          message: [
            "Esta cuenta operativa no esta habilitada",
            "para uso interactivo.",
          ].join(" "),
        };
      }

      return {
        status: "PENDING_ACCESS",
        uid,
        email,
        message: [
          "La cuenta institucional no coincide",
          "con un patron autorizado.",
        ].join(" "),
      };
    },
);

/**
 * Creates an automatic requester profile.
 *
 * @param {string} uid Firebase Auth uid.
 * @param {string} email Normalized email.
 * @param {string} displayName Display name.
 * @param {UserRequesterType} requesterType Requester category.
 * @return {Promise<EnsureUserProfileOutput>} Callable output.
 */
async function createRequesterProfile(
    uid: string,
    email: string,
    displayName: string,
    requesterType: UserRequesterType,
): Promise<EnsureUserProfileOutput> {
  const db = getFirestore();
  const now = Timestamp.now();
  const userRef = db.collection("users").doc(uid);
  const auditRef = db.collection("auditEvents").doc();

  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    if (userSnapshot.exists) {
      return;
    }

    const profile: AppUser = {
      uid,
      displayName,
      email,
      role: "docente",
      requesterType,
      labsAssigned: [],
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    transaction.create(userRef, profile);
    transaction.create(auditRef, {
      id: auditRef.id,
      type: "ADMIN_ACTION",
      targetCollection: "users",
      targetId: uid,
      action: requesterType === "docente" ?
        "AUTO_CREATE_DOCENTE_PROFILE" :
        "AUTO_CREATE_ADMINISTRATIVE_REQUESTER_PROFILE",
      description: requesterType === "docente" ?
        `Autoalta docente para ${email}.` :
        `Autoalta de solicitante administrativo para ${email}.`,
      metadata: {
        email,
        role: "docente",
        requesterType,
        source: "google_sign_in",
      },
      createdAt: now,
    });
  });

  return {
    status: requesterType === "docente" ?
      "DOCENTE_PROFILE_CREATED" :
      "ADMINISTRATIVE_PROFILE_CREATED",
    uid,
    email,
    role: "docente",
    requesterType,
    active: true,
    message: requesterType === "docente" ?
      "Perfil docente creado automaticamente." :
      "Perfil administrativo de reservas creado automaticamente.",
  };
}

/**
 * Claims a preauthorized profile by normalized email.
 *
 * @param {string} uid Firebase Auth uid.
 * @param {string} email Normalized email.
 * @param {string} displayName Auth display name.
 * @return {Promise<EnsureUserProfileOutput | null>} Callable output.
 */
async function claimPreauthorizedProfile(
    uid: string,
    email: string,
    displayName: string,
): Promise<EnsureUserProfileOutput | null> {
  const db = getFirestore();
  const now = Timestamp.now();
  const userRef = db.collection("users").doc(uid);
  const preauthRef = db.collection("preauthorizedUsers").doc(email);
  const auditRef = db.collection("auditEvents").doc();

  let claimedProfile: AppUser | null = null;

  await db.runTransaction(async (transaction) => {
    const [userSnapshot, preauthSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(preauthRef),
    ]);

    if (userSnapshot.exists) {
      claimedProfile = userSnapshot.data() as AppUser;
      return;
    }

    if (!preauthSnapshot.exists) {
      return;
    }

    const preauth = preauthSnapshot.data() as PreauthorizedUserDoc;

    if (preauth.claimedByUid || preauth.active !== true || preauth.revokedAt) {
      return;
    }

    if (!isPreauthorizedRole(preauth.role)) {
      throw new HttpsError(
          "failed-precondition",
          "La prealta tiene un rol no permitido.",
      );
    }

    claimedProfile = {
      uid,
      displayName: preauth.displayName?.trim() || displayName,
      email,
      role: preauth.role,
      labsAssigned:
        preauth.role === "responsable_laboratorio" ?
          preauth.labsAssigned ?? [] :
          [],
      active: preauth.active === true,
      createdAt: now,
      updatedAt: now,
    };

    transaction.create(userRef, claimedProfile);
    transaction.update(preauthRef, {
      claimedByUid: uid,
      claimedAt: now,
      updatedAt: now,
    });
    transaction.create(auditRef, {
      id: auditRef.id,
      type: "ADMIN_ACTION",
      targetCollection: "users",
      targetId: uid,
      action: "PREAUTHORIZED_USER_CLAIMED",
      description: `Prealta reclamada por ${email}.`,
      metadata: {
        email,
        role: claimedProfile.role,
        active: claimedProfile.active,
        labsAssigned: claimedProfile.labsAssigned,
      },
      createdAt: now,
    });
  });

  const profile = claimedProfile as AppUser | null;

  if (profile) {
    return {
      status: "PREAUTHORIZED_PROFILE_CREATED",
      uid,
      email,
      role: profile.role,
      active: profile.active,
      message: "Perfil creado desde prealta administrativa.",
    };
  }

  return null;
}

/**
 * Classifies an institutional email for automatic requester access.
 *
 * @param {string} email Normalized institutional email.
 * @param {string[]} excludedEmails Accounts excluded from interactive access.
 * @return {AutomaticAccessClassification} Automatic access category.
 */
export function classifyInstitutionalEmail(
    email: string,
    excludedEmails: string[] = DEFAULT_ACCESS_EXCLUDED_EMAILS,
): AutomaticAccessClassification {
  const normalizedEmail = normalizeEmail(email);
  const excluded = new Set(excludedEmails.map(normalizeEmail));

  if (excluded.has(normalizedEmail)) {
    return "excluded";
  }

  if (DOCENTE_EMAIL_PATTERN.test(normalizedEmail)) {
    return "docente";
  }

  if (STUDENT_EMAIL_PATTERN.test(normalizedEmail)) {
    return "estudiante";
  }

  if (ADMINISTRATIVE_EMAIL_PATTERN.test(normalizedEmail)) {
    return "administrativo";
  }

  return "pending";
}

/** Reads configured technical accounts excluded from automatic access. */
async function loadAccessExcludedEmails(): Promise<string[]> {
  const snapshot = await getFirestore()
      .collection("systemSettings")
      .doc("global")
      .get();
  const settings = snapshot.exists ?
    snapshot.data() as SystemSettingsDoc : null;

  return [
    ...DEFAULT_ACCESS_EXCLUDED_EMAILS,
    ...(settings?.accessExcludedEmails ?? []),
  ];
}

/**
 * Normalizes email values.
 *
 * @param {unknown} value Candidate email.
 * @return {string} Normalized email.
 */
function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Normalizes display names.
 *
 * @param {unknown} name Candidate display name.
 * @param {unknown} fallbackEmail Candidate fallback email.
 * @return {string} Display name.
 */
function normalizeDisplayName(name: unknown, fallbackEmail: unknown): string {
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  if (typeof fallbackEmail === "string" && fallbackEmail.trim()) {
    return fallbackEmail.trim().toLowerCase();
  }

  return "Usuario institucional";
}

/**
 * Checks allowed preauthorized roles.
 *
 * @param {unknown} value Candidate role.
 * @return {boolean} Whether role is allowed.
 */
function isPreauthorizedRole(
    value: unknown,
): value is "responsable_laboratorio" | "admin_sistemas" {
  return value === "responsable_laboratorio" || value === "admin_sistemas";
}
