Principio general

El sistema se desarrollará como una web app responsive, mobile-first y compatible con dispositivos móviles, tabletas y computadoras.

La prioridad será el flujo del docente desde celular, debido a que muchos usuarios accederán mediante QR o enlace directo.

Estrategia
Una sola web app responsive
+ mobile-first
+ QR por laboratorio
+ PWA opcional
+ sin app nativa inicial

Identidad institucional
Colores:
- Azul marino: #271e5d
- Azul: #252a86
- Gris: #888887
- Blanco: #ffffff

Logotipo:
/media/image/logo/logo_tup.png

Los colores deben usarse con criterio para una vista moderna, actualizada e institucional.

Nota de identidad visual:
Los colores azul, gris y blanco pertenecen a la identidad institucional base.
La Web App usa una identidad operativa moderna basada en morado profundo,
documentada en `docs/13_VISUAL_REDESIGN_REPORT.md`. Esta paleta operativa debe
guiar headers, botones, chips, cards, calendarios y formularios. No deben
generarse estilos visuales alternos fuera de ese sistema sin aprobacion del
propietario del proyecto.

Breakpoints mínimos

Mobile:
- 360px a 767px

Tablet:
- 768px a 1023px

Desktop:
- 1024px en adelante

Prioridad por rol

Docente

Diseño principal: móvil.

Debe poder:
iniciar sesión;
entrar desde QR;
consultar disponibilidad;
crear reserva;
cargar protocolo;
revisar estatus;
cancelar si aplica.

Responsable de laboratorio

Diseño principal: móvil y escritorio.

Debe poder:
revisar solicitudes;
abrir protocolo;
aprobar;
rechazar;
consultar historial.

Admin/Sistemas

Diseño principal: escritorio.

Debe poder:
administrar laboratorios;
configurar reglas;
gestionar usuarios;
revisar reportes;
consultar bitácora.

Debe ser funcional en móvil, pero no necesariamente tan cómodo como escritorio para tareas complejas.

Reglas de interfaz móvil

Formularios por pasos.
Botones grandes.
Campos legibles.
Evitar tablas anchas.
Usar tarjetas en lugar de tablas.
Calendario en vista agenda/lista.
Carga de archivos compatible con cámara o archivos del teléfono.
La carga de protocolo debe subir primero a Cloud Storage y después enviar metadata a createReservation.
Confirmaciones claras antes de enviar.
Mensajes de error visibles.
Botón principal siempre identificable.
Evitar saturación visual.
Priorizar acciones rápidas.

Calendario responsive

En móvil
Usar:

listDay
listWeek
timeGridDay

o vistas equivalentes.

Debe mostrar:

horarios ocupados;
horarios disponibles;
motivo de bloqueo;
opción clara para elegir fecha y hora.

No usar calendario mensual como vista principal en móvil.

En tablet
Usar:

timeGridWeek compacta
listWeek

En escritorio
Usar:
timeGridWeek
dayGridMonth

Debe permitir:
ver bloques ocupados;
cambiar de laboratorio;
filtrar por fecha;
revisar disponibilidad amplia.

Acceso por QR

Cada laboratorio tendrá un QR directo a:

/reservar/:labSlug

Comportamiento:

Usuario escanea QR
  -> entra a /reservar/:labSlug
  -> si no hay sesión, va a /login
  -> después del login regresa a /reservar/:labSlug
  -> formulario aparece con laboratorio precargado

PWA

El sistema debe prepararse para funcionar como PWA.

Características deseables:

ícono institucional;
nombre corto;
pantalla de carga;
instalación como acceso directo;
caché básico de recursos estáticos;
navegación fluida en móvil;
compatibilidad con navegador móvil.

No funcional inicial

La app no necesita trabajar completamente offline para crear reservas, porque la disponibilidad y la validación deben consultarse en backend.

Sí puede cachear:

logo;
estilos;
catálogo básico;
recursos estáticos.

No debe cachear como fuente definitiva:

