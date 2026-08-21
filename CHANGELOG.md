# Changelog

Los cambios relevantes del proyecto se documentan en este archivo.

## [Unreleased]

### Reservas

- Solicitudes de hasta 20 fechas únicas dentro de 90 días, con una reserva y
  resultado independiente por fecha.
- Resultados parciales y correos consolidados para creación, aprobación y
  rechazo de grupos.
- Formulario simplificado para responsables en laboratorios asignados.
- Número de práctica opcional y docente institucional invitado.

### Evidencias

- Carga privada posterior al inicio para reservas confirmadas.
- Compresión en navegador, máximo 10 imágenes y 5 MB por archivo.
- Acceso temporal exclusivo para propietario, responsable asignado y Admin.
- Notificación operativa sin adjuntos ni enlaces públicos.
- Limpieza automática de archivos a los 90 días conservando trazabilidad.

### Interfaz y textos

- Revisión ortográfica integral de textos visibles en español: acentos, signos
  de interrogación, puntuación y etiquetas de acciones, estados y ayudas.
- Conservación literal de rutas, roles, estatus, nombres de controles y demás
  identificadores técnicos para no alterar contratos funcionales.

## [1.0.0] - 2026-07-28

Esta versión corresponde al MVP institucional del Sistema Web de Reservas de
Laboratorios y consolida el cierre de las fases 17F a 18D. El código productivo
ya había sido desplegado y validado antes de esta liberación documental; las
fases 18D.1, 18D.2 y 18D.3 no ejecutaron deploy de aplicación, Functions ni
reglas. Los riesgos operativos aceptados permanecen documentados en el runbook
y en el checklist de liberación.

### Autenticacion y roles

- Google Sign-In restringido al dominio institucional.
- Perfiles activos con roles `docente`, `responsable_laboratorio` y
  `admin_sistemas`.
- Prealta y reclamacion controlada de responsables y administradores.
- Sesion por navegador, inactividad y carga de perfil sin fallback de rol.

### Laboratorios

- Catalogo responsive, detalle, disponibilidad y acceso QR.
- Administracion de datos, horarios, responsables, Calendar ID, portada y
  galeria privada.
- Reglas especiales y bloqueos extraordinarios.

### Reservas

- Formulario por pasos con validaciones de experiencia de usuario.
- Creacion, aprobacion, rechazo y cancelacion exclusivamente por Functions.
- Conflictos Firestore y Calendar, anticipacion, horario y reglas especiales.
- Mis reservas con vistas Recientes, Historico y Todas.

### Protocolos

- Carga privada a Storage con validacion de tipo, tamano y propiedad.
- Acceso temporal autorizado sin URLs publicas.
- Limpieza administrativa y programada de archivos huerfanos.

### Google Calendar

- Validacion de ocupacion externa y eventos de reservas confirmadas.
- Idempotencia determinista, reconciliacion y cancelacion con invitados.
- Estado bloqueante `ERROR_CALENDAR` ante fallos tecnicos.

### Gmail

- Notificaciones institucionales HTML mediante Gmail API.
- Plantillas para confirmacion, pendiente, aprobacion, rechazo, cancelacion y
  errores.
- Los errores de correo no cambian el estado de la reserva.

### Responsable

- Solicitudes pendientes, historial, protocolo privado, bitacora y decision en
  modal.
- Alcance por `labsAssigned`; Admin puede revisar todos los laboratorios.

### Admin/Sistemas

- Usuarios y prealtas, laboratorios, reglas, bloqueos y bitacora de auditoria.
- Validacion de calendarios, asignacion sincronizada de responsables y galeria.
- Retiro del dashboard redundante; `/admin` usa Laboratorios admin.

### Reportes

- Reporte agregado por periodo y laboratorio para responsables y Admin.
- Conteos y horas de reservas confirmadas, sin datos personales innecesarios.

### Seguridad

- Firestore y Storage con denegacion por defecto.
- Escrituras criticas desde Admin SDK y validacion backend por rol/alcance.
- Protocolos y rutas internas no publicos.
- Secrets de Workspace administrados con Secret Manager.

### Responsive

- Sistema visual institucional mobile-first con Angular Material, Tailwind e
  Inter.
- Navegacion movil por menu, cards tactiles, calendarios responsive y dialogs.
- QA autenticado en movil, tablet y escritorio.

### Operaciones

- Inventario productivo de Functions, Hosting, reglas y scheduler.
- Runbook de incidentes, despliegue, smoke, rollback y revisiones periodicas.
- Checklist de liberacion con evidencia y estados estrictos.
- Delegacion Workspace verificada manualmente con scopes exclusivos de Calendar
  y Gmail Send para la cuenta operativa institucional.
- Canal de correo, notificaciones de Error Reporting y uptime check publico de
  Hosting configurados en `reservas-laboratorios-tup`.
- Alerta de disponibilidad tras dos comprobaciones fallidas consecutivas de
  cinco minutos.
- Presupuesto mensual de 500 MXN limitado al proyecto, con umbrales 50 %, 80 %,
  100 % real y 100 % previsto, sin notificaciones programaticas.
- Revision manual mensual de Error Reporting, Functions, Scheduler,
  notificaciones `FAILED` y facturacion como control compensatorio.

### QA

- Suites automatizadas de Functions y Angular.
- Lint y builds productivos.
- Smokes reales de autenticacion, reservas, protocolos, Calendar, Gmail,
  Responsable y cancelacion.

### Limitaciones conocidas

- Firestore no tiene PITR, backups programados ni exportaciones automaticas;
  RPO y RTO no estan garantizados para el MVP.
- Storage conserva soft delete de 7 dias, sin versionado, retention policy ni
  lifecycle; la recuperacion posterior a ese plazo no esta garantizada.
- La cuenta de ejecucion conserva `roles/editor`; el endurecimiento IAM queda
  como actividad posterior al MVP.
- Existe un presupuesto heredado de 300 MXN para el mismo proyecto, detectado y
  no modificado durante la Fase 18D.2.
- CI remota no esta configurada.
