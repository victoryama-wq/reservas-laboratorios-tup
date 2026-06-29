# Fase 17: Cierre tecnico, QA integral y entrega MVP

## 1. Resumen ejecutivo

El Sistema Web de Reservas de Laboratorios fue revisado como cierre tecnico de MVP con enfoque en estado de build, Functions desplegadas, Hosting, rutas, reglas de seguridad visibles en codigo, integraciones documentadas, deuda tecnica y pendientes no bloqueantes.

Esta fase no agrega funcionalidades nuevas ni modifica logica de negocio. Las pruebas ejecutadas en esta revision fueron tecnicas, estaticas y de smoke remoto. Las pruebas que requieren sesion autenticada, datos productivos, envio real de correos o acciones en calendarios institucionales se documentan como `PENDING` cuando no fueron ejecutadas durante esta fase.

## 2. Fecha de cierre

- Fecha: 2026-06-24
- Zona horaria: America/Cancun
- Proyecto Firebase: `reservas-laboratorios-tup`
- Hosting principal: `https://reservas-laboratorios-tup.web.app`

## 3. Rama Git

- Raiz Git: `C:/Users/Admin/Documents/Proyectos/Reserva de laboratorios`
- Rama: `main`
- Ultimo commit revisado: `04090b3ba32832d4ce947a58e31d694683f13a64`
- Commit corto: `04090b3 feat(admin): finalize reservation history and preauth revocation`

## 4. Ultimos commits revisados

```text
04090b3 feat(admin): finalize reservation history and preauth revocation
f9ab254 feat(reservations): open reservation form in dialog
284d88d feat(admin): manage special rules and blocked periods
edb4e41 feat(admin): manage laboratories
4f33fd2 chore: initial reservas laboratorios project
```

## 5. Estado de build Angular

Estado: `PASS`

Comando ejecutado:

```powershell
npm --prefix apps/web run build
```

Resultado:

- Build Angular completado correctamente.
- Output generado en `apps/web/dist/web`.
- Warnings no bloqueantes:
  - `Sass @import` de Tailwind esta deprecado para Dart Sass 3.
  - Budget inicial excedido ligeramente por aproximadamente 4.47 kB.
  - `availability-calendar.component.scss` excede budget por aproximadamente 2.03 kB.

## 6. Estado de lint/build Functions

Estado lint: `PASS`

Comando:

```powershell
npm --prefix functions run lint
```

Estado build: `PASS`

Comando:

```powershell
npm --prefix functions run build
```

Resultado:

- ESLint finalizo sin errores.
- TypeScript Functions compilo correctamente.

## 7. Estado de Hosting

Estado: `PASS`

Comando:

```powershell
Invoke-WebRequest https://reservas-laboratorios-tup.web.app
```

Resultado:

- HTTP `200 OK`.
- Hosting responde contenido HTML de la app desplegada.
- `firebase.json` mantiene rewrite SPA a `/index.html`.

## 8. Estado de Functions desplegadas

Estado: `PASS`

Comando:

```powershell
npx firebase functions:list --project reservas-laboratorios-tup
```

Functions confirmadas:

| Function | Estado |
| --- | --- |
| `createReservation` | PASS |
| `approveReservation` | PASS |
| `rejectReservation` | PASS |
| `cancelReservation` | PASS |
| `sendPendingNotifications` | PASS |
| `ensureUserProfile` | PASS |
| `adminPreauthorizeUser` | PASS |
| `adminRevokePreauthorizedUser` | PASS |
| `adminUpdateUser` | PASS |
| `adminCreateLab` | PASS |
| `adminUpdateLab` | PASS |
| `adminCreateSpecialRule` | PASS |
| `adminUpdateSpecialRule` | PASS |
| `adminCreateBlockedPeriod` | PASS |
| `adminUpdateBlockedPeriod` | PASS |

Todas aparecen como callable v2 en `us-central1` con runtime `nodejs22`.

## 9. Estado de Firestore/Storage Rules

Estado: `PASS` en revision estatica local.

Evidencia revisada:

- `firebase/firestore.rules`
- `firebase/storage.rules`
- `firebase.json`

Resumen:

- Firestore deniega por defecto.
- `reservations` bloquea escritura directa desde cliente.
- `users` permite gestion solo a `admin_sistemas`.
- `labs` permite escritura solo a `admin_sistemas`.
- `reservationLogs`, `notifications` y `auditEvents` bloquean escritura directa.
- `preauthorizedUsers` bloquea escritura directa desde cliente.
- Storage limita protocolos a `protocolUploads/{uid}/{uploadId}/{fileName}`.
- Storage valida tamano maximo y tipos permitidos.
- Protocolos no son publicos.