disponibilidad;
validaciones críticas;
estatus de aprobación;
protocolos privados.
Restricción importante

La app no debe depender de:

Google Forms embebido;
Google Calendar embebido;
Google Sites como interfaz principal.

El formulario y calendario deben ser componentes nativos de la web app.

Orden final recomendado de desarrollo:

1. Crear repositorio y estructura base.
2. Configurar Angular + Tailwind + Angular Material.
3. Configurar Firebase.
4. Definir modelos TypeScript.
5. Implementar autenticación.
6. Implementar roles.
7. Implementar catálogo responsive.
8. Implementar acceso por QR.
9. Implementar calendario responsive.
10. Implementar formulario mobile-first.
11. Implementar createReservation.
12. Implementar reglas de negocio.
13. Integrar Firestore.
14. Integrar Storage.
15. Integrar Google Calendar.
16. Integrar notificaciones.
17. Implementar panel responsable.
18. Implementar panel Admin/Sistemas.
19. Implementar reportes.
20. Implementar pruebas.
21. Preparar despliegue en Firebase.

Actualizacion visual responsive

La Web App cuenta con una capa visual reutilizable documentada en:

```text
docs/13_VISUAL_REDESIGN_REPORT.md
```

Regla de continuidad visual:

Cada nuevo modulo responsive debe partir del sistema visual vigente. Esto aplica
a pantallas de administracion, reportes, mis reservas, cancelaciones,
bitacoras, gestion de usuarios y cualquier modulo posterior.

Requisitos para modulos nuevos:

- usar la familia global `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
- reutilizar clases globales de `apps/web/src/styles.scss`;
- reutilizar componentes standalone visuales existentes antes de crear nuevos;
- mantener cards, filtros, formularios, botones, chips y calendarios dentro de
  la misma paleta operativa morada y superficies claras;
- mantener iconografia Material completa, centrada y con `aria-label` cuando el
  contexto lo requiera;
- conservar mobile-first: una columna en movil, grids progresivos en tablet y
  layouts amplios en escritorio;
- evitar fuentes, colores o proporciones que hagan que una pantalla parezca de
  una version visual anterior.

Los componentes responsive principales agregados son:

- `AppPageHeaderComponent`
- `AppStatusChipComponent`
- `AppInfoCalloutComponent`
- `AppIconBoxComponent`
- `AppSectionCardComponent`
- `PendingRequestCardComponent`
- `ReservationDataGridComponent`
- `ProtocolFileCardComponent`
- `ReservationTimelineComponent`
- `DecisionPanelComponent`
- `AvailabilityCalendarComponent`
- `ReservationStepperFormComponent`

Reglas responsive actualizadas:

- En movil, las vistas operativas deben priorizar tarjetas, botones grandes y contenido apilado.
- En tablet, las tarjetas pueden mostrarse en dos columnas cuando exista ancho suficiente.
- En escritorio, las vistas de catalogo, calendario y revision pueden usar grids amplios.
- El catalogo de laboratorios debe usar cards ejecutivas con iconografia, chips compactos y acciones claras.
- Las vistas de catalogo, detalle de laboratorio y reserva por laboratorio deben
  mantener encabezados consistentes mediante `AppPageHeaderComponent` o el
  mismo patron visual equivalente.
- Los icon boxes de catalogo, filtros, resumen lateral y acciones deben usar
  Material Icons completos y centrados, evitando abreviaturas textuales como
  elemento visual principal.
- Las acciones `Ver detalle`, `Reservar` y `Reservar este laboratorio` deben
  conservar icono, texto visible y `aria-label` cuando el contexto dependa del
  laboratorio seleccionado.
- El calendario debe evitar texto repetido dentro de cada celda horaria.
- Los rangos ocupados o seleccionados deben renderizarse como bloques continuos.
- En escritorio, la vista semanal del calendario debe alinear visualmente los bloques con la columna de horas.
- Cada celda base del calendario semanal debe mantenerse en su fila horaria para evitar espacios blancos generados por autoacomodo de CSS Grid.
- La hora de cierre debe tratarse como exclusiva para no mostrar slots posteriores al horario real del laboratorio.
- La vista mensual debe verse como calendario de 7 columnas, no como lista de tarjetas.
- Los detalles de eventos en calendario pueden abrirse en dialogo operativo, sin mostrar informacion sensible del docente o practica.
- El resumen lateral de laboratorio debe evitar chips duplicados cuando las reglas ya estan explicadas como texto.
- El formulario de reserva debe mantener stepper visual y campos de ancho completo en movil.
- El stepper debe conservar numeros persistentes, etiquetas breves y una guia recta unica, sin lineas segmentadas internas.
- Los campos de formulario deben conservar el patron ejecutivo: fondo claro, bordes suaves, sombra ligera, foco institucional e iconos completos.
- El header y login deben conservar la misma familia tipografica del sistema en todos los breakpoints.
- La marca institucional, navegacion, avatar, datos del usuario, botones de sesion y botones de login no deben caer a fuentes serif o estilos nativos del navegador.
- Angular Material debe heredar la fuente base para evitar contrastes visuales entre toolbar, botones, cards, formularios, menus, dialogs y snackbars.
- En QA local del login se debe preferir `http://localhost:4200/login`.
  La pantalla debe soportar restauracion de sesion de Firebase Auth sin quedar
  detenida en estado de carga y debe conservar el logotipo multicolor de Google
  en el boton de acceso.
