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
  LabDoc,
  LabGalleryImage,
  LabGalleryImageContentType,
  LabQrConfig,
  LabQrFrameStyle,
  LabQrPrintSize,
  WeeklySchedule,
} from "../../shared/models";
import {
  CalendarValidationResult,
  GoogleCalendarService,
} from "../calendar/google-calendar.service";
import {GOOGLE_WORKSPACE_SECRETS} from
  "../google-workspace/google-workspace-auth.service";

const REGION = "us-central1";
const INSTITUTIONAL_DOMAIN = "@tecplayacar.edu.mx";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_GALLERY_IMAGES = 8;
const MAX_LAB_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_GALLERY_TEXT_LENGTH = 120;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const LAB_IMAGE_CONTENT_TYPES = new Set<LabGalleryImageContentType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const VALID_RESPONSIBLE_ROLES = new Set([
  "responsable_laboratorio",
  "admin_sistemas",
]);
const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const ALLOWED_INPUT_KEYS = new Set([
  "labId",
  "name",
  "slug",
  "description",
  "shortDescription",
  "imageUrl",
  "gallery",
  "coverImageId",
  "qrConfig",
  "calendarId",
  "location",
  "responsibleUids",
  "responsibleEmails",
  "defaultNotifyEmails",
  "active",
  "visibleInCatalog",
  "minNoticeHours",
  "requiresApprovalWhenRisky",
  "requiresProtocolWhenRisky",
  "weeklySchedule",
]);

type WeekdayKey = typeof WEEKDAYS[number];

export interface AdminCreateLabOutput {
  labId: string;
  created: true;
  message: string;
}

export interface AdminUpdateLabOutput {
  labId: string;
  updated: true;
  message: string;
}

export type AdminValidateLabCalendarOutput = CalendarValidationResult;

interface ParsedLabInput {
  labId?: string;
  name?: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  gallery?: LabGalleryImage[];
  coverImageId?: string;
  qrConfig?: LabQrConfig;
  calendarId?: string;
  location?: string;
  responsibleUids?: string[];
  responsibleEmails?: string[];
  defaultNotifyEmails?: string[];
  active?: boolean;
  visibleInCatalog?: boolean;
  minNoticeHours?: number;
  requiresApprovalWhenRisky?: boolean;
  requiresProtocolWhenRisky?: boolean;
  weeklySchedule?: WeeklySchedule;
}

/**
 * Creates a laboratory from Admin/Sistemas.
 */
export const adminCreateLab = onCall(
    {
      region: REGION,
      invoker: "public",
      secrets: GOOGLE_WORKSPACE_SECRETS,
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminCreateLabOutput> => {
      const actorUid = request.auth?.uid;
      if (!actorUid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para crear laboratorios.",
        );
      }

      const input = parseCreateInput(request.data);
      const db = getFirestore();
      const actor = await getActiveAdmin(actorUid);
      await assertSlugUnique(input.slug);
      await assertResponsibleUsers(input.responsibleUids);
      await assertCalendarCanWrite(input.calendarId);

      const now = Timestamp.now();
      const labRef = db.collection("labs").doc(input.slug);
      const auditRef = db.collection("auditEvents").doc();

      await db.runTransaction(async (transaction) => {
        const existingLab = await transaction.get(labRef);
        if (existingLab.exists) {
          throw new HttpsError(
              "already-exists",
              "Ya existe un laboratorio con ese slug.",
          );
        }

        const lab: LabDoc = {
          id: labRef.id,
          name: input.name,
          slug: input.slug,
          description: input.description,
          shortDescription: input.shortDescription,
          imageUrl: input.imageUrl,
          gallery: input.gallery,
          coverImageId: input.coverImageId,
          qrConfig: input.qrConfig,
          calendarId: input.calendarId,
          location: input.location,
          responsibleUids: input.responsibleUids,
          responsibleEmails: input.responsibleEmails,
          defaultNotifyEmails: input.defaultNotifyEmails,
          active: input.active,
          visibleInCatalog: input.visibleInCatalog,
          minNoticeHours: input.minNoticeHours,
          requiresApprovalWhenRisky:
            input.requiresApprovalWhenRisky ?? true,
          requiresProtocolWhenRisky:
            input.requiresProtocolWhenRisky ?? true,
          weeklySchedule: input.weeklySchedule,
          specialRules: [],
          qrPath: `/reservar/${input.slug}`,
          createdAt: now,
          updatedAt: now,
        };

        transaction.create(labRef, removeUndefinedFields(lab));
        transaction.create(auditRef, {
          id: auditRef.id,
          type: "ADMIN_ACTION",
          actorUid,
          actorEmail: actor.email ?? request.auth?.token.email,
          targetCollection: "labs",
          targetId: labRef.id,
          action: "ADMIN_CREATE_LAB",
          description: `Laboratorio creado: ${input.name}.`,
          metadata: {
            labId: labRef.id,
            slug: input.slug,
            active: input.active,
            visibleInCatalog: input.visibleInCatalog,
            minNoticeHours: input.minNoticeHours,
            responsibleUids: input.responsibleUids,
            responsibleEmails: input.responsibleEmails,
            defaultNotifyEmails: input.defaultNotifyEmails,
          },
          createdAt: now,
        });
      });

      return {
        labId: labRef.id,
        created: true,
        message: "Laboratorio creado correctamente.",
      };
    },
);

