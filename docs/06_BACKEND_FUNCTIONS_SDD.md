Actualizacion Fase 13.4: createReservation, tipo de practica y protocolo

CreateReservationInput debe incluir:

```ts
interface CreateReservationInput {
  labId: string;
  subject: string;
  group: string;
  practiceName: string;
  objective: string;
  materialRequired: string;
  practiceType:
    | 'Teórica'
    | 'Simulación'
    | 'Taller'
    | 'Evaluación práctica'
    | 'Investigación'
    | 'Otro';
  practiceTypeOther?: string;
  risky: boolean;
  externalParticipants: boolean;
  startAt: string;
  endAt: string;
  protocolFiles?: ProtocolFileInput[];
  source?: 'web' | 'qr' | 'admin';
}
```

La validacion debe mantenerse alineada con la lista oficial visible al usuario.

Si practiceType === 'Otro', practiceTypeOther es obligatorio, no puede estar
vacio y debe tener maximo 120 caracteres. Si practiceType no es 'Otro',
practiceTypeOther debe quedar vacio, null o no guardarse.

La validacion de protocolo obligatorio debe usar:

protocolRequired = risky === true || externalParticipants === true

createReservation debe guardar practiceType, practiceTypeOther si aplica,
risky, externalParticipants, protocolRequired y protocolFiles. approveReservation
debe revalidar protocolo con la misma regla cuando aprueba una reserva
PENDIENTE_VALIDACION.

createReservation debe resolver el estatus inicial con la misma condicion de
revision:

```ts
requiresManualReview = risky === true || externalParticipants === true;
```

Si requiresManualReview es true, debe crear la reserva como
PENDIENTE_VALIDACION y no crear evento en Google Calendar. El evento se crea
solamente despues de approveReservation. Si requiresManualReview es false y no
existen conflictos, puede crear la reserva como CONFIRMADA y sincronizar
Google Calendar.

Funciones principales

createReservation
approveReservation
rejectReservation
cancelReservation
getLabAvailability
syncCalendarEvent
sendReservationNotification
adminCreateLab
adminUpdateLab
adminAssignResponsible
adminUpdateUserRole
adminCreateSpecialRule
adminUpdateSpecialRule
generateLabQrPayload

createReservation
Tipo

Callable HTTPS Function.

Entrada

interface CreateReservationInput {
  labId: string;
  subject: string;
  group: string;
  practiceName: string;
  objective: string;
  materialRequired: string;
  practiceType: string;
  practiceTypeOther?: string;
  risky: boolean;
  externalParticipants: boolean;
  startAt: string;
  endAt: string;
  protocolFiles?: ProtocolFileInput[];
  source?: 'web' | 'qr' | 'admin';
}