- La seleccion de calendario puede autopoblar fecha y horarios del formulario sin cambiar el payload de reserva.

Validaciones visuales recomendadas:

- 360 px
- 390 px
- 414 px
- 768 px
- 820 px
- 1024 px
- 1366 px
- 1440 px

Las reglas funcionales siguen siendo las mismas: el frontend no debe realizar escrituras criticas directas, la validacion backend permanece obligatoria y las rutas oficiales no cambian.

Actualizacion Fase 16A: responsive Admin/Sistemas

El Panel Admin/Sistemas prioriza escritorio, pero debe conservar funcionalidad
en movil:

- dashboard en cards apiladas en movil y grid en tablet/escritorio;
- usuarios en cards responsive, evitando tablas anchas en movil;
- filtros de usuarios en una columna en movil y grid en escritorio;
- dialog de edicion usable en pantallas pequenas;
- laboratorios en cards de lectura;
- bitacora en cards cronologicas;
- navegacion admin visible solo para `admin_sistemas`.

Los modulos admin nuevos deben reutilizar el sistema visual vigente:
`AppPageHeaderComponent`, `AppSectionCardComponent`, `AppStatusChipComponent`,
`AppIconBoxComponent`, `AppInfoCalloutComponent`, Inter, Material Icons,
paleta morada y superficies claras.

Las vistas admin nuevas tambien deben estabilizar su primera carga visual:

- al entrar a `/admin/dashboard`, `/admin/usuarios`, `/admin/laboratorios` o
  `/admin/bitacora`, la informacion debe renderizar sin requerir volver a hacer
  clic en la misma ruta;
- si una carga asincronica termina fuera del ciclo visual inmediato, la vista
  debe marcarse para refresco despues de actualizar `loading`, datos y errores;
- en movil, tablet y escritorio no debe quedar un callout de `Cargando...`
  permanente cuando la consulta ya termino.
## Actualizacion Fase 16B: responsive en gestion de laboratorios

`/admin/laboratorios` debe funcionar en mobile, tablet y desktop.

Reglas responsive:

- en mobile, usar cards apiladas, filtros de ancho completo y botones grandes;
- en tablet, permitir grid progresivo de cards;
- en desktop, usar dos columnas amplias para laboratorios;
- el dialogo de laboratorio debe ocupar `min(980px, 96vw)` y ser desplazable
  verticalmente en pantallas pequenas;
