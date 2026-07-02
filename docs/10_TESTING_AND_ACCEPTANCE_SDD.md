Actualizacion Fase 13.4: pruebas de tipo de practica, protocolo y plantillas

Agregar pruebas para:

- practiceType con cada valor oficial: Teórica, Simulación, Taller, Evaluación
  práctica, Investigación y Otro.
- practiceType === 'Otro' sin practiceTypeOther debe fallar en frontend y
  backend.
- practiceType === 'Otro' con practiceTypeOther de mas de 120 caracteres debe
  fallar.
- risky === true exige protocolo.
- externalParticipants === true exige protocolo aunque risky === false.
- risky === true crea reserva PENDIENTE_VALIDACION.
- externalParticipants === true crea reserva PENDIENTE_VALIDACION aunque
  risky === false.
- risky === false y externalParticipants === false no exige protocolo.
- Si se envia un protocolo valido sin ser obligatorio, el backend puede
  conservarlo como adjunto opcional.
- createReservation guarda protocolRequired = risky || externalParticipants.
- approveReservation revalida protocolo con risky || externalParticipants.
- Google Calendar no incluye enlaces publicos a Storage.
- Gmail envia HTML institucional con fallback de texto plano y no adjunta
  protocolos.
- Gmail incluye logotipo TUP como imagen inline por `cid`, no como URL publica.
- La plantilla Gmail respeta paleta `#888887`, `#252a86`, `#271e5d` y
  `#ffffff`.
- La plantilla Gmail muestra estatus destacado, datos de reserva y pie
  institucional.
- Un error de correo sigue sin cambiar el estatus de la reserva.
- cancelReservation solo permite cancelar reservas futuras y cancelables.
- cancelReservation permite docente propietario, responsable asignado o
  admin_sistemas.
- cancelReservation elimina el evento de Google Calendar si existe
  calendarEventId.
- Si Google Calendar falla durante cancelacion, no cambia el estatus y registra
  CALENDAR_ERROR.
- Si Google Calendar responde 404 Not Found o 410 Gone durante cancelacion,
  cancelReservation continua y marca la reserva como CANCELADA.
- cancelReservation registra CANCELLED y CALENDAR_EVENT_CANCELLED cuando
  corresponde.
- cancelReservation crea RESERVATION_CANCELLED y un fallo de Gmail no revierte
  la cancelacion.

Pruebas unitarias

Deben cubrir:
Validación de horario.
Validación de anticipación mínima.
Validación de traslape.
Validación de reglas especiales.
Validación de práctica riesgosa.
Validación de protocolo obligatorio.
Validación de permisos por rol.
Generación de folio.
Cambio de estatus.
Validación de dominio institucional.
ERROR_CALENDAR como estatus bloqueante.
Errores de correo sin cambio de estatus de reserva.

Pruebas de integración

Deben cubrir:
Crear reserva normal.
Crear reserva riesgosa.
Aprobar reserva.
Rechazar reserva.
Cancelar reserva futura.
Crear evento en Calendar.
Cancelar evento en Calendar.
Enviar correo.
Subir protocolo.
Validar metadata, propiedad y existencia de protocolo en createReservation.
Consultar disponibilidad.
Acceso por QR.
Redirección después de login.

Pruebas responsive

Deben probarse como mínimo en:

Mobile:
- 360px
- 390px
- 414px

Tablet:
- 768px
- 820px

Desktop:
- 1024px
- 1366px
- 1440px

Criterios de aceptación MVP

