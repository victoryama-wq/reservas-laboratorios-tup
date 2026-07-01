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

Actualizacion QA posterior a Fase 17:

- el AppShell/Header no debe mostrar `Docente` como valor por defecto cuando el
  perfil aun no esta confirmado;
- durante la carga o refresco de `users/{uid}` debe mostrarse un estado neutro
  como `Validando perfil...`;
- los enlaces de Responsable y Admin/Sistemas solo deben aparecer cuando el
  perfil activo confirmado tenga `role === 'responsable_laboratorio'` o
  `role === 'admin_sistemas'`, segun corresponda;
- al cambiar de cuenta, recargar la app o reclamar una prealta, la interfaz no
  debe reutilizar datos visuales de un perfil anterior;
- si el rol no es reconocido, la UI debe indicar `Rol no valido` o acceso
  pendiente, nunca caer a `Docente`.

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
`responsable_laboratorio`. Tambien debe listar preautorizados pendientes,
reclamados y revocados, y mantener estados de carga/vacio/error sin quedarse en
`Cargando...`.

## Actualizacion Fase 16F: UI de revocacion y suspension

`/admin/usuarios` debe mostrar que los usuarios existentes no se eliminan para
conservar trazabilidad. Para impedir el acceso se usa suspension del perfil
con `active: false`.

Las prealtas no reclamadas pueden revocarse con un dialogo de confirmacion y
motivo opcional. La tarjeta de prealta debe indicar claramente:

- `Pendiente`: prealta activa sin reclamar;
- `Reclamada`: ya existe usuario real y los cambios van sobre `users/{uid}`;
- `Revocada`: prealta inactiva o con `revokedAt`.

El boton `Revocar prealta` solo debe mostrarse si la prealta no fue reclamada,
esta activa y no tiene `revokedAt`. La vista no debe mostrar el UID como dato
principal de usuarios existentes; debe priorizar nombre, correo, rol, estado de
acceso y laboratorios asignados.

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

## Actualizacion Fase 16D: reserva con formulario en dialogo

La ruta `/reservar/:labSlug` debe priorizar la disponibilidad visual del
laboratorio. El calendario debe ocupar la mayor superficie util y el formulario
de reserva debe abrirse desde una accion clara, por ejemplo `Nueva solicitud`.

Reglas de interfaz:

- no mostrar el formulario completo fijo al costado del calendario cuando eso
  comprima la disponibilidad;
- mostrar una card de accion con el horario seleccionado cuando exista;
- permitir abrir el formulario aunque no exista horario seleccionado, para
  captura manual;
- abrir el formulario en un dialogo Angular Material responsive;
- el dialogo debe usar ancho amplio en escritorio y casi todo el viewport en
  movil, con scroll interno y sin overflow horizontal;
- el formulario del dialogo debe reutilizar los componentes existentes de
  reserva, no duplicar markup ni crear un segundo flujo;
- si el usuario selecciono un slot disponible, el formulario debe precargar los
  controles existentes de fecha, hora inicial y hora final;
- si `createReservation` falla, el dialogo no debe cerrarse y debe conservar la
  informacion capturada;
- si `createReservation` devuelve resultado, el dialogo puede cerrarse y la
  pagina debe mostrar un mensaje claro por estatus.

Mensajes recomendados:

- `CONFIRMADA`: `Reserva confirmada. Se agrego al calendario institucional.`
- `PENDIENTE_VALIDACION`: `Solicitud enviada. Quedo pendiente de revision por el responsable.`
- `RECHAZADA_*`: `No fue posible confirmar la solicitud. Revise el motivo indicado.`
- `ERROR_CALENDAR`: `La solicitud requiere revision tecnica por un error de calendario.`

Esta fase es visual. No debe modificar payload, validaciones backend, servicios
de reserva, rutas, guards, roles, estatus, reglas de seguridad ni integraciones.

## Actualizacion Fase 16E: Mis reservas recientes e historico

La pantalla `/mis-reservas` debe mostrar por defecto la vista `Recientes` para
evitar saturacion visual del panel docente.

Regla de interfaz:

- `Recientes`: reservas futuras, reservas de los ultimos 3 meses y reservas
  antiguas con estatus `PENDIENTE_VALIDACION`, `CONFIRMADA`,
  `CONFIRMADA_TRAS_VALIDACION` o `ERROR_CALENDAR`;
- `Historico`: reservas anteriores a 3 meses que no estan pendientes ni
  bloqueando horario;