No se ejecuto deploy ni dry-run de reglas en esta fase.

## 10. Matriz de rutas

| Ruta | Estado | Evidencia / observacion |
| --- | --- | --- |
| `/login` | PENDING | Requiere validacion visual/manual en navegador; Hosting responde 200 a nivel SPA. |
| `/` | PENDING | Ruta protegida por `authGuard` y `profileGuard`; no se probo con sesion en esta fase. |
| `/laboratorios` | PENDING | Ruta protegida; estructura de ruta y guards verificados en codigo. |
| `/laboratorios/:labId` | PENDING | Ruta protegida; no se ejecuto navegacion autenticada en esta fase. |
| `/reservar/:labSlug` | PENDING | Ruta protegida; no se ejecuto flujo QR autenticado en esta fase. |
| `/mis-reservas` | PENDING | Ruta protegida; filtro Recientes/Historico documentado y construido previamente. |
| `/mis-reservas/:reservationId` | PENDING | Ruta protegida; acceso por propietario validado en servicio por `teacherUid`. |
| `/responsable/solicitudes` | PENDING | Protegida por rol `responsable_laboratorio` o `admin_sistemas`. |
| `/responsable/historial` | PENDING | Protegida por rol `responsable_laboratorio` o `admin_sistemas`. |
| `/responsable/reserva/:reservationId` | PENDING | Protegida por rol `responsable_laboratorio` o `admin_sistemas`. |
| `/admin/dashboard` | PENDING | Protegida por rol `admin_sistemas`. |
| `/admin/laboratorios` | PENDING | Protegida por rol `admin_sistemas`. |
| `/admin/usuarios` | PENDING | Protegida por rol `admin_sistemas`. |
| `/admin/reglas` | PENDING | Protegida por rol `admin_sistemas`. |
| `/admin/reportes` | DEFERRED | Vista de reportes avanzados diferida/post-MVP si no se completa funcionalmente. |
| `/admin/bitacora` | PENDING | Protegida por rol `admin_sistemas`. |

## 11. Matriz de roles

| Rol | Estado | Observacion |
| --- | --- | --- |
| `docente` | PENDING | Requiere prueba manual autenticada. Reglas y rutas respetan separacion por guards y backend. |
| `responsable_laboratorio` | PENDING | Requiere prueba manual autenticada y datos de laboratorio asignado. |
| `admin_sistemas` | PENDING | Requiere prueba manual autenticada para acciones admin reales. |

No se detectaron roles adicionales en la estructura revisada.

## 12. Matriz de flujos criticos

| Flujo | Estado | Observacion |
| --- | --- | --- |
| Reserva no riesgosa | PENDING | No se creo reserva real durante esta fase para evitar modificar datos productivos sin instruccion explicita. |
| Solicitud riesgosa con protocolo | PENDING | Requiere sesion real y archivo de prueba. |
| Aprobacion | PENDING | Requiere solicitud pendiente real y responsable/admin. |
| Rechazo | PENDING | Requiere solicitud pendiente real. |
| Cancelacion | PENDING | Requiere reserva futura cancelable. |
| Bloqueo administrativo | PENDING | Requiere crear/desactivar bloqueo QA-F17. No se modificaron datos productivos. |
| Prealta y revocacion | PENDING | Requiere crear/revocar prealta QA-F17. |
| Suspension | PENDING | Requiere usuario de prueba; no se tocaron cuentas reales. |

## 13. Matriz de pruebas responsive

| Breakpoint | Estado | Observacion |
| --- | --- | --- |
| 360 px | PENDING | No se ejecuto inspeccion visual autenticada en esta fase. |
| 390 px | PENDING | No se ejecuto inspeccion visual autenticada en esta fase. |
| 414 px | PENDING | No se ejecuto inspeccion visual autenticada en esta fase. |
| 768 px | PENDING | No se ejecuto inspeccion visual autenticada en esta fase. |
| 820 px | PENDING | No se ejecuto inspeccion visual autenticada en esta fase. |
| 1024 px | PENDING | No se ejecuto inspeccion visual autenticada en esta fase. |
| 1366 px | PENDING | No se ejecuto inspeccion visual autenticada en esta fase. |
| 1440 px | PENDING | No se ejecuto inspeccion visual autenticada en esta fase. |