El MVP está listo cuando:
Un docente puede iniciar sesión.
Un docente puede entrar desde QR.
El formulario funciona correctamente en celular.
Un docente puede ver laboratorios.
Un docente puede crear una reserva no riesgosa.
Una reserva válida no riesgosa queda confirmada.
Una reserva riesgosa queda pendiente.
Un responsable puede aprobar o rechazar.
Una aprobación crea evento en Calendar.
Un rechazo por responsable queda como RECHAZADA_POR_RESPONSABLE y notifica motivo.
Admin/Sistemas puede gestionar laboratorios.
Admin/Sistemas puede asignar responsables.
El sistema impide traslapes.
ERROR_CALENDAR bloquea el horario hasta resolución administrativa.
Un error de correo queda en notifications.status = FAILED y reservationLogs.action = EMAIL_ERROR sin liberar horario.
El sistema registra bitácora.
El sistema restringe acciones por rol.
El calendario se adapta a móvil y escritorio.
No se usa Google Forms como flujo principal.

Pruebas Fase 16A: Admin/Sistemas

Agregar o ejecutar pruebas manuales para:

- `/admin/dashboard` solo visible para `admin_sistemas`.
- `/admin/usuarios` lista usuarios con datos reales cuando Firestore Rules lo
  permiten.
- Un admin puede cambiar rol oficial mediante `adminUpdateUser`.
- Un admin puede activar/desactivar un usuario objetivo mediante
  `adminUpdateUser`.
- Un admin puede asignar `labsAssigned` a un usuario
  `responsable_laboratorio`.
- Si el rol final no es `responsable_laboratorio`, `labsAssigned` queda vacio.
- No se puede asignar un rol no oficial.
- No se puede desactivar o degradar la propia cuenta admin.
- Cada actualizacion crea `auditEvents.action = ADMIN_UPDATE_USER`.
- Angular no ejecuta `updateDoc` directo para roles.
- `/admin/laboratorios` es solo lectura y no muestra `calendarId`.
- `/admin/bitacora` muestra eventos administrativos sin secretos ni stack
  traces.
- Docente y responsable sin rol admin no deben ver rutas `/admin/*`.
- Al entrar por primera vez a `/admin/dashboard`, `/admin/usuarios`,
  `/admin/laboratorios` y `/admin/bitacora`, los datos deben mostrarse sin
  requerir un segundo clic en la misma ruta.
- Si Firestore devuelve datos o una lista vacia, la vista debe salir del estado
  `Cargando...` y mostrar datos, estado vacio o error claro.
## Pruebas Fase 16B: gestion de laboratorios

Agregar o ejecutar pruebas manuales para:

- `/admin/laboratorios` carga datos en primera navegacion sin segundo clic;
- un admin puede crear laboratorio con slug unico;
- un slug duplicado se rechaza desde backend;
- slug con caracteres invalidos se rechaza;
- `calendarId` vacio se rechaza;
- `minNoticeHours < 0` se rechaza;
- correos fuera de `@tecplayacar.edu.mx` se rechazan;
- `responsibleUids` inexistentes o con rol no permitido se rechazan;
- `weeklySchedule` con `end <= start` se rechaza;
- editar `slug` actualiza `qrPath`;
- activar/desactivar laboratorio actualiza el listado;
- mostrar/ocultar catalogo actualiza el listado;
- cada creacion genera `auditEvents.action = ADMIN_CREATE_LAB`;
- cada actualizacion genera `auditEvents.action = ADMIN_UPDATE_LAB`;
- Angular llama `adminCreateLab/adminUpdateLab` y no `updateDoc` directo;
- `calendarId` no aparece en vistas docentes;
- no se modifican reservas existentes.

Validaciones tecnicas:

```bash
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix apps/web run build
git diff --check
git status --short
```

## Pruebas Fase 17B.4: validacion real de calendarId

Validaciones obligatorias:

- entrar como `admin_sistemas`;
- abrir `/admin/laboratorios`;
- crear o editar un laboratorio;
- abrir la pestana `Calendario`;
- capturar un `calendarId` valido compartido con
  `escenarios.tup@tecplayacar.edu.mx` como escritor;
- ejecutar `Validar calendario` y confirmar resultado exitoso;
- intentar guardar y confirmar que `adminCreateLab` o `adminUpdateLab` permite
  la operacion;
