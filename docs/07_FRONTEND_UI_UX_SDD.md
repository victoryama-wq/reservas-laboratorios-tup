Actualizacion Fase 13.4: formulario de reserva

El paso "Material y tipo de practica" debe usar esta lista oficial:

- Teórica
- Simulación
- Taller
- Evaluación práctica
- Investigación
- Otro

Si el usuario selecciona "Otro", debe mostrarse el campo "Especifique el tipo
de práctica". Ese campo es obligatorio solo en ese caso y debe limitarse a 120
caracteres.

El checkbox visual anterior "Participaran personas externas a la institucion"
queda eliminado. En su lugar, el paso "Condiciones de seguridad y protocolo"
debe mostrar dos preguntas Si/No:

1. ¿Se utilizarán sustancias, muestras biológicas o material potencialmente
   riesgoso?
   - Campo asociado: risky
2. ¿Participan pacientes, usuarios simulados o población externa?
   - Campo asociado: externalParticipants

La carga de protocolo debe mostrarse y marcarse como obligatoria cuando:

protocolRequired = risky === true || externalParticipants === true

Si ambas respuestas son No, la carga de protocolo debe ocultarse y limpiarse el
archivo seleccionado si existia. El resumen final debe mostrar tipo de
practica, especificacion de Otro si aplica, material riesgoso Si/No, pacientes
o poblacion externa Si/No, protocolo requerido Si/No y protocolo adjunto Si/No
o nombre del archivo.

Principio general

La interfaz debe ser mobile-first, responsive y usable desde celular, tablet y computadora.

La prioridad del flujo docente será celular, porque la mayoría de los docentes podrá ingresar escaneando un QR o abriendo un enlace directo.

Librerías UI

Angular Material:
- botones;
- inputs;
- dialogs;
- stepper;
- cards;
- datepicker;
- toolbar;
- side navigation;
- tables;
- snackbars.

Tailwind CSS:
- layout;
- spacing;
- grid;
- colores institucionales;
- responsividad;
- diseño visual moderno.

Identidad visual institucional:
- Azul marino: #271e5d
- Azul: #252a86
- Gris: #888887
- Blanco: #ffffff
- Logotipo: /media/image/logo/logo_tup.png

Los colores deben combinarse con criterio para una interfaz moderna, actualizada e institucional.

Nota de identidad visual:
Los colores azul, gris y blanco corresponden a la identidad institucional base.
La Web App usa como identidad operativa moderna una paleta basada en morado
profundo, documentada en `docs/13_VISUAL_REDESIGN_REPORT.md`. No deben
crearse estilos nuevos fuera de ese sistema visual operativo sin aprobacion del
propietario del proyecto.

FullCalendar Angular:
- calendario semanal/mensual en escritorio;
- vista agenda/lista en móvil;
- bloques ocupados;
- selección visual de rangos.

Rutas principales

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

Pantalla: Login

Actualizacion de estabilizacion del login local:

- el boton principal debe decir `Ingresar con Google`;
- el boton debe mostrar el logotipo multicolor de Google, no una letra generica;
- la pantalla debe esperar la restauracion inicial de Firebase Auth antes de decidir que no hay sesion;
- si ya existe sesion valida y perfil activo, debe redirigir segun rol;
- para pruebas locales debe preferirse `http://localhost:4200/login` sobre `http://127.0.0.1:4200/login`, salvo que `127.0.0.1` este autorizado explicitamente en Firebase Authentication.

Elementos
Logo institucional.
Nombre del sistema.
Botón “Ingresar con correo institucional”.
Mensaje de restricción de dominio.
Diseño limpio y centrado.

Comportamiento
Si el usuario viene desde un QR, después del login debe regresar automáticamente al laboratorio solicitado.

Pantalla: Inicio

Elementos
Título del sistema.
Logo institucional
Breve descripción.
Botón “Reservar laboratorio”.
Botón “Mis reservas”.
Acceso a panel si el usuario es responsable o admin_sistemas.

Pantalla: Catálogo de laboratorios

En móvil
Usar tarjetas verticales.

Cada tarjeta debe mostrar:

imagen;
nombre;
descripción breve;
horario general;
botón “Reservar”;
botón “Ver disponibilidad”.


En escritorio
Usar grid de tarjetas con filtros:

búsqueda por nombre;
filtro por área;
filtro por disponibilidad;
filtro por laboratorio activo.

Pantalla: Detalle de laboratorio

Elementos

Nombre del laboratorio.
Imagen.
Descripción.
Reglas generales.
Responsable.
Calendario responsive.
Botón “Solicitar reserva”.

Resumen lateral

El resumen lateral del laboratorio debe ser informativo y no duplicar chips
cuando la regla ya esta explicada en texto.

Debe mostrar:

horario general;
anticipacion minima;
validaciones requeridas como texto;
boton principal para reservar.

No debe repetir como chips laterales:

Validacion si hay riesgo;
Protocolo si hay riesgo.

Vista móvil

Mostrar primero la información esencial.
Calendario en formato lista/agenda.
Botón fijo inferior “Solicitar reserva”.

Vista escritorio

Layout de dos columnas:
izquierda: datos del laboratorio;
derecha: calendario.

Pantalla: Calendario de disponibilidad
En móvil

Usar vista:

agendaDay
listWeek
o equivalente en FullCalendar.

Debe mostrar:

día;
bloques ocupados;
horarios disponibles;
mensajes de restricción;
opción de seleccionar horario.

No usar calendario mensual saturado en móvil.

En escritorio

Usar vista:

timeGridWeek
dayGridMonth

Debe mostrar:

semana completa;
bloques ocupados;
filtros;
navegación por fechas

Pantalla: Formulario de reserva
El formulario debe ser por pasos, especialmente en móvil.

Paso 1. Laboratorio y horario

laboratorio precargado si viene de QR;
fecha;
hora de inicio;
hora de finalización;
mensajes preventivos de disponibilidad.

Paso 2. Datos académicos

asignatura;
grupo;
nombre de práctica;
objetivo.

Paso 3. Material y tipo de práctica

material requerido;
tipo de práctica;
participantes externos.

Paso 4. Riesgo y protocolo

pregunta sobre riesgo;
carga de protocolo si aplica;
instrucciones claras.

Secuencia técnica del protocolo desde frontend:

1. Subir el archivo a Cloud Storage con usuario autenticado.
2. Recibir o conservar la metadata del archivo.
3. Enviar metadata a createReservation.
4. Mostrar error claro si Storage rechaza tipo, tamaño o permisos.
5. Permitir que createReservation vincule protocolFiles a la reserva tras verificar existencia, propiedad y validez.

Paso 5. Resumen y envío

Mostrar:

laboratorio;
fecha;
horario;
asignatura;
grupo;
tipo de práctica;
riesgo;
protocolo;
botón confirmar.

Pantalla: Mis reservas

Móvil

Vista en tarjetas.

Cada tarjeta debe mostrar:

folio;
laboratorio;
fecha;
horario;
estatus;
botón ver detalle.

Escritorio

Tabla con filtros:

folio;
laboratorio;
fecha;
estatus;
acción.

Actualizacion Fase 14: Mis reservas y bitacora basica docente

La ruta `/mis-reservas` debe mostrar solo reservas personales del usuario
autenticado, filtradas por `teacherUid === currentUser.uid`. Si el usuario tiene
rol `responsable_laboratorio` o `admin_sistemas`, esta vista sigue mostrando
solo sus reservas personales; las vistas globales o por laboratorio pertenecen
al modulo de Responsable o Admin/Sistemas.

Las tarjetas de `Mis reservas` deben mostrar folio, laboratorio, fecha, horario,
estatus, tipo de practica, protocolo requerido, revision requerida y boton
`Ver detalle`.

La ruta `/mis-reservas/:reservationId` debe mostrar el detalle personal de una
reserva solo si pertenece al usuario autenticado. Debe incluir folio,
laboratorio, fecha, horario, estatus, asignatura, grupo, practica, objetivo,
material requerido, tipo de practica, especificacion de `Otro` cuando aplique,
material riesgoso Si/No, pacientes o poblacion externa Si/No, protocolo
requerido, protocolo adjunto, sincronizacion Calendar sin exponer `calendarId`
y bitacora basica.