La UI mantiene sistema visual documentado en `docs/13_VISUAL_REDESIGN_REPORT.md`, pero esta fase no reemplaza una prueba visual con navegador autenticado.

## 14. Matriz de integraciones

| Integracion | Estado | Evidencia / observacion |
| --- | --- | --- |
| Firebase Authentication | PENDING | Requiere login real. Codigo mantiene guards y perfil activo. |
| Cloud Firestore | PASS | Build OK; reglas revisadas; Functions desplegadas usan Admin SDK. |
| Cloud Storage | PASS | Reglas revisadas; protocolo restringido por usuario/admin y tipo/tamano. |
| Google Calendar API | PENDING | No se creo/cancelo evento real en esta fase. Functions desplegadas y secretos referenciados por `defineSecret`. |
| Gmail API | PENDING | No se envio correo real en esta fase. Functions desplegadas y secretos referenciados por `defineSecret`. |
| Firebase Hosting | PASS | HTTP 200 OK. |
| Firebase Functions | PASS | Lista real de Functions desplegadas verificada. |

## 15. Hallazgos

### Bloqueantes

Ninguno detectado en validaciones tecnicas ejecutadas.

### Altos

Ninguno detectado en validaciones tecnicas ejecutadas.

### Medios

- `PENDING`: Falta ejecutar matriz manual completa con sesion real y datos QA-F17 para cerrar evidencia funcional productiva.

### Bajos / No bloqueantes

- Warning Sass `@import` de Tailwind.
- Budget inicial de Angular excedido ligeramente.
- Budget SCSS de `availability-calendar` excedido ligeramente.

## 16. Pendientes bloqueantes

No se identificaron pendientes bloqueantes con la evidencia tecnica disponible.

## 17. Pendientes no bloqueantes

- Migrar `@import "tailwindcss"` cuando el stack Tailwind/Angular lo permita sin romper build.
- Reducir bundle inicial o ajustar presupuesto si se acepta el tamano actual.
- Reducir SCSS del calendario o ajustar budget por componente si se acepta la complejidad visual.
- Implementar idempotencia completa de Calendar ante reintentos.
- Implementar limpieza programada de protocolos huerfanos.
- Evaluar vista publica/sanitizada de laboratorios para ocultar campos operativos aun en payload cliente.
- Completar reportes avanzados si quedan diferidos.

## 18. Deuda tecnica conocida

- Algunas validaciones integrales dependen de pruebas manuales con cuentas reales y datos productivos controlados.
- `getDownloadURL` se usa para abrir protocolos autenticados bajo reglas de Storage; no se generan enlaces publicos permanentes, pero conviene mantener auditoria sobre expiracion/uso de URLs firmadas por SDK.
- El cierre MVP requiere smoke postdeploy con usuario `docente`, `responsable_laboratorio` y `admin_sistemas` para convertir varios `PENDING` en `PASS`.

## 19. Recomendaciones post-MVP

1. Ejecutar una jornada QA-F17 con datos de prueba claramente identificados.
2. Registrar capturas de rutas clave en desktop/tablet/mobile.
3. Cerrar evidencia real de Gmail y Calendar con un flujo de reserva completa.
4. Documentar el checklist operativo de soporte para Admin/Sistemas.
5. Preparar plan post-MVP para reportes avanzados y limpieza de archivos huerfanos.
6. Revisar budgets de Angular antes de crecimiento de nuevos modulos.

## 19.1. Seguimiento QA posterior: refresco de perfil en AppShell

Durante QA posterior a Fase 17 se observo una latencia visual donde el header
podia mostrar `Docente` temporalmente para un usuario cuyo perfil real ya era
`admin_sistemas`.

Clasificacion: `MEDIO`.

Resolucion aplicada:

- el AppShell ya no usa `Docente` como fallback cuando el perfil no esta
  confirmado;
- mientras se lee `users/{uid}`, el header muestra `Validando perfil...`;
- el rol y la navegacion se renderizan solo con perfil activo confirmado;
- la lectura de perfil se fuerza desde Firestore server para evitar cache visual
  obsoleto despues de login, prealta, cambio de cuenta o recarga;
- los estados `missing`, `inactive`, `invalid-role` y `error` muestran etiquetas
  neutras y no habilitan navegacion por rol.

Validacion tecnica requerida para cerrar este seguimiento:

```powershell
npm --prefix apps/web run build
npm --prefix functions run lint
npm --prefix functions run build
git diff --check
```

## 20. Revision de seguridad por codigo