/**
 * Updates a laboratory from Admin/Sistemas.
 */
export const adminUpdateLab = onCall(
    {
      region: REGION,
      invoker: "public",
      secrets: GOOGLE_WORKSPACE_SECRETS,
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminUpdateLabOutput> => {
      const actorUid = request.auth?.uid;
      if (!actorUid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para editar laboratorios.",
        );
      }

      const input = parseUpdateInput(request.data);
      const db = getFirestore();
      const actor = await getActiveAdmin(actorUid);
      if (input.slug) {
        await assertSlugUnique(input.slug, input.labId);
      }
      if (input.responsibleUids) {
        await assertResponsibleUsers(input.responsibleUids);
      }

      const labRef = db.collection("labs").doc(input.labId);
      if (input.calendarId !== undefined) {
        const currentLabSnapshot = await labRef.get();
        if (!currentLabSnapshot.exists) {
          throw new HttpsError(
              "not-found",
              "El laboratorio indicado no existe.",
          );
        }

        const currentLab = currentLabSnapshot.data() as LabDoc;
        if (currentLab.calendarId !== input.calendarId) {
          await assertCalendarCanWrite(input.calendarId);
        }
      }

      const auditRef = db.collection("auditEvents").doc();
      const now = Timestamp.now();

      await db.runTransaction(async (transaction) => {
        const labSnapshot = await transaction.get(labRef);
        if (!labSnapshot.exists) {
          throw new HttpsError(
              "not-found",
              "El laboratorio indicado no existe.",
          );
        }

        const currentLab = labSnapshot.data() as LabDoc;
        const patch = buildLabPatch(input, now);
        const changedFields = Object.keys(patch).filter(
            (field) => field !== "updatedAt",
        );

        if (changedFields.length === 0) {
          throw new HttpsError(
              "invalid-argument",
              "Debe enviar al menos un campo modificable.",
          );
        }

        transaction.update(labRef, removeUndefinedFields(patch));
        transaction.create(auditRef, {
          id: auditRef.id,
          type: "ADMIN_ACTION",
          actorUid,
          actorEmail: actor.email ?? request.auth?.token.email,
          targetCollection: "labs",
          targetId: input.labId,
          action: "ADMIN_UPDATE_LAB",
          description: `Laboratorio actualizado: ${currentLab.name}.`,
          metadata: {
            labId: input.labId,
            changedFields,
            previousSlug: currentLab.slug,
            newSlug: input.slug ?? currentLab.slug,
          },
          createdAt: now,
        });
      });

      return {
        labId: input.labId,
        updated: true,
        message: "Laboratorio actualizado correctamente.",
      };
    },
);

/**
 * Validates a laboratory calendar from Admin/Sistemas without modifying data.
 */
export const adminValidateLabCalendar = onCall(
    {
      region: REGION,
      invoker: "public",
      secrets: GOOGLE_WORKSPACE_SECRETS,
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<AdminValidateLabCalendarOutput> => {
      const actorUid = request.auth?.uid;
      if (!actorUid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para validar calendarios.",
        );
      }

      await getActiveAdmin(actorUid);
      const input = parseCalendarValidationInput(request.data);
      return new GoogleCalendarService().validateCalendarAccess(
          input.calendarId,
      );
    },
);

/**
 * Ensures the callable actor is an active Admin/Sistemas profile.
 *
 * @param {string} actorUid Acting Firebase Auth uid.
 * @return {Promise<AppUser>} Active admin profile.
 */
