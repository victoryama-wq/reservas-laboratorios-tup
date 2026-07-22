Actualizacion Fase 13.4: instrucciones para Codex

Al modificar el formulario de reserva o createReservation:

- No restaurar el checkbox visual anterior de participantes externos.
- Usar la lista oficial de tipos de practica: Teórica, Simulación, Taller,
  Evaluación práctica, Investigación y Otro.
- Si practiceType === 'Otro', exigir practiceTypeOther con maximo 120
  caracteres.
- Mantener dos preguntas Si/No separadas:
  - risky: material potencialmente riesgoso.
  - externalParticipants: pacientes, usuarios simulados o poblacion externa.
- Calcular protocolo obligatorio con:

```ts
protocolRequired = risky === true || externalParticipants === true;
```

- No escribir reservas directamente desde Angular.
- No cambiar nombres de rutas, roles, colecciones ni estatus oficiales.
- No incluir enlaces publicos de Storage en Google Calendar o Gmail.
- Los correos de Gmail API deben usar plantilla HTML institucional con fallback
  texto plano.
- El logotipo TUP debe enviarse como imagen inline por `cid`, no mediante URL
  publica.
- Usar la paleta institucional `#888887`, `#252a86`, `#271e5d` y `#ffffff`
  para plantillas de correo.
- No adjuntar protocolos en correos.
- Calendar debe incluir solo nombres de archivos de protocolo cuando aplique.
- Gmail debe usar plantilla HTML institucional con fallback de texto plano.

Objetivo

Guiar a Codex durante el desarrollo del sistema para evitar desviaciones de arquitectura, roles, reglas y experiencia de usuario.

Reglas obligatorias para Codex

1. No modificar la definición oficial de roles.
2. No crear roles adicionales.
3. Usar únicamente: docente, responsable_laboratorio, admin_sistemas.
4. No colocar lógica crítica únicamente en Angular.
5. Toda creación, aprobación, rechazo y cancelación debe pasar por Cloud Functions.
6. Usar TypeScript strict.
7. Crear modelos tipados para todas las entidades.
8. Separar frontend, functions y documentación.
9. No hardcodear reglas administrables.
10. No exponer secretos en el repositorio.
11. Mantener README actualizado.
12. Crear pruebas para reglas de negocio.
13. Diseñar mobile-first.
14. No crear app móvil nativa en esta fase.
15. No duplicar código para móvil y escritorio.
16. Crear una sola web app responsive.
17. El flujo docente debe funcionar perfectamente desde celular.
18. El acceso por QR debe conservar la ruta original después del login.
19. No crear estatus de reserva para errores de correo.
20. Registrar errores de correo en notifications.status = FAILED y reservationLogs.action = EMAIL_ERROR.
21. Considerar ERROR_CALENDAR como estatus técnico bloqueante hasta resolución por Admin/Sistemas.
22. Usar Google Workspace mediante Gmail API como proveedor oficial de correos.
23. No usar proveedores externos de correo como SendGrid, Mailgun, Resend u otros sin autorización posterior.
24. Usar escenarios.tup@tecplayacar.edu.mx como cuenta remitente y cuenta operativa para Google Calendar.
25. Preparar la integración recomendada mediante cuenta de servicio con delegación de dominio de Google Workspace.

Roles oficiales
type UserRole = 'docente' | 'responsable_laboratorio' | 'admin_sistemas';

Primera tarea para Codex

Crea la estructura inicial del proyecto para una web app de reservas de laboratorios con Angular standalone, TypeScript strict, Tailwind CSS, Angular Material, Firebase Authentication, Cloud Firestore, Cloud Storage, Cloud Functions v2 y Firebase Hosting.

Incluye:
- apps/web
- functions
- docs
- firestore.rules
- storage.rules
- firestore.indexes.json
- firebase.json
- .firebaserc
- README.md

No implementar todavía lógica avanzada. Solo crear la base del proyecto, configuración inicial y estructura modular.

Segunda tarea para Codex
Implementa los modelos TypeScript compartidos para:
- UserRole
- AppUser
- LabDoc
- WeeklySchedule
- LabSpecialRule
- ReservationDoc
- ReservationStatus
- ProtocolFile
- ReservationLogDoc
- NotificationDoc
- SystemSettingsDoc
- BlockedPeriodDoc
- AuditEventDoc

Ubícalos en una carpeta compartida o duplicada de forma controlada entre frontend y functions.

Tercera tarea para Codex
Implementa Firebase Authentication con Google Sign-In en Angular.

Nota de estabilizacion del login:

- usar persistencia de sesion de navegador (`browserSessionPersistence`) cuando aplique al control de sesion por inactividad;
- esperar la restauracion inicial de Firebase Auth antes de declarar que no existe sesion;
- probar localmente con `http://localhost:4200/login` como host preferente;
- conservar la redireccion por rol y el retorno a `/reservar/:labSlug`;
- el boton `Ingresar con Google` debe mostrar el logotipo multicolor de Google y conservar la tipografia del sistema.

Requisitos:
- Solo permitir acceso con correo institucional.
- Crear o consultar documento users/{uid}.
- Redirigir según rol:
  - docente -> /laboratorios
  - responsable_laboratorio -> /responsable/solicitudes
  - admin_sistemas -> /admin
