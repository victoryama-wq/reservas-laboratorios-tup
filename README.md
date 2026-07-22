# Sistema Web de Reservas de Laboratorios

Web app institucional para gestionar reservas de laboratorios acadÃ©micos del TecnolÃ³gico universitario Playacar.

## Entorno recomendado

- Node.js: 22
- Firebase project: reservas-laboratorios-tup
- Cuenta propietaria/administradora: victor.yama@tecplayacar.edu.mx
- Cuenta operativa para Calendar y correos: escenarios.tup@tecplayacar.edu.mx

## Comandos base

Instalar dependencias del proyecto:

```bash
npm install
```

Instalar dependencias de Cloud Functions:

```bash
npm install --prefix functions
```

Verificar Firebase CLI local:

```bash
npx firebase --version
```

Ejecutar lint de Functions:

```bash
npm --prefix functions run lint
```

Compilar Functions:

```bash
npm --prefix functions run build
```

Iniciar emuladores Firebase:

```bash
npx firebase emulators:start
```

## Frontend Angular

La aplicaciÃ³n Angular base estÃ¡ ubicada en `apps/web`.

Instalar dependencias del frontend:

```bash
npm install --prefix apps/web
```

Ejecutar la app Angular en modo desarrollo:

```bash
npm --prefix apps/web start
```

Compilar la app Angular:

```bash
npm --prefix apps/web run build
```

Lint del frontend:

```bash
# Pendiente: el proyecto Angular base no tiene script de lint configurado todavÃ­a.
```

La salida de build queda configurada para Firebase Hosting en:

```text
apps/web/dist/web/browser
```

## Modelos y configuraciÃ³n Firebase

Los modelos TypeScript del frontend estÃ¡n en:

```text
apps/web/src/app/shared/models
```

Los modelos TypeScript de Cloud Functions estÃ¡n en:

```text
functions/src/shared/models
```

Por ahora los modelos estÃ¡n duplicados de forma controlada entre frontend y
Functions para evitar configurar una librerÃ­a compartida antes de tiempo.
Ambos lados usan nombres y tipos alineados con los SDD del proyecto.

La configuraciÃ³n base de Firebase para Angular estÃ¡ en:

```text
apps/web/src/app/core/firebase/firebase.config.ts
apps/web/src/app/core/firebase/firebase.providers.ts
```

`firebase.config.ts` ya esta conectado con la Web App publica de Firebase para
pruebas reales de autenticacion:

```text
displayName: reservas-escenarios-tup
appId: 1:261669564296:web:3705a6323eca95f7ff943d
projectId: reservas-laboratorios-tup
messagingSenderId: 261669564296
```

La configuracion de Web App es publica para el cliente Firebase. No agregar
aqui service accounts, llaves privadas ni secretos de backend.

DecisiÃ³n sobre AngularFire:
se intentÃ³ instalar `@angular/fire`, pero la versiÃ³n disponible declarÃ³ peer
dependency para Angular 20 mientras esta app usa Angular 21. Para no forzar
dependencias incompatibles, la base queda con Firebase SDK modular. Se puede
revisar nuevamente cuando exista una versiÃ³n de `@angular/fire` compatible con
Angular 21.

## Autenticacion

La base de autenticacion del frontend usa Firebase SDK modular con Google
Sign-In. En esta fase no se usa `@angular/fire`.

La sesion de Firebase Auth usa persistencia de navegador por sesion
(`browserSessionPersistence`) para alinearse con el control de cierre por
inactividad. En pruebas locales debe preferirse:

```text
http://localhost:4200/login
```

en lugar de `http://127.0.0.1:4200/login`, porque Firebase Authentication
normalmente autoriza `localhost` como dominio local y `127.0.0.1` puede
requerir configuracion adicional en dominios autorizados.

El acceso se restringe a correos del dominio institucional:

```text
@tecplayacar.edu.mx
```

Despues del inicio de sesion, la app lee el perfil en:

```text
users/{uid}
```

Los roles no se crean automaticamente desde el frontend. Admin/Sistemas debe
crear o habilitar el documento del usuario, asignar uno de los tres roles
oficiales y marcar el perfil como activo.

Si el usuario no tiene perfil, esta inactivo o tiene un rol no valido, se
muestra la pantalla de acceso pendiente. La ruta original de acceso por QR
(`/reservar/:labSlug`) se conserva durante el login y se reanuda cuando el
perfil activo existe.

El login espera brevemente la restauracion inicial de Firebase Auth antes de
decidir que no existe sesion. Esto evita que un usuario ya autenticado quede
detenido en la pantalla de login durante la validacion del perfil. El boton
`Ingresar con Google` debe mostrar el logotipo multicolor de Google, no una
letra generica.

Actualizacion QA posterior a Fase 17:

- el header no debe mostrar `Docente` como rol fallback mientras el perfil se
  esta cargando o validando;
- el perfil `users/{uid}` se lee de forma fresca desde Firestore al restaurar
  sesion o completar login;
- la navegacion de Responsable y Admin/Sistemas solo se muestra cuando existe
  un perfil activo confirmado para el UID autenticado actual;
- si el perfil aun no esta confirmado, el header muestra `Validando perfil...`
  o un estado neutro como `Perfil pendiente`, nunca un rol inventado.

Las reservas, reglas de negocio criticas, Google Calendar API y Gmail API ya se
ejecutan desde Cloud Functions. Angular conserva solo validaciones de apoyo y no
escribe reservas directamente en Firestore.

## Seguridad

No subir secretos al repositorio. No commitear archivos `.env`, credenciales, llaves privadas, service accounts ni tokens de Google/Firebase.

## Creacion del primer admin_sistemas

El primer usuario `admin_sistemas` se debe crear manualmente desde Firebase
Console. Ningun usuario debe poder asignarse su propio rol desde el frontend.

Proceso recomendado:

1. Iniciar sesion en la app con el correo institucional:

```text
victor.yama@tecplayacar.edu.mx
```

2. Entrar a Firebase Console > Authentication > Users y copiar el UID generado
   para ese usuario.

3. Entrar a Firestore Database y crear el documento:

```text
users/{uid}
```

4. Usar como minimo estos campos:

```json
{
  "uid": "UID_COPIADO_DESDE_AUTHENTICATION",
  "displayName": "Victor Yama",
  "email": "victor.yama@tecplayacar.edu.mx",
  "role": "admin_sistemas",
  "labsAssigned": [],
  "active": true,
  "createdAt": "Timestamp actual",
  "updatedAt": "Timestamp actual"
}
```

5. Volver a iniciar sesion o recargar la app para que el frontend lea
   `users/{uid}` y habilite la navegacion de Admin/Sistemas.

Advertencia: los roles oficiales solo son `docente`,
`responsable_laboratorio` y `admin_sistemas`. El frontend no debe crear ni
modificar roles.

## Reglas iniciales de seguridad

Firestore usa denegacion por defecto. La lectura y escritura dependen del
perfil activo en `users/{uid}`.

Resumen inicial:

- El usuario autenticado puede leer su propio perfil.
- `admin_sistemas` puede leer, crear, actualizar y desactivar usuarios.
- Usuarios con perfil activo consultan catalogo/detalle mediante callables
  sanitizadas; solo `admin_sistemas` lee `labs/{labId}` completo.
- Solo `admin_sistemas` puede escribir laboratorios, configuracion global y
  bloqueos extraordinarios.
- Las reservas no se escriben directamente desde el frontend; la escritura
  directa de `reservations` esta bloqueada y la creacion pasa por Cloud
  Functions.
- `reservationLogs`, `notifications` y `auditEvents` son de escritura exclusiva
  backend/Admin SDK. Desde cliente solo `admin_sistemas` puede leerlos.
- Storage niega por defecto y prepara la ruta temporal
  `protocolUploads/{uid}/{uploadId}/{fileName}` para futuras cargas de
  protocolos.
- Los protocolos no son publicos. El usuario solo puede escribir y leer dentro
  de su propio prefijo temporal; `admin_sistemas` puede leer y eliminar esos
  archivos para soporte tecnico.

## Datos semilla de laboratorios

Los datos iniciales de laboratorios se encuentran en:

```text
firebase/seed/labs.seed.json
```

El archivo contiene 10 laboratorios activos y visibles en catalogo, con su
`slug`, descripcion, horario semanal base, reglas de practicas riesgosas,
anticipacion minima, ruta QR y `calendarId` operativo institucional.

La carga manual a Firestore queda preparada con el script:

```bash
npm --prefix functions run seed:labs
```

Este script compila Functions y ejecuta `functions/lib/seed/labs.seed.js`.
Usa Firebase Admin SDK, escribe en la coleccion `labs` y guarda cada documento
con `id` o `slug` como ID. La escritura usa `merge: true`, por lo que no borra
laboratorios existentes ni elimina campos administrativos que se agreguen
despues. No se ejecuta automaticamente en deploy.

Para ejecutarlo contra el proyecto real debe existir una sesion o credencial de
administracion valida en el entorno local. No subir service accounts, llaves
privadas ni archivos `.env` al repositorio.