async function getActiveAdmin(actorUid: string): Promise<AppUser> {
  const actorSnapshot = await getFirestore()
      .collection("users")
      .doc(actorUid)
      .get();

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
        "Solo Admin/Sistemas puede gestionar laboratorios.",
    );
  }

  return actor;
}

/**
 * Ensures the delegated Workspace account has write access to a calendar.
 *
 * @param {string} calendarId Calendar id.
 */
async function assertCalendarCanWrite(calendarId: string): Promise<void> {
  const result = await new GoogleCalendarService()
      .validateCalendarAccess(calendarId);

  if (result.valid && result.canWrite) {
    return;
  }

  throw new HttpsError(
      result.reason === "INVALID_ID" ?
        "invalid-argument" :
        "failed-precondition",
      result.message,
  );
}

/**
 * Parses calendar validation callable input.
 *
 * @param {unknown} data Callable payload.
 * @return {{calendarId: string}} Sanitized input.
 */
function parseCalendarValidationInput(
    data: unknown,
): {calendarId: string} {
  if (!isRecord(data)) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud de validacion no es valida.",
    );
  }

  const allowedKeys = new Set(["calendarId"]);
  const unknownKeys = Object.keys(data).filter(
      (key) => !allowedKeys.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud contiene campos no permitidos.",
    );
  }

  return {
    calendarId: requireText(
        data.calendarId,
        "El calendarId es obligatorio.",
    ),
  };
}

/**
 * Parses create input.
 *
 * @param {unknown} data Callable payload.
 * @return {Required<ParsedLabInput>} Parsed create payload.
 */
function parseCreateInput(
    data: unknown,
): Required<Omit<ParsedLabInput, "labId">> {
  const input = parseBaseInput(data);

  return {
    name: requireText(input.name, "El nombre es obligatorio."),
    slug: requireSlug(input.slug),
    description: requireText(
        input.description,
        "La descripcion es obligatoria.",
    ),
    shortDescription: input.shortDescription ?? "",
    imageUrl: input.imageUrl ?? "",
    gallery: input.gallery ?? [],
    coverImageId: input.coverImageId ?? "",
    qrConfig: input.qrConfig ?? {},
    calendarId: requireText(
        input.calendarId,
        "El calendarId es obligatorio.",
    ),
    location: input.location ?? "",
    responsibleUids: input.responsibleUids ?? [],
    responsibleEmails: input.responsibleEmails ?? [],
    defaultNotifyEmails: input.defaultNotifyEmails ?? [],
    active: requireBoolean(input.active, "active debe ser booleano."),
    visibleInCatalog: requireBoolean(
        input.visibleInCatalog,
        "visibleInCatalog debe ser booleano.",
    ),
    minNoticeHours: requireMinNoticeHours(input.minNoticeHours),
    requiresApprovalWhenRisky:
      input.requiresApprovalWhenRisky ?? true,
    requiresProtocolWhenRisky:
      input.requiresProtocolWhenRisky ?? true,
    weeklySchedule: requireWeeklySchedule(input.weeklySchedule),
  };
}

/**
 * Parses update input.
 *
 * @param {unknown} data Callable payload.
 * @return {ParsedLabInput} Parsed update payload with labId.
 */
function parseUpdateInput(data: unknown): ParsedLabInput & {labId: string} {
  const input = parseBaseInput(data);
  if (!input.labId) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar el laboratorio a editar.",
    );
  }

  return {
    ...input,
    labId: input.labId,
  };
}

/**
 * Parses common lab input and rejects arbitrary fields.
 *
 * @param {unknown} data Callable payload.
 * @return {ParsedLabInput} Parsed payload.
 */