- capturar un calendario inexistente y confirmar mensaje controlado;
- capturar un calendario sin permiso de escritura y confirmar bloqueo;
- confirmar que no se crea ningun evento de prueba en Google Calendar;
- confirmar que no se modifican reservas, Gmail, roles, estatus ni reglas de
  seguridad;
- confirmar que `calendarId` no aparece en vistas docentes.

Validaciones tecnicas:

```bash
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix apps/web run build
git diff --check
git status --short
```

## Pruebas Fase 17B.1: galeria admin de laboratorios

Validaciones obligatorias:

- abrir `/admin/laboratorios` como `admin_sistemas`;
- crear o editar laboratorio y abrir pestana `Galeria`;
- subir imagen JPG, PNG y WebP valida menor o igual a 5 MB;
- confirmar que archivos se almacenan en
  `labImages/{labId}/gallery/{imageId}/{fileName}`;
- intentar subir archivo no permitido y confirmar rechazo visual;
- intentar subir imagen mayor a 5 MB y confirmar rechazo visual;
- confirmar que el contador no permite mas de 8 imagenes activas;
- capturar `alt` y `caption`;
- mover imagenes arriba/abajo y guardar;
- seleccionar portada y confirmar `coverImageId`;
- desactivar imagen portada y confirmar que se selecciona otra portada o se
  limpia portada;
- confirmar que Firestore guarda metadata en `labs/{labId}.gallery`;
- confirmar que no se guarda `downloadUrl`;
- confirmar que `imageUrl` sigue existiendo como campo legado opcional;
- confirmar que usuarios no admin no pueden subir imagenes;
- confirmar que usuarios con perfil activo pueden leer previews;
- confirmar que no cambia catalogo publico ni detalle publico en esta fase.

Validaciones tecnicas:

```bash
npm --prefix apps/web run build
npm --prefix functions run lint
npm --prefix functions run build
git diff --check
git status --short
```

## Pruebas Fase 17B.5: sincronizacion de responsables

Validaciones manuales obligatorias:

- entrar como `admin_sistemas`;
- abrir `/admin/laboratorios`;
- crear o editar un laboratorio con un usuario activo
  `responsable_laboratorio` en `responsibleUids`;
- confirmar en Firestore que `users/{uid}.labsAssigned` contiene el `labId`;
- entrar con ese responsable y confirmar que ve solicitudes de ese laboratorio;
- remover al responsable desde `/admin/laboratorios`;
- confirmar que `users/{uid}.labsAssigned` ya no contiene el `labId`;
- agregar un usuario `admin_sistemas` como responsable operativo y confirmar
  que no depende de `labsAssigned`;
- intentar agregar un usuario `docente` y confirmar rechazo controlado;
- intentar agregar un usuario inexistente y confirmar rechazo controlado;
- intentar agregar un usuario inactivo y confirmar rechazo controlado;
- confirmar que `ADMIN_CREATE_LAB` y `ADMIN_UPDATE_LAB` registran metadata de
  responsables sincronizados;
- confirmar que no se modifican reservas existentes;
- confirmar que `/admin/usuarios` sigue funcionando.

Validaciones tecnicas:

```bash
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix apps/web run build
git diff --check
git status --short
```

## Pruebas Fase 17B.3: QR configurable por laboratorio

- abrir `/admin/laboratorios` como `admin_sistemas`;
- crear o editar laboratorio y abrir pestana `QR`;
- confirmar que la previsualizacion usa el `slug` actual;
- confirmar que la URL generada es
  `https://reservas-laboratorios-tup.web.app/reservar/{slug}`;
- cambiar colores, textos, marco, tamano y logo institucional y confirmar que la
  previsualizacion responde;
- copiar enlace;
- descargar PNG;
- descargar SVG;
- imprimir QR;
- cambiar `slug` y confirmar advertencia visual;
- guardar laboratorio y confirmar `labs/{labId}.qrConfig`;
- confirmar que no se guardan imagenes QR, base64 ni archivos en Storage;
- escanear o abrir el enlace QR y confirmar que llega a `/reservar/:labSlug`.