`calendarId` es un dato operativo institucional. Los docentes no necesitan
verlo ni recibirlo en el cliente. Desde la Fase 17E.1, el catalogo, detalle y
ruta de reserva usan callables sanitizadas para evitar que clientes docentes
reciban campos operativos que no requieren para navegar el catalogo.

Los responsables de laboratorio se asignaran posteriormente mediante el modulo
de administracion. Por ahora `responsibleUids`, `responsibleEmails` y
`defaultNotifyEmails` quedan como arreglos vacios.

## Calendario visual interno

La disponibilidad visual por laboratorio usa FullCalendar Angular dentro del
frontend.

La vista visual usa Firestore como fuente interna a traves de la callable
sanitizada `getLabAvailability`:

- `reservations` con estatus bloqueantes.
- `blockedPeriods` activos.
- `labs/{labId}.weeklySchedule`.
- reglas especiales saneadas como bloques `No disponible`.

Los estatus de reserva que se muestran como ocupados son:

```text
PENDIENTE_VALIDACION
CONFIRMADA
CONFIRMADA_TRAS_VALIDACION
ERROR_CALENDAR
```

Los estatus rechazados o cancelados no se muestran como ocupados.

La vista docente no muestra datos sensibles de reservas. Los eventos se
presentan con textos genericos como `Ocupado`, `Pendiente de validacion` o
`No disponible`, sin nombre del docente, correo, objetivo, protocolo ni detalles
academicos.

En movil el calendario prioriza vistas `listWeek` y `timeGridDay`. En
escritorio usa `timeGridWeek` y `dayGridMonth`.

Google Calendar API se consulta desde Cloud Functions para validar conflictos
externos y crear eventos confirmados. La Web App no consulta Calendar API
directamente ni muestra `calendarId` al docente.

## Formulario de reserva

La ruta `/reservar/:labSlug` muestra un formulario mobile-first por pasos para
crear solicitudes de reserva mediante Cloud Functions.

El laboratorio se carga desde el `slug` de la ruta QR y se muestra como dato de
solo lectura. En esta fase no se permite cambiarlo desde el formulario.

Pasos actuales:

- Fecha y horario.
- Datos academicos.
- Material y tipo de practica.
- Condiciones de seguridad y protocolo.
- Resumen.

El formulario usa Reactive Forms y Angular Material. Las validaciones frontend
son solo de apoyo para la experiencia de usuario:

- Fecha requerida.
- Hora de finalizacion mayor que hora de inicio.
- Fecha no anterior a hoy.
- Advertencia por horas minimas de anticipacion.
- Advertencia de protocolo cuando la practica incluye material riesgoso o
  pacientes, usuarios simulados o poblacion externa.

Estas validaciones no sustituyen las validaciones criticas del backend. La
creacion real de reservas, deteccion definitiva de traslapes, validacion de
horarios institucionales y transiciones de estatus se ejecutan en Cloud
Functions.

El control de protocolo sube archivos a Cloud Storage cuando la solicitud lo
requiere. El frontend envia a `createReservation` solo metadata operativa del
archivo; no genera enlaces publicos ni adjunta archivos a correos.

El boton final invoca `createReservation`. Angular no escribe documentos en
`reservations` directamente.

## createReservation

La Cloud Function callable `createReservation` ya crea reservas reales en
Firestore usando Firebase Admin SDK. El frontend no escribe directamente en
`reservations`; solo invoca la callable.

Validaciones backend internas implementadas:

- Usuario autenticado.
- Perfil `users/{uid}` existente y activo.
- Rol oficial permitido.
- Correo institucional `@tecplayacar.edu.mx`.
- Laboratorio existente y activo.
- Fechas y horas validas.
- Hora final mayor que hora inicial.
- Fecha no anterior a hoy.
- Horario semanal del laboratorio.
- Horas minimas de anticipacion.
- Reglas especiales activas.
- Traslapes internos contra reservas en Firestore.
- Protocolo requerido cuando `risky === true || externalParticipants === true`.
- Propiedad de archivos de protocolo si se reciben metadatos.

Estados iniciales:

- Practica sin riesgo, sin participantes externos y sin conflicto:
  `CONFIRMADA`.
- Practica con material riesgoso o pacientes/usuarios simulados/poblacion
  externa: `PENDIENTE_VALIDACION`.
- Traslape: `RECHAZADA_CONFLICTO`.
- Regla horaria: `RECHAZADA_REGLA_HORARIO`.
- Anticipacion minima: `RECHAZADA_MIN_ANTICIPACION`.

Google Calendar API queda integrado en codigo para validar eventos externos y
crear eventos cuando una reserva no riesgosa queda confirmada. Para ejecutarlo
en el proyecto real se deben configurar los secretos de Google Workspace antes
del deploy.

Gmail API ya envia notificaciones reales con la cuenta operativa de Google
Workspace. Cada notificacion queda registrada en Firestore y un error de correo
no modifica el estatus de la reserva.

Cada reserva creada genera bitacoras en `reservationLogs`, incluyendo `CREATED`
y la accion correspondiente: `AUTO_CONFIRMED`, `CALENDAR_EVENT_CREATED`,
`PENDING_APPROVAL`, `CALENDAR_ERROR` o `STATUS_CHANGED` para rechazos
automaticos.

El folio usa el formato `RES-YYYYMMDD-XXXX`, con sufijo corto aleatorio seguro
en lugar de numeracion secuencial. La numeracion institucional secuencial puede
agregarse despues si se requiere un contador transaccional.

## Integracion Google Calendar API

La integracion con Google Calendar se ejecuta desde Cloud Functions. Firestore
sigue siendo la fuente de verdad interna; Google Calendar se usa como fuente
externa de disponibilidad y como calendario institucional sincronizado.

Cuenta operativa:

```text
escenarios.tup@tecplayacar.edu.mx
```

Los calendarios configurados en `labs/{labId}.calendarId` deben estar
compartidos con esa cuenta con permiso de escritura.

La autenticacion recomendada usa una cuenta de servicio con delegacion de
dominio de Google Workspace, autorizada para actuar como la cuenta operativa.
No se deben subir llaves JSON al repositorio.

Secrets requeridos:

```text
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON
GOOGLE_WORKSPACE_SUBJECT_EMAIL
```

`GOOGLE_WORKSPACE_SUBJECT_EMAIL` debe contener:

```text
escenarios.tup@tecplayacar.edu.mx
```

Scope usado en esta fase:

```text
https://www.googleapis.com/auth/calendar
```

Comandos para configurar secrets:

```bash
firebase functions:secrets:set GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON --project reservas-laboratorios-tup
firebase functions:secrets:set GOOGLE_WORKSPACE_SUBJECT_EMAIL --project reservas-laboratorios-tup
```

Comportamiento implementado:

- `createReservation` valida primero reglas internas y traslapes Firestore.
- Despues consulta Google Calendar para detectar eventos existentes del
  laboratorio que traslapen el horario solicitado.
- Los eventos cancelados se ignoran.
- Los eventos de dia completo se tratan como ocupados cuando traslapan.
- Si Google Calendar tiene un evento ocupado, la reserva queda como
  `RECHAZADA_CONFLICTO` y no se crea evento nuevo.
- Si la reserva no tiene material riesgoso ni participantes externos y no hay
  conflicto, se crea un evento en Google Calendar y se guarda
  `calendarEventId`.
- Al crear el evento confirmado, Google Calendar agrega como invitado al
  docente solicitante usando `teacherEmail` y `teacherName`, y se solicita a
  Calendar enviar actualizaciones a los asistentes.
- Si la reserva tiene material riesgoso o pacientes/usuarios simulados/poblacion
  externa, queda `PENDIENTE_VALIDACION` y no se crea evento hasta que sea
  aprobada mediante `approveReservation`.
- Si falla la validacion o creacion del evento de Calendar, la reserva queda
  como `ERROR_CALENDAR`, se registra `CALENDAR_ERROR` en bitacora y se genera
  una notificacion pendiente tipo `CALENDAR_ERROR`.

El evento de Calendar incluye folio, laboratorio, docente, correo, asignatura,
grupo, practica, objetivo, material requerido, tipo de practica, especificacion
de `Otro` si aplica, material riesgoso, pacientes/usuarios/poblacion externa,
protocolo requerido, protocolo adjunto, nombres de archivos si aplica y aviso
de que fue generado por el Sistema Web de Reservas. No incluye enlaces publicos
a Storage.

El docente tambien queda como asistente del evento de Calendar. Esta invitacion
no sustituye los correos institucionales enviados por Gmail API; ambos canales
son intencionales. En cancelaciones con `calendarEventId`, la eliminacion del
evento usa actualizaciones de Calendar para notificar al asistente cuando el
proveedor lo permita.

Gmail API se integra en la seccion siguiente para procesar las notificaciones
generadas por las reservas.