interface ProtocolFileInput {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

Validaciones

Usuario autenticado.
Usuario activo.
Rol permitido:
docente;
responsable_laboratorio;
admin_sistemas.
Laboratorio activo.
Fecha válida.
Hora final mayor que inicial.
Horario semanal permitido.
Anticipación mínima.
Reglas especiales.
Conflicto de horario.
Protocolo obligatorio si aplica.
Existencia, propiedad y validez de protocolFiles si aplica.
Dominio institucional.

Salida

interface CreateReservationOutput {
  reservationId: string;
  folio: string;
  status: ReservationStatus;
  message: string;
}

Secuencia oficial de protocolos en createReservation:

1. El frontend sube el archivo a Cloud Storage con usuario autenticado.
2. Storage valida tipo, tamaño y permisos.
3. El frontend envía metadata a createReservation.
4. createReservation verifica existencia, propiedad y validez del archivo.
5. createReservation vincula protocolFiles a la reserva.
6. Una función programada futura podrá limpiar archivos huérfanos.

Si falla el envío de correo, la reserva conserva su estatus de negocio. El error debe registrarse en notifications.status = FAILED y reservationLogs.action = EMAIL_ERROR.

Si falla la integración crítica con Google Calendar al confirmar, la reserva puede quedar en ERROR_CALENDAR y ese estatus bloquea el horario hasta resolución por Admin/Sistemas.

Proveedor oficial de correo

Actualizacion pre Fase 14:

Las notificaciones de reserva deben generar `body` en texto plano y `htmlBody`
con una plantilla HTML institucional. El envio por Gmail API debe conservar el
fallback de texto plano y, cuando el HTML incluya el logotipo institucional,
armar el mensaje como `multipart/related` con imagen inline por `cid`.

La plantilla HTML debe usar los colores institucionales `#888887`, `#252a86`,
`#271e5d` y `#ffffff`, e incluir encabezado con logotipo, franja institucional,
estatus destacado, datos de reserva y pie del Tecnologico Universitario
Playacar.

No se deben adjuntar protocolos ni incluir enlaces publicos a Storage.

Las Cloud Functions deberán enviar correos usando Google Workspace mediante Gmail API.

La cuenta remitente oficial será:

escenarios.tup@tecplayacar.edu.mx

No se utilizarán proveedores externos como SendGrid, Mailgun, Resend u otros, salvo autorización posterior.

La integración recomendada será mediante una cuenta de servicio con delegación de dominio de Google Workspace, autorizada para actuar como escenarios.tup@tecplayacar.edu.mx.

Scopes mínimos requeridos:

https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/calendar

La misma cuenta escenarios.tup@tecplayacar.edu.mx será la cuenta operativa para escribir eventos en Google Calendar, siempre que los calendarios estén compartidos con permisos de escritura.

approveReservation

Entrada

interface ApproveReservationInput {
  reservationId: string;
  note?: string;
}

Validaciones

Usuario autenticado.
Usuario activo.
Rol permitido:
responsable_laboratorio asignado al laboratorio;
admin_sistemas.
Reserva en PENDIENTE_VALIDACION.
Revalidar conflicto.
Revalidar fecha vigente.
Revalidar horario.
Revalidar Google Calendar.
Revalidar protocolo si aplica.

Salida

interface ApproveReservationOutput {
  reservationId: string;
  status: 'CONFIRMADA_TRAS_VALIDACION';
  calendarEventId: string;
}

rejectReservation

Entrada

interface RejectReservationInput {
  reservationId: string;
  reason: string;
}

Validaciones

Usuario autenticado.
Motivo obligatorio.
Responsable asignado o admin_sistemas.
Reserva pendiente.

Salida

interface RejectReservationOutput {
  reservationId: string;
  status: 'RECHAZADA_POR_RESPONSABLE';
}

cancelReservation

Entrada

interface CancelReservationInput {
  reservationId: string;
  reason?: string;
}

Validaciones

Usuario autenticado.
Perfil activo.
Docente propietario, responsable_laboratorio asignado o admin_sistemas.
Reserva futura.
Estatus cancelable:
PENDIENTE_VALIDACION;
CONFIRMADA;
CONFIRMADA_TRAS_VALIDACION.
ERROR_CALENDAR solo para responsable asignado o admin_sistemas.
Fecha futura.
Si existe calendarEventId, eliminacion del evento en Google Calendar antes de
actualizar Firestore.

Salida

interface CancelReservationOutput {
  reservationId: string;
  folio: string;
  status: 'CANCELADA';
  message: string;
}

Comportamiento:

Si la cancelacion procede, la funcion actualiza la reserva con status
CANCELADA, cancelledBy, cancelledAt, cancellationReason si aplica y updatedAt.
Tambien registra bitacoras CANCELLED y CALENDAR_EVENT_CANCELLED cuando existia
calendarEventId.

Debe crear una notificacion RESERVATION_CANCELLED y enviarla mediante Gmail API.
Un error de correo no debe revertir la cancelacion.

Si Google Calendar falla al eliminar el evento, la funcion debe registrar
CALENDAR_ERROR y devolver un error controlado sin cambiar el estatus de la
reserva.

Si Google Calendar devuelve `404 Not Found` o `410 Gone` al eliminar el evento,
la funcion debe considerar que el evento ya no existe en Calendar y continuar
con la cancelacion. Este caso no debe bloquear el cambio a `CANCELADA`, porque
el horario externo ya quedo liberado para ese `calendarEventId`.

getLabAvailability

Entrada

interface GetLabAvailabilityInput {
  labId: string;
  from: string;
  to: string;
}

Salida

interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  available: boolean;
  reason?: string;
}

