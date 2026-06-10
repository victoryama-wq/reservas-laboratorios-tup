Tienes razón. Debí entregarlo en español desde el inicio. A partir de ahora, todo lo que te entregue irá en español, incluyendo AGENTS.md, SDD, prompts para Codex y documentación técnica. Solo mantendré en inglés lo estrictamente necesario: nombres de tecnologías, rutas, funciones, colecciones o código.

Aquí tienes el AGENTS.md corregido completamente en español para reemplazar el anterior:

# AGENTS.md

## Nombre del proyecto

Sistema Web de Reservas de Laboratorios

---

## Instrucción principal para Codex

Antes de escribir, editar, eliminar, mover o generar cualquier código, debes leer completamente este archivo y después leer todos los documentos SDD ubicados en la carpeta `/docs`.

No debes comenzar a programar hasta comprender:

- la arquitectura del proyecto;
- los roles oficiales;
- el modelo de datos;
- las reglas de negocio;
- los flujos de reserva;
- las reglas de seguridad;
- las integraciones;
- los requisitos de interfaz responsive;
- el enfoque mobile-first;
- el orden de implementación.

Después de leer la documentación, siempre debes entregar un breve plan técnico antes de modificar código.

---

## Fuente oficial de documentación

La documentación oficial del proyecto estará ubicada en:

```text
/docs
  00_PROJECT_OVERVIEW.md
  01_SYSTEM_ARCHITECTURE_SDD.md
  02_ROLES_AND_PERMISSIONS_SDD.md
  03_DATA_MODEL_SDD.md
  04_BUSINESS_RULES_SDD.md
  05_RESERVATION_WORKFLOWS_SDD.md
  06_BACKEND_FUNCTIONS_SDD.md
  07_FRONTEND_UI_UX_SDD.md
  08_SECURITY_RULES_SDD.md
  09_INTEGRATIONS_SDD.md
  10_TESTING_AND_ACCEPTANCE_SDD.md
  11_CODEX_IMPLEMENTATION_GUIDE.md
  12_RESPONSIVE_AND_PWA_SDD.md

Si existe conflicto entre una suposición técnica y los documentos SDD, debes seguir los documentos SDD.

Si existe conflicto entre este archivo AGENTS.md y una instrucción posterior del propietario del proyecto, debes pedir aclaración antes de realizar cambios estructurales.

Objetivo del proyecto

Desarrollar una web app institucional, moderna, segura, responsive y mobile-first para gestionar reservas de laboratorios académicos.

El sistema sustituirá el flujo actual basado en:

Google Sites;
Google Forms;
Google Sheets;
Google Calendar embebido;
Google Apps Script.

El nuevo sistema debe utilizar Firebase como plataforma principal y conservar la lógica funcional del proceso actual de reserva.

Tecnologías obligatorias

Usa las siguientes tecnologías, salvo que el propietario del proyecto indique explícitamente un cambio:

Frontend:
- Angular standalone
- TypeScript strict
- Tailwind CSS
- Angular Material
- FullCalendar Angular

Backend:
- Firebase Cloud Functions v2
- TypeScript
- Firebase Admin SDK

Base de datos:
- Cloud Firestore

Archivos:
- Cloud Storage for Firebase

Autenticación:
- Firebase Authentication
- Google Sign-In institucional

Alojamiento:
- Firebase Hosting o Firebase App Hosting

Integraciones:
- Google Calendar API
- Gmail API mediante Google Workspace

Desarrollo:
- GitHub
- Codex
Datos institucionales base

Usa como valores iniciales:

- institutionName: Tecnológico universitario Playacar
- institutionalDomain: tecplayacar.edu.mx
- defaultNotifyEmails: []
- adminEmails: []

Colores institucionales:

- Azul marino: #271e5d
- Azul: #252a86
- Gris: #888887
- Blanco: #ffffff

El logotipo institucional se encuentra en:

/media/image/logo/logo_tup.png

Utiliza los colores a criterio para combinarlos en una vista moderna, actualizada e institucional.
Reglas de arquitectura

El sistema debe cumplir las siguientes reglas:

Firestore será la fuente de verdad interna.
Google Calendar será un calendario institucional sincronizado, no la fuente principal de verdad.
El frontend no debe realizar operaciones críticas directamente.
La creación de reservas debe pasar por Cloud Functions.
La aprobación de reservas debe pasar por Cloud Functions.
El rechazo de reservas debe pasar por Cloud Functions.
La cancelación de reservas debe pasar por Cloud Functions.
Toda validación crítica debe ejecutarse en backend.
Las validaciones del frontend solo son apoyo para la experiencia de usuario.
La seguridad debe aplicarse mediante validaciones backend y Firebase Security Rules.
No se deben subir secretos, API keys privadas, credenciales ni archivos de cuenta de servicio al repositorio.
Roles oficiales

Solo existen tres roles válidos:

type UserRole = 'docente' | 'responsable_laboratorio' | 'admin_sistemas';

No debes crear roles adicionales como:

admin;
sistemas;
superadmin;
coordinador;
encargado;
teacher;
lab_manager.

Si se requiere un nuevo permiso, debe resolverse dentro del modelo de estos tres roles.

Definición de roles
docente

Usuario que solicita reservas de laboratorio.

Puede:

iniciar sesión;
ver laboratorios activos;
consultar disponibilidad;
crear solicitudes de reserva;
cargar protocolo cuando aplique;
ver sus propias reservas;
consultar el estatus de sus solicitudes;
cancelar sus propias reservas solo si la regla institucional lo permite.

No puede:

aprobar reservas;
rechazar reservas;
gestionar laboratorios;
gestionar usuarios;
gestionar reglas;
ver reportes globales.
responsable_laboratorio

Usuario responsable de uno o varios laboratorios asignados.

Puede:

ver reservas de los laboratorios asignados;
revisar protocolos de sus laboratorios;
aprobar solicitudes pendientes de sus laboratorios;
rechazar solicitudes pendientes de sus laboratorios;
escribir motivos de rechazo;
ver historial de sus laboratorios;
crear sus propias reservas como usuario institucional.

No puede:

aprobar reservas de laboratorios no asignados;
gestionar reglas globales del sistema;
gestionar usuarios;
modificar configuración global de laboratorios;
ver reportes globales, salvo que posteriormente se habilite una vista limitada.
admin_sistemas

Administrador general de la web app.

Este rol corresponde al área de sistemas. También puede actuar como responsable de laboratorio.

Puede:

tener acceso total al sistema;
gestionar laboratorios;
gestionar usuarios;
asignar responsables de laboratorio;
configurar IDs de Google Calendar;
configurar horarios;
configurar reglas especiales;
configurar horas mínimas de anticipación;
ver todas las reservas;
aprobar o rechazar cualquier solicitud pendiente;
cambiar estatus de reservas en casos administrativos justificados;
revisar bitácoras;
ver reportes;
atender errores técnicos;
crear sus propias reservas.
Requisito mobile-first

El proyecto debe desarrollarse como una sola web app responsive.

No debes crear aplicaciones separadas para móvil y escritorio.

No debes crear una app nativa Android o iOS en la fase inicial.

El flujo del docente debe optimizarse para celular, porque muchos docentes accederán al sistema escaneando un código QR desde su teléfono.

Comportamiento responsive obligatorio:

Celular:
- diseño basado en tarjetas;
- formularios por pasos;
- botones grandes;
- campos legibles;
- calendario en vista agenda/lista;
- evitar tablas anchas.

Tablet:
- diseños compactos;
- combinación de tarjetas y tablas;
- calendario semanal compacto cuando sea usable.

Escritorio:
- vistas completas de calendario;
- tablas;
- filtros;
- dashboards;
- paneles administrativos.
Requisito de acceso por QR

Cada laboratorio debe tener una ruta directa:

/reservar/:labSlug

Comportamiento esperado:

El docente escanea el QR
  -> abre /reservar/:labSlug
  -> si no ha iniciado sesión, se redirige a /login
  -> después del login, regresa a /reservar/:labSlug
  -> el formulario de reserva carga con el laboratorio preseleccionado

La ruta original del QR debe conservarse durante la autenticación.

Requisito de calendario

No uses Google Calendar embebido como interfaz principal del calendario.

Usa FullCalendar Angular.

Comportamiento en celular:

Usar vistas tipo lista, agenda o día.
Evitar vistas mensuales saturadas en teléfonos.
Mostrar claramente bloques ocupados, rangos disponibles y mensajes de restricción.

Comportamiento en escritorio:

Usar vistas semanales y mensuales.
Mostrar bloques ocupados, filtros y controles de navegación.

La integración con Google Calendar debe realizarse mediante backend o lógica controlada, no mediante iframes como sistema principal.

Estatus oficiales de reserva

Usa el siguiente modelo oficial:

type ReservationStatus =
  | 'RECIBIDA'
  | 'PENDIENTE_VALIDACION'
  | 'CONFIRMADA'
  | 'CONFIRMADA_TRAS_VALIDACION'
  | 'RECHAZADA_CONFLICTO'
  | 'RECHAZADA_REGLA_HORARIO'
  | 'RECHAZADA_MIN_ANTICIPACION'
  | 'RECHAZADA_POR_RESPONSABLE'
  | 'CANCELADA'
  | 'ERROR_CALENDAR';

No inventes nuevos nombres de estatus sin aprobación explícita.

Reglas de negocio que nunca deben omitirse

El backend debe validar:

Usuario autenticado.
Perfil de usuario activo.
Dominio institucional del correo.
Rol válido.
Laboratorio activo.
Fecha y hora válidas.
Hora final mayor que hora inicial.
Horario semanal del laboratorio.
Horas mínimas de anticipación.
Reglas especiales por periodo o cuatrimestre.
Conflictos de reserva.
Flujo de práctica riesgosa.
Archivos de protocolo cuando sean obligatorios.
Permisos del responsable al aprobar o rechazar.
Disponibilidad en Google Calendar antes de la confirmación final.
Vigencia de la reserva al momento de aprobar.
Consistencia entre Firestore y Google Calendar.
Regla de práctica riesgosa

Si una reserva tiene:

risky === true

entonces no debe confirmarse automáticamente.

Debe crearse con estatus:

PENDIENTE_VALIDACION

Un usuario con rol responsable_laboratorio asignado al laboratorio o un usuario admin_sistemas debe aprobarla o rechazarla.

Si el laboratorio requiere protocolo para prácticas riesgosas, el sistema debe exigir al menos un archivo de protocolo válido.

Regla de conflicto de horario

El sistema debe impedir reservas traslapadas para el mismo laboratorio.

Los siguientes estatus bloquean el rango solicitado:

PENDIENTE_VALIDACION
CONFIRMADA
CONFIRMADA_TRAS_VALIDACION
ERROR_CALENDAR

Los siguientes estatus no bloquean el rango solicitado:

RECHAZADA_CONFLICTO
RECHAZADA_REGLA_HORARIO
RECHAZADA_MIN_ANTICIPACION
RECHAZADA_POR_RESPONSABLE
CANCELADA

Los errores de correo no cambian el estatus de la reserva ni liberan el horario. Deben registrarse en notifications.status = FAILED y reservationLogs.action = EMAIL_ERROR.

La detección de conflictos debe ejecutarse en backend.

Modelo de datos en Firestore

Usa los modelos definidos en:

/docs/03_DATA_MODEL_SDD.md

Colecciones principales:

users
labs
reservations
reservationLogs
notifications
systemSettings
blockedPeriods
auditEvents

No cambies los nombres de las colecciones sin aprobación explícita.

Cloud Functions principales

Funciones centrales:

createReservation
approveReservation
rejectReservation
cancelReservation
getLabAvailability
syncCalendarEvent
sendReservationNotification
adminCreateLab
adminUpdateLab
adminAssignResponsible
adminUpdateUserRole
adminCreateSpecialRule
adminUpdateSpecialRule
generateLabQrPayload

Al implementar estas funciones debes:

validar autenticación;
validar rol;
validar usuario activo;
validar datos de entrada;
leer configuración desde Firestore;
escribir bitácoras;
devolver respuestas tipadas;
manejar errores de forma explícita.
Rutas del frontend

Usa la siguiente estructura de rutas:

/login
/
/laboratorios
/laboratorios/:labId
/reservar/:labSlug
/mis-reservas
/responsable/solicitudes
/responsable/historial
/responsable/reserva/:reservationId
/admin/dashboard
/admin/laboratorios
/admin/usuarios
/admin/reglas
/admin/reportes
/admin/bitacora

No cambies estas rutas sin aprobación explícita.

Requisitos UI/UX

La interfaz debe ser institucional, moderna, limpia y responsive.

Continuidad visual obligatoria:

Cada modulo nuevo, pantalla nueva o refactor visual debe seguir la misma linea
de diseño documentada en:

```text
docs/13_VISUAL_REDESIGN_REPORT.md
```

Antes de implementar nuevas interfaces se deben revisar y reutilizar:

- `apps/web/src/styles.scss`;
- componentes compartidos en `apps/web/src/app/shared/components`;
- componentes de dominio ya existentes en `features/*/components`;
- reglas visuales de `docs/07_FRONTEND_UI_UX_SDD.md`;
- reglas responsive de `docs/12_RESPONSIVE_AND_PWA_SDD.md`.

La interfaz operativa debe mantener:

- tipografia global `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
- paleta operativa morada sobre fondos claros;
- cards blancas con bordes suaves, `rounded-2xl` y sombra ligera;
- botones primarios institucionales;
- chips compactos por estado;
- Material Icons completos, centrados y accesibles;
- Angular Material para comportamiento y accesibilidad;
- Tailwind CSS y clases globales para layout, spacing, color y responsive;
- textos visibles en español.

No deben introducirse fuentes serif, paletas alternas, estilos nativos del
navegador, cards o formularios que rompan la consistencia visual, salvo
autorizacion explicita del propietario del proyecto.

Usa:

Angular Material para componentes;
Tailwind CSS para layout, espaciado, responsividad y refinamiento visual;
tarjetas para móvil;
tablas para vistas administrativas de escritorio;
formularios por pasos o por secciones;
mensajes emergentes o cuadros de diálogo para estados;
pantallas de confirmación antes del envío final.

Evita:

pantallas saturadas;
tablas anchas en móvil;
Google Forms embebido;
Google Calendar embebido como calendario principal;
mensajes de estatus confusos;
errores de validación ocultos.
Reglas de seguridad

Sigue el modelo de seguridad definido en:

/docs/08_SECURITY_RULES_SDD.md

Principios generales:

Denegar por defecto.
El usuario puede leer su propio perfil.
admin_sistemas puede gestionar usuarios.
Usuarios autenticados pueden leer laboratorios activos.
Solo admin_sistemas puede editar configuración de laboratorios.
Docentes pueden leer sus propias reservas.
Responsables pueden leer reservas de laboratorios asignados.
admin_sistemas puede leer todas las reservas.
Los protocolos nunca deben ser públicos.
Las bitácoras deben escribirse solo desde backend.
Reglas de Storage

Los archivos de protocolo deben almacenarse de forma segura.

Requisitos:

validar tipo de archivo;
validar tamaño máximo;
restringir lectura;
restringir escritura;
asociar archivos con reservas;
no exponer archivos públicamente sin control backend.

Secuencia técnica oficial para protocolos:

1. El frontend sube el archivo a Cloud Storage con usuario autenticado.
2. Storage valida tipo, tamaño y permisos.
3. El frontend envía metadata a createReservation.
4. createReservation verifica existencia, propiedad y validez del archivo.
5. createReservation vincula protocolFiles a la reserva.
6. Una función programada futura podrá limpiar archivos huérfanos.
Reglas de notificaciones

El sistema debe notificar correctamente en los siguientes casos:

RESERVATION_CONFIRMED
RESERVATION_PENDING_APPROVAL
RESERVATION_APPROVED
RESERVATION_REJECTED
RESERVATION_CANCELLED
TECHNICAL_ERROR
CALENDAR_ERROR
EMAIL_ERROR

Todas las notificaciones deben registrarse en Firestore dentro de la colección notifications.

Proveedor oficial de correo:

- El proveedor de correos para notificaciones será Google Workspace mediante Gmail API.
- La cuenta remitente oficial será escenarios.tup@tecplayacar.edu.mx.
- No se utilizarán proveedores externos como SendGrid, Mailgun, Resend u otros, salvo autorización posterior.
- Las Cloud Functions deberán enviar correos usando Gmail API con la cuenta operativa escenarios.tup@tecplayacar.edu.mx.
- La integración recomendada será mediante una cuenta de servicio con delegación de dominio de Google Workspace, autorizada para actuar como escenarios.tup@tecplayacar.edu.mx.
- Los scopes mínimos requeridos serán:
  - https://www.googleapis.com/auth/gmail.send
  - https://www.googleapis.com/auth/calendar
- La cuenta escenarios.tup@tecplayacar.edu.mx también será la cuenta operativa para escribir eventos en Google Calendar, siempre que los calendarios estén compartidos con permisos de escritura.

Integración con Google Calendar

Cuando una reserva sea confirmada, debe crearse un evento en Google Calendar.

El evento debe incluir:

folio;
laboratorio;
nombre del docente;
correo del docente;
asignatura;
grupo;
nombre de la práctica;
objetivo;
material requerido;
tipo de práctica;
indicador de riesgo;
indicador de participantes externos;
nota de validación si aplica.

El ID del evento debe guardarse en:

reservations/{reservationId}.calendarEventId

Si falla la creación del evento en Google Calendar, el sistema debe registrar el error y evitar fallas silenciosas.

Estándares de código

Usa:

TypeScript strict mode;
interfaces tipadas;
estructura modular;
separación clara de servicios;
manejo explícito de errores;
configuración por ambiente;
sin secretos hardcodeados;
validadores reutilizables;
nombres claros en el código;
textos visibles para usuarios en español.

Nombres recomendados:

Componentes: PascalCase
Servicios: camelCase + Service
Funciones: camelCase
Interfaces: PascalCase
Colecciones: lowerCamelCase
Rutas: minúsculas
Reglas de idioma

Toda respuesta de Codex al propietario del proyecto debe estar en español.

Toda documentación general debe estar en español.

Los textos visibles para usuarios deben estar en español.

El código puede usar nombres técnicos en inglés cuando sea conveniente para mantener buenas prácticas de desarrollo, pero las explicaciones, planes, comentarios importantes y documentación deben estar en español.

Requisitos de pruebas

Antes de considerar completo un módulo, agrega o actualiza pruebas cuando aplique.

Como mínimo, probar:

validación de horario;
validación de anticipación mínima;
validación de horario semanal;
validación de reglas especiales;
detección de traslapes;
flujo de práctica riesgosa;
requisito de protocolo;
autorización por rol;
transiciones de estatus;
redirección desde QR;
flujos críticos en móvil.
Comportamiento requerido de Codex antes de cada tarea

Antes de implementar una tarea, Codex debe responder en español con:

1. Qué entendí.
2. Archivos que revisaré.
3. Archivos que crearé o modificaré.
4. Pasos de implementación.
5. Riesgos o supuestos.

Después debe implementar únicamente el alcance solicitado.

Si el propietario del proyecto pide implementar de inmediato, aun así se debe respetar el alcance solicitado y evitar cambios innecesarios.

Acciones prohibidas

No debes:

crear roles adicionales;
saltarte Cloud Functions para escrituras críticas;
permitir aprobación o rechazo directo desde frontend;
guardar secretos en el repositorio;
hardcodear reglas administrables;
usar Google Forms como formulario final;
usar Google Calendar embebido como calendario principal;
crear apps móviles nativas en la fase inicial;
duplicar código para móvil y escritorio;
omitir bitácoras en cambios de estatus;
omitir validaciones backend;
exponer protocolos públicamente;
renombrar colecciones principales sin aprobación;
inventar nuevos estatus de reserva sin aprobación.
Orden recomendado de implementación

Sigue este orden, salvo que el propietario del proyecto cambie la prioridad:

1. Crear estructura del repositorio.
2. Configurar Angular + Tailwind + Angular Material.
3. Configurar Firebase.
4. Definir modelos TypeScript compartidos.
5. Implementar autenticación.
6. Implementar perfil de usuario y carga de rol.
7. Implementar catálogo responsive de laboratorios.
8. Implementar ruta QR /reservar/:labSlug.
9. Implementar calendario responsive con FullCalendar.
10. Implementar formulario de reserva mobile-first.
11. Implementar validadores de reglas de negocio.
12. Implementar Cloud Function createReservation.
13. Implementar escrituras de reservas en Firestore.
14. Implementar carga de protocolo en Storage.
15. Implementar integración con Google Calendar.
16. Implementar notificaciones por correo.
17. Implementar panel responsable_laboratorio.
18. Implementar approveReservation y rejectReservation.
19. Implementar panel admin_sistemas.
20. Implementar gestión de laboratorios, reglas y usuarios.
21. Implementar bitácoras y reportes.
22. Implementar pruebas.
23. Preparar despliegue en Firebase.
Primera tarea esperada de Codex

Cuando Codex abra este proyecto por primera vez, no debe programar inmediatamente.

Primero debe leer este archivo y todos los documentos de /docs.

Después debe responder en español con:

1. Resumen técnico del proyecto.
2. Módulos principales que se construirán.
3. Orden recomendado de implementación.
4. Archivos y carpetas iniciales que se crearán.
5. Riesgos, datos faltantes o supuestos.

Solo después de eso debe comenzar la programación.

Recordatorio final

Este proyecto es un sistema institucional para reservas de laboratorios.

La confiabilidad, trazabilidad, seguridad por roles, usabilidad móvil y validación backend son más importantes que avanzar rápido con prototipos visuales.

Construye con cuidado, en pasos pequeños, verificables y documentados.
