/* eslint-disable max-len, require-jsdoc, valid-jsdoc */
import {getStorage} from "firebase-admin/storage";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {CallableRequest, HttpsError, onCall} from "firebase-functions/v2/https";

import {
  AppUser,
  EvidenceFile,
  ReservationDoc,
} from "../../shared/models";
import {GOOGLE_WORKSPACE_SECRETS} from
  "../google-workspace/google-workspace-auth.service";
import {ReservationLogRepository} from "../logs/reservation-log.repository";
import {NotificationDeliveryService} from
  "../notifications/notification-delivery.service";
import {NotificationRepository} from
  "../notifications/notification.repository";
import {ReservationRepository} from "../reservations/reservation.repository";

const REGION = "us-central1";
const MAX_EVIDENCE_FILES = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const RETENTION_DAYS = 90;
const ACCESS_TTL_SECONDS = 10 * 60;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface EvidenceInput {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface AddEvidenceInput {
  reservationId?: string;
  files?: EvidenceInput[];
}

interface EvidenceAccessInput {
  reservationId?: string;
  storagePath?: string;
}

/** Links private evidence images to a confirmed reservation. */
export const addReservationEvidence = onCall(
    {
      region: REGION,
      invoker: "public",
      secrets: GOOGLE_WORKSPACE_SECRETS,
    },
    async (request: CallableRequest<unknown>) => {
      const uid = requireUid(request);
      const input = parseAddInput(request.data);
      const db = getFirestore();
      const repository = new ReservationRepository(db);
      const profile = await repository.getUserProfile(uid);
      const reservation = await repository.getReservationById(input.reservationId);

      assertActiveProfile(profile);
      assertEvidenceOwner(profile, reservation);
      if (!reservation) {
        throw new HttpsError("not-found", "La reserva no existe.");
      }
      assertEvidenceWindow(reservation, repository);

      const newFiles = await validateStoredFiles(
          uid,
          reservation.id,
          input.files,
      );
      const lab = await repository.getLab(reservation.labId, undefined);
      if (!lab) {
        throw new HttpsError("not-found", "El laboratorio no existe.");
      }
      const recipients = await resolveEvidenceRecipients(lab);

      const notificationRepository = new NotificationRepository(db);
      const logRepository = new ReservationLogRepository(db);
      const transactionResult = await repository.runTransaction(
          async (transaction) => {
            const reservationRef = db.collection("reservations")
                .doc(reservation.id);
            const latestSnapshot = await transaction.get(reservationRef);
            if (!latestSnapshot.exists) {
              throw new HttpsError("not-found", "La reserva no existe.");
            }
            const latest = latestSnapshot.data() as ReservationDoc;
            assertEvidenceOwner(profile, latest);
            assertEvidenceWindow(latest, repository);

            const currentFiles = latest.evidenceFiles ?? [];
            const currentPaths = new Set(
                currentFiles.map((file) => file.storagePath),
            );
            const filesToAdd = newFiles.filter(
                (file) => !currentPaths.has(file.storagePath),
            );
            if (currentFiles.length + filesToAdd.length > MAX_EVIDENCE_FILES) {
              throw new HttpsError(
                  "failed-precondition",
                  `Cada reserva admite hasta ${MAX_EVIDENCE_FILES} evidencias.`,
              );
            }
            if (!filesToAdd.length) {
              return {files: currentFiles, notification: null};
            }

            const allFiles = [...currentFiles, ...filesToAdd];
            repository.updateReservation(transaction, reservation.id, {
              evidenceFiles: allFiles,
              evidenceCleanupAt: earliestExpiry(allFiles),
              updatedAt: Timestamp.now(),
            });
            logRepository.createLog(transaction, {
              reservationId: reservation.id,
              action: "EVIDENCE_UPLOADED",
              actorUid: profile.uid,
              actorEmail: profile.email,
              newStatus: reservation.status,
              metadata: {filesAdded: filesToAdd.length},
              note: `${filesToAdd.length} evidencia(s) fotografica(s) agregada(s).`,
            });

            const template = buildEvidenceEmail(latest, filesToAdd.length);
            const notification = notificationRepository
                .createPendingNotification(transaction, {
                  reservationId: reservation.id,
                  type: "RESERVATION_EVIDENCE_UPLOADED",
                  to: recipients,
                  subject: template.subject,
                  body: template.body,
                  htmlBody: template.htmlBody,
                });
            return {files: allFiles, notification};
          },
      );

      if (transactionResult.notification) {
        try {
          await new NotificationDeliveryService(db)
              .sendNotification(transactionResult.notification.notification);
        } catch (error) {
          logger.error("Evidence notification failed", {
            reservationId: reservation.id,
            notificationId: transactionResult.notification.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        reservationId: reservation.id,
        files: transactionResult.files.map(toEvidenceOutput),
        message: "Evidencias guardadas y responsable notificado.",
      };
    },
);

/** Returns a short-lived URL after checking reservation ownership/assignment. */
export const getReservationEvidenceAccess = onCall(
    {region: REGION, invoker: "public"},
    async (request: CallableRequest<unknown>) => {
      const uid = requireUid(request);
      const input = parseAccessInput(request.data);
      const repository = new ReservationRepository(getFirestore());
      const profile = await repository.getUserProfile(uid);
      const reservation = await repository.getReservationById(input.reservationId);
      assertActiveProfile(profile);
      assertCanReadEvidence(profile, reservation);
      if (!reservation) {
        throw new HttpsError("not-found", "La reserva no existe.");
      }

      const file = (reservation.evidenceFiles ?? [])
          .find((item) => item.storagePath === input.storagePath);
      if (!file) {
        throw new HttpsError("not-found", "La evidencia no esta vinculada.");
      }
      const bucketFile = getStorage().bucket().file(file.storagePath);
      const [exists] = await bucketFile.exists();
      if (!exists) {
        throw new HttpsError("not-found", "La evidencia ya no esta disponible.");
      }
      const [url] = await bucketFile.getSignedUrl({
        action: "read",
        expires: Date.now() + ACCESS_TTL_SECONDS * 1000,
        responseDisposition: `inline; filename="${safeFileName(file.fileName)}"`,
      });
      return {url, expiresInSeconds: ACCESS_TTL_SECONDS};
    },
);

/** Removes linked evidence files after the approved 90-day retention. */
export const scheduledCleanupReservationEvidence = onSchedule(
    {
      region: REGION,
      schedule: "every day 03:30",
      timeZone: "America/Cancun",
      timeoutSeconds: 540,
    },
    async () => {
      const db = getFirestore();
      const now = Timestamp.now();
      const snapshot = await db.collection("reservations")
          .where("evidenceCleanupAt", "<=", now)
          .limit(100)
          .get();

      for (const document of snapshot.docs) {
        const reservation = document.data() as ReservationDoc;
        const files = reservation.evidenceFiles ?? [];
        const expired = files.filter((file) => file.expiresAt.toMillis() <= now.toMillis());
        const remaining = files.filter((file) => file.expiresAt.toMillis() > now.toMillis());

        await Promise.all(expired.map(async (file) => {
          try {
            await getStorage().bucket().file(file.storagePath).delete({ignoreNotFound: true});
          } catch (error) {
            logger.error("Evidence cleanup file deletion failed", {
              reservationId: document.id,
              storagePath: file.storagePath,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }));

        await document.ref.update({
          evidenceFiles: remaining,
          evidenceCleanupAt: remaining.length ? earliestExpiry(remaining) : null,
          updatedAt: now,
        });
      }

      await removeExpiredOrphanEvidence(now);

      logger.info("Reservation evidence cleanup completed", {
        reservationsProcessed: snapshot.size,
      });
    },
);

function requireUid(request: CallableRequest<unknown>): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debe iniciar sesion.");
  }
  return request.auth.uid;
}

function assertActiveProfile(profile: AppUser | null): asserts profile is AppUser {
  if (!profile?.active) {
    throw new HttpsError("permission-denied", "Su perfil no esta activo.");
  }
}

function assertEvidenceOwner(
    profile: AppUser,
    reservation: ReservationDoc | null,
): void {
  if (
    profile.role !== "docente" ||
    !reservation ||
    reservation.teacherUid !== profile.uid
  ) {
    throw new HttpsError(
        "permission-denied",
        "Solo el docente propietario puede agregar evidencias.",
    );
  }
}

function assertCanReadEvidence(
    profile: AppUser,
    reservation: ReservationDoc | null,
): void {
  if (!reservation) {
    throw new HttpsError("not-found", "La reserva no existe.");
  }
  const allowed = reservation.teacherUid === profile.uid ||
    profile.role === "admin_sistemas" ||
    (profile.role === "responsable_laboratorio" &&
      (profile.labsAssigned ?? []).includes(reservation.labId));
  if (!allowed) {
    throw new HttpsError("permission-denied", "No puede consultar esta evidencia.");
  }
}

function assertEvidenceWindow(
    reservation: ReservationDoc,
    repository: ReservationRepository,
): void {
  if (!["CONFIRMADA", "CONFIRMADA_TRAS_VALIDACION"].includes(reservation.status)) {
    throw new HttpsError(
        "failed-precondition",
        "Solo se admiten evidencias de reservas confirmadas.",
    );
  }
  const startAt = repository.toDate(reservation.startAt);
  if (!startAt || startAt.getTime() > Date.now()) {
    throw new HttpsError(
        "failed-precondition",
        "Las evidencias se habilitan al iniciar la reserva.",
    );
  }
}

function parseAddInput(data: unknown): {reservationId: string; files: EvidenceInput[]} {
  const input = data as AddEvidenceInput;
  if (typeof input?.reservationId !== "string" || !input.reservationId.trim()) {
    throw new HttpsError("invalid-argument", "Debe indicar la reserva.");
  }
  if (!Array.isArray(input.files) || !input.files.length) {
    throw new HttpsError("invalid-argument", "Seleccione evidencias para guardar.");
  }
  if (input.files.length > MAX_EVIDENCE_FILES) {
    throw new HttpsError("invalid-argument", "Puede subir hasta 10 evidencias.");
  }
  return {reservationId: input.reservationId.trim(), files: input.files};
}

function parseAccessInput(data: unknown): {reservationId: string; storagePath: string} {
  const input = data as EvidenceAccessInput;
  if (
    typeof input?.reservationId !== "string" ||
    typeof input?.storagePath !== "string" ||
    !input.reservationId.trim() ||
    !input.storagePath.trim()
  ) {
    throw new HttpsError("invalid-argument", "Acceso de evidencia incompleto.");
  }
  return {
    reservationId: input.reservationId.trim(),
    storagePath: input.storagePath.trim(),
  };
}

async function validateStoredFiles(
    uid: string,
    reservationId: string,
    inputs: EvidenceInput[],
): Promise<EvidenceFile[]> {
  const prefix = `reservationEvidence/${uid}/${reservationId}/`;
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(
      now.toMillis() + RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  return Promise.all(inputs.map(async (input) => {
    if (
      !input.storagePath.startsWith(prefix) ||
      !ALLOWED_CONTENT_TYPES.has(input.contentType) ||
      !Number.isFinite(input.sizeBytes) ||
      input.sizeBytes <= 0 ||
      input.sizeBytes > MAX_FILE_SIZE_BYTES
    ) {
      throw new HttpsError("invalid-argument", "Metadata de evidencia invalida.");
    }
    const bucketFile = getStorage().bucket().file(input.storagePath);
    const [exists] = await bucketFile.exists();
    if (!exists) {
      throw new HttpsError("not-found", `No existe ${input.fileName} en Storage.`);
    }
    const [metadata] = await bucketFile.getMetadata();
    if (
      metadata.contentType !== input.contentType ||
      Number(metadata.size) !== input.sizeBytes
    ) {
      throw new HttpsError("failed-precondition", "La evidencia no coincide con Storage.");
    }
    return {
      storagePath: input.storagePath,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      uploadedByUid: uid,
      uploadedAt: now,
      expiresAt,
    };
  }));
}

function earliestExpiry(files: EvidenceFile[]): Timestamp {
  return files.reduce((earliest, file) =>
    file.expiresAt.toMillis() < earliest.toMillis() ? file.expiresAt : earliest,
  files[0].expiresAt);
}

function toEvidenceOutput(file: EvidenceFile): Record<string, unknown> {
  return {
    ...file,
    uploadedAt: file.uploadedAt.toDate().toISOString(),
    expiresAt: file.expiresAt.toDate().toISOString(),
  };
}

function buildEvidenceEmail(
    reservation: ReservationDoc,
    filesAdded: number,
): {subject: string; body: string; htmlBody: string} {
  const date = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: "America/Cancun",
  }).format(reservation.startAt.toDate());
  const formatter = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Cancun",
  });
  const time = `${formatter.format(reservation.startAt.toDate())} - ${formatter.format(reservation.endAt.toDate())}`;
  const body = [
    "Se cargaron evidencias de una actividad de laboratorio.",
    `Folio: ${reservation.folio}`,
    `Docente: ${reservation.teacherName} (${reservation.teacherEmail})`,
    `Laboratorio: ${reservation.labName}`,
    `Fecha: ${date}`,
    `Horario: ${time}`,
    `Practica: ${reservation.practiceName}`,
    `Evidencias agregadas: ${filesAdded}`,
    "Las imagenes deben revisarse desde el sistema; no se adjuntan ni se publican.",
  ].join("\n");
  const htmlBody = `<div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif"><div style="max-width:680px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden"><div style="background:#271e5d;color:#fff;padding:22px"><strong>Sistema Web de Reservas de Laboratorios</strong><h2>Evidencias cargadas</h2></div><div style="padding:22px;white-space:pre-line;color:#111827">${escapeHtml(body)}</div></div></div>`;
  return {
    subject: `Evidencias cargadas - ${reservation.folio}`,
    body,
    htmlBody,
  };
}

function uniqueEmails(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim()).filter(Boolean))];
}