function parseBaseInput(data: unknown): ParsedLabInput {
  if (!isRecord(data)) {
    throw new HttpsError(
        "invalid-argument",
        "La solicitud de laboratorio no es valida.",
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

  const labId = optionalText(data.labId);
  const slug = data.slug === undefined ? undefined : requireSlug(data.slug);
  const storageLabId = labId ?? slug;
  const gallery = parseGallery(data.gallery, storageLabId);
  const coverImageId = optionalText(data.coverImageId);
  validateCoverImageId(coverImageId, gallery);
  const qrConfig = parseQrConfig(data.qrConfig);

  return {
    labId,
    name: optionalText(data.name),
    slug,
    description: optionalText(data.description),
    shortDescription: optionalText(data.shortDescription),
    imageUrl: optionalText(data.imageUrl),
    gallery,
    coverImageId,
    qrConfig,
    calendarId: optionalText(data.calendarId),
    location: optionalText(data.location),
    responsibleUids: parseStringList(data.responsibleUids, "responsibleUids"),
    responsibleEmails: parseEmailList(
        data.responsibleEmails,
        "responsibleEmails",
    ),
    defaultNotifyEmails: parseEmailList(
        data.defaultNotifyEmails,
        "defaultNotifyEmails",
    ),
    active: optionalBoolean(data.active, "active"),
    visibleInCatalog: optionalBoolean(
        data.visibleInCatalog,
        "visibleInCatalog",
    ),
    minNoticeHours: data.minNoticeHours === undefined ?
      undefined :
      requireMinNoticeHours(data.minNoticeHours),
    requiresApprovalWhenRisky: optionalBoolean(
        data.requiresApprovalWhenRisky,
        "requiresApprovalWhenRisky",
    ),
    requiresProtocolWhenRisky: optionalBoolean(
        data.requiresProtocolWhenRisky,
        "requiresProtocolWhenRisky",
    ),
    weeklySchedule: data.weeklySchedule === undefined ?
      undefined :
      requireWeeklySchedule(data.weeklySchedule),
  };
}

/**
 * Builds a Firestore patch from update input.
 *
 * @param {ParsedLabInput} input Parsed input.
 * @param {Timestamp} now Current timestamp.
 * @return {Partial<LabDoc>} Firestore patch.
 */
function buildLabPatch(
    input: ParsedLabInput,
    now: Timestamp,
): Partial<LabDoc> {
  const patch: Partial<LabDoc> = {updatedAt: now};

  setIfDefined(patch, "name", input.name);
  setIfDefined(patch, "slug", input.slug);
  setIfDefined(patch, "description", input.description);
  setIfDefined(patch, "shortDescription", input.shortDescription);
  setIfDefined(patch, "imageUrl", input.imageUrl);
  setIfDefined(patch, "gallery", input.gallery);
  setIfDefined(patch, "coverImageId", input.coverImageId);
  setIfDefined(patch, "qrConfig", input.qrConfig);
  setIfDefined(patch, "calendarId", input.calendarId);
  setIfDefined(patch, "location", input.location);
  setIfDefined(patch, "responsibleUids", input.responsibleUids);
  setIfDefined(patch, "responsibleEmails", input.responsibleEmails);
  setIfDefined(patch, "defaultNotifyEmails", input.defaultNotifyEmails);
  setIfDefined(patch, "active", input.active);
  setIfDefined(patch, "visibleInCatalog", input.visibleInCatalog);
  setIfDefined(patch, "minNoticeHours", input.minNoticeHours);
  setIfDefined(
      patch,
      "requiresApprovalWhenRisky",
      input.requiresApprovalWhenRisky,
  );
  setIfDefined(
      patch,
      "requiresProtocolWhenRisky",
      input.requiresProtocolWhenRisky,
  );
  setIfDefined(patch, "weeklySchedule", input.weeklySchedule);

  if (input.slug !== undefined) {
    patch.qrPath = `/reservar/${input.slug}`;
  }

  return patch;
}

/**
 * Sets a patch field only when the value is defined.
 *
 * @param {Partial<LabDoc>} patch Patch object.
 * @param {string} key Lab field.
 * @param {unknown} value Candidate value.
 */
function setIfDefined<K extends keyof LabDoc>(
    patch: Partial<LabDoc>,
    key: K,
    value: LabDoc[K] | undefined,
): void {
  if (value !== undefined) {
    patch[key] = value;
  }
}

/**
 * Removes undefined values before writing to Firestore.
 *
 * Firestore rejects `undefined` values, including nested gallery metadata.
 * This helper preserves Timestamp instances and cleans plain objects/arrays.
 *
 * @param {T} value Candidate Firestore data.
 * @return {T} Data without undefined fields.
 */
function removeUndefinedFields<T>(value: T): T {
  if (value instanceof Timestamp) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => removeUndefinedFields(entry)) as T;
  }

  if (isRecord(value)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        cleaned[key] = removeUndefinedFields(entry);
      }
    }
    return cleaned as T;
  }

  return value;
}

const ALLOWED_GALLERY_KEYS = new Set([
  "id",
  "storagePath",
  "fileName",
  "contentType",
  "sizeBytes",
  "alt",
  "caption",
  "order",
  "active",
  "createdAt",
  "updatedAt",
]);

const ALLOWED_QR_CONFIG_KEYS = new Set([
  "title",
  "subtitle",
  "customLabel",
  "primaryColor",
  "secondaryColor",
  "backgroundColor",
  "showLogo",
  "frameStyle",
  "printSize",
]);