- `Todas`: reservas personales sin corte temporal.

La vista debe incluir un mensaje visible:

```text
Por defecto se muestran reservas recientes y futuras. Las reservas anteriores a 3 meses permanecen disponibles en Historico.
```

Estados vacios recomendados:

- `Sin reservas recientes.`
- `No hay reservas historicas.`

Esta separacion es visual. No debe eliminar documentos de `reservations`,
`reservationLogs`, `notifications` ni `auditEvents`; tampoco debe modificar
Cloud Functions, estatus, rutas, reglas de negocio ni permisos.

## Actualizacion Fase 17B.1: UI admin para galeria de laboratorios

El dialogo de alta/edicion de laboratorios debe incluir una pestana `Galeria`
para Admin/Sistemas.

Requisitos visuales:

- conservar el sistema visual institucional morado documentado;
- usar Angular Material para dialogo, tabs, botones, formularios y progreso;
- usar Tailwind/clases globales para layout, espaciado, bordes y superficies;
- mostrar contador `N de 8 imagenes activas`;
- mostrar ayuda visible sobre formatos JPG/PNG/WebP y limite de 5 MB;
- permitir preview privado de imagenes subidas;
- permitir capturar `alt` y `caption`;
- permitir activar/desactivar imagen sin borrar archivo;
- permitir mover imagenes arriba/abajo;
- permitir seleccionar portada;
- no mostrar ni guardar URLs publicas;
- conservar `imageUrl` como campo legado opcional.

Esta fase no implementa carrusel publico en `/laboratorios` ni
`/laboratorios/:labId`. La galeria queda preparada para una fase posterior.

## Actualizacion Fase 17B.2: carrusel en detalle de laboratorio

La vista `/laboratorios/:labId` debe mostrar un carrusel visual cuando existan
imagenes activas en `labs/{labId}.gallery`.

Reglas visuales:

- ubicar el carrusel despues del encabezado y antes del layout principal;
- conservar resumen lateral, boton `Reservar este laboratorio` y calendario;
- usar card blanca, bordes suaves, `rounded-2xl`, sombra ligera e identidad
  operativa morada;
- usar imagen con `object-fit: cover`;
- mostrar caption visible si existe;
- mostrar controles anterior/siguiente solo si hay mas de una imagen;
- mostrar indicadores accesibles;
- en movil usar ancho completo y altura moderada, sin scroll horizontal;
- si no hay imagenes o no cargan, mostrar fallback:
  `Galeria no disponible por el momento.`

El carrusel no debe consultar Firestore, modificar laboratorio, subir imagenes
ni llamar Cloud Functions. La resolucion de URLs temporales desde Storage debe
hacerse en un servicio de lectura.

Accesibilidad del carrusel:

- cuando existan varias imagenes, puede avanzar automaticamente cada 5 segundos;
- debe pausarse al pasar el cursor o cuando el foco de teclado entra al
  componente;
- debe pausarse cuando el usuario usa flechas o indicadores;
- debe respetar `prefers-reduced-motion: reduce`;
- no debe usar animaciones agresivas, cambios demasiado rapidos ni movimiento
  que pueda marear en movil o lectores de pantalla.

## Actualizacion Fase 17B.3: QR visual configurable

El dialogo de alta/edicion de laboratorios en `/admin/laboratorios` debe incluir
una pestana `QR` para configurar y previsualizar el QR operativo del
laboratorio.

La interfaz debe permitir:

- configurar titulo, subtitulo y etiqueta institucional;
- configurar colores institucionales del QR;
- elegir marco visual `classic`, `card` o `minimal`;
- elegir tamano de impresion `small`, `medium` o `large`;
- mostrar u ocultar el logo institucional real;
- copiar enlace;
- descargar PNG;
- descargar SVG cuando la generacion sea estable;
- imprimir.

La previsualizacion debe mantener la linea visual documentada en
`docs/13_VISUAL_REDESIGN_REPORT.md`. Si el contraste de colores es bajo, la UI
debe advertirlo sin bloquear la configuracion.

La URL siempre se deriva del `slug`:

```text
https://reservas-laboratorios-tup.web.app/reservar/{slug}
```

Si el admin modifica el `slug`, la vista debe advertir que se deben reemplazar
los QR impresos.

### Actualizacion Fase 17B.3A: uso global del logo institucional real

La Web App debe usar el logotipo institucional real como marca primaria:

```text
/media/image/logo/logo_tup.png
```

Reglas:

- el header principal debe mostrar el logo real, no un texto simulado;
- la pantalla de login debe mostrar el logo real en su marca principal y fondo
  decorativo;
- la previsualizacion de QR debe mostrar el logo real cuando `showLogo === true`;
- la descarga PNG y la impresion de QR deben intentar incrustar el logo real;
- si el logo no carga, se permite fallback tecnico con icono institucional;
- no se deben usar letras como `TUP` como marca visual primaria;
- no se deben guardar logos, QR o imagenes generadas como base64 en Firestore
  o Storage.

El SVG de QR puede mantenerse sin logo para preservar compatibilidad vectorial,
siempre que se documente la limitacion y el PNG/impresion mantengan la identidad
institucional.

## Actualizacion Fase 17B.4: validacion visual de calendario

La pestana `Calendario` del dialogo de alta/edicion de laboratorios debe incluir
una accion clara para validar el `calendarId` antes de guardar.

Reglas de interfaz:

- el campo `calendarId` sigue visible solo para Admin/Sistemas;
- la accion debe llamarse `Validar calendario`;
- mientras valida debe mostrar estado de carga;
- si el calendario es valido debe mostrar mensaje de exito y permiso detectado;
- si no existe, no tiene permiso de escritura o el ID es invalido, debe mostrar
  mensaje de error controlado;
- debe explicar que el backend tambien bloqueara el guardado si la cuenta
  operativa no puede escribir;
- no debe mostrar datos sensibles de eventos existentes;
- no debe exponer `calendarId` en vistas docentes.

La vista mantiene el sistema visual institucional: cards blancas, bordes
suaves, botones Material, iconos completos y textos en espanol.

## Actualizacion Fase 17B.5: mensaje de responsables sincronizados

La pestana `Responsables` del dialogo de alta/edicion de laboratorios debe
informar que la asignacion ya se sincroniza automaticamente desde backend.

Reglas de interfaz:

- no debe sugerir que Admin/Sistemas sincronice manualmente
  `users/{uid}.labsAssigned` cuando la asignacion se realiza desde
  `/admin/laboratorios`;
- debe mostrar un mensaje claro: al guardar, el sistema sincroniza los
  laboratorios asignados en el perfil de cada responsable;
- debe aclarar que los usuarios `admin_sistemas` tienen acceso global y no
  dependen de `labsAssigned`;
- Angular no debe escribir directamente en `users/{uid}.labsAssigned`;
- la vista debe seguir usando `adminCreateLab` y `adminUpdateLab`;
- no se modifican rutas, permisos, reservas ni flujos docentes.

El mensaje debe mantener la linea visual institucional con callouts suaves,
iconografia completa, texto en espanol y componentes Angular Material.

## Actualizacion Fase 17B.6: Laboratorios sin resumen redundante

`/admin/laboratorios` debe mostrar informacion operativa suficiente sin
duplicar formularios o detalles gestionados por otros modulos.

Reglas visuales:

- las cards muestran un resumen compacto de reglas especiales:
  - `Sin reglas especiales activas`;
  - `1 regla especial activa`;
  - `{n} reglas especiales activas`;
  - chip secundario para reglas inactivas si aporta valor;
- no se muestran dias, horarios, razones largas ni formularios de reglas en la
  card de laboratorio;
- la accion `Gestionar reglas` lleva a `/admin/reglas?labId={labId}`;
- el dialogo de laboratorio puede mostrar un callout en Disponibilidad, pero no
  debe crear una pestana nueva de Reglas;
- el boton `Guardar laboratorio` debe quedar deshabilitado cuando no hay
  cambios reales;
- las confirmaciones se reservan para cambios sensibles: slug, calendarId,
  desactivacion, ocultar del catalogo, responsables, horario o reduccion de
  imagenes activas;
- los errores administrativos visibles deben ser claros y no mostrar
  `internal`, stack traces, JSON crudo ni datos sensibles.

`/admin/reglas` sigue siendo la fuente visual para consultar y editar reglas
especiales y bloqueos.
## Actualizacion Fase 17C.1: UI para abrir protocolos privados

La vista `/responsable/reserva/:reservationId` debe mostrar los protocolos como
archivos privados adjuntos, sin exponer `storagePath` como enlace visible.

El boton principal debe decir `Abrir protocolo` y debe:

- mostrar estado de carga mientras se genera acceso temporal;
- llamar a `getReservationProtocolAccess`;
- abrir la URL temporal en una pestana nueva;
- mostrar un mensaje claro si el usuario no tiene permiso o el archivo ya no
  existe;