interface GetLabAvailabilityOutput {
  labId: string;
  slots: AvailabilitySlot[];
  reservations: CalendarBusyBlock[];
}

adminCreateLab

Solo admin_sistemas.

Debe crear:

nombre;
slug;
descripción;
calendario;
responsables;
horarios;
anticipación mínima;
reglas;
QR path.

adminUpdateLab

Solo admin_sistemas.

Debe actualizar configuración sin perder historial de reservas.

adminUpdateUserRole

Solo admin_sistemas.

No se permite que un usuario cambie su propio rol desde cliente.

Actualizacion Fase 16A: adminUpdateUser

Se implementa la callable administrativa:

```ts
interface AdminUpdateUserInput {
  uid: string;
  role?: 'docente' | 'responsable_laboratorio' | 'admin_sistemas';
  active?: boolean;
  labsAssigned?: string[];
}

interface AdminUpdateUserOutput {
  uid: string;
  updated: true;
  message: string;
}
```

Validaciones:

- `request.auth` existe.
- El actor tiene documento `users/{actorUid}`.
- El actor esta activo.
- El actor tiene rol `admin_sistemas`.
- El usuario objetivo existe.
- El actor no puede desactivar su propia cuenta ni quitarse el rol
  `admin_sistemas`.
- `role`, si llega, pertenece a los tres roles oficiales.
- `labsAssigned`, si llega, es arreglo de strings.
- Cada `labId` en `labsAssigned` existe en `labs`.
- Si el rol final no es `responsable_laboratorio`, `labsAssigned` queda vacio.
- No se aceptan campos arbitrarios fuera del contrato.
- Se actualiza `updatedAt`.

La funcion registra `auditEvents.type = ADMIN_ACTION` y
`auditEvents.action = ADMIN_UPDATE_USER` con actor, target `users/{uid}`,
descripcion legible y metadata segura de campos modificados.

Angular no debe actualizar roles, `active` ni `labsAssigned` con `updateDoc`;
debe usar exclusivamente `adminUpdateUser`.
## Actualizacion Fase 16A.1: ensureUserProfile

Callable HTTPS Function que garantiza perfil institucional despues de Google
Sign-In sin permitir autoasignacion de privilegios.

```ts
interface EnsureUserProfileOutput {
  status:
    | 'EXISTING_PROFILE'
    | 'DOCENTE_PROFILE_CREATED'
    | 'PREAUTHORIZED_PROFILE_CREATED'
    | 'PENDING_ACCESS';
  uid: string;
  email: string;
  role?: 'docente' | 'responsable_laboratorio' | 'admin_sistemas';
  active?: boolean;
  message: string;
}
```

Reglas:

- requiere `request.auth`;
- normaliza email en minusculas;
- exige dominio `@tecplayacar.edu.mx`;
- si `users/{uid}` existe, devuelve `EXISTING_PROFILE`;
- si no existe y el correo cumple `^tup-d\d+@tecplayacar\.edu\.mx$`, crea
  perfil `docente` activo y registra `AUTO_CREATE_DOCENTE_PROFILE`;
- si no existe y hay prealta activa sin reclamar para ese correo, crea
  `users/{uid}`, marca la prealta como reclamada y registra
  `PREAUTHORIZED_USER_CLAIMED`;
- si no existe perfil ni prealta valida, devuelve `PENDING_ACCESS`.

## Actualizacion Fase 16A.1: adminPreauthorizeUser

Callable administrativa para registrar prealtas en
`preauthorizedUsers/{email}`.

Solo puede ejecutarla un perfil activo con rol `admin_sistemas`. El input solo
acepta `email`, `displayName`, `role`, `active` y `labsAssigned`. El rol debe
ser `responsable_laboratorio` o `admin_sistemas`; no se usa para docentes con
patron `tup-dNUMEROS`. Cada laboratorio asignado debe existir en `labs`. La
funcion registra `auditEvents.action = ADMIN_PREAUTHORIZE_USER`.