/**
 * Parses optional QR configuration.
 *
 * @param {unknown} value Candidate QR config.
 * @return {LabQrConfig | undefined} Sanitized QR config.
 */
function parseQrConfig(value: unknown): LabQrConfig | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new HttpsError(
        "invalid-argument",
        "qrConfig debe ser un objeto.",
    );
  }

  const unknownKeys = Object.keys(value).filter(
      (key) => !ALLOWED_QR_CONFIG_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new HttpsError(
        "invalid-argument",
        "qrConfig contiene campos no permitidos.",
    );
  }

  const config: LabQrConfig = {};
  const title = optionalLimitedText(value.title, "qrConfig.title");
  const subtitle = optionalLimitedText(value.subtitle, "qrConfig.subtitle");
  const customLabel = optionalLimitedText(
      value.customLabel,
      "qrConfig.customLabel",
  );
  const primaryColor = optionalHexColor(
      value.primaryColor,
      "qrConfig.primaryColor",
  );
  const secondaryColor = optionalHexColor(
      value.secondaryColor,
      "qrConfig.secondaryColor",
  );
  const backgroundColor = optionalHexColor(
      value.backgroundColor,
      "qrConfig.backgroundColor",
  );
  const showLogo = optionalBoolean(value.showLogo, "qrConfig.showLogo");
  const frameStyle = optionalQrFrameStyle(value.frameStyle);
  const printSize = optionalQrPrintSize(value.printSize);

  if (title !== undefined) {
    config.title = title;
  }
  if (subtitle !== undefined) {
    config.subtitle = subtitle;
  }
  if (customLabel !== undefined) {
    config.customLabel = customLabel;
  }
  if (primaryColor !== undefined) {
    config.primaryColor = primaryColor;
  }
  if (secondaryColor !== undefined) {
    config.secondaryColor = secondaryColor;
  }
  if (backgroundColor !== undefined) {
    config.backgroundColor = backgroundColor;
  }
  if (showLogo !== undefined) {
    config.showLogo = showLogo;
  }
  if (frameStyle !== undefined) {
    config.frameStyle = frameStyle;
  }
  if (printSize !== undefined) {
    config.printSize = printSize;
  }

  return config;
}

/**
 * Parses optional QR color.
 *
 * @param {unknown} value Candidate color.
 * @param {string} field Field name.
 * @return {string | undefined} Hex color.
 */
function optionalHexColor(value: unknown, field: string): string | undefined {
  const text = optionalText(value);
  if (text === undefined || text === "") {
    return undefined;
  }

  if (!HEX_COLOR_PATTERN.test(text)) {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe usar formato hexadecimal #RRGGBB.`,
    );
  }

  return text;
}

/**
 * Parses QR frame style.
 *
 * @param {unknown} value Candidate frame style.
 * @return {LabQrFrameStyle | undefined} Frame style.
 */
function optionalQrFrameStyle(value: unknown): LabQrFrameStyle | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === "classic" || value === "card" || value === "minimal") {
    return value;
  }

  throw new HttpsError(
      "invalid-argument",
      "qrConfig.frameStyle no es valido.",
  );
}

/**
 * Parses QR print size.
 *
 * @param {unknown} value Candidate print size.
 * @return {LabQrPrintSize | undefined} Print size.
 */
function optionalQrPrintSize(value: unknown): LabQrPrintSize | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === "small" || value === "medium" || value === "large") {
    return value;
  }

  throw new HttpsError(
      "invalid-argument",
      "qrConfig.printSize no es valido.",
  );
}

/**
 * Parses and validates laboratory gallery metadata.
 *
 * @param {unknown} value Candidate gallery.
 * @param {string | undefined} labId Lab id used in Storage path.
 * @return {LabGalleryImage[] | undefined} Gallery metadata.
 */
function parseGallery(
    value: unknown,
    labId: string | undefined,
): LabGalleryImage[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new HttpsError(
        "invalid-argument",
        "gallery debe ser un arreglo.",
    );
  }

  if (value.length > MAX_GALLERY_IMAGES) {
    throw new HttpsError(
        "invalid-argument",
        `gallery no puede exceder ${MAX_GALLERY_IMAGES} imagenes.`,
    );
  }

  if (!labId) {
    throw new HttpsError(
        "invalid-argument",
        "Debe indicar labId o slug para validar la galeria.",
    );
  }

  const seenIds = new Set<string>();
  const gallery = value.map((item) => parseGalleryImage(item, labId, seenIds));
  const activeCount = gallery.filter((image) => image.active).length;

  if (activeCount > MAX_GALLERY_IMAGES) {
    throw new HttpsError(
        "invalid-argument",
        `Solo se permiten ${MAX_GALLERY_IMAGES} imagenes activas.`,
    );
  }

  return gallery.sort((first, second) => first.order - second.order);
}