## Pruebas Fase 17B.2: carrusel en detalle de laboratorio

Validaciones obligatorias:

- entrar con usuario autenticado y perfil activo;
- abrir `/laboratorios/:labId` con imagenes activas;
- confirmar que aparece el carrusel despues del encabezado;
- confirmar que la imagen `coverImageId` aparece primero;
- confirmar botones anterior/siguiente cuando hay mas de una imagen;
- confirmar indicadores y foco visible;
- confirmar que `alt` y `caption` se usan en la vista;
- abrir laboratorio sin imagenes activas y confirmar fallback institucional;
- simular imagen faltante o sin permiso y confirmar que no bloquea toda la
  vista;
- confirmar que resumen lateral, boton de reserva y calendario siguen
  visibles y funcionales;
- confirmar que no se muestra `storagePath`;
- confirmar que no se muestra `calendarId`;
- probar responsive en 360, 390, 414, 768, 820, 1024, 1366 y 1440 px.

Validaciones tecnicas:

```bash
npm --prefix apps/web run build
npm --prefix functions run lint
npm --prefix functions run build
git diff --check
git status --short
```

## Pruebas Fase 16C: reglas y bloqueos

Agregar o ejecutar pruebas manuales para:

- `/admin/reglas` carga en primera navegacion sin segundo clic;
- Admin/Sistemas puede crear regla especial por laboratorio;
- Admin/Sistemas puede editar regla especial existente;
- Admin/Sistemas puede activar/desactivar regla especial;
- regla parcial exige `blockedEnd > blockedStart`;
- regla de dia completo no exige horas;
- Admin/Sistemas puede crear bloqueo global;
- Admin/Sistemas puede crear bloqueo por uno o varios laboratorios;
- bloqueo por laboratorio exige `labIds`;
- `endAt <= startAt` se rechaza en backend;
- crear reserva dentro de bloqueo activo queda `RECHAZADA_REGLA_HORARIO`;
- aprobar reserva pendiente dentro de bloqueo activo se detiene;
- Angular usa callables admin y no escritura directa;
- cada cambio genera `auditEvents`.

## Pruebas Fase 16A.1: autoalta y prealta

Agregar o ejecutar pruebas manuales para:

- un correo `tup-d1@tecplayacar.edu.mx` sin perfil crea automaticamente
  `users/{uid}` como `docente` activo;
- un correo institucional que no cumple patron docente y no tiene prealta queda
  en acceso pendiente;
- Admin/Sistemas puede crear prealta de `responsable_laboratorio` con
  laboratorios asignados;
- una cuenta preautorizada reclama la prealta en su primer login y se crea
  `users/{uid}` con el UID real;
- `claimedByUid` y `claimedAt` quedan registrados en `preauthorizedUsers`;
- `adminPreauthorizeUser` rechaza correos fuera del dominio institucional;
- `adminPreauthorizeUser` rechaza correos docentes con patron `tup-dNUMEROS`;
- `adminPreauthorizeUser` rechaza labs inexistentes;
- Angular no crea perfiles ni escribe roles directamente;
- `/admin/usuarios` lista usuarios y preautorizados pendientes en la primera
  navegacion, sin requerir segundo clic.

## Pruebas Fase 16F: revocacion de prealtas

Agregar o ejecutar pruebas manuales para:

- Admin/Sistemas puede revocar una prealta activa no reclamada;
- la revocacion deja `active: false`, `revokedBy`, `revokedAt`,
  `revocationReason` si se capturo motivo y `updatedAt`;
- se registra `auditEvents.action = ADMIN_REVOKE_PREAUTHORIZED_USER`;
- una prealta revocada no puede ser reclamada por `ensureUserProfile`;
- una prealta con `claimedByUid` no muestra accion de revocacion;
- los usuarios existentes se suspenden con `active: false` y no se eliminan;
- `/admin/usuarios` muestra estados `Pendiente`, `Reclamada` y `Revocada`;
- el UID no se usa como dato principal en las tarjetas de usuarios existentes.
- si Firestore recibe una prealta heredada con datos incompletos, la
  revocacion no debe fallar por metadata de auditoria `undefined`;
