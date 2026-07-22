# Changelog

Los cambios relevantes del proyecto se documentan en este archivo.

## [1.0.0] - 2026-07-22

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

### QA

- Suites automatizadas de Functions y Angular.
- Lint y builds productivos.
- Smokes reales de autenticacion, reservas, protocolos, Calendar, Gmail,
  Responsable y cancelacion.

### Limitaciones conocidas

- La evidencia directa de IAM, alertas, indices remotos, backups/PITR,
  proteccion de Storage y scopes exactos de Workspace requiere reautenticacion
  o revision manual en consola.
- CI remota no esta configurada.
- El tag/release `v1.0.0` debe esperar el cierre de los controles operativos
  anteriores.