La integracion usa un ID determinista por `reservationId`, propiedades privadas
de Calendar y reconciliacion posterior a respuestas ambiguas. Un reintento de
la misma reserva reutiliza el evento existente y no crea un duplicado.

## Gmail API y notificaciones reales

El envio real de correos institucionales usa Google Workspace mediante Gmail
API. La cuenta remitente oficial es:

```text
escenarios.tup@tecplayacar.edu.mx
```

No se usan proveedores externos como SendGrid, Mailgun, Resend u otros.

La autenticacion reutiliza la cuenta de servicio con delegacion de dominio de
Google Workspace. Los secrets usados por Functions son:

```text
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON
GOOGLE_WORKSPACE_SUBJECT_EMAIL
```

Scope requerido para Gmail en esta fase:

```text
https://www.googleapis.com/auth/gmail.send
```

`createReservation` crea documentos en `notifications` con `provider:
gmail_api` y `status: PENDING`. Despues intenta enviar el correo de inmediato
con Gmail API. Si el envio es exitoso:

- `notifications.status` cambia a `SENT`.
- Se guarda `sentAt`.
- Se guarda `providerMessageId`.
- Se crea bitacora `reservationLogs.action = EMAIL_SENT`.

Si el envio falla:

- `notifications.status` cambia a `FAILED`.
- Se guarda el error seguro en `notifications.error`.
- Se crea bitacora `reservationLogs.action = EMAIL_ERROR`.
- La reserva conserva su estatus original.

Un error de correo no cambia `CONFIRMADA`, `PENDIENTE_VALIDACION`,
`RECHAZADA_CONFLICTO`, `ERROR_CALENDAR` ni libera horarios bloqueantes.

### Plantilla HTML institucional de correos

Los correos de reserva se generan con una plantilla HTML institucional y
fallback de texto plano. La estructura visual oficial incluye:

- contenedor centrado con fondo claro;
- encabezado blanco con logotipo del Tecnologico Universitario Playacar como
  imagen inline `cid:tup-logo`;
- franja institucional en `#271e5d` con acento `#252a86`;
- titulo del correo segun tipo de notificacion;
- saludo e introduccion contextual;
- panel de estatus actual con folio destacado;
- tabla con folio, laboratorio, fecha, horario, docente, asignatura, grupo,
  tipo de practica, condiciones de seguridad y protocolo;
- nota de seguridad;
- pie institucional.

Paleta usada:

- `#888887`
- `#252a86`
- `#271e5d`
- `#ffffff`

Asuntos institucionales por tipo:

- `RESERVATION_CONFIRMED`: `Reserva confirmada - {labName}`
- `RESERVATION_PENDING_APPROVAL`: `Reserva pendiente de validacion - {labName}`
- `RESERVATION_APPROVED`: `Reserva aprobada - {labName}`
- `RESERVATION_REJECTED`: `Reserva rechazada - {labName}`
- `CALENDAR_ERROR`: `Error de calendario - {folio}`
- `TECHNICAL_ERROR`: `Error tecnico en reserva - {folio}`
- `RESERVATION_CANCELLED`: `Reserva cancelada - {labName}`

El logotipo se envia como imagen inline dentro del MIME `multipart/related`.
El correo conserva `multipart/alternative` para incluir version HTML y fallback
`text/plain`. No se usan enlaces publicos para el logo, no se adjuntan
protocolos y no se generan URLs publicas de Cloud Storage.

Tambien existe la callable administrativa:

```text
sendPendingNotifications
```

Solo puede ejecutarla un usuario autenticado con perfil activo y rol
`admin_sistemas`. Procesa hasta 20 documentos `notifications` con `status:
PENDING` por ejecucion y actualiza cada documento como `SENT` o `FAILED`.

Los correos usan plantilla HTML institucional con fallback de texto plano. No se
adjuntan protocolos ni se generan enlaces publicos a Storage.

## Flujo de aprobacion de responsables

Las reservas riesgosas se crean con estatus `PENDIENTE_VALIDACION`. En esta
fase se habilita el flujo de revision para:

- usuarios con rol `responsable_laboratorio` asignados al laboratorio de la
  reserva mediante `users/{uid}.labsAssigned`;
- usuarios con rol `admin_sistemas`.

La aprobacion y el rechazo no escriben directamente en Firestore desde Angular.
El frontend invoca Cloud Functions callable:

```text
approveReservation
rejectReservation
```

`approveReservation` valida:

- usuario autenticado y perfil activo;
- rol permitido;
- asignacion al laboratorio cuando el rol es `responsable_laboratorio`;
- reserva existente con `status === PENDIENTE_VALIDACION`;
- laboratorio existente y activo;
- fecha no vencida;
- horario semanal y reglas especiales vigentes;
- ausencia de traslape interno en Firestore;
- ausencia de conflicto externo en Google Calendar;
- existencia de protocolo cuando era obligatorio.

Si la aprobacion es valida, crea el evento en Google Calendar, guarda
`calendarEventId`, cambia el estatus a `CONFIRMADA_TRAS_VALIDACION`, registra
bitacoras `APPROVED` y `CALENDAR_EVENT_CREATED`, crea notificacion
`RESERVATION_APPROVED` y envia correo real con Gmail API.

Si falla Google Calendar durante una aprobacion, la reserva queda con
`ERROR_CALENDAR`, se registra `CALENDAR_ERROR` y se genera notificacion tecnica.

`rejectReservation` valida permisos y exige motivo de rechazo. Si procede,
cambia el estatus a `RECHAZADA_POR_RESPONSABLE`, registra `REJECTED`, crea
notificacion `RESERVATION_REJECTED` y envia correo al docente.

Un error de correo durante aprobacion o rechazo no cambia el estatus final de
la reserva. El fallo queda en `notifications.status = FAILED` y en bitacora
`EMAIL_ERROR`.

El panel de responsable usa las rutas:

```text
/responsable/solicitudes
/responsable/historial
/responsable/reserva/:reservationId
```

La vista de solicitudes muestra solo reservas pendientes. Admin/Sistemas ve
todas; responsables solo ven las reservas de sus laboratorios asignados segun
las reglas de Firestore.

Los protocolos se listan en el detalle de la reserva y se abren mediante la
Cloud Function callable `getReservationProtocolAccess`. El frontend no solicita
`getDownloadURL` directo a Storage para responsables ni para la vista personal
de Mis reservas. La funcion valida usuario activo, rol, laboratorio asignado o
propiedad de la reserva, y que el `storagePath` solicitado pertenezca
exactamente a `reservations/{reservationId}.protocolFiles`. Si procede, devuelve
una URL firmada temporal de lectura. No se generan URLs publicas permanentes ni
se amplian reglas de Storage para lectura directa.

## Mis reservas

La ruta:

```text
/mis-reservas
```

muestra las reservas personales del usuario autenticado. La consulta filtra por:

```text
teacherUid === currentUser.uid
```

Incluso cuando el usuario tiene rol `responsable_laboratorio` o
`admin_sistemas`, esta vista muestra solo sus propias reservas como docente o
solicitante institucional. La revision global o por laboratorio se mantiene en
el modulo de Responsable.

La ruta:

```text
/mis-reservas/:reservationId
```

muestra el detalle personal de una reserva si pertenece al usuario autenticado.
Incluye folio, laboratorio, fecha, horario, estatus, datos academicos, tipo de
practica, condiciones de seguridad, protocolo requerido/adunto, estatus de
sincronizacion de Calendar y bitacora basica personal.

La bitacora basica del detalle no lee `reservationLogs` directamente desde
Angular. Usa la Cloud Function callable `getMyReservationLogs`, que valida
sesion, perfil activo, reserva existente y propiedad:

```text
reservation.teacherUid === currentUser.uid
```

`admin_sistemas` y `responsable_laboratorio` no ven reservas ajenas desde esta
callable; si son propietarios de la reserva, pueden ver su bitacora personal.
La revision global se mantiene en el modulo Responsable.

La callable traduce acciones tecnicas de `reservationLogs` a textos
comprensibles para el usuario final. Por ejemplo:

- `CREATED` se muestra como `Solicitud registrada`.
- `STATUS_CHANGED` se muestra como el estatus legible de la reserva.
- `EMAIL_SENT` se muestra como `Notificacion enviada`.
- `CALENDAR_EVENT_CREATED` se muestra como `Agendada en calendario`.
- `CALENDAR_ERROR` se muestra como `Error de calendario`.

Si el log incluye `note`, se muestra como detalle contextual. Si no existe nota,
la interfaz usa una descripcion predeterminada clara. La linea de tiempo usa
colores por severidad para distinguir eventos exitosos, pendientes, errores,
informativos o neutrales.

La respuesta saneada no devuelve metadata cruda, `calendarId`, `storagePath`,
URLs firmadas, protocolos, UIDs, correos de actores, providerMessageId, secretos
ni stack traces. No se abren reglas Firestore para lectura directa de
`reservationLogs` a docentes.

