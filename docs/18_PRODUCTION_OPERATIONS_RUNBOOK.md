# Runbook de Operacion Productiva

## 1. Proposito y alcance

Este documento define la operacion de produccion del Sistema Web de Reservas
de Laboratorios. Cubre despliegue, monitoreo, incidentes, respaldo, recuperacion
y rollback. No sustituye los SDD ni autoriza cambios de infraestructura.

Estado de la auditoria: `2026-07-22`. Proyecto Firebase:
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

Checklist manual de Google Workspace Admin:

1. Confirmar delegacion de dominio para el client ID de la cuenta de servicio.
2. Confirmar exactamente los dos scopes anteriores.
3. Confirmar que la cuenta operativa puede escribir en cada calendario.
4. Confirmar que no existen scopes adicionales innecesarios.

La auditoria no accedio a valores de Secret Manager. Calendar y Gmail quedaron
verificados funcionalmente en QA real de la Fase 18C; la configuracion exacta
de la consola Workspace requiere revision manual.

## 6. IAM de ejecucion

Cuenta de ejecucion observada:
`261669564296-compute@developer.gserviceaccount.com`.

Capacidades que deben revisarse con menor privilegio:

- acceso a los secretos vinculados;
- Firestore y Storage mediante Admin SDK;
- firma de blobs para URLs temporales de protocolos;
- ejecucion del job programado.

Existe evidencia historica de errores `iam.serviceAccounts.signBlob` en
`getReservationProtocolAccess` hasta `2026-06-30`. La apertura de protocolos se
valido posteriormente en QA real. La politica IAM actual no pudo inspeccionarse
directamente porque la sesion `gcloud` requeria reautenticacion no interactiva.

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

Alertas recomendadas:

- cualquier fallo consecutivo del scheduler;
- incremento de 5xx en Functions criticas;
- presencia sostenida de `ERROR_CALENDAR`;
- notificaciones `FAILED` sin reproceso;
- errores de acceso a secretos o `signBlob`.

Las politicas de alerta existentes no pudieron inventariarse durante esta
auditoria; quedan como verificacion manual obligatoria.

## 12. Respaldos y recuperacion

No se confirmo una politica activa de backups o PITR de Firestore ni versionado
del bucket. Antes de declarar liberacion final se debe registrar evidencia de:

1. PITR o exportaciones programadas de Firestore.
2. Ubicacion, retencion, cifrado y responsables del respaldo.
3. Versionado o estrategia equivalente para Storage.
4. Prueba de restauracion en un proyecto aislado.
5. RPO y RTO institucionales aprobados.

Nunca probar restauracion sobre produccion.

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
- confirmar estado de backups y alertas.

## 18. Lista operativa trimestral

- revisar minimo privilegio IAM;
- revisar delegacion y scopes Workspace;
- ejecutar prueba de restauracion aislada;
- revisar retencion/versionado de Storage;
- auditar reglas, indices y consultas;
- revisar dependencias y runtime en una fase separada;
- ejecutar QA completa por rol y breakpoints.

## 19. Pendientes operativos de liberacion

- reautenticar `gcloud` y capturar evidencia de IAM, alertas, indices remotos,
  backups/PITR y proteccion de Storage;
- aprobar RPO/RTO y responsables de restauracion;
- confirmar en Workspace Admin la delegacion y scopes exactos;
- decidir y configurar alertas minimas;
- crear tag o release `v1.0.0` solo despues de cerrar la checklist.