- Si el usuario venía desde /reservar/:labSlug, después del login debe regresar a esa ruta.
- Si el usuario no tiene perfil activo, mostrar pantalla de acceso pendiente.

Cuarta tarea para Codex

Implementa el módulo de laboratorios.

Los datos iniciales de laboratorios y calendarios deben cargarse como datos semilla iniciales en Firestore, idealmente mediante uno de estos archivos:

- firebase/seed/labs.seed.json
- functions/src/seed/labs.seed.ts

La fuente documental para esos datos semilla es la sección "Datos iniciales de laboratorios y calendarios" en docs/03_DATA_MODEL_SDD.md.

Frontend:
- Lista de laboratorios activos.
- Tarjeta responsive por laboratorio.
- Detalle de laboratorio.
- Vista de reglas básicas.
- Ruta /reservar/:labSlug para QR.

Backend:
- Función adminCreateLab.
- Función adminUpdateLab.

Seguridad:
- Lectura para usuarios autenticados.
- Escritura solo para admin_sistemas.

Quinta tarea para Codex

Implementa el calendario responsive con FullCalendar Angular.

Requisitos:
- En móvil usar vista agenda/lista.
- En escritorio usar vista semanal/mensual.
- Mostrar bloques ocupados.
- Mostrar restricciones del laboratorio.
- Permitir selección de fecha y horario.
- No usar iframe de Google Calendar como calendario principal.

Sexta tarea para Codex

Implementa el formulario de reserva mobile-first.

Requisitos:
- Usar stepper o formulario por secciones.
- Laboratorio precargado si viene desde QR.
- Validaciones visuales en frontend.
- Validación crítica en backend.
- Carga de protocolo si risky=true o externalParticipants=true.
- La carga de protocolo debe subir primero a Cloud Storage con usuario autenticado y enviar metadata a createReservation.
- Resumen antes de enviar.

Séptima tarea para Codex

Implementa createReservation como Cloud Function callable.

Debe:
- Verificar autenticación.
- Consultar usuario.
- Consultar laboratorio.
- Validar dominio institucional.
- Validar horario.
- Validar anticipación mínima.
- Validar reglas especiales.
- Validar traslape.
- Verificar existencia, propiedad y validez de protocolFiles si aplica.
- Si risky=false y externalParticipants=false, confirmar reserva y crear evento
  Calendar.
- Si risky=true o externalParticipants=true, crear reserva
  PENDIENTE_VALIDACION.
- Crear log.
- Enviar notificaciones.
- Enviar correos con Gmail API usando la cuenta operativa escenarios.tup@tecplayacar.edu.mx.
- Usar scopes mínimos: https://www.googleapis.com/auth/gmail.send y https://www.googleapis.com/auth/calendar.
- Si falla correo, no cambiar estatus de reserva; registrar notifications.status = FAILED y reservationLogs.action = EMAIL_ERROR.
- Si falla Calendar en confirmación crítica, registrar ERROR_CALENDAR como estatus bloqueante.

Octava tarea para Codex

Implementa el panel responsable_laboratorio.

Debe:
- Mostrar solicitudes pendientes de labsAssigned.
- Funcionar en celular con tarjetas.
- Funcionar en escritorio con tabla y filtros.
- Permitir ver protocolo.
- Permitir aprobar.
- Permitir rechazar con motivo.
- Invocar approveReservation y rejectReservation.

Novena tarea para Codex

Implementa el panel admin_sistemas.

Debe permitir:
- Gestionar laboratorios.
- Gestionar usuarios.
- Asignar responsables.
- Configurar horarios.
- Configurar reglas especiales.
- Ver todas las reservas.
- Consultar bitácora.
- Consultar reportes.

## Patrón de reportes agregados

Los reportes operativos deben pasar por callables protegidas y devolver solo
agregados. No deben exponer documentos completos ni permitir que Angular lea
reservas globales directamente. Toda nueva métrica debe declarar estatus
incluidos, zona horaria, alcance por rol y alternativa accesible a la gráfica.

La implementación base es `getLabUsageReport` + `/reportes`, con Chart.js local
y lazy-loaded. No agregar nuevas visualizaciones mediante CDN.

Priorizar experiencia escritorio, pero mantener diseño responsive.

## Patron de idempotencia para Google Calendar

Toda creacion de evento de reserva debe pasar por
`GoogleCalendarService.ensureReservationEvent`. No llamar `events.insert`
directamente desde Functions de negocio. Mantener el ID determinista, las
propiedades privadas, la validacion de identidad y la reconciliacion posterior
a `409` o fallos ambiguos. La cancelacion debe resolver el mismo evento antes de
eliminarlo y nunca elegir arbitrariamente entre multiples coincidencias.

Antes de asegurar el evento se deben completar las validaciones internas, las
reglas horarias y bloqueos, los conflictos Firestore y la disponibilidad
externa. Todo evento Calendar no cancelado y traslapado bloquea, incluso si esta
marcado como `Disponible` o usa `transparency = transparent`. No cambiar esta
politica sin autorizacion institucional expresa.