Si la reserva personal es futura y tiene estatus `PENDIENTE_VALIDACION`,
`CONFIRMADA` o `CONFIRMADA_TRAS_VALIDACION`, el detalle debe mostrar la accion
`Cancelar reserva`. Esta accion debe usar un dialogo de confirmacion y llamar a
la Cloud Function `cancelReservation`; Angular no debe escribir en Firestore
directamente. Al completarse, la vista debe refrescar el detalle y mostrar un
snackbar de resultado.

La bitacora basica visible para docentes no debe mostrar claves tecnicas crudas
como `STATUS_CHANGED`, `CREATED` o `EMAIL_SENT` como texto principal. Debe
traducirlas a mensajes claros para usuario final:

- `CREATED`: Solicitud registrada.
- `STATUS_CHANGED`: estatus legible de la reserva, como Rechazada por conflicto
  o Pendiente de validacion.
- `EMAIL_SENT`: Notificacion enviada.
- `CALENDAR_EVENT_CREATED`: Agendada en calendario.
- `CALENDAR_ERROR`: Error de calendario.

Cuando exista `log.note`, puede mostrarse como detalle contextual. Si no existe
nota, debe usarse una descripcion predeterminada clara. La linea de tiempo debe
usar estados visuales por severidad: success, warning, danger, info o neutral.
No se deben mostrar datos de otros docentes, `calendarId`, rutas privadas de
Storage como enlaces publicos ni datos tecnicos innecesarios.

Panel responsable_laboratorio
Pantallas
/responsable/solicitudes
/responsable/historial
/responsable/reserva/:reservationId
Funciones
Ver pendientes.
Filtrar por laboratorio asignado.
Ver protocolo.
Aprobar.
Rechazar con motivo.
Ver historial.
Móvil

Vista por tarjetas.

Acciones rápidas:

“Ver detalle”.
“Aprobar”.
“Rechazar”.
Escritorio

Tabla con filtros y panel de detalle lateral.

Panel Admin/Sistemas

Pantallas

/admin/dashboard
/admin/laboratorios
/admin/usuarios
/admin/reglas
/admin/reportes
/admin/bitacora

Funciones

Administrar laboratorios.
Administrar responsables.
Administrar usuarios.
Configurar reglas.
Configurar calendarios.
Ver todas las reservas.
Ver reportes.
Consultar bitácora.

Móvil

Debe funcionar, pero no es la experiencia principal.

Escritorio

Debe ser la experiencia principal para administración.

Reglas visuales

Botones grandes en móvil.
Formularios por pasos.
No usar tablas anchas en móvil.
Usar tarjetas en pantallas pequeñas.
Usar tablas en escritorio.
Mensajes de error claros.
Confirmación antes de enviar.
Colores por estatus.
Diseño institucional limpio.
Evitar iframes para formularios o calendario principal.

Sistema visual institucional implementado

El frontend debe mantener el sistema visual base documentado en:

```text
docs/13_VISUAL_REDESIGN_REPORT.md
```

Regla obligatoria para nuevos modulos visuales:

Todo modulo nuevo, pantalla nueva o refactor visual debe respetar la misma
linea de diseno institucional ya implementada. No deben crearse estilos,
paletas, tipografias, cards, botones, filtros o layouts alternos sin aprobacion
del propietario del proyecto.

Antes de crear una pantalla nueva se debe revisar:

- `docs/13_VISUAL_REDESIGN_REPORT.md`;
- las clases globales de `apps/web/src/styles.scss`;
- los componentes visuales reutilizables en `apps/web/src/app/shared/components`;
- los componentes de dominio ya existentes cuando el modulo pertenezca a
  calendario, reservas, laboratorios o responsable.

Los nuevos modulos deben usar:

- tipografia unica `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
- Angular Material para comportamiento, accesibilidad y controles base;
- Tailwind CSS y clases globales para layout, spacing, color, bordes, sombras y responsive;
- Material Icons completos, centrados y accesibles;
- tarjetas blancas con bordes suaves y sombra ligera;
- botones primarios institucionales;
- chips compactos por estado;
- encabezados con el patron de `AppPageHeaderComponent`;
- textos visibles en espanol.

Queda prohibido introducir fuentes serif o estilos nativos del navegador en la
interfaz operativa. Los iconos `mat-icon` deben conservar la fuente de Material
Icons y no deben heredar la fuente de texto.

La identidad visual operativa de la Web App usa una combinacion institucional moderna basada en:

- morado profundo como color principal de interfaz;
- fondo general claro;
- superficies blancas;
- bordes suaves;
- sombras ligeras;
- tarjetas con `rounded-2xl`;
- botones primarios solidos;
- botones secundarios tipo link u outline;
- chips de estado compactos;
- iconografia Material;
- tipografia Inter o fallback system-ui.

Regla tipografica global:

- la interfaz operativa debe usar una sola familia base: `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
- el header principal, login, navegacion, avatar, nombre del usuario, botones, cards, formularios, dialogs, menus y snackbars deben heredar esa familia;
- no deben aparecer fuentes serif en componentes de interfaz, salvo aprobacion explicita para una pieza grafica aislada;
- Angular Material debe conservar accesibilidad y comportamiento, pero su tipografia debe alinearse con la familia base del sistema.

Tokens visuales base:

```text
brand-primary: #21005D
brand-primary-hover: #2E1065
brand-secondary: #5B21B6
brand-accent: #6366F1
app-bg: #F8FAFC
surface: #FFFFFF
surface-soft: #F9FAFB
text-primary: #111827
text-secondary: #4B5563
text-muted: #6B7280
border-soft: #E5E7EB
border-strong: #D1D5DB
```

Estados visuales:

```text
success: disponible, confirmado, correcto
warning: pendiente, riesgo, requiere validacion
danger: rechazo, error, bloqueo critico
info: informacion, protocolo, validacion
neutral: dato operativo sin severidad
```

Componentes visuales base

La capa visual reutilizable del frontend debe priorizar estos componentes standalone:

- `AppPageHeaderComponent`
- `AppStatusChipComponent`
- `AppInfoCalloutComponent`
- `AppIconBoxComponent`
- `AppSectionCardComponent`

Componentes de dominio implementados para Responsable:

- `PendingRequestCardComponent`
- `ReservationDataGridComponent`
- `ProtocolFileCardComponent`
- `ReservationTimelineComponent`
- `DecisionPanelComponent`

Componentes de dominio implementados para Calendario y Reserva:

- `AvailabilityCalendarComponent`
- `ReservationStepperFormComponent`

Reglas de componentizacion visual

Los componentes visuales deben:

- ser standalone;
- usar Angular Material solo cuando aporte accesibilidad o comportamiento;
- usar Tailwind CSS y clases globales para layout, spacing, color y responsive;
- reutilizar `AppPageHeaderComponent` para encabezados de vistas operativas como
  catalogo, detalle de laboratorio y reserva por laboratorio;
- reutilizar `AppIconBoxComponent` para iconografia visual; no usar textos
  abreviados como `LAB`, `HR`, `OK` o similares cuando exista un icono Material
  claro y accesible;
- no consultar servicios directamente si son presentacionales;
- no aprobar, rechazar, crear reservas ni ejecutar operaciones criticas;
- emitir eventos al componente padre;
- conservar las rutas existentes;
- conservar la estructura del payload de reserva;
- mantener textos visibles en español.

Catalogo de laboratorios

Las tarjetas del catalogo deben seguir este patron:

- icon box suave a la izquierda;
- nombre del laboratorio como titulo principal;
- descripcion breve;
- horario compacto con icono de reloj;
- chips suaves para disponibilidad, validacion, protocolo y anticipacion;
- herramientas superiores con iconografia sobria cuando se muestren filtros,
  busqueda o indicadores de disponibilidad;
- accion secundaria `Ver detalle` con icono y `aria-label` descriptivo;
- boton primario `Reservar` con icono y `aria-label` descriptivo;
- no mostrar `calendarId` al docente;
- no usar abreviaturas como identificador visual principal cuando exista iconografia apropiada.

Detalle y reserva por laboratorio

Las vistas `/laboratorios/:labId` y `/reservar/:labSlug` deben usar el mismo
patron de encabezado:

- `AppPageHeaderComponent`;
- kicker breve;
- titulo con el nombre del laboratorio;
- subtitulo descriptivo;
- accion de regreso con icono;
- chip de estado cuando aplique.

El resumen lateral de laboratorio debe usar `AppIconBoxComponent` con iconos
Material (`schedule`, `event_available`, `verified_user` u otros equivalentes)
en lugar de cajas con abreviaturas textuales. Las acciones principales deben
mantener icono visible y etiqueta textual.