- el frontend no debe mostrar el texto tecnico `internal`; debe presentar un
  mensaje administrativo claro.

## Pruebas QA posterior a Fase 17: refresco de perfil y rol en header

Agregar o ejecutar pruebas manuales para:

- entrar con un usuario `docente` y confirmar que el header muestre `Docente`;
- cerrar sesion y entrar con un usuario `admin_sistemas`;
- confirmar que durante la carga del perfil el header muestre
  `Validando perfil...` o un estado neutro, nunca `Docente`;
- confirmar que al terminar la carga el header muestre `Admin` o
  `Admin/Sistemas` y los accesos administrativos;
- entrar con un usuario recien preautorizado como `admin_sistemas` y confirmar
  que despues del primer login se vea el rol admin sin esperar minutos;
- recargar el navegador con sesion admin y confirmar que no aparece `Docente`
  como rol temporal;
- entrar con un usuario `responsable_laboratorio` y confirmar que muestre
  `Responsable`, que vea accesos Responsable y que no vea accesos Admin;
- si el perfil esta inactivo, falta o tiene rol no valido, confirmar que el
  header muestre un estado neutro o acceso pendiente y no un rol inventado.

## Pruebas Fase 16D: reserva con formulario en dialogo

Validaciones obligatorias:

- abrir `/reservar/:labSlug` en movil, tablet y escritorio;
- confirmar que el calendario ocupa la superficie principal;
- confirmar que existe la accion `Nueva solicitud`;
- abrir el dialogo sin seleccionar horario y capturar fecha/hora manualmente;
- seleccionar un slot disponible y abrir el dialogo;
- confirmar que se precargan fecha, hora de inicio y hora de finalizacion;
- completar una reserva no riesgosa y confirmar que el dialogo se cierra;
- confirmar que el calendario se refresca o muestra evento optimista para
  estatus bloqueantes;
- completar una solicitud con protocolo y confirmar que conserva la carga real
  de archivo;
- provocar un error controlado y confirmar que el dialogo permanece abierto;
- confirmar que no hay overflow horizontal en el dialogo;
- confirmar que botones, foco, iconos y textos son accesibles y legibles;
- confirmar que no cambia la estructura del payload enviado a
  `createReservation`.

## Pruebas Fase 16E: Mis reservas recientes e historico

Validaciones obligatorias:

- abrir `/mis-reservas` con usuario docente o admin que tenga reservas propias;
- confirmar que la vista inicial sea `Recientes`;
- confirmar que `Recientes` muestra reservas futuras;
- confirmar que `Recientes` muestra reservas de los ultimos 3 meses;
- confirmar que `Recientes` conserva reservas antiguas con estatus
  `PENDIENTE_VALIDACION`, `CONFIRMADA`, `CONFIRMADA_TRAS_VALIDACION` o
  `ERROR_CALENDAR`;
- confirmar que `Historico` muestra reservas anteriores a 3 meses que no estan
  pendientes ni bloqueando horario;
- confirmar que `Todas` muestra todas las reservas personales;
- confirmar que los filtros existentes por estatus, revision, fecha, busqueda y
  orden siguen funcionando dentro de cada vista;
- confirmar que una cuenta no ve reservas de otros usuarios;
- confirmar que no se muestra `calendarId` ni rutas internas de Storage;
- confirmar que no se ejecutan borrados de `reservations`, `reservationLogs`,
  `notifications` ni `auditEvents`.

Validaciones tecnicas:

```bash
npm --prefix apps/web run build
npm --prefix functions run lint
npm --prefix functions run build
git diff --check
git status --short
```

## Pruebas Fase 17B.6: Admin/Laboratorios sin resumen redundante

Validaciones obligatorias:

- abrir `/admin/laboratorios` como `admin_sistemas`;
- confirmar que cada card muestra solo un resumen compacto de reglas
  especiales;
- confirmar que un laboratorio sin reglas activas muestra
  `Sin reglas especiales activas`;
- confirmar que laboratorios con reglas activas muestran el conteo correcto;
- confirmar que reglas inactivas aparecen solo como chip compacto cuando
  existan;
- confirmar que no se muestran dias, horarios, razones largas ni formularios
  de reglas dentro de la card;
- confirmar que la accion `Gestionar reglas` abre `/admin/reglas` con el
  laboratorio preseleccionado mediante `labId`;
- confirmar que el dialogo de laboratorio conserva sus pestanas existentes y
  solo muestra un callout para reglas especiales en Disponibilidad;
- abrir un laboratorio en modo edicion sin modificar datos y confirmar que
  `Guardar laboratorio` queda deshabilitado;
- confirmar que no se llama `adminUpdateLab` cuando no hay cambios reales;
- confirmar que cambios sensibles muestran confirmacion previa: `slug`,
  `calendarId`, desactivar laboratorio, ocultar del catalogo, responsables,
  horario base y reduccion de imagenes activas;
- confirmar que cambios simples no muestran confirmaciones innecesarias;
- confirmar que errores administrativos como permisos, precondiciones,
  servicio no disponible o errores internos se muestran con mensajes claros y
  no con `internal`, stack traces o JSON crudo;
- confirmar que no se modifican reservas, Calendar API, Gmail API, roles,
  estatus, Firestore Rules ni Storage Rules.

Validaciones tecnicas:

```bash
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix apps/web run build
git diff --check
git status --short
```
## Actualizacion Fase 17C.1: pruebas de acceso a protocolos

Casos minimos de aceptacion para `getReservationProtocolAccess`:

- `admin_sistemas` puede abrir protocolo de cualquier reserva.
- `responsable_laboratorio` puede abrir protocolo solo si
  `reservation.labId` esta en `users/{uid}.labsAssigned`.
- `responsable_laboratorio` no puede abrir protocolo de un laboratorio no
  asignado.
- docente propietario puede abrir protocolo de su propia reserva si el flujo lo
  usa.
- docente no puede abrir protocolo de otras reservas.
- si `storagePath` no existe en `reservation.protocolFiles`, la funcion rechaza
  la solicitud.
- si el archivo no existe en Storage, la funcion devuelve error claro.
- la URL devuelta expira y no se almacena en Firestore.
- la interfaz muestra carga y error legible sin mostrar rutas internas.

Pruebas manuales recomendadas:

1. Entrar como responsable asignado y abrir un protocolo desde
   `/responsable/reserva/:reservationId`.
2. Entrar como responsable no asignado y confirmar rechazo.
3. Entrar como Admin/Sistemas y confirmar acceso.
4. Confirmar que no se modifican reservas, logs, Calendar ni Gmail.

### Correccion 17C.1A

Validaciones adicionales:

- cuando falle el acceso temporal al protocolo, la UI no debe mostrar
  `INTERNAL`;
- si falta el permiso IAM `iam.serviceAccounts.signBlob`, el error debe quedar
  registrado en logs de Functions y el usuario debe ver un mensaje seguro;
- una reserva `12:00 - 13:30` debe mostrarse como `12:00 - 13:30` en la Web App;
- una reserva `12:30 - 13:30` debe iniciar visualmente a media celda;
- una reserva de hora exacta, por ejemplo `08:00 - 09:00`, debe conservar el
  mismo comportamiento anterior;
- los bloques de dia no disponible deben seguir sin saturar la vista.

### Correccion 17C.1B

Validaciones visuales adicionales:

- `12:00 - 13:30`: inicia en la linea de 12:00 y termina a mitad entre 13:00 y
  14:00.
- `12:30 - 13:30`: inicia a mitad entre 12:00 y 13:00 y termina a mitad entre
  13:00 y 14:00.