El detalle de protocolo usa `getReservationProtocolAccess` para solicitar acceso
temporal al archivo privado. El docente propietario puede abrir su propio
protocolo, pero Angular no usa `getDownloadURL` directo desde esta vista. No se
generan enlaces publicos permanentes, no se muestra `storagePath`, no se muestra
`calendarId` y no se permite aprobar, rechazar ni modificar reservas desde esta
vista. La cancelacion controlada solo se permite para reservas futuras con
estatus cancelable y siempre pasa por Cloud Functions.

Actualizacion 17C.1A:

- La UI normaliza errores de protocolo y no debe mostrar codigos tecnicos como
  `INTERNAL`.
- `getReservationProtocolAccess` captura errores de firmado y devuelve un
  mensaje seguro.
- Para generar URLs firmadas, el service account de Functions debe tener permiso
  `iam.serviceAccounts.signBlob`. En QA real se identifico el runtime:
  `261669564296-compute@developer.gserviceaccount.com`.
  Si falta ese permiso, Sistemas debe otorgarlo antes del smoke final.
- El calendario visual muestra el horario real de reservas y bloqueos,
  incluyendo minutos, por ejemplo `12:00 - 13:30`, sin redondear la etiqueta a
  la siguiente hora.

Actualizacion 17C.1B:

- La vista semanal del calendario posiciona y mide bloques por minutos reales
  sobre el eje vertical del dia.
- `top` se calcula con los minutos transcurridos desde la primera hora visible
  y `height` con la duracion real entre `startAt` y `endAt`.
- Una reserva `12:00 - 13:30` ocupa visualmente 1.5 horas; una reserva
  `12:30 - 13:30` inicia a media hora y ocupa 1 hora; una reserva
  `08:00 - 08:30` ocupa media hora.
- La etiqueta visible y el dialogo usan el horario real. No se modifican
  reservas, validaciones backend, Google Calendar API ni Gmail API.

### Cancelacion controlada

La ruta `/mis-reservas/:reservationId` muestra el boton `Cancelar reserva`
cuando la reserva personal es futura y tiene estatus:

- `PENDIENTE_VALIDACION`
- `CONFIRMADA`
- `CONFIRMADA_TRAS_VALIDACION`

La cancelacion no escribe directo desde Angular. El frontend abre un dialogo de
confirmacion y llama a la Cloud Function callable:

```text
cancelReservation
```

Validaciones backend:

- usuario autenticado;
- perfil activo;
- docente propietario, responsable asignado o `admin_sistemas`;
- reserva futura;
- estatus cancelable;
- `ERROR_CALENDAR` solo puede ser cancelado por responsable asignado o
  `admin_sistemas`.

Si la reserva tiene `calendarEventId`, la funcion elimina el evento de Google
Calendar antes de cambiar el estatus en Firestore. Si Calendar falla, la
cancelacion no se completa, se registra `CALENDAR_ERROR` y se devuelve un error
controlado para Admin/Sistemas. Si Google Calendar responde `404 Not Found` o
`410 Gone`, la funcion lo trata como evento ya eliminado y continua la
cancelacion, porque el horario externo ya no esta ocupado por ese evento.

Cuando procede, la reserva cambia a `CANCELADA`, se guardan `cancelledBy`,
`cancelledAt` y `cancellationReason` si existe, se registra bitacora
`CANCELLED` y, si aplicaba, `CALENDAR_EVENT_CANCELLED`. Tambien se crea una
notificacion `RESERVATION_CANCELLED` y se intenta enviar por Gmail API. Un error
de correo no revierte la cancelacion.

## Carga de protocolos

La carga real de protocolos usa Cloud Storage for Firebase desde el frontend,
con Firebase SDK modular.

Ruta usada:

```text
protocolUploads/{uid}/{uploadId}/{fileName}
```

Tipos permitidos inicialmente:

```text
application/pdf
image/png
image/jpeg
application/msword
application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

Tamano maximo:

```text
20 MB
```

Los archivos no son publicos y no se generan `downloadUrl` publicas. El
frontend envia a `createReservation` solo metadata operativa:

- `storagePath`
- `fileName`
- `contentType`
- `sizeBytes`
- `uploadedByUid`
- `uploadedAt`

`createReservation` valida que el archivo pertenezca al usuario autenticado,
que la ruta este dentro de `protocolUploads/{uid}/`, que el tipo sea permitido
y que el tamano no exceda 20 MB.

Si la carga del archivo ocurre pero `createReservation` falla, se cancela el
envio o se cierra el navegador, el archivo puede quedar huerfano
temporalmente.

## Limpieza segura de protocolos huerfanos

La Fase 17I agrega una limpieza backend segura para archivos bajo:

```text
protocolUploads/{uid}/{uploadId}/{fileName}
```

Un archivo se considera huerfano solo si:

- esta bajo `protocolUploads/`;
- no aparece referenciado en ningun
  `reservations/{reservationId}.protocolFiles[].storagePath`;
- supera el umbral minimo de antiguedad.

Reglas de seguridad:

- nunca se borran protocolos referenciados por reservas, aunque la reserva este
  cancelada, rechazada o sea historica;
- no se borran documentos de `reservations`, `reservationLogs`,
  `notifications` ni `auditEvents`;
- no se generan URLs publicas ni URLs firmadas;
- no se escanean ni borran `labImages/`, logos, QR u otros folders.

Callable administrativa:

```text
adminCleanupOrphanProtocolUploads
```

Solo `admin_sistemas` puede ejecutarla. `dryRun` es `true` por defecto para
previsualizar candidatos sin borrar. El umbral predeterminado es `72` horas.
Si `dryRun === false`, no se permite limpieza destructiva con menos de `24`
horas. `maxDelete` tiene limite absoluto de `200` archivos por ejecucion.

Funcion programada:

```text
scheduledCleanupOrphanProtocolUploads
```

Se ejecuta diariamente con `minAgeHours = 72` y `maxDelete = 100`. Registra un
resumen seguro en Cloud Logging y continua con los demas archivos si alguno
falla.

Para que funcione en el proyecto real deben estar desplegadas las reglas de
Storage actualizadas:

```bash
npx firebase deploy --only storage --project reservas-laboratorios-tup
```

## Prueba de createReservation

Al revisar el proyecto real con:

```bash
npx firebase functions:list --project reservas-laboratorios-tup
```

si aparece `No functions found`, primero se debe desplegar la callable:

```bash
npx firebase deploy --only functions:createReservation --project reservas-laboratorios-tup
```

Para probar desde Angular local:

```bash
npm --prefix apps/web start
```

Entrar con cuenta institucional activa y abrir:

```text
http://localhost:4200/reservar/{labSlug}
```

Casos esperados:

- Reserva no riesgosa: crea `reservations` con `CONFIRMADA`,
  guarda `calendarEventId`, documentos en `reservationLogs` y una notificacion
  `PENDING`.
- Reserva riesgosa con protocolo: sube el archivo a Storage, crea
  `reservations` con `PENDIENTE_VALIDACION`, vincula `protocolFiles`, crea logs
  y notificacion `PENDING`.
- Reserva riesgosa sin protocolo: se bloquea en frontend; si llegara al
  backend, `createReservation` tambien debe rechazarla.
- Traslape interno: crea reserva rechazada con `RECHAZADA_CONFLICTO`.

La verificacion manual se realiza en Firebase Console:

- Firestore Database > `reservations`
- Firestore Database > `reservationLogs`
- Firestore Database > `notifications`
- Storage > `protocolUploads/{uid}/...`

Google Calendar API y Gmail API requieren secrets configurados en Firebase
Functions Secret Manager para operar en el proyecto real.

## Rediseño visual y componentizacion

La documentacion completa del rediseño visual institucional esta en:

```text
docs/13_VISUAL_REDESIGN_REPORT.md
```

El rediseño se implemento por fases:

- Fase 1: estilos globales reutilizables en `apps/web/src/styles.scss`.
- Fase 2: componentes visuales simples en `apps/web/src/app/shared/components`.
- Fase 3: componentes presentacionales para Responsable y Revision de reserva.
- Fase 4A: componente visual `AvailabilityCalendarComponent`.
- Fase 4B: componente visual `ReservationStepperFormComponent`.
- Fase 4C: seleccion de calendario conectada al formulario sin cambiar payload.
- Ajustes finales: calendario con bloques agrupados y cards ejecutivas del catalogo de laboratorios.
- Ajuste de consistencia visual: catalogo, detalle de laboratorio y reserva por
  laboratorio usan encabezados reutilizables, iconografia Material mediante
  `AppIconBoxComponent`, acciones con icono y etiquetas accesibles.
- Ajuste de login: logo real de Google, restauracion de sesion Firebase Auth y
  recomendacion de uso local con `localhost`.

La capa visual usa:

- Angular Standalone Components.
- Angular Material para comportamiento, accesibilidad y componentes base.
- Tailwind CSS y clases globales para layout, spacing, color y responsive.
- Material Icons.
- Tipografia Inter con fallback system-ui.
- Paleta institucional moderna basada en morado profundo, superficies blancas, fondo claro, bordes suaves y chips por estado.

Regla para nuevos modulos:

Todo modulo nuevo debe seguir la misma linea visual documentada en
`docs/13_VISUAL_REDESIGN_REPORT.md`. Antes de crear una pantalla nueva se deben
reutilizar, cuando aplique, las clases globales de `apps/web/src/styles.scss` y
los componentes standalone visuales existentes.

Lineamientos obligatorios:

- usar la fuente global `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
- mantener Angular Material para comportamiento y accesibilidad;
- usar Tailwind CSS y clases globales para layout, espaciado, color y responsive;
- usar Material Icons completos y centrados mediante `mat-icon`;
- mantener cards blancas con bordes suaves, `rounded-2xl` y sombra ligera;
- mantener botones primarios institucionales y secundarios tipo link u outline;
- usar chips compactos por estado;
- evitar fuentes serif, estilos nativos del navegador o paletas alternas;
- mantener textos visibles en espanol;
- no mostrar datos operativos sensibles como `calendarId` donde no corresponda.

