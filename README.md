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
- Usuarios con perfil activo pueden leer laboratorios activos.
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
verlo en la interfaz; el catalogo actual no lo muestra. Como pendiente de
seguridad fina queda crear una vista publica sanitizada o una lectura controlada
por backend para evitar que clientes docentes reciban campos operativos que no
requieren para navegar el catalogo.

Los responsables de laboratorio se asignaran posteriormente mediante el modulo
de administracion. Por ahora `responsibleUids`, `responsibleEmails` y
`defaultNotifyEmails` quedan como arreglos vacios.

## Calendario visual interno

La disponibilidad visual por laboratorio usa FullCalendar Angular dentro del
frontend.

La vista visual usa Firestore como fuente interna:

- `reservations` con estatus bloqueantes.
- `blockedPeriods` activos.
- `labs/{labId}.weeklySchedule`.
- `labs/{labId}.specialRules`.

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

Gmail API se integra en la seccion siguiente para procesar las notificaciones
generadas por las reservas.

Riesgo pendiente: esta fase todavia no implementa una clave idempotente para
evitar duplicados ante reintentos inesperados. Si el proceso crea un evento y
despues falla antes de guardar `calendarEventId`, Admin/Sistemas debera revisar
el calendario y Firestore. La idempotencia completa queda para una fase
posterior.

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

Los protocolos se listan en el detalle de la reserva y se intenta abrirlos con
Firebase Storage SDK. Actualmente las reglas de Storage permiten lectura al
docente propietario y a `admin_sistemas`; si un responsable no puede abrir el
archivo, el panel muestra un mensaje indicando que queda pendiente ajustar una
regla controlada de lectura para responsables sin exponer URLs publicas.

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
sincronizacion de Calendar y bitacora basica cuando las reglas permiten leerla.

La bitacora basica del detalle traduce acciones tecnicas de `reservationLogs` a
textos comprensibles para el usuario final. Por ejemplo:

- `CREATED` se muestra como `Solicitud registrada`.
- `STATUS_CHANGED` se muestra como el estatus legible de la reserva.
- `EMAIL_SENT` se muestra como `Notificacion enviada`.
- `CALENDAR_EVENT_CREATED` se muestra como `Agendada en calendario`.
- `CALENDAR_ERROR` se muestra como `Error de calendario`.

Si el log incluye `note`, se muestra como detalle contextual. Si no existe nota,
la interfaz usa una descripcion predeterminada clara. La linea de tiempo usa
colores por severidad para distinguir eventos exitosos, pendientes, errores,
informativos o neutrales.

El detalle de protocolo usa Firebase Storage SDK para solicitar acceso al
archivo privado. No se generan enlaces publicos, no se muestra `calendarId` y no
se permite aprobar, rechazar ni modificar reservas desde esta vista. La
cancelacion controlada solo se permite para reservas futuras con estatus
cancelable y siempre pasa por Cloud Functions.

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

Si la carga del archivo ocurre pero `createReservation` falla, el archivo puede
quedar huerfano temporalmente. La limpieza programada de archivos huerfanos
queda pendiente para una fase posterior.

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

- `/admin/dashboard`: resumen de usuarios, laboratorios, reservas pendientes,
  reservas `ERROR_CALENDAR` y notificaciones fallidas.
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

- `/admin/dashboard`
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
importacion masiva, subida real de imagenes ni sincronizacion automatica con
`users/{uid}.labsAssigned`. Si se asigna un responsable en el laboratorio,
Admin/Sistemas debe mantener `labsAssigned` desde `/admin/usuarios` para que
el responsable vea solicitudes.
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

## Fase 16E: Mis reservas recientes e historico

La ruta `/mis-reservas` ahora evita saturar el panel docente con solicitudes
antiguas sin eliminar documentos de Firestore.

Vista por defecto:

- `Recientes`: muestra reservas futuras, reservas de los ultimos 3 meses y
  reservas con estatus bloqueante o pendiente aunque sean anteriores.

Vistas disponibles:

- `Historico`: muestra reservas anteriores a 3 meses que no tienen estatus
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
- identificador TUP visible u oculto;
- estilo de marco: `classic`, `card` o `minimal`;
- tamano de impresion: `small`, `medium` o `large`.

El sistema permite copiar el enlace, descargar PNG, descargar SVG e imprimir el
QR desde el navegador. No se guardan archivos QR, imagenes base64 ni rutas de
QR en Firestore o Storage; solo se guarda `labs/{labId}.qrConfig` como
configuracion visual.

Si se modifica el `slug`, cambia la URL de reserva y se deben reemplazar los QR
impresos previamente.