- `08:00 - 09:00`: ocupa exactamente una hora visual.
- `08:00 - 08:30`: ocupa media hora visual.
- `13:30 - 14:00`: ocupa media hora visual.
- `Dia no disponible` sigue mostrando un bloque claro sin repetir texto.
- La etiqueta y el dialogo de detalle muestran el horario real.

Estas pruebas son visuales y no deben implicar cambios en reservas, Google
Calendar API, Gmail API, Firestore Rules ni Storage Rules.
## Actualizacion Fase 17C.2: QA de bitacora responsable

Pruebas manuales requeridas:

- entrar como `responsable_laboratorio` asignado a un laboratorio;
- abrir `/responsable/solicitudes`;
- abrir `/responsable/reserva/:reservationId`;
- confirmar que la bitacora basica muestra textos legibles;
- confirmar que no aparecen `calendarId`, `storagePath`, URLs firmadas, UIDs
  como dato principal ni metadata cruda;
- aprobar o rechazar una reserva de prueba y confirmar que la bitacora refleja
  el nuevo evento;
- entrar como responsable no asignado y confirmar que no puede consultar la
  bitacora de laboratorios ajenos;
- entrar como `admin_sistemas` y confirmar acceso global;
- confirmar que consultar la bitacora no modifica reservas ni crea eventos de
  auditoria de lectura.

## Pruebas Fase 17F.1: bitacora personal de Mis reservas

Docente:

- entrar como docente;
- abrir `/mis-reservas`;
- abrir una reserva propia confirmada;
- confirmar que la bitacora muestra eventos saneados;
- abrir una reserva pendiente y confirmar `Pendiente de validacion`;
- abrir una reserva rechazada y confirmar motivo si existe;
- abrir una reserva cancelada y confirmar evento `Reserva cancelada`.

Seguridad:

- intentar abrir `/mis-reservas/:reservationId` de otro usuario;
- confirmar error controlado;
- confirmar que no carga bitacora de reserva ajena;
- confirmar en DevTools que no hay lectura directa a `reservationLogs`;
- confirmar llamada a `getMyReservationLogs`;
- confirmar que no aparecen `calendarId`, `storagePath`, metadata, UIDs,
  correos de actores, URLs firmadas ni stack traces.

Roles:

- entrar como `admin_sistemas` y confirmar que `/mis-reservas` muestra solo sus
  reservas propias como solicitante;
- entrar como `responsable_laboratorio` y confirmar que `/mis-reservas` muestra
  solo sus reservas propias como solicitante;
- confirmar que la revision global permanece en `/responsable/solicitudes`.

Pruebas adicionales de correccion 17C.2A:

- confirmar que una reserva sin eventos muestra
  `No hay eventos de bitacora registrados para esta reserva.`;
- confirmar que un responsable no asignado ve mensaje de permiso claro;
- confirmar que fallas tecnicas muestran mensaje generico y no `INTERNAL`;
- revisar Cloud Logging y confirmar diagnostico con `reservationId`,
  `reservationFound`, `reservationLabId`, `actorRole`, `labsAssignedCount`,
  `allowed` y `logsCount` cuando aplique;
- confirmar que los logs no imprimen `calendarId`, rutas de Storage, URLs
  firmadas, secretos ni stack traces completos.

## Pruebas Fase 17F.2: protocolos en Mis reservas

Casos minimos:

- entrar como docente propietario y abrir una reserva propia con protocolo;
- presionar `Abrir protocolo`;
- confirmar que se llama `getReservationProtocolAccess`;
- confirmar que no se llama `getDownloadURL` desde Mis reservas;
- confirmar que el archivo abre en una nueva pestana mediante URL temporal;
- confirmar que no se muestra `storagePath` ni la URL firmada en UI;
- confirmar mensajes seguros para sin permiso, archivo no encontrado y error
  tecnico;
- confirmar que solo el boton del archivo seleccionado muestra carga;
- probar mobile 360, 390 y 414 px sin overflow horizontal;
- confirmar que Responsable sigue abriendo protocolos con el mismo flujo.