/**
 * Parses one gallery image metadata entry.
 *
 * @param {unknown} value Candidate entry.
 * @param {string} labId Lab id used in Storage path.
 * @param {Set<string>} seenIds Already used image IDs.
 * @return {LabGalleryImage} Valid image metadata.
 */
function parseGalleryImage(
    value: unknown,
    labId: string,
    seenIds: Set<string>,
): LabGalleryImage {
  if (!isRecord(value)) {
    throw new HttpsError(
        "invalid-argument",
        "Cada imagen de gallery debe ser un objeto.",
    );
  }

  const unknownKeys = Object.keys(value).filter(
      (key) => !ALLOWED_GALLERY_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new HttpsError(
        "invalid-argument",
        "gallery contiene campos no permitidos.",
    );
  }

  const id = requireText(value.id, "Cada imagen debe tener id.");
  if (seenIds.has(id)) {
    throw new HttpsError(
        "invalid-argument",
        `Imagen duplicada en gallery: ${id}.`,
    );
  }
  seenIds.add(id);

  const storagePath = requireText(
      value.storagePath,
      "Cada imagen debe tener storagePath.",
  );
  const expectedPrefix = `labImages/${labId}/gallery/${id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new HttpsError(
        "invalid-argument",
        "storagePath de imagen no pertenece al laboratorio indicado.",
    );
  }

  const fileName = requireText(
      value.fileName,
      "Cada imagen debe tener fileName.",
  );
  const contentType = parseLabImageContentType(value.contentType);
  const sizeBytes = parseLabImageSize(value.sizeBytes);
  const order = parseGalleryOrder(value.order);
  const active = requireBoolean(
      value.active,
      "active de imagen debe ser booleano.",
  );
  const alt = optionalLimitedText(value.alt, "alt");
  const caption = optionalLimitedText(value.caption, "caption");
  const image: LabGalleryImage = {
    id,
    storagePath,
    fileName,
    contentType,
    sizeBytes,
    order,
    active,
    createdAt: parseGalleryTimestamp(value.createdAt, "createdAt"),
  };

  if (alt !== undefined) {
    image.alt = alt;
  }

  if (caption !== undefined) {
    image.caption = caption;
  }

  if (value.updatedAt !== undefined && value.updatedAt !== null) {
    image.updatedAt = parseGalleryTimestamp(value.updatedAt, "updatedAt");
  }

  return image;
}

/**
 * Validates gallery cover image.
 *
 * @param {string | undefined} coverImageId Candidate cover image id.
 * @param {LabGalleryImage[] | undefined} gallery Parsed gallery.
 */
function validateCoverImageId(
    coverImageId: string | undefined,
    gallery: LabGalleryImage[] | undefined,
): void {
  if (!coverImageId) {
    return;
  }

  const cover = gallery?.find((image) =>
    image.id === coverImageId && image.active,
  );
  if (!cover) {
    throw new HttpsError(
        "invalid-argument",
        "coverImageId debe corresponder a una imagen activa de gallery.",
    );
  }
}

/**
 * Parses allowed laboratory image content type.
 *
 * @param {unknown} value Candidate content type.
 * @return {LabGalleryImageContentType} Content type.
 */
function parseLabImageContentType(
    value: unknown,
): LabGalleryImageContentType {
  if (typeof value !== "string" ||
    !LAB_IMAGE_CONTENT_TYPES.has(value as LabGalleryImageContentType)) {
    throw new HttpsError(
        "invalid-argument",
        "Tipo de imagen no permitido.",
    );
  }

  return value as LabGalleryImageContentType;
}

/**
 * Parses image size.
 *
 * @param {unknown} value Candidate size.
 * @return {number} Size in bytes.
 */
function parseLabImageSize(value: unknown): number {
  if (typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_LAB_IMAGE_SIZE_BYTES) {
    throw new HttpsError(
        "invalid-argument",
        "El tamano de imagen excede el limite permitido.",
    );
  }

  return Math.floor(value);
}

/**
 * Parses gallery image order.
 *
 * @param {unknown} value Candidate order.
 * @return {number} Order.
 */
function parseGalleryOrder(value: unknown): number {
  if (typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0) {
    throw new HttpsError(
        "invalid-argument",
        "order de imagen debe ser numerico mayor o igual a cero.",
    );
  }

  return Math.floor(value);
}

/**
 * Parses optional gallery text.
 *
 * @param {unknown} value Candidate text.
 * @param {string} field Field name.
 * @return {string | undefined} Sanitized text.
 */
function optionalLimitedText(
    value: unknown,
    field: string,
): string | undefined {
  const text = optionalText(value);
  if (text === undefined || text === "") {
    return undefined;
  }

  if (text.length > MAX_GALLERY_TEXT_LENGTH) {
    throw new HttpsError(
        "invalid-argument",
        `${field} no puede exceder ${MAX_GALLERY_TEXT_LENGTH} caracteres.`,
    );
  }

  return text;
}

/**
 * Parses Timestamp-like values from callable payloads.
 *
 * @param {unknown} value Candidate timestamp.
 * @param {string} field Field name.
 * @return {Timestamp} Timestamp.
 */
function parseGalleryTimestamp(value: unknown, field: string): Timestamp {
  if (value instanceof Timestamp) {
    return value;
  }

  if (isRecord(value)) {
    const seconds = typeof value.seconds === "number" ?
      value.seconds :
      value._seconds;
    const nanoseconds = typeof value.nanoseconds === "number" ?
      value.nanoseconds :
      value._nanoseconds;

    if (typeof seconds === "number" &&
      typeof nanoseconds === "number") {
      return new Timestamp(seconds, nanoseconds);
    }
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }

  throw new HttpsError(
      "invalid-argument",
      `${field} de imagen debe ser una fecha valida.`,
  );
}

/**
 * Ensures a slug is unique in labs.
 *
 * @param {string} slug Candidate slug.
 * @param {string | undefined} exceptLabId Lab id to ignore.
 */
async function assertSlugUnique(
    slug: string,
    exceptLabId?: string,
): Promise<void> {
  const snapshot = await getFirestore()
      .collection("labs")
      .where("slug", "==", slug)
      .limit(2)
      .get();

  const conflict = snapshot.docs.find((document) =>
    document.id !== exceptLabId,
  );

  if (conflict) {
    throw new HttpsError(
        "already-exists",
        "Ya existe un laboratorio con ese slug.",
    );
  }
}

/**
 * Ensures selected responsible users exist with allowed roles.
 *
 * @param {string[]} responsibleUids Responsible user IDs.
 */
async function assertResponsibleUsers(
    responsibleUids: string[],
): Promise<void> {
  if (!responsibleUids.length) {
    return;
  }

  const db = getFirestore();
  const snapshots = await Promise.all(
      responsibleUids.map((uid) => db.collection("users").doc(uid).get()),
  );

  const invalidUids = snapshots
      .map((snapshot, index) => {
        if (!snapshot.exists) {
          return responsibleUids[index];
        }
        const user = snapshot.data() as AppUser;
        return VALID_RESPONSIBLE_ROLES.has(user.role) ?
          null :
          responsibleUids[index];
      })
      .filter((uid): uid is string => typeof uid === "string");

  if (invalidUids.length > 0) {
    throw new HttpsError(
        "failed-precondition",
        `Responsables invalidos: ${invalidUids.join(", ")}.`,
    );
  }
}

/**
 * Parses a required weekly schedule.
 *
 * @param {unknown} value Candidate schedule.
 * @return {WeeklySchedule} Valid schedule.
 */
function requireWeeklySchedule(value: unknown): WeeklySchedule {
  if (!isRecord(value)) {
    throw new HttpsError(
        "invalid-argument",
        "weeklySchedule debe ser un objeto.",
    );
  }

  const unknownDays = Object.keys(value).filter(
      (key) => !WEEKDAYS.includes(key as WeekdayKey),
  );
  if (unknownDays.length > 0) {
    throw new HttpsError(
        "invalid-argument",
        "weeklySchedule contiene dias no permitidos.",
    );
  }

  const schedule: WeeklySchedule = {};
  let enabledDays = 0;
  for (const day of WEEKDAYS) {
    const dayValue = value[day];
    if (dayValue === undefined) {
      schedule[day] = {enabled: false, start: "", end: ""};
      continue;
    }

    schedule[day] = parseDaySchedule(dayValue, day);
    if (schedule[day]?.enabled) {
      enabledDays += 1;
    }
  }

  if (enabledDays === 0) {
    throw new HttpsError(
        "invalid-argument",
        "Debe habilitar al menos un dia de horario.",
    );
  }

  return schedule;
}

/**
 * Parses one day schedule.
 *
 * @param {unknown} value Candidate day schedule.
 * @param {WeekdayKey} day Day key.
 * @return {object} Valid day schedule.
 */
function parseDaySchedule(
    value: unknown,
    day: WeekdayKey,
): NonNullable<WeeklySchedule[WeekdayKey]> {
  if (!isRecord(value) || typeof value.enabled !== "boolean") {
    throw new HttpsError(
        "invalid-argument",
        `Horario invalido para ${day}.`,
    );
  }

  if (!value.enabled) {
    return {
      enabled: false,
      start: typeof value.start === "string" ? value.start : "",
      end: typeof value.end === "string" ? value.end : "",
    };
  }

  const start = requireTime(value.start, `Inicio invalido para ${day}.`);
  const end = requireTime(value.end, `Fin invalido para ${day}.`);
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    throw new HttpsError(
        "invalid-argument",
        `La hora final debe ser mayor que la inicial en ${day}.`,
    );
  }

  return {enabled: true, start, end};
}

/**
 * Parses a required text.
 *
 * @param {unknown} value Candidate value.
 * @param {string} message Error message.
 * @return {string} Text.
 */
function requireText(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", message);
  }
  return value.trim();
}

/**
 * Parses optional text.
 *
 * @param {unknown} value Candidate value.
 * @return {string | undefined} Text or undefined.
 */
function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        "Los campos de texto deben ser cadenas validas.",
    );
  }
  return value.trim();
}

/**
 * Parses and validates slug.
 *
 * @param {unknown} value Candidate value.
 * @return {string} Slug.
 */
function requireSlug(value: unknown): string {
  const slug = requireText(value, "El slug es obligatorio.").toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new HttpsError(
        "invalid-argument",
        "El slug solo puede usar minusculas, numeros y guiones.",
    );
  }
  return slug;
}

/**
 * Parses required boolean.
 *
 * @param {unknown} value Candidate value.
 * @param {string} message Error message.
 * @return {boolean} Parsed boolean.
 */
function requireBoolean(value: unknown, message: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", message);
  }
  return value;
}

/**
 * Parses optional boolean.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {boolean | undefined} Parsed boolean.
 */
function optionalBoolean(
    value: unknown,
    field: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe ser booleano.`,
    );
  }
  return value;
}