Estado: `PASS` en busqueda orientativa.

Resultados:

- No se encontraron coincidencias de `deleteDoc`, `updateDoc`, `setDoc` o `addDoc` en `apps/web/src`.
- La creacion de reservas usa `httpsCallable('createReservation')`.
- La gestion de usuarios usa `httpsCallable('adminUpdateUser')`.
- La gestion de laboratorios usa `httpsCallable('adminCreateLab')` y `httpsCallable('adminUpdateLab')`.
- La gestion de reglas/bloqueos usa callable Functions admin.
- La revocacion de prealtas usa `adminRevokePreauthorizedUser`.
- No se encontraron llaves privadas o JSON de cuenta de servicio commiteados; solo referencia esperada a `defineSecret('GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON')`.
- `calendarId` aparece en vistas/servicios de administracion; no se detecto en componentes docentes de catalogo/detalle/reserva.

## 21. Comandos ejecutados

```powershell
git rev-parse --show-toplevel
git branch --show-current
git status --short
git log --oneline -n 10
node -v
npm -v
npx firebase --version
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix apps/web run build
git diff --check
git status --short
npx firebase functions:list --project reservas-laboratorios-tup
Invoke-WebRequest https://reservas-laboratorios-tup.web.app
```

## 22. Dictamen final

**MVP APROBADO CON OBSERVACIONES**

Justificacion:

- Build Angular: `PASS`.
- Lint/build Functions: `PASS`.
- Hosting real: `PASS`.
- Functions esperadas desplegadas: `PASS`.
- Reglas revisadas localmente: `PASS`.
- Busqueda de secretos: `PASS`.
- Escrituras criticas desde Angular: `PASS` en busqueda orientativa.
- Flujos autenticados/productivos: `PENDING` porque no se ejecutaron en esta fase para evitar modificar datos sin instruccion explicita.
- Warnings de build: no bloqueantes y ya documentados.

El sistema queda tecnicamente apto para smoke manual final con cuentas reales y datos `QA-F17` antes de declararlo `MVP APROBADO` sin observaciones.

## 23. Seguimiento Fase 17B.1: galeria privada de laboratorios

Estado: `IMPLEMENTADO LOCALMENTE`, pendiente de smoke manual y deploy cuando el
propietario lo autorice.

Alcance:

- `LabDoc` extendido con `gallery` y `coverImageId`;
- Storage path `labImages/{labId}/gallery/{imageId}/{fileName}`;
- reglas de Storage para lectura autenticada activa y escritura admin;
- validacion backend en `adminCreateLab` y `adminUpdateLab`;
- servicio Angular admin para carga de imagenes;
- pestana `Galeria` en dialogo de laboratorios;
- metadata sin `downloadUrl` publica;
- `imageUrl` preservado como campo legado.

Fuera de alcance:

- carrusel publico en catalogo/detalle;
- eliminacion automatica de archivos;
- QR;
- reservas;
- Calendar API;
- Gmail API.

## 24. Seguimiento Fase 17B.2: carrusel en detalle de laboratorio

Estado: `IMPLEMENTADO LOCALMENTE`, pendiente de smoke manual y deploy cuando el
propietario lo autorice.

Alcance:

- componente `LabImageCarouselComponent` para `/laboratorios/:labId`;
- servicio `LabGalleryViewService` para resolver URLs temporales desde Storage;
- ordenamiento de imagenes activas con `coverImageId` primero;
- fallback institucional si no hay imagenes o no cargan;
- integracion despues del encabezado y antes del resumen/calendario;
- documentacion actualizada.

Fuera de alcance:

- cambios en Admin/Laboratorios;
- cambios en carga de imagenes;
- cambios en Storage Rules;
- backend;
- reservas;
- Calendar API;
- Gmail API.

## 25. Seguimiento Fase 17B.3: QR configurable por laboratorio

Estado: `IMPLEMENTADO LOCALMENTE`, pendiente de smoke manual, commit y deploy
cuando el propietario lo autorice.

Alcance:

- modelo `qrConfig` en laboratorios;
- validacion backend en `adminCreateLab` y `adminUpdateLab`;
- pestana `QR` en el dialogo de alta/edicion;
- componente `AdminLabQrPreviewComponent`;
- acciones cliente para copiar enlace, descargar PNG, descargar SVG e imprimir;
- advertencia cuando el `slug` cambia.

No se modificaron reservas, Calendar, Gmail, reglas de seguridad, roles ni
estatus.