Pruebas tecnicas:

- `npm --prefix functions run lint`;
- `npm --prefix functions run build`;
- `npm --prefix apps/web run build`;
- `git diff --check`.

## Correccion Fase 17C.2B: QA contra doble envio

Pruebas manuales recomendadas:

- crear una reserva con protocolo y presionar el boton final una sola vez;
- confirmar que queda `PENDIENTE_VALIDACION`;
- intentar doble click rapido sobre el boton final;
- confirmar que solo se ejecuta una llamada a `createReservation`;
- confirmar que no se genera una segunda reserva `RECHAZADA_CONFLICTO` por
  duplicado;
- confirmar que el boton muestra `Enviando...` y permanece deshabilitado
  durante la operacion;
- confirmar que no se modifican datos historicos ni se eliminan notificaciones.

## Pruebas Fase 17F.3: motivos destacados en Mis reservas

Casos minimos:

- abrir una reserva `RECHAZADA_POR_RESPONSABLE` y confirmar que aparece
  `Motivo del rechazo` con `rejectionReason` si existe;
- abrir una reserva `RECHAZADA_CONFLICTO` y confirmar explicacion clara de
  traslape;
- abrir una reserva `RECHAZADA_REGLA_HORARIO` y confirmar explicacion de regla
  de disponibilidad;
- abrir una reserva `RECHAZADA_MIN_ANTICIPACION` y confirmar explicacion de
  anticipacion minima;
- abrir una reserva `CANCELADA` y confirmar `Motivo de cancelacion`;
- abrir una reserva `ERROR_CALENDAR` y confirmar `Revision tecnica requerida`;
- abrir reservas `CONFIRMADA` y `PENDIENTE_VALIDACION` y confirmar que no
  aparece bloque de motivo;
- confirmar que no se muestran UIDs, `calendarId`, `storagePath`, URLs firmadas,
  JSON crudo, stack traces ni metadata tecnica;
- probar 360, 390 y 414 px para confirmar que textos largos no generan
  overflow horizontal.

## Correccion Fase 17C.2C: QA de disponibilidad sanitizada

Pruebas recomendadas:

- entrar como `docente` activo y abrir `/laboratorios/:labId`;
- confirmar que reservas bloqueantes se muestran como `Ocupado` o
  `Pendiente de validacion`;
- confirmar que no se muestran docente, correo, asignatura, grupo, practica,
  objetivo, protocolo, `calendarId` ni rutas Storage;
- confirmar que un folio aprobado para el laboratorio correcto aparece en el
  rango semanal/mensual correspondiente;
- confirmar que `admin_sistemas` y `responsable_laboratorio` siguen viendo la
  misma ocupacion visual sin depender de lecturas directas de `reservations`;
- confirmar que no se cambiaron reglas Firestore/Storage, Calendar API, Gmail
  API, roles ni estatus.

## Pruebas Fase 17E.1: laboratorios sanitizados

Pruebas recomendadas:

- entrar como docente y abrir `/laboratorios`;
- confirmar que el catalogo carga desde `getPublicLabs`;
- confirmar que no aparecen laboratorios inactivos u ocultos;
- abrir `/laboratorios/:labId` y verificar galeria, resumen y disponibilidad;
- abrir `/reservar/:labSlug` y confirmar que el formulario conserva laboratorio,
  horario, anticipacion minima y protocolo;
- revisar en DevTools que `getPublicLabs` y `getPublicLabDetail` no devuelvan
  `calendarId`, responsables, correos internos, `defaultNotifyEmails`,
  `specialRules` completas, `qrConfig`, `storagePath` ni timestamps
  administrativos;
- confirmar que `getLabAvailability` solo devuelve bloques saneados;
- entrar como Admin/Sistemas y confirmar que `/admin/laboratorios` sigue viendo
  y editando datos completos;
- confirmar que un usuario no admin ya no puede leer directamente `labs/{labId}`
  completo desde Firestore.