- conservar el estilo visual institucional y responsive.

No se debe usar `getDownloadURL` directo desde Angular para responsables. No se
deben mostrar URLs publicas, rutas internas de Storage ni detalles tecnicos al
usuario final.

### Correccion 17C.1A

Los errores de acceso a protocolos deben mapearse a mensajes claros:

- permiso insuficiente: `No tienes permiso para abrir este protocolo.`;
- archivo inexistente: `No se encontro el archivo de protocolo.`;
- archivo no vinculado: `El archivo no pertenece a esta reserva.`;
- fallo tecnico: `No fue posible generar el acceso temporal al protocolo.`;
- servicio no disponible: `El servicio no esta disponible temporalmente.`;

La interfaz nunca debe mostrar `INTERNAL`, stack traces, JSON crudo,
`storagePath` ni signed URLs permanentes.

El calendario visual debe mostrar siempre el horario real de `startAt` y
`endAt` para reservas o bloqueos. Si una reserva termina a las 13:30, la tarjeta
de disponibilidad debe decir `12:00 - 13:30`, no `12:00 - 14:00`. La posicion
visual puede calcularse por minutos, pero el texto visible no debe redondearse.

### Correccion 17C.1B

La vista semanal del calendario de disponibilidad debe comportarse como un eje
vertical de tiempo. Los bloques ocupados, pendientes, seleccionados o no
disponibles se posicionan con base en los minutos reales desde la primera hora
visible y se dimensionan con la duracion real del evento.

Reglas visuales:

- `12:00 - 13:30` ocupa 1.5 horas visuales;
- `12:30 - 13:30` inicia a media hora y ocupa 1 hora visual;
- `08:00 - 08:30` ocupa media hora visual;
- la etiqueta visible conserva `startAt/endAt` reales;
- las lineas de hora quedan como referencia detras de los bloques;
- no se repite `Ocupado` por celda horaria.

Este ajuste no cambia servicios, payloads, reservas, Calendar API, Gmail API ni
reglas de negocio.

## Actualizacion Fase 17D.1: navegacion movil y acciones del catalogo

En vista movil el AppShell debe usar un boton hamburguesa accesible con icono
`menu` y `aria-label="Abrir menu de navegacion"`. La navegacion horizontal se
oculta en celulares para evitar overflow y saturacion visual.

El menu movil debe respetar exactamente los mismos permisos visuales que la
navegacion de escritorio:

- `Laboratorios` y `Mis reservas` para usuarios autenticados con perfil valido.
- `Responsable` solo para `responsable_laboratorio` o `admin_sistemas`.
- rutas de Admin solo para `admin_sistemas`.
- `Cerrar sesion` dentro del menu movil.

En escritorio se conserva la navegacion horizontal.

En el catalogo de laboratorios, `Ver detalle` debe presentarse como boton
secundario real con icono, fondo suave, borde, radio consistente, foco visible y
area tactil completa. `Reservar` sigue siendo la accion primaria. No se deben
alterar rutas, servicios, modelos, roles ni reglas de negocio por ajustes
visuales.
## Actualizacion Fase 17C.2: timeline responsable saneado

La vista `/responsable/reserva/:reservationId` debe mostrar la bitacora basica
con el componente visual reutilizable `ReservationTimelineComponent`.

Reglas de UI:

- mostrar titulos legibles, no acciones tecnicas como texto principal;
- usar severidades visuales `success`, `warning`, `danger`, `info` y
  `neutral`;
- no repetir datos ya visibles en las cards de la reserva;
- si la callable falla por permisos, mostrar:
  `No tienes permiso para consultar la bitacora de esta reserva.`;
- si falla el servicio, mostrar:
  `No fue posible cargar la bitacora. Intenta nuevamente.`;
- si no hay eventos, mostrar:
  `No hay eventos de bitacora registrados para esta reserva.`;
- no mostrar JSON crudo, `internal`, stack traces ni metadata sensible.

Correccion 17C.2A:

La UI debe conservar mensajes diferenciados para la bitacora responsable:

- sin eventos: la reserva no tiene eventos de bitacora registrados;
- sin permiso: el usuario no puede consultar la bitacora de esa reserva;
- error tecnico: no fue posible cargar la bitacora.

Ningun caso debe mostrar `INTERNAL`, errores crudos del SDK, JSON, stack traces
ni rutas tecnicas.