Calendario visual

El calendario visual debe evitar celdas saturadas. Las celdas disponibles no deben repetir texto en cada hora. Los eventos ocupados, de riesgo, seleccionados o no disponibles deben agruparse como bloques continuos cuando ocupen varias horas.

Ejemplo:

```text
14:00 - 17:00
Ocupado
```

No debe repetirse `Ocupado` por cada celda horaria.

Reglas finales para vista semanal:

- usar columna fija de horas y columnas de dias alineadas por fila;
- fijar explicitamente cada celda base a su fila horaria para evitar desplazamientos visuales por CSS Grid;
- tratar la hora de cierre como exclusiva;
- si el horario termina a las 20:00, el ultimo slot visual debe ser 19:00 - 20:00;
- renderizar reservas, bloqueos y no disponibles como bloques continuos del rango real;
- centrar el texto de bloques ocupados, de riesgo, seleccionados o no disponibles;
- permitir abrir un detalle operativo al hacer clic en un bloque, sin exponer datos sensibles del docente o practica;
- no mostrar datos privados ni `calendarId` en el calendario visible para docente.

Reglas finales para vista mensual:

- usar una rejilla reconocible de calendario mensual con 7 columnas;
- mantener encabezados de dias;
- mostrar eventos como indicadores compactos dentro del dia;
- evitar tarjetas sueltas que no parezcan calendario;
- evitar saturar con horarios no disponibles repetidos.

Formulario de reserva

El formulario de reserva debe mantener el `FormGroup` y validaciones en el componente padre cuando sea necesario para preservar el flujo funcional. Los componentes visuales pueden renderizar stepper, campos y resumen, pero no deben construir payloads criticos ni llamar directamente al backend salvo que ese comportamiento ya este centralizado por diseño.

Reglas visuales del stepper:

- debe mostrar numeros persistentes en cada paso;
- no debe reemplazar pasos completados por iconos que cambien el lenguaje visual;
- las etiquetas deben ser concisas y legibles debajo del numero;
- la guia entre pasos debe ser una sola linea recta y limpia;
- no deben mostrarse segmentos o lineas entrecortadas de Angular Material;
- en movil puede usarse orientacion vertical si mejora la lectura.

Reglas visuales de campos:

- los campos Material deben conservar accesibilidad y comportamiento nativo;
- deben tener fondo claro, borde suave, radio consistente y sombra ligera;
- el estado hover/focus debe usar color institucional;
- los iconos de sufijo deben verse completos y alineados;
- no se deben usar campos planos que rompan el patron ejecutivo del sistema.

Actualizacion Fase 16A: base Admin/Sistemas

El panel Admin/Sistemas inicial completa estas rutas:

- `/admin/dashboard`
- `/admin/usuarios`
- `/admin/laboratorios`
- `/admin/bitacora`

Todas deben reutilizar `authGuard`, `profileGuard` y `roleGuard` con
`admin_sistemas`.

`/admin/dashboard` muestra cards de resumen para usuarios activos, usuarios
pendientes o inactivos, laboratorios activos, reservas
`PENDIENTE_VALIDACION`, reservas `ERROR_CALENDAR` y notificaciones fallidas.

`/admin/usuarios` es mobile-first con tarjetas y filtros por busqueda, rol,
estado y laboratorio asignado. La edicion usa un dialogo con rol oficial,
activo/inactivo y laboratorios asignados cuando el rol sea
`responsable_laboratorio`.

La actualizacion de usuarios debe llamar `adminUpdateUser`. No se permite
`updateDoc` directo para roles, `active` o `labsAssigned`.

`/admin/laboratorios` queda solo lectura en esta fase. Debe mostrar datos
operativos no sensibles y no debe mostrar `calendarId` salvo autorizacion
posterior.

`/admin/bitacora` debe mostrar `auditEvents` de forma legible, sin stack traces,
secretos ni metadata sensible.

La navegacion debe mostrar accesos administrativos solo para `admin_sistemas`.

Estabilidad de carga visual:

- Las rutas admin lazy-loaded deben mostrar datos en la primera navegacion, sin
  requerir un segundo clic sobre la misma opcion del menu.
