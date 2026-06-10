import {google} from "googleapis";
import {defineSecret} from "firebase-functions/params";

export const GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON = defineSecret(
    "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON",
);
export const GOOGLE_WORKSPACE_SUBJECT_EMAIL = defineSecret(
    "GOOGLE_WORKSPACE_SUBJECT_EMAIL",
);
export const GOOGLE_WORKSPACE_SECRETS = [
  GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON,
  GOOGLE_WORKSPACE_SUBJECT_EMAIL,
];

const DEFAULT_SUBJECT_EMAIL = "escenarios.tup@tecplayacar.edu.mx";

interface ServiceAccountCredentials {
  client_email?: string;
  private_key?: string;
}

/**
 * Creates a delegated Google Workspace JWT client.
 *
 * @param {string[]} scopes Google API scopes.
 * @return {Promise<unknown>} Authorized client.
 */
export async function createWorkspaceJwt(
    scopes: string[],
): Promise<InstanceType<typeof google.auth.JWT>> {
  const credentials = getServiceAccountCredentials();
  const subject = getWorkspaceSubjectEmail();

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Credenciales de Google Workspace incompletas.");
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, "\n"),
    scopes,
    subject,
  });

  await auth.authorize();
  return auth;
}

/**
 * Returns the delegated Workspace subject email.
 *
 * @return {string} Subject email.
 */
export function getWorkspaceSubjectEmail(): string {
  return GOOGLE_WORKSPACE_SUBJECT_EMAIL.value().trim() ||
    DEFAULT_SUBJECT_EMAIL;
}

/**
 * Parses the service account secret.
 *
 * @return {ServiceAccountCredentials} Service account credentials.
 */
function getServiceAccountCredentials(): ServiceAccountCredentials {
  const raw = GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON.value();

  if (!raw) {
    throw new Error(
        "Secret GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON no existe.",
    );
  }

  return JSON.parse(raw) as ServiceAccountCredentials;
}