/**
 * Parses min notice hours.
 *
 * @param {unknown} value Candidate value.
 * @return {number} Valid hours.
 */
function requireMinNoticeHours(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new HttpsError(
        "invalid-argument",
        "minNoticeHours debe ser un numero mayor o igual a cero.",
    );
  }
  return Math.floor(value);
}

/**
 * Parses optional string list.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {string[] | undefined} Parsed list.
 */
function parseStringList(
    value: unknown,
    field: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new HttpsError(
        "invalid-argument",
        `${field} debe ser un arreglo.`,
    );
  }

  return [
    ...new Set(value.map((item) => {
      if (typeof item !== "string" || !item.trim()) {
        throw new HttpsError(
            "invalid-argument",
            `${field} contiene valores invalidos.`,
        );
      }
      return item.trim();
    })),
  ];
}

/**
 * Parses institutional email list.
 *
 * @param {unknown} value Candidate value.
 * @param {string} field Field name.
 * @return {string[] | undefined} Parsed email list.
 */
function parseEmailList(
    value: unknown,
    field: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const emails = parseStringList(value, field) ?? [];
  return emails.map((email) => {
    const normalized = email.toLowerCase();
    if (!normalized.endsWith(INSTITUTIONAL_DOMAIN)) {
      throw new HttpsError(
          "invalid-argument",
          `${field} solo permite correos institucionales.`,
      );
    }
    return normalized;
  });
}

/**
 * Parses HH:mm time.
 *
 * @param {unknown} value Candidate value.
 * @param {string} message Error message.
 * @return {string} Time value.
 */
function requireTime(value: unknown, message: string): string {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
    throw new HttpsError("invalid-argument", message);
  }
  return value;
}

/**
 * Converts HH:mm to minutes.
 *
 * @param {string} value Time value.
 * @return {number} Minutes.
 */
function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Ensures a value is record-like.
 *
 * @param {unknown} value Candidate value.
 * @return {boolean} Whether it is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