El ajuste tipografico global reciente refuerza que Angular Material, overlays,
cards, filtros, botones, formularios, dialogs, menus, selects, tabs y snackbars
hereden `--app-font-family`. Los iconos quedan excluidos para conservar
`Material Icons Round`.

No se cambiaron rutas funcionales, roles, modelos de datos, Cloud Functions,
reglas de negocio, permisos ni estructura del payload de reserva durante el
rediseño visual.

## Tipo de practica, protocolo y plantillas institucionales

El formulario de reserva usa esta lista oficial de tipos de practica:

- Teórica
- Simulación
- Taller
- Evaluación práctica
- Investigación
- Otro

Si se selecciona `Otro`, se muestra el campo `practiceTypeOther` con la etiqueta
"Especifique el tipo de práctica". Ese campo es obligatorio solo para `Otro` y
tiene limite de 120 caracteres.

El checkbox anterior de participantes externos fue eliminado. Ahora el paso
"Condiciones de seguridad y protocolo" muestra dos preguntas Si/No:

- ¿Se utilizarán sustancias, muestras biológicas o material potencialmente
  riesgoso? (`risky`)
- ¿Participan pacientes, usuarios simulados o población externa?
  (`externalParticipants`)

La regla de protocolo obligatorio es:

```ts
protocolRequired = risky === true || externalParticipants === true;
```

Si cualquiera de las dos preguntas es Si, el formulario exige protocolo, sube el
archivo a Cloud Storage y envia metadata a `createReservation`. Si ambas son
No, el protocolo no se exige y el control de carga se oculta.

Si cualquiera de las dos preguntas es Si, `createReservation` crea la reserva
con estatus `PENDIENTE_VALIDACION`. El responsable del laboratorio asignado o
un usuario `admin_sistemas` debe revisar el protocolo y aprobar o rechazar la
solicitud. La reserva no crea evento en Google Calendar hasta su aprobacion.

`createReservation` y `approveReservation` validan esta misma regla en backend.
Angular sigue sin escribir reservas directamente en Firestore.

La descripcion de eventos en Google Calendar incluye folio, docente,
laboratorio, asignatura, grupo, tipo de practica, especificacion de `Otro`,
material riesgoso, pacientes/usuarios/poblacion externa, protocolo requerido,
protocolo adjunto, nombres de archivos, material requerido, practica y objetivo.
No incluye enlaces publicos a Storage.

Los correos Gmail usan plantilla HTML institucional con fallback de texto plano.
No se adjuntan protocolos ni se generan enlaces publicos; cuando hay protocolo,
el correo indica que debe revisarse desde el sistema.

## Panel Admin/Sistemas Fase 16A

La base operativa del Panel Admin/Sistemas incluye:

- `/admin`: entrada administrativa protegida que muestra el modulo inicial de
  Laboratorios admin.
- `/admin/usuarios`: gestion inicial de usuarios, roles oficiales,
  activacion/desactivacion y asignacion de laboratorios a responsables.
- `/admin/laboratorios`: lectura operativa de laboratorios sin edicion completa.
- `/admin/bitacora`: lectura basica de `auditEvents`.

Todas las rutas `/admin/*` usan los guards existentes de autenticacion, perfil
activo y rol `admin_sistemas`.

La gestion de usuarios no escribe roles directamente desde Angular. El frontend
invoca la Cloud Function callable:

```text
adminUpdateUser
```

`adminUpdateUser` valida usuario autenticado, perfil activo del actor, rol
`admin_sistemas`, usuario objetivo existente, roles oficiales, laboratorios
existentes en `labs`, bloqueo de autodesactivacion/autodegradacion y campos
permitidos estrictamente.

Cada actualizacion crea un evento en `auditEvents` con action
`ADMIN_UPDATE_USER`. La metadata registrada es operativa y no contiene secretos.

En esta fase los laboratorios son solo lectura: nombre, slug, estado, visibilidad
en catalogo, anticipacion minima y responsables. No se muestra `calendarId` en
la vista administrativa base para evitar exposicion innecesaria. La edicion
completa de laboratorios, reglas y reportes avanzados queda para fases
posteriores.

### Estabilizacion visual de carga admin

Se corrigio el comportamiento donde algunas vistas nuevas de Fase 16A podian
quedarse en `Cargando...` hasta que el usuario hiciera clic otra vez en la
misma ruta.

Vistas estabilizadas:

- `/admin`
- `/admin/usuarios`
- `/admin/laboratorios`
- `/admin/bitacora`

El ajuste solo sincroniza el estado visual despues de cargas asincronicas con
Firebase SDK modular. No cambia rutas, guards, servicios, permisos, Cloud
Functions ni reglas de negocio.
## Autoalta docente y prealta administrativa

Los docentes con correo `tup-dNUMEROS@tecplayacar.edu.mx` se dan de alta
automaticamente desde backend mediante `ensureUserProfile`.

La regex usada es:

```text
^tup-d\d+@tecplayacar\.edu\.mx$
```

El perfil creado queda como `role: docente`, `active: true` y
`labsAssigned: []`.

Responsables/coordinadores se preautorizan desde `/admin/usuarios` mediante
`adminPreauthorizeUser`; no se crean contrasenas. La prealta se guarda en
`preauthorizedUsers/{email}` y se reclama cuando la persona inicia sesion con
Google por primera vez.

Las prealtas que todavia no han sido reclamadas pueden revocarse desde
`/admin/usuarios` mediante `adminRevokePreauthorizedUser`. La revocacion es
logica: el documento permanece en `preauthorizedUsers`, queda `active: false`
y registra `revokedBy`, `revokedAt` y `revocationReason` cuando se capture
motivo. `ensureUserProfile` ignora prealtas inactivas o revocadas. La auditoria
sanitiza metadata incompleta para evitar errores tecnicos `internal`.

Los usuarios ya existentes en `users/{uid}` no se eliminan fisicamente. Para
impedir acceso se usa suspension del perfil con `active: false` desde
`adminUpdateUser`, conservando reservas, bitacoras, notificaciones y auditoria.

Angular no crea perfiles ni escribe `role`, `active` o `labsAssigned`
directamente en Firestore.

## Panel Admin/Sistemas Fase 16B: gestion de laboratorios

La ruta `/admin/laboratorios` permite a `admin_sistemas` crear y editar
laboratorios desde la Web App. La escritura critica no se hace con `updateDoc`
directo desde Angular; el frontend invoca Cloud Functions callable:

```text
adminCreateLab
adminUpdateLab
```

Campos administrables:

- nombre, slug, descripcion, descripcion breve, ubicacion e imagen URL;
- `active` y `visibleInCatalog`;
- `calendarId` operativo visible solo para Admin/Sistemas;
- `minNoticeHours`;
- campos de compatibilidad `requiresApprovalWhenRisky` y
  `requiresProtocolWhenRisky`;
- `weeklySchedule` base por dia;
- `responsibleUids`, `responsibleEmails` y `defaultNotifyEmails`.

Validaciones backend:

- actor autenticado, activo y con rol `admin_sistemas`;
- slug seguro y unico;
- `calendarId` no vacio;
- `minNoticeHours >= 0`;
- correos institucionales `@tecplayacar.edu.mx`;
- responsables existentes con rol `responsable_laboratorio` o
  `admin_sistemas`;
- `weeklySchedule` con dias permitidos, horas `HH:mm` y `end > start`;
- rechazo de campos arbitrarios fuera del contrato.

Cada creacion o actualizacion registra auditoria en `auditEvents` con acciones:

```text
ADMIN_CREATE_LAB
ADMIN_UPDATE_LAB
```

La fase no implementa editor avanzado de `specialRules`, `blockedPeriods`,
importacion masiva ni subida real de imagenes. Desde la Fase 17B.5, la
asignacion de responsables desde `/admin/laboratorios` sincroniza
automaticamente `users/{uid}.labsAssigned` para usuarios con rol
`responsable_laboratorio`.
## Ajuste visual del dialogo de laboratorios

El dialogo de alta/edicion de laboratorios se ajusto para pantallas de
escritorio y tablet:

- ancho responsive `min(1120px, calc(100vw - 32px))`;
- altura maxima basada en viewport;
- sin scroll horizontal en el formulario;
- tabs desplazables si el ancho disponible es reducido;
- iconos completos y centrados en encabezados, callouts y chips.

Este ajuste es solo visual. No modifica servicios, rutas, validaciones,
Cloud Functions ni reglas de seguridad.

## Panel Admin/Sistemas Fase 16C: reglas y bloqueos

La ruta `/admin/reglas` permite a `admin_sistemas` gestionar excepciones
operativas sin escribir reservas directamente desde Angular.

Cloud Functions disponibles:

```text
adminCreateSpecialRule
adminUpdateSpecialRule
adminCreateBlockedPeriod
adminUpdateBlockedPeriod
```

Alcance implementado:

- crear, editar, activar y desactivar `labs/{labId}.specialRules`;
- crear, editar, activar y desactivar documentos en `blockedPeriods`;
- registrar auditoria en `auditEvents`;
- validar bloqueos activos al crear reservas;
- revalidar bloqueos activos antes de aprobar reservas pendientes.

Los bloqueos extraordinarios no crean eventos en Google Calendar por si mismos.
Solo impiden que una reserva sea creada o aprobada dentro del rango bloqueado.
La sincronizacion con Google Calendar sigue ocurriendo cuando una reserva queda
confirmada o confirmada tras validacion.

No se hizo deploy ni commit en esta fase. Comando recomendado cuando se autorice:

```bash
npx firebase deploy --only functions --project reservas-laboratorios-tup
```

## Fase 16D: reserva con calendario amplio y formulario en dialogo

La ruta `/reservar/:labSlug` fue ajustada visualmente para dar prioridad al
calendario de disponibilidad. El formulario de solicitud ya no queda fijo al
lado del calendario; ahora se abre en un dialogo responsive mediante el boton
`Nueva solicitud`.

Comportamiento:

- el calendario conserva la seleccion de horario y la disponibilidad visual;
- si el usuario selecciona un horario, el formulario del dialogo se abre con
  fecha, hora inicial y hora final precargadas;
- si no hay seleccion, el formulario permite capturar fecha y horarios
  manualmente;
- el dialogo reutiliza el mismo `ReservationFormComponent` y
  `ReservationStepperFormComponent`;
- el formulario conserva Reactive Forms, validaciones, carga de protocolo,
  payload y llamada a `createReservation`;
- al crear una reserva correctamente, el dialogo se cierra y el calendario se
  refresca con el evento optimista cuando el estatus bloquea horario;
- si hay error de envio, el dialogo permanece abierto y conserva los datos
  capturados.

Mensajes visibles:

- `CONFIRMADA`: reserva confirmada y agregada al calendario institucional;
- `PENDIENTE_VALIDACION`: solicitud enviada y pendiente de revision;
- `RECHAZADA_*`: solicitud no confirmada, revisar motivo;
- `ERROR_CALENDAR`: solicitud requiere revision tecnica por calendario.

Este ajuste es solo de interfaz y experiencia de usuario. No modifica rutas,
roles, permisos, modelos, servicios, Cloud Functions, reglas de negocio,
Firestore Rules, Storage Rules, Google Calendar API, Gmail API ni estructura del
payload de reserva.

## Fase 16E: Mis reservas recientes e histórico

La ruta `/mis-reservas` ahora evita saturar el panel docente con solicitudes
antiguas sin eliminar documentos de Firestore.

Vista por defecto:

- `Recientes`: muestra reservas futuras, reservas de los ultimos 3 meses y
  reservas con estatus bloqueante o pendiente aunque sean anteriores.

Vistas disponibles:

- `Histórico`: muestra reservas anteriores a 3 meses que no tienen estatus
  bloqueante o pendiente.
- `Todas`: muestra todas las reservas personales sin corte temporal.

Estatus que permanecen visibles en `Recientes` aunque sean antiguos:

```text
PENDIENTE_VALIDACION
CONFIRMADA
CONFIRMADA_TRAS_VALIDACION
ERROR_CALENDAR
```

La fase no elimina reservas antiguas ni borra documentos relacionados. Se
conservan:

- `reservations`;
- `reservationLogs`;
- `notifications`;
- `auditEvents`.

El filtro es solo de interfaz en Angular. La consulta sigue restringida al
usuario autenticado mediante `teacherUid === currentUser.uid`; no se exponen
`calendarId`, rutas internas de Storage ni reservas de otros usuarios.

## Fase 17B.1: galeria privada de laboratorios

La administracion de laboratorios ahora permite preparar una galeria privada de
imagenes por laboratorio desde `/admin/laboratorios`.

Modelo:

- metadata en `labs/{labId}.gallery`;
- portada seleccionada con `labs/{labId}.coverImageId`;
- `imageUrl` se conserva solo como campo legado opcional;
- maximo 8 imagenes activas por laboratorio;
- imagenes JPG, PNG o WebP;
- tamano maximo 5 MB por imagen.

Ruta de Storage:

```text
labImages/{labId}/gallery/{imageId}/{fileName}
```

Seguridad:

- solo usuarios autenticados con perfil activo pueden leer imagenes;
- solo `admin_sistemas` puede subir o actualizar imagenes de galeria;
- no se guardan `downloadUrl` publicas en Firestore;
- no se borran archivos automaticamente en esta fase;
- la desactivacion de imagenes conserva trazabilidad.

El carrusel publico en catalogo/detalle queda diferido. Esta fase solo prepara
modelo, reglas de Storage, carga admin y validacion backend.

## Fase 17B.2: carrusel en detalle de laboratorio

La ruta `/laboratorios/:labId` muestra un carrusel visual responsive cuando el
laboratorio tiene imagenes activas en `labs/{labId}.gallery`.

Comportamiento:

- usa solo imagenes con `active: true`;
- coloca primero la imagen marcada en `coverImageId`;
- resuelve URLs temporales con Firebase Storage SDK desde `storagePath`;
- no guarda `downloadUrl` en Firestore;
- omite imagenes que no puedan cargarse por permisos o archivo inexistente;
- muestra fallback institucional si no hay imagenes activas o todas fallan;
- no muestra `storagePath` ni `calendarId` al usuario final;
- mantiene intactos el resumen lateral, el boton `Reservar este laboratorio`
  y el calendario `app-lab-calendar`.

El carrusel es solo de lectura y no modifica laboratorios, reservas, Calendar,
Gmail, roles ni estatus.

Actualizacion de accesibilidad del carrusel:

- si hay mas de una imagen, avanza automaticamente cada 5 segundos;
- se pausa al pasar el cursor sobre el carrusel;
- se pausa al enfocar controles con teclado;
- se pausa definitivamente cuando el usuario usa flechas o indicadores;
- respeta `prefers-reduced-motion: reduce` y desactiva el autoplay para evitar
  mareos en movil, lectores de pantalla o usuarios sensibles al movimiento.

## Fase 17B.3: QR personalizable por laboratorio

La administracion de laboratorios incluye una pestana `QR` en el dialogo de
alta y edicion de `/admin/laboratorios`.

El QR siempre apunta a la ruta publica:

```text
https://reservas-laboratorios-tup.web.app/reservar/{slug}
```

Admin/Sistemas puede configurar solamente presentacion visual del QR:

- titulo;
- subtitulo;
- etiqueta institucional;
- color primario;
- color secundario;
- color de fondo;
- logo institucional visible u oculto;
- estilo de marco: `classic`, `card` o `minimal`;
- tamano de impresion: `small`, `medium` o `large`.

El sistema permite copiar el enlace, descargar PNG, descargar SVG e imprimir el
QR desde el navegador. No se guardan archivos QR, imagenes base64 ni rutas de
QR en Firestore o Storage; solo se guarda `labs/{labId}.qrConfig` como
configuracion visual.

Si se modifica el `slug`, cambia la URL de reserva y se deben reemplazar los QR
impresos previamente.

### Fase 17B.3A: logo institucional real en UI y QR

La Web App usa el logotipo institucional real ubicado en:

```text
/media/image/logo/logo_tup.png
```

El logo se usa como marca visual primaria en el header principal, pantalla de
login, previsualizacion de QR, descarga PNG de QR e impresion cuando
`showLogo === true`.

No se deben usar simulaciones textuales como `TUP` para representar el logo en
interfaces nuevas. Si el logo no carga, la UI puede mostrar un fallback tecnico
con icono institucional, pero no debe usar letras como marca principal.

El SVG de QR se mantiene como QR vectorial limpio sin incrustar logo para evitar
incompatibilidades con clientes o editores SVG. El PNG y la impresion si usan el
logo real cuando puede cargarse en el navegador.

No se guardan QR, logos en base64 ni imagenes generadas en Firestore o Storage.

## Fase 17B.4: Validacion real de calendarId

La administracion de laboratorios valida el `calendarId` contra Google Calendar
API antes de crear un laboratorio o cuando Admin/Sistemas cambia el calendario
de un laboratorio existente.

