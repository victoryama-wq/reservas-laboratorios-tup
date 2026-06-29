Colecciones principales

users
labs
reservations
reservationLogs
notifications
systemSettings
blockedPeriods
auditEvents

users/{uid}

interface UserDoc {
  uid: string;
  displayName: string;
  email: string;
  role: 'docente' | 'responsable_laboratorio' | 'admin_sistemas';
  labsAssigned: string[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

labs/{labId}

interface LabDoc {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  imageUrl?: string;
  calendarId: string;
  location?: string;

  responsibleUids: string[];
  responsibleEmails: string[];
  defaultNotifyEmails: string[];

  active: boolean;
  visibleInCatalog: boolean;

  minNoticeHours: number;

  requiresApprovalWhenRisky: boolean;
  requiresProtocolWhenRisky: boolean;

  weeklySchedule: WeeklySchedule;
  specialRules: LabSpecialRule[];

  qrPath: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

weeklySchedule

interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

interface DaySchedule {
  enabled: boolean;
  start: string; // "08:00"
  end: string;   // "20:00"
}

specialRules

interface LabSpecialRule {
  id: string;
  name: string;
  active: boolean;
  termStart?: string; // YYYY-MM-DD
  termEnd?: string;   // YYYY-MM-DD
  daysOfWeek?: number[]; // 0 domingo, 1 lunes, 2 martes...
  blockedStart?: string; // "08:00"
  blockedEnd?: string;   // "13:00"
  fullDayBlocked?: boolean;
  reason: string;
}

reservations/{reservationId}

type ReservationStatus =
  | 'RECIBIDA'
  | 'PENDIENTE_VALIDACION'
  | 'CONFIRMADA'
  | 'CONFIRMADA_TRAS_VALIDACION'
  | 'RECHAZADA_CONFLICTO'
  | 'RECHAZADA_REGLA_HORARIO'
  | 'RECHAZADA_MIN_ANTICIPACION'
  | 'RECHAZADA_POR_RESPONSABLE'
  | 'CANCELADA'
  | 'ERROR_CALENDAR';

interface ReservationDoc {
  id: string;
  folio: string;

  labId: string;
  labName: string;

  teacherUid: string;
  teacherName: string;
  teacherEmail: string;

  subject: string;
  group: string;
  practiceName: string;
  objective: string;
  materialRequired: string;

  practiceType: string;
  practiceTypeOther?: string;
  risky: boolean;
  externalParticipants: boolean;

  protocolRequired: boolean;
  protocolFiles: ProtocolFile[];

  startAt: Timestamp;
  endAt: Timestamp;

  status: ReservationStatus;
  statusReason?: string;

  calendarEventId?: string;

  approvedBy?: string;
  approvedAt?: Timestamp;

  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  cancelledBy?: string;
  cancelledAt?: Timestamp;
  cancellationReason?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;

  source: 'web' | 'qr' | 'admin';
}

Tipos oficiales de practica

El campo practiceType solo debe aceptar estos valores:

- Teorica
- Simulacion
- Taller
- Evaluacion practica
- Investigacion
- Otro

Cuando practiceType === 'Otro', el campo practiceTypeOther es obligatorio,
debe contener texto no vacio y debe tener maximo 120 caracteres. Cuando
practiceType sea distinto de 'Otro', practiceTypeOther debe quedar vacio,
null o no guardarse.

Preguntas condicionadas de seguridad

El formulario y el backend deben conservar dos respuestas booleanas separadas:

- risky: responde a "Se utilizaran sustancias, muestras biologicas o material
  potencialmente riesgoso?"
- externalParticipants: responde a "Participan pacientes, usuarios simulados o
  poblacion externa?"

La regla operativa de protocolo obligatorio es:

protocolRequired = risky === true || externalParticipants === true

El checkbox visual anterior de participantes externos queda eliminado y se
reemplaza por la pregunta formal asociada a externalParticipants.

protocolFiles

interface ProtocolFile {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUid: string;
  downloadUrl?: string;
  uploadedAt: Timestamp;
}

reservationLogs/{logId}

interface ReservationLogDoc {
  id: string;
  reservationId: string;

  action:
    | 'CREATED'
    | 'AUTO_CONFIRMED'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'CALENDAR_EVENT_CREATED'
    | 'CALENDAR_EVENT_CANCELLED'
    | 'CALENDAR_ERROR'
    | 'EMAIL_SENT'
    | 'EMAIL_ERROR'
    | 'STATUS_CHANGED';

  actorUid?: string;
  actorEmail?: string;

  previousStatus?: ReservationStatus;
  newStatus?: ReservationStatus;

  note?: string;
  metadata?: Record<string, unknown>;

  createdAt: Timestamp;
}

notifications/{notificationId}

interface NotificationDoc {
  id: string;
  reservationId?: string;
  type:
    | 'RESERVATION_CONFIRMED'
    | 'RESERVATION_PENDING_APPROVAL'
    | 'RESERVATION_APPROVED'
    | 'RESERVATION_REJECTED'
    | 'RESERVATION_CANCELLED'
    | 'TECHNICAL_ERROR'
    | 'CALENDAR_ERROR'
    | 'EMAIL_ERROR';

  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;

  status: 'PENDING' | 'SENT' | 'FAILED';
  provider: 'gmail_api';
  providerMessageId?: string;

  sentAt?: Timestamp;
  error?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

systemSettings/global

interface SystemSettingsDoc {
  institutionName: string;
  institutionalDomain: string; // "tecplayacar.edu.mx"
  defaultNotifyEmails: string[];
  adminEmails: string[];

  termStart?: string;
  termEnd?: string;

  allowTeacherCancellation: boolean;
  cancellationMinHours?: number;

  maxProtocolFileSizeMb: number;
  allowedProtocolFileTypes: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

Valores iniciales recomendados para systemSettings/global:

{
  "institutionName": "Tecnológico universitario Playacar",
  "institutionalDomain": "tecplayacar.edu.mx",
  "defaultNotifyEmails": [],
  "adminEmails": []
}

blockedPeriods/{blockedPeriodId}

Los bloqueos extraordinarios sirven para mantenimiento, días inhábiles, eventos institucionales o restricciones temporales que no pertenecen al horario semanal normal.

interface BlockedPeriodDoc {
  id: string;
  name: string;
  description?: string;
  reason: string;

  scope: 'global' | 'lab';
  labIds?: string[];

  startAt: Timestamp;
  endAt: Timestamp;
  fullDay: boolean;

  active: boolean;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

auditEvents/{auditEventId}

Los eventos de auditoría registran acciones administrativas, cambios sensibles, errores técnicos y eventos relevantes para trazabilidad.

interface AuditEventDoc {
  id: string;
  type:
    | 'ADMIN_ACTION'
    | 'SENSITIVE_CHANGE'
    | 'TECHNICAL_ERROR'
    | 'CALENDAR_ERROR'
    | 'EMAIL_ERROR'
    | 'SECURITY_EVENT';

  actorUid?: string;
  actorEmail?: string;
  targetCollection?: string;
  targetId?: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;

  createdAt: Timestamp;
}

Datos iniciales de laboratorios y calendarios

Estos datos deben cargarse como semilla inicial de la colección labs. Todos los laboratorios listados son escenarios académicos/laboratorios institucionales activos y visibles en catálogo.

[
  {
    "name": "Cámara de Gesell",
    "slug": "camara-de-gesell",
    "calendarId": "c_6a2664013ee3791f955e2055e83eb4d99249bc871fc47f5dd01231939492ff70@group.calendar.google.com",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 0,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  },
  {
    "name": "Consultorio",
    "slug": "consultorio",
    "calendarId": "c_e3229a68e3592d5b2655ecb3962faf99adb48d86cb907ad6f44e144d7f87ff3a@group.calendar.google.com",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 0,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  },
  {
    "name": "Fisioterapia",
    "slug": "fisioterapia",
    "calendarId": "c_76df8b9baf56e1ff8ab4e871754d1db69852b6bfb3a7127bdbe53d987206c0f2@group.calendar.google.com",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 0,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  },
  {
    "name": "Laboratorio de Alimentos y Bebidas",
    "slug": "laboratorio-de-alimentos-y-bebidas",
    "calendarId": "c_8ba4aef2d1c939fc4e48c7917f2055d61e2f674840a44c175edcda20200570ce@group.calendar.google.com",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 0,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  },
  {
    "name": "Laboratorio de Criminología y Criminalística",
    "slug": "laboratorio-de-criminologia-y-criminalistica",
    "calendarId": "c_cfb0c279a28eec2124aef6091ea5f5341299ac2778dc971eed3062277e354a9d@group.calendar.google.com",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 24,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  },
  {
    "name": "Laboratorio de Simulación clínica",
    "slug": "laboratorio-de-simulacion-clinica",
    "calendarId": "c_f29066fd38d8e46810022a54cc8e28524361b9fd94d833ab0ba45c3227dbf125@group.calendar.google.com",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 0,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  },
  {
    "name": "Quirófano",
    "slug": "quirofano",
    "calendarId": "c_bec1d81ecac4b13d2a4a76dd33792dc04363f9d545550b99066391603fceabd1@group.calendar.google.com",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 0,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  },
  {
    "name": "Sala de Juicios Orales",
    "slug": "sala-de-juicios-orales",
    "calendarId": "c_a61be2c1771a2ce85cb7bc5c69363e6e2026525525a262c8ae4aff517865662b@group.calendar.google.com",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 24,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  },
  {
    "name": "Taller de Arquitectura",
    "slug": "taller-de-arquitectura",
    "calendarId": "c_8cc0dfc820d56981c4df9f0fd2daded7b9291e84aad1d80f4d46f9dfb531fb6e@group.calendar.google.com",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 24,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  },
  {
    "name": "Centro de Cómputo",
    "slug": "centro-de-computo",
    "calendarId": "centro.computo@tecplayacar.edu.mx",
    "calendarSharedWith": "escenarios.tup@tecplayacar.edu.mx",
    "active": true,
    "visibleInCatalog": true,
    "minNoticeHours": 24,
    "requiresApprovalWhenRisky": true,
    "requiresProtocolWhenRisky": true
  }
]
## Actualizacion Fase 16A.1: preauthorizedUsers

La coleccion `preauthorizedUsers` registra prealtas administrativas para
responsables/coordinadores y, cuando se autorice, admins. No se usa para
docentes regulares con patron `tup-dNUMEROS@tecplayacar.edu.mx`.

`emailKey` es el correo institucional normalizado en minusculas.

```ts
interface PreauthorizedUserDoc {
  email: string;
  displayName?: string;
  role: 'responsable_laboratorio' | 'admin_sistemas';
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
```

Cuando `claimedByUid` existe, la prealta ya fue reclamada por un usuario real
de Firebase Authentication y los cambios posteriores deben hacerse sobre
`users/{uid}` mediante `adminUpdateUser`.

Cuando `revokedAt` existe o `active === false`, la prealta queda revocada o
inactiva y no debe ser reclamada por `ensureUserProfile`. La revocacion conserva
el documento para trazabilidad y registra:

- `revokedBy`: UID de Admin/Sistemas que revoco la prealta;
- `revokedAt`: fecha/hora de revocacion;
- `revocationReason`: motivo opcional capturado en UI.

Los documentos `users/{uid}` existentes no se eliminan como mecanismo de
baja. El bloqueo de acceso se modela con `active: false` para conservar
relaciones historicas con reservas, bitacoras, notificaciones y auditoria.

## Actualizacion Fase 16B: administracion de labs

La coleccion `labs` mantiene el modelo `LabDoc` existente. Fase 16B no agrega
colecciones nuevas ni renombra campos, pero formaliza que Admin/Sistemas puede
crear y editar documentos mediante Cloud Functions.

Campos editables desde `/admin/laboratorios`:

- `name`
- `slug`
- `description`
- `shortDescription`
- `imageUrl`
- `location`
- `calendarId`
- `responsibleUids`
- `responsibleEmails`
- `defaultNotifyEmails`
- `active`
- `visibleInCatalog`
- `minNoticeHours`
- `requiresApprovalWhenRisky`
- `requiresProtocolWhenRisky`
- `weeklySchedule`

`qrPath` se deriva automaticamente como `/reservar/{slug}`. `specialRules`
queda fuera del editor Fase 16B y se conserva sin borrarse.

`responsibleUids` no sincroniza automaticamente `users/{uid}.labsAssigned`.
La asignacion que controla visibilidad de solicitudes para responsables sigue
gestionandose desde `/admin/usuarios`.

Eventos de auditoria esperados:

- `auditEvents.action = ADMIN_CREATE_LAB`
- `auditEvents.action = ADMIN_UPDATE_LAB`

## Actualizacion Fase 16C: specialRules y blockedPeriods

`labs/{labId}.specialRules` queda habilitado para gestion desde
`/admin/reglas`. Cada regla conserva el modelo `LabSpecialRule`:

```ts
interface LabSpecialRule {
  id: string;
  name: string;
  active: boolean;
  termStart?: string;
  termEnd?: string;
  daysOfWeek?: number[];
  blockedStart?: string;
  blockedEnd?: string;
  fullDayBlocked?: boolean;
  reason: string;
}
```

`blockedPeriods` mantiene el modelo ya definido para bloqueos extraordinarios:

```ts
interface BlockedPeriodDoc {
  id: string;
  name: string;
  description?: string;
  reason: string;
  scope: 'global' | 'lab';
  labIds?: string[];
  startAt: Timestamp;
  endAt: Timestamp;
  fullDay: boolean;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Reglas de datos:

- `scope = global` aplica a todos los laboratorios y guarda `labIds: []`;
- `scope = lab` exige al menos un laboratorio existente;
- no se borran reglas ni bloqueos desde la interfaz, se desactivan con
  `active: false`;
- cada creacion/actualizacion genera un evento en `auditEvents`.

## Actualizacion Fase 17B.1: galeria de imagenes de laboratorios

`labs/{labId}` incorpora metadata opcional para una galeria privada de imagenes.
No se crean colecciones nuevas para esta fase.

Campos agregados a `LabDoc`:

```ts
interface LabDoc {
  gallery?: LabGalleryImage[];
  coverImageId?: string;
}

type LabGalleryImageContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

interface LabGalleryImage {
  id: string;
  storagePath: string;
  fileName: string;
  contentType: LabGalleryImageContentType;
  sizeBytes: number;
  alt?: string;
  caption?: string;
  order: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

Reglas del modelo:

- `storagePath` debe pertenecer a
  `labImages/{labId}/gallery/{imageId}/{fileName}`;
- no se permite guardar `downloadUrl` en la metadata;
- maximo 8 imagenes activas por laboratorio;
- `coverImageId` debe apuntar a una imagen activa de `gallery`;
- `imageUrl` permanece como campo legado opcional y no sustituye a
  `gallery`;
- los archivos fisicos no se eliminan automaticamente en esta fase.

## Actualizacion Fase 17B.3: configuracion QR de laboratorios

`labs/{labId}` puede incluir el campo opcional:

```ts
qrConfig?: {
  title?: string;
  subtitle?: string;
  customLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  showLogo?: boolean;
  frameStyle?: 'classic' | 'card' | 'minimal';
  printSize?: 'small' | 'medium' | 'large';
};
```

`qrConfig` solo define presentacion visual. No almacena imagenes QR, archivos
base64 ni URLs distintas a la ruta derivada del `slug`.

La URL operativa del QR sigue siendo:

```text
https://reservas-laboratorios-tup.web.app/reservar/{slug}
```

Si cambia `slug`, `qrPath` se actualiza a `/reservar/{slug}` y los QR impresos
deben regenerarse.