- las secciones del dialogo deben agruparse en tabs para evitar saturacion;
- los campos `calendarId`, correos y ruta QR deben permitir corte de linea y
  no provocar overflow horizontal;
- los estados de carga, vacio y error deben mantener `AppInfoCalloutComponent`.

La vista conserva el sistema visual de Fase 13: Inter, paleta morada operativa,
Angular Material para controles, Tailwind/clases globales para composicion y
cards blancas con bordes suaves.

## Actualizacion Fase 16A.1: responsive de usuarios preautorizados

La vista `/admin/usuarios` debe presentar preautorizados pendientes en cards
responsive. En movil debe apilar informacion y accion principal; en tablet y
escritorio puede usar grids. Los filtros, dialogos y callouts deben conservar
el sistema visual documentado y no provocar overflow horizontal.
## Actualizacion Fase 16B.1: responsive del dialogo de laboratorios

El dialogo de laboratorio debe ocupar:

```text
min(1120px, calc(100vw - 32px))
```

Debe respetar el viewport y ser desplazable verticalmente en pantallas
pequenas.

Reglas responsive:

- el contenido del dialogo no debe provocar scroll horizontal;
- si falta ancho, las tabs pueden desplazarse horizontalmente sin afectar los
  campos;
- los iconos dentro de callouts, chips y encabezados deben tener caja fija para
  evitar recortes o desalineaciones;
- los campos `calendarId`, correos y ruta QR deben permitir corte de linea y no
  provocar overflow horizontal.
## Actualizacion Fase 16C: responsive de reglas administrativas

La vista `/admin/reglas` debe funcionar en escritorio y tablet con cards
responsivas. En movil, las acciones deben apilarse verticalmente y los dialogs
deben usar:

```text
width: min(760px, calc(100vw - 32px))
max-height: calc(100vh - 32px)
```

Los filtros y selects deben ocupar ancho completo en pantallas pequenas. No se
deben crear tablas horizontales para reglas o bloqueos en esta fase.

## Actualizacion Fase 16D: responsive de reserva por laboratorio

La ruta `/reservar/:labSlug` debe comportarse como una experiencia
mobile-first basada en:

- calendario de disponibilidad como superficie principal;
- card de accion `Nueva solicitud` para abrir el formulario;
- dialogo responsive para el formulario de reserva;
- una columna en movil y tablet estrecha;
- calendario amplio y card lateral de accion en escritorio;
- sin overflow horizontal en el dialogo ni en el calendario;
- cierre protegido del dialogo durante el envio;
- cierre automatico del dialogo solo cuando la solicitud se procesa;
- permanencia del dialogo si ocurre un error para no perder datos capturados.

Dimensiones recomendadas para el dialogo de reserva:

- escritorio: `min(1120px, calc(100vw - 32px))`;
- movil: no exceder `calc(100vw - 24px)`;
- altura maxima: `calc(100vh - 32px)`;
- contenido con scroll interno.

La seleccion de calendario puede seguir precargando el formulario sin cambiar
los nombres de controles ni la estructura del payload.

## Actualizacion Fase 16E: responsive de Mis reservas

La ruta `/mis-reservas` debe mantener una experiencia mobile-first con:

- selector de vista `Recientes`, `Historico` y `Todas`;
- filtros apilados en movil y distribuidos en grid en escritorio;
- cards de reserva en una columna en movil, dos columnas en tablet y hasta tres
  columnas en escritorio amplio;
- callout informativo visible sobre la conservacion del historico;
- estados vacios claros para recientes e historico;
- sin tablas anchas ni overflow horizontal.

La clasificacion temporal es solo visual. No debe eliminar documentos ni
modificar rutas, servicios, guards, payloads, Cloud Functions o reglas de
seguridad.

## Actualizacion Fase 17B.2: responsive y movimiento del carrusel

El carrusel de imagenes del detalle de laboratorio debe conservar una
experiencia responsive y accesible:

- autoplay cada 5 segundos solo cuando hay mas de una imagen;
- pausa al hover, al foco de teclado y despues de controles manuales;
- respeto a `prefers-reduced-motion: reduce`;
- sin scroll horizontal en movil;
- controles e indicadores con foco visible y etiquetas accesibles;
- cambios visuales suaves, sin movimiento agresivo ni transiciones que puedan
  marear.

## Actualizacion Fase 17B.3A: logo institucional responsive

El logotipo institucional real debe mantenerse legible y proporcionado en todos
los breakpoints usando la ruta:

```text
/media/image/logo/logo_tup.png
```

Reglas responsive:

- en header desktop, el logo debe conservar caja fija y `object-fit: contain`;
- en header movil, el logo no debe comprimir la navegacion horizontal;
- en login, el logo decorativo de fondo debe ser tenue y no afectar legibilidad;
- en QR, la previsualizacion puede superponer el logo real sobre el QR cuando
  `showLogo === true`;
- PNG e impresion deben usar el logo real si puede cargarse;
- SVG puede omitirse del logo por compatibilidad tecnica;
- no usar texto `TUP` como sustituto visual principal del logo.
## Actualizacion 17C.1A: precision visual del calendario

El calendario responsive debe representar bloques ocupados usando el horario
real del evento, incluyendo minutos. La vista semanal puede usar una grilla por
hora, pero los bloques visuales deben posicionarse por porcentaje/minutos para
evitar redondear reservas de media hora a la siguiente hora completa.

Ejemplos esperados:

- `12:00 - 13:30` se muestra como `12:00 - 13:30`;
- `12:30 - 13:30` inicia a media celda;
- `08:00 - 09:00` ocupa una hora completa.

Este ajuste debe mantenerse en escritorio, tablet y movil sin repetir texto por
celda y sin romper el comportamiento de vista mensual.

## Actualizacion 17C.1B: eje temporal proporcional

La vista semanal debe renderizar cada columna de dia como un contenedor relativo
con bloques posicionados por minutos. La altura de una hora visual se controla
por `--calendar-hour-height`; cada minuto se deriva de esa altura para calcular
`top` y `height`.

Requisitos responsive:

- conservar columna de horas fija y lineas de referencia;
- evitar scroll horizontal innecesario en movil;
- mantener legibles bloques de 30 minutos o menores;
- usar `aria-label` con horario real cuando un bloque sea interactivo;
- conservar vista mensual resumida sin saturacion.

Este comportamiento visual no debe cambiar la seleccion, los formularios,
payloads, servicios ni backend.

## Actualizacion Fase 17D.1: header movil y botones del catalogo

El header responsive debe comportarse asi:

- hasta 767 px, ocultar la navegacion horizontal y mostrar menu hamburguesa;
- desde tablet/escritorio, conservar navegacion horizontal si hay espacio;
- evitar overflow horizontal;
- conservar logo institucional sin compresion;
- cerrar el menu movil al seleccionar una ruta o cerrar sesion;
- mantener contraste suficiente y foco visible.

Las acciones de cards del catalogo deben ser tactiles y claras en movil:

- `Ver detalle` como boton secundario de ancho y altura comodos;
- `Reservar` como boton primario;
- apilar acciones cuando el ancho no permita una fila estable;
- mantener iconos Material completos y centrados.

Estos ajustes son visuales y responsive; no cambian backend, permisos,
consultas, payloads ni reglas de negocio.

## Actualizacion Fase 17E.1: responsive con datos saneados

El comportamiento responsive del catalogo, detalle y reserva por laboratorio se
mantiene, pero sus datos provienen de `PublicLab`. Los componentes no deben
requerir campos administrativos para pintar cards, resumen, galeria, calendario
o formulario.

En movil, tablet y escritorio se debe conservar:

- catalogo por cards;
- detalle con galeria, resumen y disponibilidad;
- ruta QR `/reservar/:labSlug`;
- calendario con bloques saneados de `getLabAvailability`.

Ninguna vista responsive docente debe depender de lectura directa de
`labs/{labId}` completo.