Comportamiento:

- se usa la misma cuenta operativa `escenarios.tup@tecplayacar.edu.mx`;
- se usan los secrets existentes `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON` y
  `GOOGLE_WORKSPACE_SUBJECT_EMAIL`;
- se consulta Google Calendar API sin crear eventos de prueba;
- el calendario debe existir y estar compartido con permisos de escritura para
  la cuenta operativa;
- la validacion acepta permisos `writer` u `owner`;
- si el calendario no existe, no tiene permisos suficientes o el ID no es
  valido, `adminCreateLab` y `adminUpdateLab` bloquean el guardado con un
  mensaje controlado.

La pestana `Calendario` del dialogo de alta/edicion incluye la accion
`Validar calendario`, que permite a Admin/Sistemas revisar el acceso antes de
guardar. Esta validacion no modifica reservas, no crea eventos en Google
Calendar, no usa Gmail API y no expone el `calendarId` a docentes.

## Fase 17B.5: sincronizacion automatica de responsables

La administracion de laboratorios sincroniza automaticamente
`labs/{labId}.responsibleUids` con `users/{uid}.labsAssigned` cuando se crea o
edita un laboratorio desde `/admin/laboratorios`.

Comportamiento:

- `adminCreateLab` agrega el `labId` a `labsAssigned` de cada usuario activo
  con rol `responsable_laboratorio` incluido en `responsibleUids`;
- `adminUpdateLab` compara responsables anteriores y nuevos para agregar o
  remover el `labId` de `labsAssigned`;
- los usuarios `admin_sistemas` pueden aparecer como responsables operativos,
  pero no dependen de `labsAssigned` porque tienen acceso global;
- usuarios inexistentes, docentes o inactivos se rechazan como responsables
  operativos;
- la sincronizacion ocurre en transaccion junto con el laboratorio y la
  auditoria administrativa;
- `Admin/Usuarios` sigue pudiendo editar `labsAssigned`, pero ya no es
  necesario hacerlo manualmente cuando la asignacion se realiza desde
  `Admin/Laboratorios`.

Esta fase no modifica reservas, eventos de Calendar, correos Gmail, roles,
estatus, galeria, QR ni reglas de seguridad.

## Fase 17B.6: resumen no redundante de reglas en Admin/Laboratorios

`/admin/laboratorios` muestra un resumen compacto de reglas especiales por
laboratorio sin duplicar el modulo `/admin/reglas`.

Comportamiento:

- cada card de laboratorio muestra solo el conteo de reglas especiales activas;
- si existen reglas inactivas, se muestra un chip secundario compacto;
- no se muestran razones, dias, horarios ni formularios de reglas en
  Laboratorios;
- la accion `Gestionar reglas` navega a `/admin/reglas?labId={labId}`;
- `/admin/reglas` preselecciona el laboratorio indicado cuando el parametro es
  valido;
- el dialogo de laboratorio muestra un callout breve en Disponibilidad con el
  resumen de reglas y acceso a Reglas;
- el boton `Guardar laboratorio` se deshabilita si no hay cambios reales;
- `adminUpdateLab` no se llama cuando el dialogo detecta que no hubo cambios;
- los cambios sensibles piden confirmacion antes de guardar:
  - slug;
  - calendarId;
  - desactivar laboratorio;
  - ocultar del catalogo;
  - responsables;
  - horario semanal;
  - reduccion de imagenes activas;
- los errores administrativos se traducen a mensajes legibles y no muestran
  stack traces ni JSON crudo.

Esta fase no modifica reservas, Calendar API, Gmail API, roles, estatus,
galeria, QR ni reglas Firestore/Storage. `/admin/reglas` permanece como fuente
oficial para crear y editar reglas especiales.

## Fase 17D.1: navegacion movil y acciones del catalogo

La Web App incorpora un menu hamburguesa para vista movil en el AppShell. En
celulares se oculta la navegacion horizontal para evitar saturacion y el menu
movil muestra solo las rutas permitidas segun el perfil confirmado del usuario:
Laboratorios, Mis reservas, Responsable cuando aplica y Cerrar sesion. Para
Admin/Sistemas, el acceso redundante `Panel Admin` fue retirado; se conservan
Usuarios, Laboratorios admin, Reglas y Bitacora.

La URL historica `/admin/dashboard` se conserva como redireccion tecnica hacia
`/admin` para evitar enlaces rotos, pero ya no carga una pantalla visual propia.

En tablet y escritorio se conserva la navegacion horizontal institucional.

El catalogo de laboratorios mantiene `Reservar` como accion primaria y muestra
`Ver detalle` como boton secundario real, con icono, borde, fondo suave y area
clickeable completa. Esta fase no modifica rutas, roles, permisos, servicios,
backend ni reglas de negocio.

## Fase 17C.2: bitacora basica para responsables asignados

El detalle de revision en `/responsable/reserva/:reservationId` consulta la
bitacora basica mediante la callable segura `getReservationReviewLogs`.

Comportamiento:

- `admin_sistemas` puede consultar la bitacora de cualquier reserva;
- `responsable_laboratorio` solo puede consultar bitacoras de reservas cuyo
  `labId` este incluido en `users/{uid}.labsAssigned`;
- `docente` no usa esta callable para revision;
- no se abre lectura directa amplia de `reservationLogs` en Firestore Rules;
- la callable devuelve eventos saneados con titulo, descripcion, severidad,
  fecha y etiqueta de actor segura;
- no se devuelven `calendarId`, `storagePath`, URLs firmadas, UIDs como dato
  principal, stack traces, secretos ni metadata cruda;
- no se registra un `auditEvent` por cada lectura para evitar ruido operativo;
- la UI reutiliza el componente `ReservationTimelineComponent`.

Esta fase no modifica creacion, aprobacion, rechazo, cancelacion, Google
Calendar API, Gmail API, roles, estatus ni reglas de seguridad.

### Correccion 17C.2A: visibilidad de bitacora para responsables

`getReservationReviewLogs` normaliza `users/{uid}.labsAssigned` antes de
validar permisos. Esto evita errores tecnicos si el arreglo no existe en un
perfil antiguo y mantiene la regla oficial: el responsable solo ve la bitacora
cuando `reservation.labId` coincide con un laboratorio asignado.

La funcion registra diagnostico seguro en Cloud Logging para diferenciar:

- reserva encontrada o no encontrada;
- `reservation.labId`;
- rol del actor;
- cantidad de laboratorios asignados;
- decision de acceso;
- cantidad de eventos devueltos.

No registra `calendarId`, rutas de Storage, URLs firmadas, correos, secretos ni
stack traces. La UI diferencia entre bitacora vacia, falta de permiso y error
tecnico.

## Correccion 17C.2B: bloqueo de doble envio en reservas con protocolo

Durante QA real se detecto que una solicitud con protocolo podia enviarse dos
veces con pocos segundos de diferencia. La primera reserva quedaba
`PENDIENTE_VALIDACION` y la segunda era rechazada correctamente como
`RECHAZADA_CONFLICTO` por traslaparse contra la primera.

El formulario de reserva ahora ignora cualquier segundo envio mientras
`submitting` esta activo. La UI conserva el estado `Enviando...` y el backend
mantiene intacta la validacion de conflictos.

No se borran reservas, logs ni notificaciones historicas. No se modifican
estatus, Calendar API, Gmail API ni reglas de seguridad.

## Correccion 17C.2C: disponibilidad sanitizada para vista docente

La disponibilidad visual de laboratorios ya no depende de lecturas directas de
`reservations` o `blockedPeriods` desde Angular. El calendario consulta la
callable `getLabAvailability`, que valida usuario autenticado con perfil activo
y devuelve solamente bloques sanitizados para el rango visible.

La respuesta incluye:

- rangos ocupados por reservas bloqueantes como `Ocupado`;
- solicitudes pendientes como `Pendiente de validacion`;
- bloqueos activos como `No disponible`.

La callable no devuelve datos privados de reserva como docente, correo,
asignatura, grupo, practica, objetivo, material, protocolo, rutas Storage,
`calendarId`, responsables ni metadata tecnica. No se modifican reglas de
Firestore/Storage, reservas existentes, Calendar API, Gmail API, roles ni
estatus.

## Fase 17E.1: catalogo y detalle de laboratorios sanitizados

Las vistas docentes `/laboratorios`, `/laboratorios/:labId` y
`/reservar/:labSlug` ya no leen documentos completos `labs/{labId}` desde
Angular. Ahora consumen las callables:

- `getPublicLabs`;
- `getPublicLabDetail`.

Ambas requieren sesion autenticada, perfil activo y rol oficial. Devuelven solo
el modelo `PublicLab`, suficiente para navegar, consultar disponibilidad y
crear solicitudes: `id`, `name`, `slug`, descripciones, ubicacion, estado
activo/visible, anticipacion minima, banderas de validacion/protocolo, horario
semanal, `qrPath`, `coverImageId` y galeria publica con URL temporal cuando se
puede firmar.

No se devuelven a vistas docentes:

