# Runbook de Operacion Productiva

## 1. Proposito y alcance

Este documento define la operacion de produccion del Sistema Web de Reservas
de Laboratorios. Cubre despliegue, monitoreo, incidentes, respaldo, recuperacion
y rollback. No sustituye los SDD ni autoriza cambios de infraestructura.

Estado de la auditoria: `2026-07-27`. Proyecto Firebase:
`reservas-laboratorios-tup`. Zona horaria operativa: `America/Cancun`.

## 2. Arquitectura operativa

- Angular standalone en Firebase Hosting.
- Firebase Authentication con Google institucional.
- Firestore como fuente de verdad.
- Cloud Storage privado para protocolos e imagenes.
- Cloud Functions v2 en `us-central1`, runtime Node.js 22.
- Google Calendar API para ocupacion y eventos institucionales.
- Gmail API para notificaciones institucionales.
- Cloud Scheduler para limpieza conservadora de protocolos huerfanos.

URL principal: `https://reservas-laboratorios-tup.web.app`.

La cuenta de Google Cloud administra varios proyectos y la configuracion global
de `gcloud` puede apuntar a otro proyecto. Toda consulta o mutacion operativa
debe incluir explicitamente `--project=reservas-laboratorios-tup`; los comandos
de Billing deben usar ademas `--billing-project=reservas-laboratorios-tup`.
Nunca confiar en el proyecto predeterminado de la CLI.

## 3. Responsables y cuentas operativas

- Propietario funcional: `victor.yama@tecplayacar.edu.mx`.
- Cuenta operativa Workspace: `escenarios.tup@tecplayacar.edu.mx`.
- Roles de aplicacion: `docente`, `responsable_laboratorio` y
  `admin_sistemas`.

Las credenciales, claves privadas y valores de secretos nunca deben copiarse a
este documento, tickets, logs o repositorio.

## 4. Inventario de Functions

La comparacion entre `functions/src/index.ts` y Firebase confirmo 25 exports
locales y 25 Functions desplegadas, todas `ACTIVE`, en `us-central1`, Node.js
22 y con la cuenta de ejecucion
`261669564296-compute@developer.gserviceaccount.com`.

| Function | Tipo | Proposito | Acceso | Secrets Workspace |
| --- | --- | --- | --- | --- |
| `adminCleanupOrphanProtocolUploads` | callable | Dry run o limpieza controlada de protocolos huerfanos | Admin | No |
| `adminCreateBlockedPeriod` | callable | Crear bloqueo extraordinario | Admin | No |
| `adminCreateLab` | callable | Crear laboratorio y validar configuracion | Admin | Si |
| `adminCreateSpecialRule` | callable | Crear regla especial | Admin | No |
| `adminPreauthorizeUser` | callable | Preautorizar responsable o admin | Admin | No |
| `adminRevokePreauthorizedUser` | callable | Revocar prealta no reclamada | Admin | No |
| `adminUpdateBlockedPeriod` | callable | Actualizar o desactivar bloqueo | Admin | No |
| `adminUpdateLab` | callable | Actualizar laboratorio | Admin | Si |
| `adminUpdateSpecialRule` | callable | Actualizar o desactivar regla | Admin | No |
| `adminUpdateUser` | callable | Actualizar perfil, rol o asignaciones | Admin | No |
| `adminValidateLabCalendar` | callable | Validar acceso al calendario del laboratorio | Admin | Si |
| `approveReservation` | callable | Aprobar solicitud pendiente | Responsable asignado o Admin | Si |
| `cancelReservation` | callable | Cancelar reserva autorizada | Propietario, responsable asignado o Admin | Si |
| `createReservation` | callable | Validar y crear reserva | Perfil activo | Si |
| `ensureUserProfile` | callable | Restaurar, crear o reclamar perfil permitido | Usuario institucional autenticado | No |
| `getLabAvailability` | callable | Consultar disponibilidad saneada | Perfil activo | No |
| `getLabUsageReport` | callable | Reporte agregado de uso | Responsable asignado o Admin | No |
| `getMyReservationLogs` | callable | Bitacora saneada de reserva propia | Propietario | No |
| `getPublicLabDetail` | callable | Detalle saneado de laboratorio | Perfil activo | No |
| `getPublicLabs` | callable | Catalogo saneado | Perfil activo | No |
| `getReservationProtocolAccess` | callable | URL temporal de protocolo autorizado | Propietario, responsable asignado o Admin | No |
| `getReservationReviewLogs` | callable | Bitacora para revision | Responsable asignado o Admin | No |
| `rejectReservation` | callable | Rechazar solicitud pendiente | Responsable asignado o Admin | Si |
| `scheduledCleanupOrphanProtocolUploads` | scheduler | Limpieza diaria conservadora | Invocacion administrada | No |
| `sendPendingNotifications` | callable | Reprocesar notificaciones pendientes | Admin | Si |

