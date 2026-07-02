import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {
  AppUser,
  LabDoc,
  LabGalleryImage,
  PublicLab,
  PublicLabGalleryImage,
} from "../../shared/models";

const REGION = "us-central1";
const GALLERY_URL_TTL_MS = 15 * 60 * 1000;

interface GetPublicLabsOutput {
  labs: PublicLab[];
}

interface GetPublicLabDetailInput {
  labId?: unknown;
  slug?: unknown;
}

interface GetPublicLabDetailOutput {
  lab: PublicLab;
}

/**
 * Returns active and visible laboratories with sanitized fields.
 */
export const getPublicLabs = onCall(
    {
      region: REGION,
      invoker: "public",
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<GetPublicLabsOutput> => {
      const db = getFirestore();
      await assertActiveProfile(db, request.auth?.uid);

      const snapshot = await db
          .collection("labs")
          .where("active", "==", true)
          .where("visibleInCatalog", "==", true)
          .get();

      const labs = await Promise.all(
          snapshot.docs.map((document) =>
            toPublicLab(document.id, document.data() as LabDoc, false),
          ),
      );

      return {
        labs: labs.sort((first, second) =>
          first.name.localeCompare(second.name, "es"),
        ),
      };
    },
);

/**
 * Returns one active and visible laboratory with sanitized fields.
 */
export const getPublicLabDetail = onCall(
    {
      region: REGION,
      invoker: "public",
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<GetPublicLabDetailOutput> => {
      const db = getFirestore();
      await assertActiveProfile(db, request.auth?.uid);

      const input = parseDetailInput(request.data);
      const lab = await findPublicLab(db, input);

      if (!lab || lab.active !== true || lab.visibleInCatalog !== true) {
        throw new HttpsError(
            "not-found",
            "El laboratorio no esta disponible en el catalogo.",
        );
      }

      return {
        lab: await toPublicLab(lab.id, lab, true),
      };
    },
);

/**
 * Verifies the caller has an active institutional profile.
 *
 * @param {FirebaseFirestore.Firestore} db Firestore instance.
 * @param {string | undefined} uid Auth uid.
 */
async function assertActiveProfile(
    db: FirebaseFirestore.Firestore,
    uid: string | undefined,
): Promise<void> {
  if (!uid) {
    throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesion para consultar laboratorios.",
    );
  }

  const snapshot = await db.collection("users").doc(uid).get();
  const profile = snapshot.exists ? (snapshot.data() as AppUser) : null;

  if (!profile || profile.active !== true) {
    throw new HttpsError(
        "permission-denied",
        "El perfil institucional no esta activo.",
    );
  }

  if (!["docente", "responsable_laboratorio", "admin_sistemas"].includes(
      profile.role,
  )) {
    throw new HttpsError(
        "permission-denied",
        "El rol institucional no es valido.",
    );
  }
}

/**
 * Parses public detail input.
 *
 * @param {unknown} data Callable input.
 * @return {Object} Parsed input.
 */
function parseDetailInput(data: unknown): {labId: string; slug: string} {
  const record = data as GetPublicLabDetailInput;
  const labId = normalizeString(record?.labId);
  const slug = normalizeString(record?.slug);

  if (!labId && !slug) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar el laboratorio solicitado.",
    );
  }

  return {labId, slug};
}

/**
 * Finds a lab by document id, field id or slug.
 *
 * @param {FirebaseFirestore.Firestore} db Firestore instance.
 * @param {Object} input Parsed input.
 * @return {Promise<LabDoc | null>} Laboratory or null.
 */
async function findPublicLab(
    db: FirebaseFirestore.Firestore,
    input: {labId: string; slug: string},
): Promise<LabDoc | null> {
  if (input.labId) {
    const direct = await db.collection("labs").doc(input.labId).get();

    if (direct.exists) {
      return withDocumentId(direct.id, direct.data());
    }

    const byFieldId = await db
        .collection("labs")
        .where("id", "==", input.labId)
        .limit(1)
        .get();
    const fieldIdDocument = byFieldId.docs[0];

    if (fieldIdDocument) {
      return withDocumentId(fieldIdDocument.id, fieldIdDocument.data());
    }
  }

  const targetSlug = input.slug || input.labId;
  const bySlug = await db
      .collection("labs")
      .where("slug", "==", targetSlug)
      .limit(1)
      .get();
  const slugDocument = bySlug.docs[0];

  return slugDocument ?
    withDocumentId(slugDocument.id, slugDocument.data()) :
    null;
}

/**
 * Normalizes Firestore data with its document id.
 *
 * @param {string} documentId Firestore document id.
 * @param {FirebaseFirestore.DocumentData | undefined} data Document data.
 * @return {LabDoc} Laboratory document.
 */
function withDocumentId(
    documentId: string,
    data: FirebaseFirestore.DocumentData | undefined,
): LabDoc {
  const lab = data as Omit<LabDoc, "id">;
  return {
    ...lab,
    id: documentId,
  };
}

/**
 * Builds a sanitized public laboratory view.
 *
 * @param {string} documentId Firestore document id.
 * @param {LabDoc} lab Laboratory document.
 * @param {boolean} includeGallery Whether to sign gallery image URLs.
 * @return {Promise<PublicLab>} Sanitized lab.
 */
async function toPublicLab(
    documentId: string,
    lab: LabDoc,
    includeGallery: boolean,
): Promise<PublicLab> {
  const gallery = includeGallery ?
    await toPublicGallery(lab.gallery, lab.coverImageId) :
    [];

  return {
    id: documentId,
    name: lab.name,
    slug: lab.slug,
    description: lab.description,
    shortDescription: lab.shortDescription,
    imageUrl: lab.imageUrl,
    gallery,
    coverImageId: lab.coverImageId,
    location: lab.location,
    active: lab.active === true,
    visibleInCatalog: lab.visibleInCatalog === true,
    minNoticeHours: Number(lab.minNoticeHours ?? 0),
    requiresApprovalWhenRisky: lab.requiresApprovalWhenRisky === true,
    requiresProtocolWhenRisky: lab.requiresProtocolWhenRisky === true,
    weeklySchedule: lab.weeklySchedule ?? {},
    qrPath: lab.qrPath || `/reservar/${lab.slug}`,
  };
}

/**
 * Sanitizes gallery metadata and signs temporary read URLs.
 *
 * @param {LabGalleryImage[] | undefined} gallery Gallery metadata.
 * @param {string | undefined} coverImageId Cover image id.
 * @return {Promise<PublicLabGalleryImage[]>} Public gallery.
 */
async function toPublicGallery(
    gallery: LabGalleryImage[] | undefined,
    coverImageId: string | undefined,
): Promise<PublicLabGalleryImage[]> {
  const activeImages = (gallery ?? [])
      .filter((image) => image.active)
      .sort((first, second) => {
        const firstIsCover = first.id === coverImageId;
        const secondIsCover = second.id === coverImageId;

        if (firstIsCover !== secondIsCover) {
          return firstIsCover ? -1 : 1;
        }

        return first.order - second.order;
      });

  const bucket = getStorage().bucket();
  const results = await Promise.allSettled(
      activeImages.map(async (image) => {
        const [url] = await bucket.file(image.storagePath).getSignedUrl({
          action: "read",
          expires: Date.now() + GALLERY_URL_TTL_MS,
        });

        return {
          id: image.id,
          url,
          alt: image.alt,
          caption: image.caption,
          order: image.order,
          active: true,
        } satisfies PublicLabGalleryImage;
      }),
  );

  return results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

/**
 * Normalizes strings.
 *
 * @param {unknown} value Value.
 * @return {string} Normalized string.
 */
function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