- `calendarId` ni `calendarSharedWith`;
- `responsibleUids`, `responsibleEmails` ni `defaultNotifyEmails`;
- `specialRules` completas ni razones administrativas;
- `qrConfig` administrativa;
- `storagePath` de galeria;
- timestamps o metadata tecnica administrativa.

`getLabAvailability` conserva la consulta de disponibilidad y ahora tambien
expande reglas especiales como bloques saneados `No disponible`, sin enviar las
reglas completas al cliente. Admin/Sistemas mantiene lectura completa de
`labs/{labId}` desde `/admin/laboratorios`.

Las reglas de Firestore se endurecieron: solo `admin_sistemas` puede leer
directamente documentos completos de `labs`. Los usuarios no admin deben usar
las callables sanitizadas.

## Fase 17F.3: motivos destacados en Mis reservas

El detalle personal `/mis-reservas/:reservationId` muestra un bloque destacado
cuando la reserva esta rechazada, cancelada o requiere revision tecnica por
calendario.

Estatus cubiertos:

- `RECHAZADA_POR_RESPONSABLE`;
- `RECHAZADA_CONFLICTO`;
- `RECHAZADA_REGLA_HORARIO`;
- `RECHAZADA_MIN_ANTICIPACION`;
- `CANCELADA`;
- `ERROR_CALENDAR`.

El motivo se obtiene de campos propios saneados de la reserva, con esta
prioridad:

- rechazo por responsable: `rejectionReason`, `statusReason`, fallback claro;
- otros rechazos: `statusReason`, fallback claro segun el tipo de rechazo;
- cancelacion: `cancellationReason` o fallback neutro; nunca `statusReason`;
- error de calendario: `statusReason`, fallback de revision tecnica.

La bitacora basica se mantiene como linea de tiempo, pero el docente no depende
de ella para entender el motivo principal. La UI no muestra UIDs, `calendarId`,
`storagePath`, URLs firmadas, metadata tecnica, JSON crudo ni stack traces.

### Correccion Fase 18C.3: motivos de aprobacion y cancelacion

La nota opcional de aprobacion se conserva en la bitacora `APPROVED` y en la
notificacion de aprobacion. No se guarda en `reservations.statusReason`.

La cancelacion usa exclusivamente `cancellationReason` cuando el usuario
captura un motivo. Si se cancela sin motivo, el campo queda ausente y la vista
muestra `La reserva fue cancelada sin motivo especificado.`. Al aprobar o
cancelar, el backend elimina de forma explicita cualquier `statusReason`
heredado que pudiera confundir la presentacion posterior.

Los documentos historicos no se migran. La vista personal los presenta de
forma segura: una reserva `CANCELADA` nunca reutiliza `statusReason` como motivo
de cancelacion. `statusReason` se mantiene para rechazos automaticos y errores
tecnicos de calendario.

## Fase 17F.4: búsqueda y textos de Mis reservas

La vista `/mis-reservas` conserva una sola barra de búsqueda y reutiliza el
filtro existente. No se crean filtros ni pipelines paralelos.

La búsqueda ahora evalúa:

- folio;
- laboratorio;
- asignatura;
- nombre de práctica;
- grupo;
- tipo de práctica.

La comparación es insensible a mayúsculas/minúsculas, tolera acentos mediante
normalización y respeta los filtros existentes de estatus, revisión, fechas,
modo `Recientes` / `Histórico` / `Todas` y ordenamiento.

También se corrigieron textos visibles de Mis reservas y su detalle para usar
acentos y etiquetas más claras, sin cambiar nombres internos de estatus,
contratos de datos, backend, Calendar, Gmail ni reglas de seguridad.

## Fase 17F.4A: filtros de fecha en Mis reservas

La vista `/mis-reservas` mantiene los filtros existentes `Desde` y `Hasta`, pero
ahora usan Angular Material Datepicker en lugar de campos nativos de fecha. Al
hacer clic sobre el campo o el icono se abre un calendario real para seleccionar
la fecha.

El valor interno del filtro se conserva como `YYYY-MM-DD`, por lo que no cambia
el pipeline de filtrado, la búsqueda ampliada ni la forma en que se calculan las
reservas recientes, históricas o todas.

También se ajustó el layout del panel de filtros para que el botón `Limpiar`
quede alineado con los demás controles en escritorio y mantenga un ancho cómodo
en móvil.

Si la fecha `Desde` es posterior a `Hasta`, la interfaz muestra una advertencia:
`La fecha inicial no puede ser posterior a la fecha final.`

Este ajuste es visual/frontend. No modifica Functions, Calendar API, Gmail API,
reglas, roles, estatus, apertura de protocolos, bitácora ni datos de reservas.

## Fase 17H: cierre documental y QA post 17F/17G

La documentación de cierre deja alineado que `Mis reservas` conserva una vista
personal filtrada por `teacherUid === currentUser.uid`, con selector
`Recientes` / `Histórico` / `Todas`, búsqueda única por folio, laboratorio,
asignatura, práctica, grupo y tipo de práctica, normalización de acentos,
filtros de estatus, revisión, fechas y ordenamiento, y detalle personal seguro
sin `calendarId`, `storagePath`, URLs firmadas, UIDs ni metadata técnica.

También queda documentado que Google Calendar agrega al docente solicitante como
asistente cuando una reserva queda `CONFIRMADA` o
`CONFIRMADA_TRAS_VALIDACION`, usando `teacherEmail` y `teacherName`, y que las
cancelaciones con `calendarEventId` solicitan actualización al invitado mediante
Calendar. Gmail API se mantiene como canal institucional independiente.

No se marcan como resueltos los pendientes no bloqueantes: limpieza programada
de protocolos huérfanos, QA móvil autenticado real complementario y revisión
futura de textos Gmail si aplica.

## Fase 18A.3: reportes de uso de laboratorios

La ruta canónica `/reportes` ofrece a `admin_sistemas` y
`responsable_laboratorio` un tablero agregado de uso. `/admin/reportes` se
conserva como redirección técnica a `/reportes`. El menú muestra `Reportes`
solo para esos dos roles.

Los filtros permiten seleccionar año, rango de meses y laboratorio autorizado.
El backend callable `getLabUsageReport` cuenta exclusivamente reservas con
estatus `CONFIRMADA` o `CONFIRMADA_TRAS_VALIDACION`, calcula horas reservadas y
agrupa los resultados por mes y laboratorio usando `America/Cancun`.

Admin/Sistemas puede consultar todos los laboratorios. Un responsable solo
puede consultar los IDs presentes en `users/{uid}.labsAssigned`; solicitar un
laboratorio fuera de ese alcance devuelve `permission-denied`.

El dashboard usa Chart.js instalado como dependencia local y cargado de forma
lazy. Incluye indicadores, gráficas y tablas accesibles. La respuesta no incluye
docentes, correos, protocolos, `calendarId`, rutas de Storage ni metadata de
reservas. Esta fase es de solo lectura y no invoca Calendar API ni Gmail API.

## Idempotencia completa de Google Calendar

`createReservation` y `approveReservation` usan una operacion compartida que
asegura un unico evento por `reservationId`. El ID externo se deriva con SHA-256
de un namespace tecnico y se complementa con propiedades privadas
`reservationId`, `sourceSystem` e `idempotencyVersion`; no contiene datos
personales.

La operacion reutiliza `calendarEventId` heredados, busca el ID determinista,
reconcilia por propiedades privadas y maneja `409` o timeouts consultando el
evento antes de declarar un error. La cancelacion aplica la misma resolucion y
mantiene `sendUpdates: "all"`. No se agregaron colecciones ni campos
persistentes: Firestore conserva solamente `calendarEventId`.

Estado: **Fase 18B validada y cerrada**. La suite automatizada aprobó 18 de 18
escenarios y el smoke postdeploy confirmó que la idempotencia no genera eventos
duplicados, autoconflictos ni creaciones prematuras.

### Política institucional de disponibilidad externa

Google Calendar funciona como fuente operativa adicional de ocupación. Todo
evento existente y no cancelado que se traslape con una solicitud bloquea el
horario, incluso cuando Calendar lo marque como `Disponible` o use
`transparency = transparent`. Esta política conservadora es deliberada; una
distinción futura entre eventos informativos y bloqueantes requiere autorización
institucional y una fase específica.

El orden operativo es: validaciones internas; horario, anticipación, reglas y
bloqueos; conflictos Firestore; conflictos Google Calendar; y solo entonces
`ensureReservationEvent`, persistencia de `calendarEventId` y confirmación. Un
conflicto externo produce `RECHAZADA_CONFLICTO` y evita crear el evento.

El diagnóstico postdeploy verificó que `RES-20260721-AF00` fue rechazada por
horario sin consultar ni crear eventos Calendar. `RES-20260721-D96E` encontró un
evento externo real, confirmado manualmente, de 10:00 a 13:00; la solicitud de
11:00 a 13:30 tenía un traslape legítimo. No hubo duplicado, autoconflicto ni
evento huérfano generado por 18B.