`Si` significa que la definicion desplegada referencia
`GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON` y
`GOOGLE_WORKSPACE_SUBJECT_EMAIL`; no implica que sus valores hayan sido
consultados durante la auditoria.

## 5. Secrets y delegacion Workspace

Secretos esperados:

- `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON`: versiones 1 y 2 habilitadas; las
  Functions actuales usan la version 2.
- `GOOGLE_WORKSPACE_SUBJECT_EMAIL`: version 1 habilitada.

Scopes autorizados esperados:

- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/gmail.send`

Resultado `VERIFIED_MANUAL`:

1. Delegacion de dominio activa para el client ID OAuth coincidente.
2. Scopes autorizados exactamente `calendar` y `gmail.send`, sin scopes
   adicionales.
3. Cuenta delegada confirmada:
   `escenarios.tup@tecplayacar.edu.mx`.
4. Calendar y Gmail verificados funcionalmente en QA real de la Fase 18C.

La auditoria no accedio al contenido de los secretos.

## 6. IAM de ejecucion

Cuenta de ejecucion observada:
`261669564296-compute@developer.gserviceaccount.com`.

Controles verificados:

- acceso a los secretos vinculados: `PASS`;
- firma de blobs para URLs temporales de protocolos: `PASS`;
- Firestore y Storage operativos mediante Admin SDK;
- job programado activo.

La cuenta conserva `roles/editor`. El propietario acepta este riesgo conocido
para el MVP y difiere el endurecimiento de menor privilegio a una actividad
posterior. No se redujeron roles en esta fase.

## 7. Hosting y rutas SPA

El Hosting sirve `apps/web/dist/web/browser` y reescribe `**` a `index.html`.
Durante la auditoria:

- `/` devolvio HTTP 200 y `text/html`;
- `/reportes` devolvio HTTP 200 y el mismo shell SPA;
- el canal `live` estaba activo y sin expiracion.

Comprobacion sugerida:

```powershell
Invoke-WebRequest https://reservas-laboratorios-tup.web.app
Invoke-WebRequest https://reservas-laboratorios-tup.web.app/reportes
```

## 8. Firestore

Colecciones operativas principales:

- `users`, `preauthorizedUsers`, `labs`, `reservations`;
- `reservationLogs`, `notifications`, `systemSettings`;
- `blockedPeriods`, `auditEvents`.

Las reglas usan denegacion por defecto. Las escrituras criticas de reservas,
bitacoras, notificaciones y auditoria no se permiten al cliente. Los accesos se
limitan por propietario, laboratorio asignado o rol Admin segun el recurso.

`firebase/firestore.indexes.json` no declara indices compuestos. El barrido de
consultas no encontro una combinacion local inequívoca de rango y ordenamiento
que exija un indice compuesto adicional. Los indices remotos deben verificarse
en consola o con una sesion `gcloud` reautenticada antes de liberar.

## 9. Storage

Rutas privadas:

- `protocolUploads/{uid}/{uploadId}/{fileName}`: propietario o Admin; maximo
  20 MB y tipos permitidos de protocolo.
- `labImages/{labId}/gallery/{imageId}/{fileName}`: lectura por perfil activo y
  escritura Admin; maximo 5 MB e imagenes permitidas.

No existen lecturas publicas generales y el fallback deniega todo. La interfaz
no debe exponer `storagePath`; los protocolos se abren mediante callable y URL
temporal autorizada.

Versionado, retencion y lifecycle del bucket no pudieron verificarse por la
sesion expirada de `gcloud`; deben revisarse manualmente.

## 10. Scheduler de protocolos huerfanos

`scheduledCleanupOrphanProtocolUploads` se ejecuta diariamente a las `03:00`
de `America/Cancun`. Usa `minAgeHours = 72` y `maxDelete = 100`.

Los logs revisados del `2026-07-15` al `2026-07-22` mostraron ejecuciones
diarias sin errores: 13 archivos escaneados, 13 referenciados, 0 candidatos y
0 eliminados. No se ejecuto una limpieza manual destructiva durante la
auditoria.

## 11. Monitoreo y alertas

Revisar diariamente o ante incidente:

- errores de `createReservation`, `approveReservation` y
  `cancelReservation`;
- `ERROR_CALENDAR` en reservas;
- `FAILED` en `notifications`;
- fallos de `getReservationProtocolAccess`;
- resumen del scheduler de limpieza;
- respuestas 5xx y latencia de callables criticas.

Controles configurados en el proyecto `reservas-laboratorios-tup`:

- canal de notificacion por correo `Operaciones Reservas Laboratorios TUP`,
  dirigido a `victor.yama@tecplayacar.edu.mx`;
- Error Reporting notifica grupos de errores nuevos y errores resueltos que
  reaparezcan;
- uptime check publico HTTPS `GET /` sobre
  `reservas-laboratorios-tup.web.app`, cada 5 minutos, timeout de 10 segundos y
  validacion desde tres regiones;
- politica `Hosting Reservas Laboratorios TUP - Dos fallos consecutivos`, que
  notifica por correo cuando dos comprobaciones consecutivas fallan.

Por decision del propietario no se crearon alertas metricas adicionales para
Functions, 5xx, Scheduler, `ERROR_CALENDAR` o notificaciones `FAILED`.

Control compensatorio mensual:

1. Revisar Error Reporting.
2. Revisar errores y latencia de Cloud Functions.
3. Revisar ejecuciones de Cloud Scheduler.
4. Revisar documentos de `notifications` con `status = FAILED`.
5. Revisar consumo y facturacion.

### Presupuesto y facturacion

La cuenta de facturacion fue verificada en moneda MXN. Se creo el presupuesto
`Reservas Laboratorios TUP - Presupuesto mensual`, limitado exclusivamente al
proyecto, por 500 MXN mensuales:

- 50 % de gasto real: 250 MXN;
- 80 % de gasto real: 400 MXN;
- 100 % de gasto real: 500 MXN;
- 100 % de gasto previsto: 500 MXN.

Usa el tratamiento predeterminado de creditos y notifica a administradores y
usuarios autorizados de facturacion. No usa Pub/Sub, notificaciones
programaticas ni suspension automatica.

Existe un presupuesto heredado de 300 MXN para el mismo proyecto. No fue
modificado ni eliminado; el propietario debe decidir posteriormente si lo
conserva para evitar avisos duplicados.

## 12. Respaldos y recuperacion

Estado aceptado para el MVP:

**Firestore**

- PITR: deshabilitado;
- backups programados: no configurados;
- exportaciones automaticas: no configuradas;
- estado: `NOT_CONFIGURED`, riesgo aceptado por el propietario;
- RPO: no garantizado;
- RTO: no garantizado;
- prueba de restauracion: `NOT_APPLICABLE` para el MVP.

**Storage**

- soft delete: 7 dias;
- versionado: deshabilitado;
- retention policy: no configurada;
- lifecycle: no configurado;
- recuperacion posterior a 7 dias: no garantizada;
- riesgo aceptado por el propietario.

Nunca probar restauracion sobre produccion. La adopcion posterior de PITR,
backups o versionado requiere una fase controlada con prueba en proyecto
aislado.

## 13. Procedimientos de incidente

### Reserva en `ERROR_CALENDAR`

1. No liberar automaticamente el horario: el estado es bloqueante.
2. Consultar `reservationLogs` y logs de `createReservation` o aprobacion.
3. Validar `calendarId`, permisos y cuenta operativa.
4. Corregir la causa; no crear un evento manual sin reconciliar Firestore.
5. Registrar toda intervencion administrativa.

### Notificacion `FAILED`

1. La reserva conserva su estado.
2. Revisar destinatarios, Gmail API, delegacion y logs.
3. Usar `sendPendingNotifications` solo como Admin y tras corregir la causa.
4. Confirmar `SENT`, `providerMessageId` y bitacora.

### Protocolo inaccesible

1. Confirmar propietario, laboratorio asignado o rol Admin.
2. Revisar `storagePath` solo en backend/consola autorizada.
3. Consultar logs de `getReservationProtocolAccess` y permisos `signBlob`.
4. No volver publico el archivo ni compartir una URL permanente.

### Usuario sin acceso

1. Confirmar Authentication, dominio, `users/{uid}`, `active` y rol oficial.
2. Revisar prealta por correo normalizado si corresponde.
3. No asignar roles desde el cliente.

### `calendarId` invalido

1. Validar desde Laboratorios admin.
2. Confirmar que la cuenta operativa tiene escritura.
3. Corregir por Function administrativa y registrar auditoria.

### Evento duplicado o huerfano

1. No eliminar hasta comparar `reservationId`, propiedades privadas y
   `calendarEventId`.
2. Usar la idempotencia determinista para reconciliar.
3. Registrar cualquier correccion manual.

### Fallo del scheduler

1. Revisar Cloud Scheduler y logs de la Function.
2. No ejecutar borrado real de emergencia sin un dry run revisado.
3. Corregir permisos/configuracion y verificar la siguiente ejecucion.

## 14. Despliegue controlado

Validar antes de desplegar:

```powershell
npm test
npm run validate
git diff --check
git status --short
```

Comandos por superficie, solo con autorizacion:

```powershell
npx.cmd firebase deploy --only hosting --project reservas-laboratorios-tup
npx.cmd firebase deploy --only functions --project reservas-laboratorios-tup
npx.cmd firebase deploy --only firestore:rules,storage --project reservas-laboratorios-tup
```

No mezclar cambios no relacionados. Registrar SHA, operador, hora, recursos y
resultado del smoke.

## 15. Smoke postdeploy

- login docente, responsable y Admin;
- catalogo, detalle y disponibilidad;
- reserva no riesgosa y riesgosa con protocolo;
- aprobacion, rechazo y cancelacion;
- Calendar sin duplicados y Gmail sin cambiar estados por fallo;
- Mis reservas, Responsable, Admin y Reportes por rol;
- protocolos privados;
- rutas directas SPA y movil sin overflow.

## 16. Rollback

### Hosting

Restaurar una version anterior desde Firebase Hosting y repetir smoke. No
suponer que revertir Git cambia automaticamente el Hosting.

### Functions

Revertir el commit, validar y desplegar solo Functions autorizadas. Comprobar
compatibilidad con documentos ya escritos antes de retroceder contratos.

### Rules

Conservar cada version en Git. Revertir y desplegar reglas solo si no amplia
acceso indebidamente y despues de validar en emulador.

### Datos

No ejecutar rollback destructivo. Restaurar en entorno aislado, verificar y
seguir un procedimiento aprobado de recuperacion.

## 17. Lista operativa mensual

- revisar errores y latencia de Functions;
- revisar `ERROR_CALENDAR` y notificaciones `FAILED`;
- revisar scheduler y candidatos huerfanos;
- validar calendarios activos y cuentas suspendidas;
- revisar accesos Admin y responsables asignados;
- confirmar vigencia de secretos sin leer valores;
- revisar los riesgos aceptados de continuidad y el estado de las alertas.

## 18. Lista operativa trimestral

- revisar minimo privilegio IAM;
- revisar delegacion y scopes Workspace;
- reevaluar PITR, backups y una futura prueba de restauracion aislada;
- revisar retencion/versionado de Storage;
- auditar reglas, indices y consultas;
- revisar dependencias y runtime en una fase separada;
- ejecutar QA completa por rol y breakpoints.

## 19. Pendientes posteriores al MVP

- endurecer IAM y retirar `roles/editor` con una migracion de menor privilegio;
- evaluar PITR, backups programados y RPO/RTO institucionales;
- evaluar versionado o retencion adicional de Storage;
- decidir si se conserva el presupuesto heredado de 300 MXN;
- mantener la revision manual mensual documentada;
- crear tag o release `v1.0.0` solo con autorizacion expresa.
