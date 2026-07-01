# Reporte de rediseño visual y componentizacion

Este documento registra los cambios visuales realizados desde la Fase 1 del rediseño institucional hasta los ajustes recientes del calendario de disponibilidad, vista mensual y resumen del laboratorio.

El alcance documentado corresponde solo a interfaz, estilos, patrones visuales y componentes presentacionales. No incluye cambios de reglas de negocio, Cloud Functions, modelos de datos, permisos, rutas funcionales ni integraciones backend.

## Objetivo del rediseño

Adoptar una interfaz moderna, minimalista, ejecutiva, institucional y responsive para el Sistema Web de Reservas de Laboratorios.

La direccion visual aplicada utiliza:

- header superior morado profundo;
- fondo general claro;
- tarjetas blancas;
- bordes suaves;
- sombras ligeras;
- botones primarios morados;
- chips de estado compactos;
- iconografia Material;
- espaciado generoso;
- jerarquia tipografica clara;
- diseño mobile-first;
- Angular Material para comportamiento y accesibilidad;
- Tailwind CSS y clases globales para layout, color, spacing y composicion.

## Sistema visual implementado

### Relacion con identidad institucional base

Los colores azul marino, azul, gris y blanco definidos en AGENTS.md y en los SDD pertenecen a la identidad institucional base del Tecnologico universitario Playacar.

La Web App usa una identidad operativa moderna basada en morado profundo para interfaz, navegacion, acciones principales y estados visuales. Esta identidad operativa no sustituye la identidad institucional base; la adapta a un producto digital ejecutivo y consistente.

No deben generarse nuevos estilos visuales fuera de este sistema sin aprobacion del propietario del proyecto.

### Colores base

Tokens principales definidos en `apps/web/src/styles.scss`:

- `--brand-primary: #21005D`
- `--brand-primary-hover: #2E1065`
- `--brand-secondary: #5B21B6`
- `--brand-accent: #6366F1`
- `--app-bg: #F8FAFC`
- `--surface: #FFFFFF`
- `--surface-soft: #F9FAFB`
- `--text-primary: #111827`
- `--text-secondary: #4B5563`
- `--text-muted: #6B7280`
- `--text-inverse: #FFFFFF`
- `--border-soft: #E5E7EB`
- `--border-strong: #D1D5DB`

Estados:

- success: fondo `#ECFDF5`, texto `#047857`, borde `#A7F3D0`
- warning: fondo `#FFFBEB`, texto `#B45309`, borde `#FDE68A`
- danger: fondo `#FEF2F2`, texto `#B91C1C`, borde `#FECACA`
- info: fondo `#EEF2FF`, texto `#4338CA`, borde `#C7D2FE`
- neutral: fondo `#F3F4F6`, texto `#374151`, borde `#D1D5DB`

### Tipografia

Se dejo como base global:

```text
Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

La familia tipografica se centralizo mediante el token global:

```text
--app-font-family
```

Este token debe aplicarse de forma consistente en:

- `body`;
- `app-root`;
- Angular Material;
- header principal;
- marca TUP;
- navegacion superior;
- avatar y datos de usuario;
- botones de sesion;
- pantalla de login;
- tarjetas, formularios, dialogos, menus y snackbars.

No deben aparecer fuentes serif en la interfaz operativa, salvo que el propietario del proyecto lo apruebe explicitamente para una pieza grafica especifica.

Actualizacion de consistencia tipografica:

- `apps/web/src/styles.scss` refuerza la herencia global de `--app-font-family`
  en `app-root`, overlays de Angular CDK, Angular Material, cards, botones,
  formularios, menus, dialogs, selects, tabs y snackbars.
- Se agrego una excepcion explicita para `mat-icon`, `.mat-icon`,
  `.material-icons` y `.material-icons-round`, de modo que los iconos conserven
  la fuente `Material Icons Round` y no se rendericen como texto.
- El objetivo es que encabezados, catalogo, cards, filtros, login, barra de
  navegacion, formularios, dialogos y componentes futuros no mezclen fuentes ni
  caigan a estilos serif o nativos del navegador.

### Estado visual de rol en AppShell/Header

El header principal debe mostrar rol y accesos solo cuando el perfil
`users/{uid}` este confirmado como activo para el usuario autenticado actual.

Reglas:

- no usar `Docente` como fallback visual mientras se carga el perfil;
- durante la restauracion de sesion, cambio de cuenta o reclamo de prealta, usar
  un texto neutro como `Validando perfil...`;
- si el perfil esta pendiente, inactivo o tiene rol no valido, mostrar un estado
  neutro como `Perfil pendiente`, `Perfil inactivo` o `Rol no valido`;
- los accesos `Responsable` y `Admin/Sistemas` solo deben renderizarse despues
  de confirmar el rol real del perfil;
- no reutilizar visualmente datos de un perfil anterior cuando cambia el UID.

Jerarquia visual usada:

- kicker: texto pequeño, uppercase, con tracking amplio y color violeta;
- titulo de pagina: fuerte, amplio, `font-weight` alto;
- titulo de card: compacto, jerarquico y oscuro;
- cuerpo: texto secundario sobrio;
- captions: texto pequeño y discreto.

## Contrato visual para nuevos modulos

Todo modulo nuevo debe respetar la misma linea visual del rediseño. Esta regla
aplica a pantallas nuevas, componentes nuevos, submodulos administrativos,
reportes, mis reservas, cancelaciones, bitacoras y cualquier refactor posterior.

Antes de implementar una nueva interfaz se debe revisar:

- este documento;
- `docs/07_FRONTEND_UI_UX_SDD.md`;
- `docs/12_RESPONSIVE_AND_PWA_SDD.md`;
- `apps/web/src/styles.scss`;
- componentes reutilizables en `apps/web/src/app/shared/components`;
- componentes de dominio existentes en `features/*/components`.

La interfaz nueva debe cumplir:

- Angular Standalone Components;
- Angular Material para comportamiento y accesibilidad;
- Tailwind CSS y clases globales para layout, spacing, color y responsive;
- Material Icons dentro de `mat-icon`;
- tipografia global `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
- tarjetas blancas con `rounded-2xl`, borde suave y sombra ligera;
- paleta operativa morada, superficies claras y textos sobrios;
- botones primarios morados y secundarios tipo link u outline;
- chips de estado compactos usando variantes success, warning, danger, info o neutral;
- encabezados reutilizables con `AppPageHeaderComponent` o patron equivalente;
- mobile-first y sin overflow horizontal;
- textos visibles en espanol;
- no mostrar `calendarId`, protocolos publicos ni informacion sensible donde no corresponda.

No se deben crear estilos aislados que contradigan la paleta, tipografia,
espaciado, iconografia o composicion documentada. Si un modulo necesita un
patron nuevo, primero debe documentarse en este reporte y en el SDD
correspondiente.

### Clases globales reutilizables

Se consolidaron en `apps/web/src/styles.scss`:

- `app-shell`
- `app-main`
- `app-container`
- `app-page-header`
- `app-page-kicker`
- `app-page-title`
- `app-page-subtitle`
- `app-section-card`
- `app-section-card-header`
- `app-section-card-title`
- `app-icon-box`
- `app-status-chip`
- `app-status-chip--success`
- `app-status-chip--warning`
- `app-status-chip--danger`
- `app-status-chip--info`
- `app-status-chip--neutral`
- `app-info-callout`
- `app-info-callout--info`
- `app-info-callout--success`
- `app-info-callout--warning`
- `app-info-callout--danger`
- `app-state-panel`

### Compatibilidad Angular Material

Se ajusto visualmente:

- `mat-card` con bordes redondeados y sombra suave;
- `mat-form-field` a ancho completo, con fondo sutil, borde suave, sombra ligera e iconos completos;
- botones Material con radio consistente;
- herencia tipografica global para botones, cards, formularios, dialogs, toolbar, menus, tabs, selects y snackbars;
- chips Material redondeados;
- snackbars por variantes visuales;
- tabs con color institucional;
- stepper con mejor espaciado base, numeros persistentes y linea guia unica.

## Fase 1: Estilos globales reutilizables

### Resumen

Se formalizo el sistema visual global. La Fase 1 centralizo tokens, clases base y compatibilidad visual con Angular Material.

### Archivo modificado

- `apps/web/src/styles.scss`

### Cambios implementados

- Variables CSS institucionales.
- Clases de layout y composicion.
- Clases de page header.
- Clases de cards y paneles.
- Clases de chips por estado.
- Clases de callouts informativos.
- Ajustes globales de Angular Material.
- Fuente base Inter con fallback system-ui.

## Fase 2: Componentes visuales simples

### Resumen

Se creo una primera capa de componentes standalone reutilizables para patrones visuales repetidos.

### Archivos nuevos agregados

- `apps/web/src/app/shared/components/app-page-header/app-page-header.component.ts`
- `apps/web/src/app/shared/components/app-status-chip/app-status-chip.component.ts`
- `apps/web/src/app/shared/components/app-info-callout/app-info-callout.component.ts`
- `apps/web/src/app/shared/components/app-icon-box/app-icon-box.component.ts`
- `apps/web/src/app/shared/components/app-section-card/app-section-card.component.ts`
- `apps/web/src/app/shared/components/index.ts`

### Componentes creados

#### AppPageHeaderComponent

Responsabilidad:

- encabezados de pagina;
- kicker;
- titulo;
- subtitulo;
- link de regreso;
- chip de estado opcional.

Inputs:

- `kicker?: string`
- `title: string`
- `subtitle?: string`
- `backLabel?: string`
- `backLink?: string`
- `statusLabel?: string`
- `statusVariant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'`
- `statusIcon?: string`

#### AppStatusChipComponent

Responsabilidad:

- chips visuales reutilizables para estados.

Inputs:

- `variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'`
- `icon?: string`
- `label?: string`

#### AppInfoCalloutComponent

Responsabilidad:

- mensajes informativos, advertencias y notas suaves.

Inputs:

- `variant: 'info' | 'success' | 'warning' | 'danger'`
- `icon?: string`
- `title?: string`
- `message?: string`

#### AppIconBoxComponent

Responsabilidad:

- iconos dentro de cajas visuales consistentes.

Inputs:

- `icon: string`
- `variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'`
- `size?: 'sm' | 'md' | 'lg'`

#### AppSectionCardComponent

Responsabilidad:

- contenedores de seccion con header, icono y contenido proyectado.

Inputs:

- `title?: string`
- `subtitle?: string`
- `icon?: string`
- `iconVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'`
- `padded?: boolean`

### Vistas migradas en Fase 2

- `apps/web/src/app/features/responsible/responsible-requests-page/`
- `apps/web/src/app/features/responsible/responsible-reservation-detail-page/`

### Archivos existentes modificados

- `apps/web/src/app/features/responsible/responsible-requests-page/responsible-requests-page.component.html`
- `apps/web/src/app/features/responsible/responsible-requests-page/responsible-requests-page.component.ts`
- `apps/web/src/app/features/responsible/responsible-requests-page/responsible-requests-page.component.scss`
- `apps/web/src/app/features/responsible/responsible-reservation-detail-page/responsible-reservation-detail-page.component.html`
- `apps/web/src/app/features/responsible/responsible-reservation-detail-page/responsible-reservation-detail-page.component.ts`
- `apps/web/src/app/features/responsible/responsible-reservation-detail-page/responsible-reservation-detail-page.component.scss`

## Fase 3: Componentes de tarjetas y paneles

### Resumen

Se crearon componentes presentacionales de dominio para el panel de responsable y la revision de reserva. La logica permanecio en los componentes padre.

### Archivos nuevos agregados

- `apps/web/src/app/features/responsible/components/pending-request-card/pending-request-card.component.ts`
- `apps/web/src/app/features/responsible/components/pending-request-card/pending-request-card.component.html`
- `apps/web/src/app/features/responsible/components/pending-request-card/pending-request-card.component.scss`
- `apps/web/src/app/features/responsible/components/reservation-data-grid/reservation-data-grid.component.ts`
- `apps/web/src/app/features/responsible/components/reservation-data-grid/reservation-data-grid.component.html`
- `apps/web/src/app/features/responsible/components/reservation-data-grid/reservation-data-grid.component.scss`
- `apps/web/src/app/features/responsible/components/protocol-file-card/protocol-file-card.component.ts`
- `apps/web/src/app/features/responsible/components/protocol-file-card/protocol-file-card.component.html`
- `apps/web/src/app/features/responsible/components/protocol-file-card/protocol-file-card.component.scss`
- `apps/web/src/app/features/responsible/components/reservation-timeline/reservation-timeline.component.ts`
- `apps/web/src/app/features/responsible/components/reservation-timeline/reservation-timeline.component.html`
- `apps/web/src/app/features/responsible/components/reservation-timeline/reservation-timeline.component.scss`
- `apps/web/src/app/features/responsible/components/decision-panel/decision-panel.component.ts`
- `apps/web/src/app/features/responsible/components/decision-panel/decision-panel.component.html`
- `apps/web/src/app/features/responsible/components/decision-panel/decision-panel.component.scss`
- `apps/web/src/app/features/responsible/components/index.ts`

### Componentes creados

#### PendingRequestCardComponent

Responsabilidad:

- renderizar una solicitud pendiente en formato card.

Inputs:

- `request`
- `showActions`

Outputs:

- `review`

#### ReservationDataGridComponent

Responsabilidad:

- mostrar datos principales de una reserva en grilla visual.

Inputs:

- `reservation`
- `fields`

#### ProtocolFileCardComponent

Responsabilidad:

- mostrar archivo de protocolo y accion de descarga o vista.

Inputs:

- `fileName`
- `fileSize`
- `fileType`
- `downloadUrl`

Outputs:

- `download`

#### ReservationTimelineComponent

Responsabilidad:

- mostrar bitacora basica tipo timeline.

Inputs:

- `events`

#### DecisionPanelComponent

Responsabilidad:

- panel visual para nota, aprobacion y rechazo.

Inputs:

- `noteControl`
- `approveLabel`
- `rejectLabel`
- `loading`
- `disabled`
- `maxLength`

Outputs:

- `approve`
- `reject`

### Vistas migradas

- `apps/web/src/app/features/responsible/responsible-requests-page/`
- `apps/web/src/app/features/responsible/responsible-reservation-detail-page/`

### Logica conservada en padres

- carga de solicitudes;
- filtros;
- navegacion a detalle;
- lectura de reserva;
- lectura de logs;
- apertura de protocolo;
- validacion de motivo;
- llamadas a `approveReservation`;
- llamadas a `rejectReservation`;
- snackbars;
- estados de carga.

### Logica en hijos

- render visual;
- emision de eventos;
- composicion de cards;
- organizacion de datos recibidos;
- estados vacios presentacionales.

## Fase 4A: AvailabilityCalendarComponent

### Resumen

Se encapsulo visualmente el calendario de disponibilidad. El padre conserva la logica de disponibilidad, servicios, generacion de dias, horas, slots, navegacion y seleccion.

### Archivos nuevos agregados

- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.ts`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.html`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.scss`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-slot-detail-dialog.component.ts`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-slot-detail-dialog.component.html`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-slot-detail-dialog.component.scss`
- `apps/web/src/app/features/calendar/components/index.ts`

### Archivos existentes modificados

- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.ts`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.html`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.scss`

### Inputs definitivos

- `title`
- `subtitle`
- `scheduleSummary`
- `viewMode`
- `currentRangeLabel`
- `days`
- `hours`
- `slots`
- `selectedSlot`
- `loading`
- `disabled`
- `emptyMessage`
- `errorMessage`
- `readLimitMessage`
- `showLegend`

### Outputs definitivos

- `previousRange`
- `nextRange`
- `today`
- `viewModeChange`
- `slotSelected`

### Mejoras visuales posteriores

Se ajusto el calendario para evitar que cada celda repitiera textos como `08:00 Disponible`.

Cambios:

- los slots disponibles quedan limpios o con indicador sutil;
- `occupied`, `risk`, `selected` y `unavailable` se muestran como bloques;
- los rangos consecutivos se agrupan visualmente;
- un evento de 14:00 a 17:00 se muestra como un solo bloque;
- los dias no disponibles muestran el texto una sola vez;
- la vista semanal fija cada celda base a su fila horaria para evitar desplazamientos visuales debajo de bloques ocupados;
- la hora de cierre se trata como exclusiva para no crear slots fuera del horario real;
- la vista mensual se ajusto a una rejilla de 7 columnas, reconocible como calendario mensual;
- se agrego un dialogo de detalle operativo para bloques del calendario, sin exponer datos sensibles;
- se redujo ruido visual.

## Fase 4B: ReservationStepperFormComponent

### Resumen

Se encapsulo visualmente el stepper/formulario de reserva sin mover Reactive Forms, validaciones, carga de protocolo, payload ni llamada a `createReservation`.

### Archivos nuevos agregados

- `apps/web/src/app/features/reservations/components/reservation-stepper-form/reservation-stepper-form.component.ts`
- `apps/web/src/app/features/reservations/components/reservation-stepper-form/reservation-stepper-form.component.html`
- `apps/web/src/app/features/reservations/components/reservation-stepper-form/reservation-stepper-form.component.scss`
- `apps/web/src/app/features/reservations/components/index.ts`

### Archivos existentes modificados

- `apps/web/src/app/features/reservations/reservation-form/reservation-form.component.ts`
- `apps/web/src/app/features/reservations/reservation-form/reservation-form.component.html`
- `apps/web/src/app/features/reservations/reservation-form/reservation-form.component.scss`
- `apps/web/src/styles.scss`

### Inputs definitivos

- `form`
- `stepperOrientation`
- `selectedLabName`
- `selectedLabSlug`
- `minDate`
- `maxDate`
- `availableStartTimes`
- `availableEndTimes`
- `practiceTypes`
- `riskOptions`
- `loading`
- `disabled`
- `submitting`
- `uploadingProtocol`
- `protocolFileName`
- `protocolFileSummary`
- `protocolRequired`
- `dateInPastError`
- `minNoticeWarning`
- `minNoticeHours`
- `protocolWarning`
- `result`
- `submitLabel`
- `cancelLabel`

### Outputs definitivos

- `currentStepIndexChange`
- `protocolSelected`
- `protocolRemoved`
- `cancel`
- `submitReservation`

### Controles del FormGroup usados

- `schedule.date`
- `schedule.startTime`
- `schedule.endTime`
- `academic.subject`
- `academic.group`
- `academic.practiceName`
- `academic.objective`
- `practice.materialRequired`
- `practice.practiceType`
- `practice.externalParticipants`
- `risk.risky`

### Logica conservada en padre

- creacion de `FormGroup`;
- validadores;
- carga de protocolo;
- eliminacion de protocolo;
- construccion de payload;
- llamada a `createReservation`;
- snackbars;
- resultado de envio;
- navegacion de regreso.

### Ajustes visuales posteriores del stepper y campos

Se corrigio la presentacion del stepper para que siga el patron visual ejecutivo:

- los pasos muestran numeros persistentes, incluso cuando Angular Material cambia el estado interno a `edit`;
- las etiquetas se redujeron a textos concisos: `Fecha`, `Datos`, `Practica`, `Riesgo`, `Resumen`;
- los numeros quedan arriba y la descripcion debajo;
- se reemplazaron los separadores nativos segmentados de Angular Material por una sola linea guia recta;
- se desactivaron los pseudo-elementos `::before` y `::after` internos de `mat-horizontal-stepper-header`, que generaban lineas entrecortadas debajo;
- la guia recta se dibuja desde el contenedor del stepper y queda detras de los circulos;
- los circulos mantienen borde de superficie para que la linea no atraviese visualmente el numero.

Tambien se reforzo la apariencia global de campos Angular Material:

- fondo claro con superficie sutil;
- borde redondeado de 16 px;
- sombra suave;
- estado hover y focus con color institucional;
- labels con peso tipografico consistente;
- iconos de sufijo alineados, completos y sin recorte.

Estos ajustes viven principalmente en `apps/web/src/styles.scss` para aplicarse de forma consistente en todas las fases y no inflar el SCSS local del componente.

## Fase 4C: Conexion calendario a formulario

### Resumen

Se conecto la seleccion visual del calendario con el formulario de reserva.

### Archivos modificados

- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.ts`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.ts`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.html`
- `apps/web/src/app/features/reservations/reservation-form/reservation-form.component.ts`

### Comportamiento implementado

Al seleccionar un slot disponible:

- se actualiza `selectedSlot`;
- se actualiza `schedule.date`;
- se actualiza `schedule.startTime`;
- se actualiza `schedule.endTime`;
- se ejecutan las validaciones existentes;
- el payload conserva la misma estructura.

Formato:

- fecha: `Date`, compatible con el datepicker;
- horas: string `HH:mm`.

No se modifico `createReservation`.

## Ajuste posterior: refresco visual despues de crear reserva

### Resumen

Se ajusto la vista para que, tras crear una reserva, el calendario visual muestre inmediatamente el bloqueo sin exigir refrescar la pagina.

### Archivos modificados

- `apps/web/src/app/features/reservations/reservation-form/reservation-form.component.ts`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.ts`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.html`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.ts`

### Comportamiento

- `ReservationFormComponent` emite evento despues de crear reserva.
- `ReserveLabPageComponent` genera un evento visual optimista si el resultado tiene estatus bloqueante.
- `LabCalendarComponent` combina eventos reales y eventos optimistas.
- Se deduplican eventos por `id`.

No cambia backend, payload ni escritura en Firestore.

## Ajuste final: cards del catalogo de laboratorios

### Resumen

Se refino la apariencia de las tarjetas del catalogo para alinearlas con el patron ejecutivo definido.

### Archivos modificados

- `apps/web/src/app/features/labs/lab-list/lab-list.component.ts`
- `apps/web/src/app/features/labs/lab-list/lab-list.component.html`
- `apps/web/src/app/features/labs/lab-list/lab-list.component.scss`
- `apps/web/src/app/features/labs/lab-detail/lab-detail.component.ts`
- `apps/web/src/app/features/labs/lab-detail/lab-detail.component.html`
- `apps/web/src/app/features/labs/lab-detail/lab-detail.component.scss`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.ts`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.html`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.scss`

### Cambios visuales

- Se reemplazaron abreviaturas por iconos Material segun tipo de laboratorio.
- Se uso `AppIconBoxComponent` para el icono principal.
- Se uso `AppStatusChipComponent` para chips consistentes.
- Se reorganizo el card en header, horario, chips y footer.
- El horario usa icono `schedule` y una linea compacta.
- `Ver detalle` queda como accion secundaria con icono.
- `Reservar` queda como boton primario solido con icono.
- Se aplico `rounded-2xl`, borde suave, sombra ligera y hover.
- Se mejoro el comportamiento responsive en movil.
- El encabezado del catalogo reemplaza la abreviatura `LAB` por un icono
  Material dentro de `AppIconBoxComponent`.
- Las herramientas superiores del catalogo usan iconografia sobria para busqueda,
  tipo, validacion y disponibilidad.
- Las acciones `Ver detalle` y `Reservar` incluyen `aria-label` contextual por
  laboratorio.
- El detalle de laboratorio usa `AppPageHeaderComponent` para alinear kicker,
  titulo, subtitulo, accion de regreso y chip de estado `Disponible`.
- El resumen lateral del laboratorio reemplaza `HR`, `24` y `OK` por iconos
  Material dentro de `AppIconBoxComponent`.
- La vista `/reservar/:labSlug` usa `AppPageHeaderComponent` para conservar el
  mismo lenguaje visual del detalle y del catalogo.

## Archivos nuevos agregados durante el rediseño

### Shared visual components

- `apps/web/src/app/shared/components/app-page-header/app-page-header.component.ts`
- `apps/web/src/app/shared/components/app-status-chip/app-status-chip.component.ts`
- `apps/web/src/app/shared/components/app-info-callout/app-info-callout.component.ts`
- `apps/web/src/app/shared/components/app-icon-box/app-icon-box.component.ts`
- `apps/web/src/app/shared/components/app-section-card/app-section-card.component.ts`
- `apps/web/src/app/shared/components/index.ts`

### Responsible domain components

- `apps/web/src/app/features/responsible/components/pending-request-card/pending-request-card.component.ts`
- `apps/web/src/app/features/responsible/components/pending-request-card/pending-request-card.component.html`
- `apps/web/src/app/features/responsible/components/pending-request-card/pending-request-card.component.scss`
- `apps/web/src/app/features/responsible/components/reservation-data-grid/reservation-data-grid.component.ts`
- `apps/web/src/app/features/responsible/components/reservation-data-grid/reservation-data-grid.component.html`
- `apps/web/src/app/features/responsible/components/reservation-data-grid/reservation-data-grid.component.scss`
- `apps/web/src/app/features/responsible/components/protocol-file-card/protocol-file-card.component.ts`
- `apps/web/src/app/features/responsible/components/protocol-file-card/protocol-file-card.component.html`
- `apps/web/src/app/features/responsible/components/protocol-file-card/protocol-file-card.component.scss`
- `apps/web/src/app/features/responsible/components/reservation-timeline/reservation-timeline.component.ts`
- `apps/web/src/app/features/responsible/components/reservation-timeline/reservation-timeline.component.html`
- `apps/web/src/app/features/responsible/components/reservation-timeline/reservation-timeline.component.scss`
- `apps/web/src/app/features/responsible/components/decision-panel/decision-panel.component.ts`
- `apps/web/src/app/features/responsible/components/decision-panel/decision-panel.component.html`
- `apps/web/src/app/features/responsible/components/decision-panel/decision-panel.component.scss`
- `apps/web/src/app/features/responsible/components/index.ts`

### Calendar domain components

- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.ts`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.html`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.scss`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-slot-detail-dialog.component.ts`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-slot-detail-dialog.component.html`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-slot-detail-dialog.component.scss`
- `apps/web/src/app/features/calendar/components/index.ts`

### Reservation domain components

- `apps/web/src/app/features/reservations/components/reservation-stepper-form/reservation-stepper-form.component.ts`
- `apps/web/src/app/features/reservations/components/reservation-stepper-form/reservation-stepper-form.component.html`
- `apps/web/src/app/features/reservations/components/reservation-stepper-form/reservation-stepper-form.component.scss`
- `apps/web/src/app/features/reservations/components/my-reservation-card/my-reservation-card.component.ts`
- `apps/web/src/app/features/reservations/components/my-reservation-card/my-reservation-card.component.html`
- `apps/web/src/app/features/reservations/components/my-reservation-card/my-reservation-card.component.scss`
- `apps/web/src/app/features/reservations/components/my-reservation-detail/my-reservation-detail.component.ts`
- `apps/web/src/app/features/reservations/components/my-reservation-detail/my-reservation-detail.component.html`
- `apps/web/src/app/features/reservations/components/my-reservation-detail/my-reservation-detail.component.scss`
- `apps/web/src/app/features/reservations/services/my-reservations.service.ts`
- `apps/web/src/app/features/reservations/my-reservation-detail-page/my-reservation-detail-page.component.ts`
- `apps/web/src/app/features/reservations/my-reservation-detail-page/my-reservation-detail-page.component.html`
- `apps/web/src/app/features/reservations/my-reservation-detail-page/my-reservation-detail-page.component.scss`
- `apps/web/src/app/features/reservations/components/index.ts`

### Documentacion

- `docs/13_VISUAL_REDESIGN_REPORT.md`

### Dialogos visuales compartidos

- `apps/web/src/app/shared/components/confirmation-dialog/confirmation-dialog.component.ts`

## Archivos existentes modificados durante el rediseño

- `apps/web/src/styles.scss`
- `apps/web/src/app/features/responsible/responsible-requests-page/responsible-requests-page.component.ts`
- `apps/web/src/app/features/responsible/responsible-requests-page/responsible-requests-page.component.html`
- `apps/web/src/app/features/responsible/responsible-requests-page/responsible-requests-page.component.scss`
- `apps/web/src/app/features/responsible/responsible-reservation-detail-page/responsible-reservation-detail-page.component.ts`
- `apps/web/src/app/features/responsible/responsible-reservation-detail-page/responsible-reservation-detail-page.component.html`
- `apps/web/src/app/features/responsible/responsible-reservation-detail-page/responsible-reservation-detail-page.component.scss`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.ts`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.html`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.scss`
- `apps/web/src/app/features/reservations/reservation-form/reservation-form.component.ts`
- `apps/web/src/app/features/reservations/reservation-form/reservation-form.component.html`
- `apps/web/src/app/features/reservations/reservation-form/reservation-form.component.scss`
- `apps/web/src/app/features/reservations/my-reservations-page/my-reservations-page.component.ts`
- `apps/web/src/app/features/reservations/my-reservations-page/my-reservations-page.component.html`
- `apps/web/src/app/features/reservations/my-reservations-page/my-reservations-page.component.scss`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.ts`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.html`
- `apps/web/src/app/features/labs/lab-list/lab-list.component.ts`
- `apps/web/src/app/features/labs/lab-list/lab-list.component.html`
- `apps/web/src/app/features/labs/lab-list/lab-list.component.scss`
- `apps/web/src/app/features/labs/lab-detail/lab-detail.component.ts`
- `apps/web/src/app/features/labs/lab-detail/lab-detail.component.html`
- `apps/web/src/app/core/layouts/app-shell/app-shell.component.scss`
- `apps/web/src/app/features/auth/login/login.component.scss`
- `apps/web/src/app/shared/components/app-icon-box/app-icon-box.component.ts`
- `apps/web/src/app/shared/components/confirmation-dialog/confirmation-dialog.component.ts`
- `apps/web/src/app/app.routes.ts`
- `docs/07_FRONTEND_UI_UX_SDD.md`
- `docs/12_RESPONSIVE_AND_PWA_SDD.md`
- `README.md`

## Rutas de archivos

No se cambiaron rutas funcionales de Angular.

No se movieron componentes antiguos de ubicacion. Los cambios se realizaron agregando componentes nuevos y sustituyendo markup visual en templates existentes.

Rutas funcionales conservadas:

- `/login`
- `/`
- `/laboratorios`
- `/laboratorios/:labId`
- `/reservar/:labSlug`
- `/mis-reservas`
- `/mis-reservas/:reservationId`
- `/responsable/solicitudes`
- `/responsable/historial`
- `/responsable/reserva/:reservationId`
- `/admin/dashboard`
- `/admin/laboratorios`
- `/admin/usuarios`
- `/admin/reglas`
- `/admin/reportes`
- `/admin/bitacora`

## Patrones visuales finales

### Cards

- fondo blanco;
- `rounded-2xl`;
- borde `border-slate-200`;
- `shadow-sm`;
- hover suave;
- padding amplio;
- icon box lila claro;
- titulo fuerte;
- texto secundario sobrio;
- footer con accion secundaria y boton primario.

### Chips

Se usan variantes:

- success para disponible o confirmado;
- warning para pendiente o riesgo;
- danger para rechazo o error;
- info para protocolo, informacion o validacion;
- neutral para estados informativos sin severidad.

### Calendario

- agenda visual limpia;
- columna de horas separada;
- disponibles sin texto repetitivo;
- ocupados como bloques continuos;
- seleccion con color institucional fuerte;
- dias no disponibles agrupados;
- leyenda compacta;
- accesibilidad con botones y aria-labels.

Reglas finales aplicadas:

- la vista semanal usa una columna fija de horas y columnas de dias sincronizadas por fila;
- cada celda base se fija explicitamente a su fila horaria para evitar que CSS Grid desplace celdas debajo de bloques ocupados;
- la hora de cierre del laboratorio es exclusiva: si el horario termina a las 20:00, el ultimo slot visual es 19:00 - 20:00;
- los bloques ocupados, pendientes o no disponibles abarcan visualmente todo su rango real;
- los bloques muestran rango y estado, por ejemplo `08:00 - 10:00` y `Ocupado`;
- los bloques pueden abrir un dialogo de detalle operativo sin exponer datos sensibles del docente o de la practica;
- la vista mensual se presenta como una rejilla de calendario de 7 columnas con encabezados de dias;
- la vista mensual usa indicadores compactos por evento y no tarjetas sueltas por dia.

Archivos asociados al ajuste semanal/mensual:

- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.ts`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.html`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.scss`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-slot-detail-dialog.component.ts`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-slot-detail-dialog.component.html`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-slot-detail-dialog.component.scss`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.ts`

### Detalle de laboratorio

El resumen lateral del laboratorio se simplifico para evitar informacion duplicada:

- usa `AppPageHeaderComponent` para el encabezado de la vista;
- mantiene accion de regreso con icono y estilo institucional;
- mantiene horario general;
- mantiene anticipacion minima;
- mantiene el texto de validaciones requeridas;
- elimina los chips redundantes `Validacion si hay riesgo` y `Protocolo si hay riesgo`;
- usa `AppIconBoxComponent` con iconos Material en lugar de abreviaturas
  textuales para horario, anticipacion y validaciones;
- conserva el boton primario `Reservar este laboratorio`.

Archivos asociados:

- `apps/web/src/app/features/labs/lab-detail/lab-detail.component.html`
- `apps/web/src/app/features/labs/lab-detail/lab-detail.component.ts`
- `apps/web/src/app/features/labs/lab-detail/lab-detail.component.scss`

### Reserva por laboratorio

La vista `/reservar/:labSlug` mantiene el mismo patron visual de encabezado que
el detalle de laboratorio:

- `AppPageHeaderComponent`;
- kicker `Reserva por laboratorio`;
- titulo con el laboratorio seleccionado;
- subtitulo breve;
- link de regreso al catalogo;
- layout en dos secciones: calendario visual y formulario por pasos.

La vista conserva la logica existente: carga de laboratorio por slug, calendario,
seleccion visual, formulario, payload y emision de reserva. El ajuste fue solo
de presentacion.

### Formularios

- stepper encapsulado;
- stepper con numeros persistentes y linea guia unica;
- campos Material outline con fondo sutil, sombra suave e iconos completos;
- botones grandes;
- resumen final en cards;
- callouts informativos;
- carga de protocolo visualmente integrada;
- responsive mobile-first.

### Header y login

Se corrigio la consistencia tipografica del header principal y de la pantalla de login para evitar que la barra superior, la marca, la navegacion, el avatar, el nombre del usuario o los botones de sesion se rendericen con una fuente distinta al resto de la interfaz.

Cambios documentados:

- `--app-font-family` centraliza la familia `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
- Angular Material y controles nativos heredan esta familia;
- `AppShellComponent` refuerza la fuente en header, marca, navegacion, avatar, usuario y boton de cierre de sesion;
- `LoginComponent` mantiene la misma fuente en card, titulo, boton de Google, textos auxiliares y llamada de seguridad;
- se conserva el patron ejecutivo morado, sin alterar autenticacion, rutas ni navegacion.

### Estabilizacion del login con Google

Se corrigio el comportamiento visual y de restauracion de sesion en la pantalla
de login:

- Firebase Auth usa `browserSessionPersistence` para alinear el login con el
  control de sesion por inactividad;
- `LoginComponent` espera brevemente la restauracion inicial de Firebase Auth
  antes de decidir que no existe sesion;
- si el usuario ya tiene sesion valida y perfil activo, `/login` redirige por
  rol sin quedarse en estado de carga;
- el texto de carga distingue entre apertura de popup, redireccion a Google y
  validacion de perfil;
- el boton `Ingresar con Google` usa el logotipo multicolor de Google mediante
  SVG, no una letra generica;
- para pruebas locales se recomienda `http://localhost:4200/login` como host
  preferente frente a `127.0.0.1`, salvo que este ultimo este autorizado en
  Firebase Authentication.

Archivos asociados:

- `apps/web/src/app/core/services/auth.service.ts`
- `apps/web/src/app/features/auth/login/login.component.ts`
- `apps/web/src/app/features/auth/login/login.component.html`
- `apps/web/src/app/features/auth/login/login.component.scss`

### Panel responsable

- solicitudes en tarjetas;
- detalle de reserva por secciones;
- bitacora tipo timeline;
- panel de decision separado;
- acciones de aprobar/rechazar emitidas al padre.

## Fase 14: Mis reservas y detalle docente

### Resumen

Se implemento la vista personal de reservas para docentes y usuarios
institucionales, manteniendo la regla de que `/mis-reservas` solo muestra
reservas donde `teacherUid === currentUser.uid`.

El modulo es solo de consulta. No permite cancelar, aprobar, rechazar ni
modificar reservas desde Angular. Las operaciones criticas siguen pasando por
Cloud Functions.

### Rutas implementadas

- `/mis-reservas`
- `/mis-reservas/:reservationId`

Ambas rutas usan guards existentes de autenticacion y perfil activo. La ruta de
detalle valida desde el servicio que la reserva pertenezca al usuario
autenticado antes de mostrarla.

### Archivos nuevos agregados

- `apps/web/src/app/features/reservations/services/my-reservations.service.ts`
- `apps/web/src/app/features/reservations/components/my-reservation-card/my-reservation-card.component.ts`
- `apps/web/src/app/features/reservations/components/my-reservation-card/my-reservation-card.component.html`
- `apps/web/src/app/features/reservations/components/my-reservation-card/my-reservation-card.component.scss`
- `apps/web/src/app/features/reservations/components/my-reservation-detail/my-reservation-detail.component.ts`
- `apps/web/src/app/features/reservations/components/my-reservation-detail/my-reservation-detail.component.html`
- `apps/web/src/app/features/reservations/components/my-reservation-detail/my-reservation-detail.component.scss`
- `apps/web/src/app/features/reservations/my-reservation-detail-page/my-reservation-detail-page.component.ts`
- `apps/web/src/app/features/reservations/my-reservation-detail-page/my-reservation-detail-page.component.html`
- `apps/web/src/app/features/reservations/my-reservation-detail-page/my-reservation-detail-page.component.scss`

### Archivos modificados

- `apps/web/src/app/app.routes.ts`
- `apps/web/src/app/features/reservations/my-reservations-page/my-reservations-page.component.ts`
- `apps/web/src/app/features/reservations/my-reservations-page/my-reservations-page.component.html`
- `apps/web/src/app/features/reservations/my-reservations-page/my-reservations-page.component.scss`
- `apps/web/src/app/features/reservations/components/index.ts`
- `README.md`

### Vista `/mis-reservas`

La vista muestra:

- encabezado visual con `AppPageHeaderComponent`;
- contador de reservas personales;
- filtros por busqueda, estatus, revision requerida, fecha desde/hasta y orden;
- cards responsive con folio, laboratorio, fecha, horario, estatus, tipo de
  practica, protocolo requerido y revision requerida;
- estados de carga, error, vacio y sin resultados.

### Vista `/mis-reservas/:reservationId`

El detalle muestra:

- folio;
- laboratorio;
- fecha;
- horario;
- estatus;
- datos academicos;
- tipo de practica y especificacion de `Otro` cuando aplica;
- material riesgoso;
- pacientes, usuarios simulados o poblacion externa;
- protocolo requerido;
- protocolo adjunto;
- sincronizacion Calendar sin exponer `calendarId`;
- bitacora basica.

El protocolo se abre mediante Firebase Storage SDK si las reglas permiten leer
el archivo privado. No se generan enlaces publicos ni se exponen rutas privadas
como links permanentes.

### Ajuste de bitacora basica

La bitacora basica del detalle docente ya no muestra claves tecnicas crudas como
texto principal. El componente `MyReservationDetailComponent` traduce acciones
de `reservationLogs` a textos claros para usuario final:

- `CREATED`: Solicitud registrada.
- `AUTO_CONFIRMED`: Reserva confirmada.
- `PENDING_APPROVAL`: Pendiente de validacion.
- `APPROVED`: Reserva aprobada.
- `REJECTED`: Reserva rechazada.
- `CANCELLED`: Reserva cancelada.
- `CALENDAR_EVENT_CREATED`: Agendada en calendario.
- `CALENDAR_EVENT_CANCELLED`: Evento de calendario cancelado.
- `CALENDAR_ERROR`: Error de calendario.
- `EMAIL_SENT`: Notificacion enviada.
- `EMAIL_ERROR`: Error al enviar notificacion.
- `STATUS_CHANGED`: estatus legible de la reserva, usando `newStatus` cuando
  existe.

Cuando el log tiene `note`, se conserva como mensaje contextual. Si no existe
nota, se usa una descripcion predeterminada clara. La linea de tiempo usa puntos
de color por severidad: success, warning, danger, info y neutral.

### Confirmaciones de alcance Fase 14

- No se modificaron Cloud Functions.
- No se modificaron reglas Firestore o Storage.
- No se modificaron modelos de datos.
- No se modificaron permisos ni roles.
- No se cambio el payload de reservas.
- No se agregaron escrituras directas desde Angular.
- No se expone `calendarId`.
- No se generan enlaces publicos a Storage.

### Correos institucionales Gmail

Antes de Fase 14 se ajustaron las plantillas HTML de correos enviados por
Gmail API para alinearlas con la identidad visual TUP compartida por el
propietario del proyecto.

Patron aplicado:

- contenedor centrado sobre fondo claro;
- encabezado blanco con logotipo TUP;
- franja institucional en `#271e5d` con acento `#252a86`;
- titulo del correo;
- saludo e introduccion segun tipo de notificacion;
- panel destacado de estatus actual;
- tabla de datos de reserva;
- nota de seguridad sobre protocolos;
- pie institucional.

En Fase 13.5 se estabilizo la plantilla como layout institucional reutilizable:

- `buildInstitutionalEmailLayout` construye la tarjeta HTML con estilos inline
  compatibles con clientes de correo;
- el logotipo viaja como imagen inline `cid:tup-logo` desde
  `functions/src/modules/notifications/assets/logo_tup.png`;
- Gmail conserva fallback `text/plain` mediante `multipart/alternative`;
- cuando hay logotipo inline, Gmail usa `multipart/related`;
- el panel de estatus muestra folio y estado;
- la tabla de datos incluye tipo de practica, condiciones de seguridad,
  protocolo requerido, protocolo adjunto y nombres de archivos cuando aplica;
- los asuntos quedan alineados por tipo de notificacion: confirmada, pendiente,
  aprobada, rechazada, error de calendario, error tecnico y cancelada.

No se usan enlaces publicos para imagenes ni protocolos. No se adjuntan
protocolos, no se exponen rutas de Storage y no se muestra `calendarId`.

Archivos asociados:

- `functions/src/modules/notifications/email-templates.ts`
- `functions/src/modules/notifications/gmail.service.ts`
- `functions/src/modules/notifications/email-assets.ts`
- `functions/src/modules/notifications/assets/logo_tup.png`

## Confirmaciones de alcance

- No se modificaron roles.
- No se modificaron estatus.
- No se modificaron colecciones.
- No se modificaron rutas funcionales.
- No se modificaron servicios backend.
- No se modificaron Cloud Functions.
- No se modificaron reglas Firestore o Storage.
- No se modifico `createReservation`.
- No se modifico `approveReservation`.
- No se modifico `rejectReservation`.
- No se modificaron integraciones Google Calendar o Gmail API.
- No se cambio la estructura del payload de reserva.

## Validaciones ejecutadas

Durante las fases se ejecuto build de Angular de forma recurrente:

```bash
npm --prefix apps/web run build
```

En fases que tocaron solo frontend visual tambien se verifico que Functions siguiera compilando cuando aplicaba:

```bash
npm --prefix functions run lint
npm --prefix functions run build
```

Warnings conocidos:

- `Sass @import` de Tailwind en `styles.scss` esta marcado como deprecado por Dart Sass.
- El bundle inicial excede el budget configurado de Angular.
- El SCSS de `AvailabilityCalendarComponent` puede exceder el budget local del componente por la cantidad de estados visuales del calendario.

Estos warnings no impiden el build, pero quedan como deuda tecnica visual/build.

## Recomendaciones siguientes

1. Revisar visualmente todos los breakpoints minimos: 360, 390, 414, 768, 820, 1024, 1366 y 1440 px.
2. Homologar el panel Admin/Sistemas con los componentes visuales ya creados.
3. Evaluar reemplazar `@import "tailwindcss"` cuando Tailwind/Angular recomiende una alternativa compatible sin warning Sass.
4. Revisar budget inicial de Angular y separar chunks si el crecimiento visual continua.
5. Probar manualmente `/mis-reservas` y `/mis-reservas/:reservationId` en movil, tablet y escritorio con datos reales.

## Fase 16A: Base visual del Panel Admin/Sistemas

Se inicia la homologacion del Panel Admin/Sistemas con el sistema visual
institucional.

Rutas completadas:

- `/admin/dashboard`
- `/admin/usuarios`
- `/admin/laboratorios`
- `/admin/bitacora`

Patrones aplicados:

- encabezados con `AppPageHeaderComponent`;
- cards blancas con `AppSectionCardComponent`;
- chips con `AppStatusChipComponent`;
- iconografia Material;
- filtros Angular Material con tipografia Inter;
- layout mobile-first en cards y grids progresivos;
- callouts institucionales para estados de lectura, carga, error y alcance.

`/admin/dashboard` usa cards de estadisticas y accesos rapidos. `/admin/usuarios`
usa tarjetas responsive y dialogo de edicion. `/admin/laboratorios` queda como
lectura operativa sin mostrar `calendarId`. `/admin/bitacora` presenta
`auditEvents` como eventos legibles.

La navegacion superior agrega accesos administrativos para `admin_sistemas` sin
mostrarlos a docentes o responsables sin privilegio admin.

Para cuidar el rendimiento visual, las paginas admin implementadas en Fase 16A
se cargan con `loadComponent`; no deben importarse eager en `app.routes.ts`,
porque inflan el bundle inicial.

### Estabilizacion de carga inicial en vistas admin

Se corrigio un problema visual donde algunas rutas nuevas de Admin/Sistemas
podian quedarse mostrando `Cargando...` en la primera navegacion y solo
renderizar datos despues de volver a hacer clic en la misma vista.

El ajuste se aplico en:

- `/admin/dashboard`
- `/admin/usuarios`
- `/admin/laboratorios`
- `/admin/bitacora`

La causa estaba asociada a cargas asincronicas con Firebase SDK modular y
actualizacion de propiedades del componente fuera del disparo visual inmediato.
Las vistas mantienen las mismas consultas, servicios, guards, rutas y permisos,
pero al cerrar el ciclo de carga marcan explicitamente la vista para refresco.

Regla para pantallas admin futuras:

- toda vista lazy-loaded que use `getDocs`, callable Functions o cualquier
  carga asincronica similar debe cerrar `loading` de forma explicita;
- despues de actualizar arrays, mensajes de error o banderas de UI, debe
  garantizarse que Angular renderice el nuevo estado en la primera entrada;
- no se debe depender de un segundo clic de navegacion para mostrar datos;
- este ajuste es solo de estabilidad visual y no modifica reglas de negocio.

No se introducen paletas, tipografias ni estilos alternos. Cualquier modulo
admin posterior debe continuar esta misma linea visual.
## Fase 16A.1: Autoalta docente y prealta administrativa

Se agrega soporte visual y funcional para diferenciar dos caminos de acceso:

- docentes con correo `tup-dNUMEROS@tecplayacar.edu.mx`, dados de alta
  automaticamente por backend al iniciar sesion;
- responsables/coordinadores preautorizados por Admin/Sistemas desde
  `/admin/usuarios`.

Cambios visuales:

- `/admin/usuarios` agrega callout informativo, boton `Agregar responsable`,
  dialog institucional y seccion de preautorizados pendientes;
- la pantalla de acceso pendiente explica el criterio docente automatico y la
  necesidad de prealta administrativa para responsables/coordinadores;
- los nuevos elementos reutilizan `AppInfoCalloutComponent`,
  `AppSectionCardComponent`, `AppStatusChipComponent`, Angular Material,
  Inter, Material Icons y la paleta morada operativa.

Regla de continuidad:

Las pantallas administrativas futuras deben conservar esta misma linea visual,
cerrar `loading` explicitamente y renderizar datos en la primera navegacion.

## Fase 16F: Revocacion visual de prealtas

Se ajusta `/admin/usuarios` para mantener trazabilidad administrativa sin
acciones destructivas:

- la seccion de prealtas muestra estados `Pendiente`, `Reclamada` y `Revocada`
  con `AppStatusChipComponent`;
- el boton `Revocar prealta` aparece solo en prealtas activas, no reclamadas y
  no revocadas;
- la revocacion usa un dialogo institucional con motivo opcional, advertencia y
  acciones claras;
- los usuarios existentes muestran `Estado de acceso` en lugar de destacar UID
  como dato principal;
- los errores tecnicos de revocacion no se muestran como `internal`; la UI
  presenta un mensaje administrativo claro para Admin/Sistemas;
- se conserva la linea visual: Inter, cards blancas, chips compactos, iconos
  completos y callouts con la paleta morada operativa.

La regla de producto queda documentada en UI: no se eliminan usuarios
existentes; se suspenden con `active: false`.

## Fase 16B: Gestion visual de laboratorios

Se amplia `/admin/laboratorios` como pantalla operativa de gestion completa,
manteniendo la identidad visual institucional.

Componentes y patrones usados:

- `AppPageHeaderComponent` para encabezado;
- `AppSectionCardComponent` para filtros y cards de laboratorio;
- `AppStatusChipComponent` para estado activo/visible;
- `AppInfoCalloutComponent` para avisos y estados de carga/error/vacio;
- Angular Material Dialog, Tabs, Form Fields, Select, Checkbox, Buttons e
  Icons;
- Tailwind CSS para grid, spacing, responsive y jerarquia visual.

Nuevo componente:

```text
apps/web/src/app/features/admin/components/admin-lab-edit-dialog/admin-lab-edit-dialog.component.ts
```

El dialogo usa secciones:

- Datos generales;
- Disponibilidad;
- Responsables;
- Calendario.

Reglas visuales:

- no mostrar `calendarId` fuera de Admin/Sistemas;
- mantener textos en espanol;
- evitar tablas anchas en mobile;
- usar cards y filtros con la misma proporcion de Fase 13;
- cerrar estados de carga en primera navegacion;
- no introducir paletas ni tipografias alternas.

Esta fase no rediseña catalogo docente, calendario, reservas ni responsable;
solo homologa y habilita la gestion administrativa de laboratorios.
## Ajuste visual Fase 16B.1: dialogo de laboratorios e iconografia

Se estabilizo la presentacion del dialogo de alta y edicion de laboratorios
despues de detectar que el ancho util era insuficiente y que algunos iconos de
avisos se recortaban.

Cambios visuales aplicados:

- el dialogo `AdminLabEditDialogComponent` usa un ancho operativo de
  `min(1120px, calc(100vw - 32px))`;
- el `maxWidth` y `maxHeight` se ajustan al viewport para evitar que el modal
  se salga de pantalla;
- el panel `admin-lab-dialog-panel` controla radio, sombra, superficie y
  overflow;
- se elimina el scroll horizontal del contenido del dialogo;
- las tabs pueden desplazarse horizontalmente si el viewport es reducido;
- `AppInfoCalloutComponent` y `AppStatusChipComponent` definen una caja fija
  para `mat-icon`, evitando iconos recortados o descentrados;
- el encabezado del dialogo usa una caja de icono con dimensiones fijas.

Regla para futuros dialogos administrativos:

- no depender del `maxWidth` por defecto de Angular Material cuando el dialogo
  contenga formularios amplios o tabs;
- usar `panelClass` especifico cuando se requiera controlar superficie,
  overflow y responsividad;
- asegurar que todo icono dentro de callouts, chips o acciones tenga ancho,
  alto y `line-height` definidos;
- evitar scroll horizontal salvo que sea una navegacion de tabs o contenido
  deliberadamente desplazable.
## Fase 16C: reglas y bloqueos administrativos

Se agrego la pantalla `/admin/reglas` con la misma linea visual del panel
Admin/Sistemas:

- encabezado con kicker, titulo y subtitulo;
- cards blancas `rounded-2xl` con bordes suaves;
- chips compactos para activo/inactivo;
- callouts para alcance y seguridad;
- dialogs Material responsive;
- iconografia Material centrada y completa;
- tipografia Inter y paleta operativa morada.

El cambio es visual y administrativo. No altera rutas publicas, roles ni
permisos existentes. Las acciones criticas se delegan a Cloud Functions.

## Fase 16D: reserva con calendario amplio y formulario modal

Se refactorizo visualmente la ruta `/reservar/:labSlug` para reducir saturacion
en escritorio y mejorar la experiencia de captura:

- el calendario queda como superficie principal de disponibilidad;
- la solicitud se inicia desde una card lateral o superior con boton
  `Nueva solicitud`;
- el formulario se abre en `ReservationFormDialogComponent`, un dialogo
  Material responsive;
- el dialogo reutiliza `ReservationFormComponent` y
  `ReservationStepperFormComponent`;
- la seleccion previa de calendario se conserva y precarga fecha, hora de
  inicio y hora de finalizacion en el formulario;
- el dialogo se bloquea durante el envio para evitar cierre accidental;
- si la solicitud se procesa, el dialogo se cierra y el calendario se refresca
  con el evento optimista cuando el estatus bloquea horario;
- si hay error, el dialogo permanece abierto y conserva los datos capturados.

Archivos nuevos:

```text
apps/web/src/app/features/reservations/components/reservation-form-dialog/reservation-form-dialog.component.ts
apps/web/src/app/features/reservations/components/reservation-form-dialog/reservation-form-dialog.component.html
apps/web/src/app/features/reservations/components/reservation-form-dialog/reservation-form-dialog.component.scss
```

Archivos ajustados:

```text
apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.ts
apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.html
apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.scss
apps/web/src/app/features/reservations/reservation-form/reservation-form.component.ts
apps/web/src/app/features/reservations/components/index.ts
apps/web/src/styles.scss
```

No se modifico logica de negocio, payload, rutas, modelos, servicios de reserva,
Cloud Functions, Calendar API ni Gmail API. El cambio se limita a layout,
dialogo, mensajes visuales y preservacion del flujo existente.

### Ajuste Fase 16D.1: campos de fecha y hora en formulario modal

Se ajusto la experiencia del formulario de nueva solicitud dentro del dialogo:

- el campo completo `Fecha de reserva` abre el datepicker al hacer clic, no
  solo el icono del calendario;
- los campos de hora conservan `type="time"` y usan el control nativo del
  navegador, sin icono Material duplicado;
- se amplio el espacio interno de los campos de hora para evitar recortes en
  formatos regionales como `p. m.`;
- se agregaron reglas visuales para los subcampos nativos WebKit de
  hora/minuto/a. m./p. m. usados por Chrome y Edge;
- el ajuste es visual/accesible y no modifica controles, validaciones,
  payload, servicios ni backend.

## Fase 16E: Mis reservas recientes e historico

Se ajusto la pantalla `/mis-reservas` para reducir saturacion visual sin perder
trazabilidad institucional.

Cambios visuales:

- se agrego selector de vista `Recientes`, `Historico` y `Todas`;
- la vista por defecto es `Recientes`;
- se agrego callout informativo sobre la conservacion de reservas antiguas;
- los estados vacios ahora distinguen `Sin reservas recientes` y
  `No hay reservas historicas`;
- los filtros existentes se conservan dentro de cada vista;
- el selector usa superficies claras, bordes suaves, foco visible y la paleta
  operativa morada.

Regla funcional documentada:

- `Recientes` muestra reservas futuras, reservas de los ultimos 3 meses y
  reservas antiguas con estatus `PENDIENTE_VALIDACION`, `CONFIRMADA`,
  `CONFIRMADA_TRAS_VALIDACION` o `ERROR_CALENDAR`;
- `Historico` muestra reservas anteriores a 3 meses que no estan pendientes ni
  bloqueando horario;
- `Todas` muestra todas las reservas personales.

No se eliminan documentos de Firestore. Permanecen intactas las colecciones
`reservations`, `reservationLogs`, `notifications` y `auditEvents`. Tampoco se
modifican Cloud Functions, Calendar API, Gmail API, rutas, roles, payloads ni
reglas de negocio.

## Fase 17B.1: galeria admin de laboratorios

Se agrego una pestana `Galeria` al dialogo administrativo de laboratorios con
la misma linea visual del sistema:

- card/dialogo blanco con bordes suaves y sombra ligera;
- contador de imagenes activas;
- callouts institucionales para limites y seguridad;
- previews en tarjetas compactas;
- acciones con Angular Material y Material Icons;
- campos `alt` y `caption` con apariencia outline;
- botones para portada, activar/desactivar y reordenar;
- progreso de carga visible.

La implementacion conserva la paleta operativa morada, tipografia Inter y
componentes Angular Material. No introduce nuevas dependencias ni estilos fuera
del sistema visual.

No se implementa carrusel publico todavia. La galeria queda preparada para
catalogo/detalle en una fase posterior.

## Fase 17B.2: carrusel en detalle de laboratorio

Se agrego un carrusel de imagenes a `/laboratorios/:labId` siguiendo el sistema
visual institucional:

- superficie blanca con borde suave, radio amplio y sombra ligera;
- imagen principal con `object-fit: cover`;
- degradado inferior para legibilidad de titulo y caption;
- controles con Material Icons, foco visible y contraste suficiente;
- indicadores compactos;
- fallback institucional con icono `photo_library`;
- comportamiento responsive mobile-first.

El carrusel se inserta despues del encabezado de pagina y antes del layout con
resumen/calendario. No desplaza ni modifica el calendario de disponibilidad ni
el flujo de reserva.

Las URLs se resuelven temporalmente en memoria desde Firebase Storage SDK. No
se guardan `downloadUrl` en Firestore ni se muestran rutas internas de Storage.

### Ajuste Fase 17B.2.1: autoplay accesible del carrusel

Se agrego comportamiento automatico al carrusel de detalle de laboratorio sin
alterar la carga de imagenes ni datos:

- cambio automatico cada 5 segundos cuando hay mas de una imagen;
- pausa al pasar el cursor sobre el carrusel;
- pausa al enfocar el componente con teclado;
- pausa definitiva cuando el usuario usa flechas o indicadores;
- respeto a `prefers-reduced-motion: reduce`;
- texto auxiliar para lectores de pantalla mediante `aria-live`.

El ajuste es estrictamente presentacional. No modifica laboratorios, reservas,
Storage, Calendar, Gmail, roles, rutas ni Cloud Functions.

## Fase 17B.3: QR personalizable por laboratorio

Se agrego una pestana `QR` al dialogo de administracion de laboratorios para
previsualizar y exportar codigos QR de reserva con identidad visual
institucional.

Patron visual:

- card blanca con borde suave y sombra ligera;
- logo institucional real opcional;
- colores configurables dentro de la paleta institucional;
- acciones consistentes: copiar enlace, descargar PNG, descargar SVG e imprimir;
- advertencia de contraste cuando la combinacion de colores podria afectar
  legibilidad;
- advertencia cuando cambia el `slug` porque cambia la URL impresa.

La configuracion visual se guarda como `qrConfig` en el documento del
laboratorio. El QR no se guarda como archivo ni como base64. La URL siempre se
deriva del `slug` y apunta a:

```text
https://reservas-laboratorios-tup.web.app/reservar/{slug}
```

### Ajuste Fase 17B.3A: logo institucional real

Se reemplazaron simulaciones textuales de marca por el logotipo institucional
real:

```text
/media/image/logo/logo_tup.png
```

Cambios visuales:

- `AppShellComponent` usa el logo real en el header principal;
- `LoginComponent` usa el logo real como marca principal y como fondo
  decorativo tenue;
- `AdminLabQrPreviewComponent` usa el logo real en la previsualizacion de QR;
- la descarga PNG de QR y la impresion intentan incrustar el logo real cuando
  `showLogo === true`;
- la configuracion del QR se renombra visualmente a `Mostrar logo institucional`;
- se conserva fallback tecnico con icono si el logo falla.

El SVG de QR permanece sin logo incrustado para evitar problemas de
compatibilidad vectorial. No se guardan logos, QR ni imagenes base64 en
Firestore o Storage.

## Fase 17D.1: navegacion movil y accion secundaria de catalogo

Se agrego una mejora responsive al AppShell: en celulares se usa un menu
hamburguesa institucional, con Material Icons, contraste sobre morado profundo y
rutas condicionadas por rol. En tablet y escritorio se mantiene la barra
horizontal existente para conservar eficiencia de navegacion.

Tambien se ajusto la accion `Ver detalle` en las tarjetas de laboratorios para
que se lea como boton secundario, no como enlace suelto. El boton usa fondo
suave, borde, radio consistente, icono de ojo y estado hover/focus alineado al
sistema visual. `Reservar` permanece como accion primaria.

La fase mantiene la tipografia Inter/system-ui, la paleta operativa morada,
cards blancas con bordes suaves y accesibilidad basica mediante Angular
Material. No se alteraron flujos funcionales ni backend.
