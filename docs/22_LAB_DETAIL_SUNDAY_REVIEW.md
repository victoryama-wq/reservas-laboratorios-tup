# Detalle de laboratorios y solicitudes dominicales

Fecha: 2026-10-22. Base: `main`, `771b71e` (`v1.1.0`).

## Cambios de esta entrega

- El resumen del catálogo/detalle lee los siete días de `weeklySchedule`.
  Ya no afirma siempre que el domingo está cerrado ni aplica el horario de
  lunes a todos los días hábiles.
- Nueva opción por laboratorio en **Admin → Laboratorios → Editar → Disponibilidad**:
  «Bloquear solicitudes del domingo para el lunes antes de las 12:00».
- Campo `blockSundayRequestsForMondayMorning`, desactivado cuando falta.
  No se migraron ni modificaron los documentos productivos.
- Con la opción activa, una solicitud recibida en domingo rechaza los inicios
  anteriores a las 12:00 del lunes inmediato, en `America/Cancun`.
  Las 12:00 quedan fuera de esta política; todas las demás reglas siguen vigentes.
- La decisión se toma en backend por ocurrencia y usa la hora de recepción
  del servidor para todo el lote. Conserva estado `RECHAZADA_REGLA_HORARIO`,
  motivo visible, bitácora y flujo existente de notificación.
- El formulario informa la política antes de enviar. La política es independiente
  de abrir/cerrar el laboratorio el domingo y no se reevalúa al aprobar.

## Diagnóstico del error 500

La ruta «Ver detalle» apunta al identificador correcto y llama a
`getPublicLabDetail`. Los diez laboratorios consultados estaban activos y
visibles; todos tenían `weeklySchedule.sunday.enabled = false`.

El error se reprodujo antes de la validación de autenticación: una petición
sin token devuelve HTTP 500 HTML de Google Frontend en lugar del 401 JSON
esperado del callable. También se observaron errores en catálogo,
disponibilidad y creación, sin enviar solicitudes autenticadas ni crear reservas.

Evidencia de Cloud Logging y revisiones:

- `getpubliclabdetail-00008-zul` atendió solicitudes correctamente el mismo día.
- A las 22:06:34 UTC aparece «The request failed because the instance could
  not start successfully»; otras respuestas 500 tienen latencia 0 y no llevan
  identificador de instancia.
- El redeploy de recuperación usó únicamente el código de la base validada
  para `getPublicLabDetail`, antes de incorporar la nueva regla al backend.
  Un primer intento local agotó el plazo de descubrimiento; se reintentó con
  `FUNCTIONS_DISCOVERY_TIMEOUT=60`.
- Las revisiones `00009-yiy` y `00010-tej` fallaron en el health check de
  arranque/puerto 8080, con «Internal error occurred while performing container
  health check». No hay un stack de aplicación asociado que permita atribuir
  la causa a la consulta Firestore.
- Proyecto activo, facturación habilitada y cuenta de facturación abierta.
  El servicio de detalle no monta secretos ni tiene conector VPC configurado.
  El agente de Cloud Run conserva su rol `roles/run.serviceAgent`.
- La consulta de logs inicialmente agotó la cuota del cliente OAuth de Firebase;
  usar `x-goog-user-project: reservas-laboratorios-tup` permitió consultar
  los registros. Ese 429 de diagnóstico no demuestra la causa del 500 productivo.

Referencia para interpretar el fallo de arranque:
[Diagnóstico oficial de Cloud Run](https://docs.cloud.google.com/run/docs/troubleshooting#container-failed-to-start).
### Recuperación y contraste de memoria

Se probó temporalmente 512 MiB en el servicio de detalle, manteniendo 1 CPU.
La revisión `00011-bit` arrancó y devolvió 401 JSON ante una petición sin
sesión. Sin embargo, catálogo, disponibilidad y creación también se recuperaron
sin cambios, por lo que no se atribuye la recuperación al aumento de memoria.

Se restauraron los 256 MiB y 1 CPU originales. La revisión `00012-gam` quedó
saludable a las 22:42:51 UTC, con arranque en 7,17 segundos. No se conserva
un aumento de recursos ni un cambio especulativo de configuración.

Conclusión: hubo un fallo de arranque en Cloud Run que después se recuperó.
La evidencia apunta a una condición transitoria de infraestructura; no prueba
un defecto de consulta Firestore, una falta de memoria ni un incidente global
confirmado por Google. La causa raíz de la plataforma queda sin confirmar.

Smoke autenticado de lectura: se recorrieron las diez rutas obtenidas de
**Laboratorios admin → Ver detalle** y las diez cargaron su detalle. Taller de
Arquitectura y Sala de Juicios Orales muestran galería, resumen y calendario.
Fisioterapia devolvió un 500 durante la transición entre revisiones; al recargar
cargó correctamente. El registro de ese fallo pertenece a `00011-bit`.
Las comprobaciones finales se realizaron con `00012-gam` activa y 256 MiB.
No se crearon reservas, eventos ni notificaciones durante el smoke.

## Programación de Cloud SQL descartada como dependencia directa

Se revisaron, sin modificarlas, las tareas de `nomina-docente-prod`:

- `nomina-cloudsql-apagar`: 22:00, `America/Cancun`, aplica `activationPolicy=NEVER`.
- `nomina-cloudsql-encender`: 06:50, `America/Cancun`, aplica `activationPolicy=ALWAYS`.

Ambas apuntan exclusivamente a la instancia `nomina-docente-web` de ese
proyecto. Reservas usa Firestore y no depende de esa instancia. En Reservas,
las tareas observadas son las dos limpiezas de archivos de las 03:00 y 03:30.

## Validación y publicación

- `npm run validate`: 56 pruebas backend, 25 frontend, lint y builds aprobados.
- Tras agregar cobertura del interruptor administrativo: `npm run test:web`,
  27 pruebas aprobadas. No hubo cambios de implementación después del build.
- Verificación de cierre previa a commit y deploy: `npm run validate` completo,
  56 pruebas backend y 27 frontend, lint y ambos builds aprobados.
- Advertencias de build: Sass `@import`, presupuestos de bundle/estilos y
  dependencia CommonJS `qrcode`; no son errores de compilación.
- La recuperación operativa anterior no incluía la nueva regla ni el frontend.
- El propietario autorizó commit, push y deploy el 2026-10-22. La entrega
  comprende `createReservation`, `adminCreateLab`, `adminUpdateLab`,
  `getPublicLabs`, `getPublicLabDetail` y Firebase Hosting. Las Functions se
  publican antes del frontend para que el backend admita el nuevo campo.
- La opción permanece desactivada en los laboratorios que no tienen el campo.
  Su activación se realiza desde Administración en los laboratorios elegidos;
  el despliegue no modifica horarios ni documentos existentes.
- El smoke de publicación debe comprobar el detalle, el resumen de siete días
  y el interruptor en Disponibilidad sin guardar cambios productivos de prueba.
  La aceptación funcional de la nueva restricción requiere posteriormente
  activar la opción y validar el flujo institucional con los tres roles.