- Cuando una vista admin use Firebase SDK modular, `getDocs`, callable
  Functions o promesas similares, debe cerrar `loading` y refrescar el estado
  visual al finalizar la carga.
- Los estados de carga, vacio y error deben ser transitorios y coherentes con
  `AppInfoCalloutComponent`.
- Este criterio no cambia servicios, guards, rutas, permisos ni contratos de
  datos; solo asegura que el estado visual se sincronice correctamente.
## Actualizacion Fase 16A.1: usuarios y prealtas

El login debe llamar `ensureUserProfile` cuando Google Sign-In regrese una
cuenta institucional sin documento `users/{uid}`. Si la respuesta crea perfil
docente o reclama prealta, el frontend debe recargar el perfil y continuar la
redireccion normal por rol o ruta QR. Si recibe `PENDING_ACCESS`, debe mostrar
la pantalla de acceso pendiente.

La pantalla de acceso pendiente debe explicar que:

- docentes con correo `tup-dNUMEROS@tecplayacar.edu.mx` entran
  automaticamente;
- responsables/coordinadores requieren prealta de Admin/Sistemas;
- cuentas institucionales que no cumplen patron docente ni tienen prealta
  quedan pendientes.

La ruta `/admin/usuarios` debe incluir una accion visible para agregar
responsable/coordinador. El dialog debe pedir nombre opcional, correo
institucional, rol oficial, estado activo y laboratorios asignados si el rol es
`responsable_laboratorio`. Tambien debe listar preautorizados pendientes y
mantener estados de carga/vacio/error sin quedarse en `Cargando...`.

## Actualizacion Fase 16B: UI de gestion de laboratorios

La ruta `/admin/laboratorios` deja de ser solo lectura y permite gestionar
laboratorios con una interfaz Admin/Sistemas consistente con el sistema visual.

La vista incluye:

- encabezado con `AppPageHeaderComponent`;
- filtros por busqueda, estado activo/inactivo y visibilidad en catalogo;
- cards responsivas con nombre, slug, descripcion, estado, ruta QR,
  responsables, correos y `calendarId`;
- boton `Nuevo laboratorio`;
- accion `Editar`;
- chips de estado con `AppStatusChipComponent`;
- estados de carga, vacio y error con `AppInfoCalloutComponent`.

El dialogo `AdminLabEditDialogComponent` usa Angular Material y secciones por
tabs:

- Datos generales;
- Disponibilidad;
- Responsables;
- Calendario.

El campo `calendarId` se muestra solo dentro de Admin/Sistemas con una nota de
uso operativo. No debe aparecer en catalogo docente, detalle docente ni
calendario publico.

No se implementa subida real de imagenes ni edicion de `specialRules` en esta
fase.
## Actualizacion Fase 16B.1: dialogo de laboratorios

El modal de alta/edicion de laboratorios debe conservar la linea visual
institucional y abrirse con ancho amplio y responsive:

```text
min(1120px, calc(100vw - 32px))
```

Reglas visuales:

- no debe mostrar scroll horizontal en el contenido del formulario;
- si las tabs no caben en pantallas pequenas, solo la cabecera de tabs puede
  desplazarse horizontalmente;
- los iconos de encabezado, callouts y chips deben verse completos, centrados y
  con caja fija;
- cualquier dialogo administrativo futuro con formularios extensos debe usar
  `panelClass` propio para controlar radio, sombra, superficie y overflow sin
  romper el sistema visual;
- este ajuste es solo de interfaz y no cambia servicios, rutas, validaciones,
  Cloud Functions ni reglas de seguridad.

## Actualizacion Fase 16C: UI de reglas y bloqueos

La ruta `/admin/reglas` debe mantener la identidad visual operativa morada y
usar componentes reutilizables:

- `AppPageHeaderComponent`;
- `AppSectionCardComponent`;
- `AppStatusChipComponent`;
- `AppInfoCalloutComponent`.

La vista debe incluir dos secciones por tabs:

1. Reglas especiales por laboratorio.
2. Bloqueos extraordinarios globales o por laboratorio.

Los formularios administrativos se abren en dialogs responsive, usan Angular
Material para controles y Tailwind/clases globales para layout. Los cambios se
envian a Cloud Functions, nunca con `updateDoc` directo desde Angular.
