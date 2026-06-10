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