async function resolveEvidenceRecipients(
    lab: {responsibleUids: string[]; responsibleEmails: string[]; defaultNotifyEmails: string[]},
): Promise<string[]> {
  const db = getFirestore();
  const profiles = await Promise.all((lab.responsibleUids ?? []).map(
      (uid) => db.collection("users").doc(uid).get(),
  ));
  const profileEmails = profiles
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => snapshot.data() as AppUser)
      .filter((profile) => profile.active === true)
      .map((profile) => profile.email);
  return uniqueEmails([
    ...profileEmails,
    ...(lab.responsibleEmails ?? []),
    ...(lab.defaultNotifyEmails ?? []),
  ]);
}

async function removeExpiredOrphanEvidence(now: Timestamp): Promise<void> {
  const cutoff = now.toMillis() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const [files] = await getStorage().bucket().getFiles({
    prefix: "reservationEvidence/",
  });
  for (const file of files) {
    try {
      const [metadata] = await file.getMetadata();
      const createdAt = Date.parse(metadata.timeCreated ?? "");
      if (Number.isFinite(createdAt) && createdAt <= cutoff) {
        await file.delete({ignoreNotFound: true});
      }
    } catch (error) {
      logger.error("Orphan evidence cleanup failed", {
        storagePath: file.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function safeFileName(value: string): string {
  return value.replace(/["\r\n]/g, "_");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
}
