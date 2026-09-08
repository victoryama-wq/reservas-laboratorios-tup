# Revisión de Reglas y fechas institucionales

Fecha: 2026-09-08. Implementación y validación automatizada completas.
Commit, push y deploy completados el 2026-09-08. El propietario confirmó
posteriormente: «Quedo excelente, los smoke pasaron». Fase cerrada.

## Alcance

Se revisó la creación y edición de reglas especiales, su efecto en laboratorios,
la consulta de disponibilidad, los bloqueos extraordinarios y los resultados
al solicitar una o varias fechas. El propietario confirmó `America/Cancun`
para todos los módulos que manejan fechas.

## Cambios

1. **Guardar reglas:** se limpian opcionales antes de escribir `specialRules`
   en Firestore. Sin días seleccionados se envía `[]`. Vaciar vigencia u horas
   de una regla usa `null` explícito. Editar conserva el laboratorio de origen.
2. **Errores del formulario:** reglas y bloqueos guardan dentro del diálogo;
   bloquean envíos repetidos, mantienen datos ante errores y permiten reintentar.
3. **Calendario:** expande las reglas en Cancún, también para consultas
   intradía. Respeta días y vigencia, recorta bloques de varios días y no
   interpreta una consulta fallida como disponibilidad libre.
4. **Día completo:** usa medianoches de Cancún con fin exclusivo. El formulario
   muestra el último día incluido. Los periodos legados se normalizan al leer,
   sin modificar datos; un periodo legado marcado como día completo puede
   impedir nuevas reservas fuera de sus antiguas horas parciales.
5. **Mensajes:** el rechazo por regla indica que el horario está bloqueado y
   pide seleccionar otro. No incorpora el motivo administrativo. El resultado
   permanece en la página con cada fecha, folio y enlace al detalle, incluso
   después de cerrar el formulario. Las fechas aceptadas de un lote no se
   ofrecen para reenvío conjunto.
6. **Fechas en otros módulos:** presentación en Cancún en reservas, historial,
   revisión de responsables, administración, bitácora y reportes; conversión
   institucional para capturas, filtros y límites de fechas. Anticipación
   mínima calculada por horas transcurridas. Los folios usan el día de Cancún.
   Correo, evidencias, reportes backend y Calendar ya usaban esa zona.

No cambian roles, estatus, rutas, colecciones ni integraciones. Las reglas no
crean eventos de Calendar ni cancelan retroactivamente reservas. La aprobación
conserva su revalidación de reglas y disponibilidad.

## Evidencia y límites

- Casos locales de 08:00–13:00, todos los días, vigencia inclusiva, regla
  inactiva, consulta intradía, día completo, alcance global y por laboratorio.
- Verificación de límites exactos y consistencia entre calendario y validador.
- Conversión comprobada con zonas de proceso UTC, Los Ángeles y Tokio.
- Prueba de la función de creación con Firestore simulado y validación real del
  SDK sobre un batch que nunca se envía; comprueba opcionales y bitácora.
- Pruebas de interfaz para errores conservados, doble envío, fechas civiles,
  bloques de varios días, consulta fallida y resultados de lotes mixtos.
- Se consultaron las reglas reales mediante Firestore REST con la sesión
  existente de Firebase CLI, en modo de solo lectura. Se proyectaron únicamente
  nombre, actividad, horario semanal y reglas; no se publicaron motivos
  administrativos, identidades ni credenciales. Los cinco horarios siguientes
  se reprodujeron en pruebas locales contra calendario y validación backend.
  Esto confirma la configuración consultada, no el smoke del código nuevo
  en producción.

## Reglas observadas en producción (solo lectura)

| Laboratorio | Día | Horario de Cancún | Vigencia inclusiva |
| --- | --- | --- | --- |
| Sala de Juicios Orales | Martes | 11:30–13:00 | 08/09/2026–05/12/2026 |
| Sala de Juicios Orales | Viernes | 11:30–15:00 | 11/09/2026–05/12/2026 |
| Taller de Arquitectura | Martes | 11:00–13:00 | 08/09/2026–05/12/2026 |
| Taller de Arquitectura | Viernes | 11:00–15:00 | 11/09/2026–05/12/2026 |
| Taller de Arquitectura | Sábado | 13:00–15:00 | 12/09/2026–12/12/2026 |

Los dos laboratorios y las cinco reglas estaban activos al consultar.
El horario semanal observado es lunes a viernes 08:00–20:00, sábado
08:00–18:00 y domingo deshabilitado.

## Smoke posterior a publicación — confirmado por el propietario

1. Revisar las reglas existentes de Taller de Arquitectura y Juicios Orales:
   laboratorio, vigencia, días y horas. Confirmar coincidencia en calendario.
2. Crear una regla sin vigencia y sin días seleccionados; editar, vaciar su
   vigencia, activar/desactivar y verificar que solo afecta a su laboratorio.
3. Crear un bloqueo por hora y otro de un solo día completo, tanto global
   como por laboratorio. Verificar el último día incluido y el día posterior.
4. Solicitar manualmente una hora bloqueada y comprobar mensaje persistente,
   folio y detalle. Probar un lote con una fecha bloqueada y otra libre.
5. Con una solicitud pendiente, agregar una restricción y comprobar que la
   aprobación vuelve a validarla; no crear eventos para la fecha bloqueada.
6. Repetir calendario y capturas en móvil y en un equipo con zona distinta de
   Cancún. Comprobar 08:00 institucional como 13:00 UTC en la solicitud.
7. Simular fallo de conexión al guardar: conservar datos y permitir reintento.
   Simular fallo de disponibilidad: no mostrar horarios libres.

La confirmación anterior a este deploy correspondía a otra fase. La nueva
confirmación del propietario, posterior al despliegue de `da38623`, cierra
esta revisión. Es evidencia manual declarada por el propietario; no se
atribuye a Codex la ejecución individual de los pasos anteriores.

## Validación automatizada de esta revisión

Comando: `npm run validate`, finalizado con código 0 el 2026-09-08.

| Verificación | Resultado |
| --- | --- |
| Backend, `node --test test/*.test.js` | 49 pruebas aprobadas |
| Frontend, Angular/Vitest | 22 pruebas aprobadas en 9 archivos |
| ESLint de Functions | Aprobado |
| Compilación TypeScript de Functions | Aprobada |
| Build de producción Angular | Aprobado |

La suite incluye nueve pruebas backend nuevas y nueve frontend nuevas. Se
conservan las advertencias de Sass `@import`, presupuestos de tamaño y el
módulo CommonJS `qrcode`; no hubo errores de compilación.

Codex no creó reservas de prueba en producción. El smoke operativo fue
confirmado por el propietario después del despliegue. Se distingue esa
aceptación de las pruebas automatizadas y de las consultas técnicas.

## Cierre autorizado

Publicación de esta fase en `origin/main` y Firebase
`reservas-laboratorios-tup`, superficies Functions y Hosting. No se cambian
Security Rules, índices ni configuración de Storage. La evidencia final de
SHA, push, despliegue y comprobaciones técnicas se entrega en el cierre de
la tarea.

Comando de despliegue:

```powershell
npx.cmd firebase deploy --only functions,hosting --project reservas-laboratorios-tup --non-interactive
```

### Archivos creados

- `apps/web/src/app/features/admin/components/admin-blocked-period-dialog/admin-blocked-period-dialog.component.spec.ts`
- `apps/web/src/app/features/admin/components/admin-special-rule-dialog/admin-special-rule-dialog.component.spec.ts`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.spec.ts`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.spec.ts`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.spec.ts`
- `apps/web/src/app/shared/utils/institutional-time.utils.spec.ts`
- `apps/web/src/app/shared/utils/institutional-time.utils.ts`
- `docs/20_RULES_TIMEZONE_REVIEW.md`
- `functions/src/shared/utils/institutional-time.utils.ts`
- `functions/test/special-rules-timezone.test.js`

### Archivos modificados

- `apps/web/src/app/features/admin/admin-audit-page/admin-audit-page.component.ts`
- `apps/web/src/app/features/admin/admin-rules-page/admin-rules-page.component.ts`
- `apps/web/src/app/features/admin/components/admin-blocked-period-dialog/admin-blocked-period-dialog.component.ts`
- `apps/web/src/app/features/admin/components/admin-special-rule-dialog/admin-special-rule-dialog.component.ts`
- `apps/web/src/app/features/admin/services/admin-labs.service.ts`
- `apps/web/src/app/features/admin/services/admin-preauthorized-users.service.ts`
- `apps/web/src/app/features/admin/services/admin-rules.service.ts`
- `apps/web/src/app/features/admin/services/admin-users.service.ts`
- `apps/web/src/app/features/calendar/components/availability-calendar/availability-calendar.component.ts`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.html`
- `apps/web/src/app/features/calendar/lab-calendar/lab-calendar.component.ts`
- `apps/web/src/app/features/reports/components/lab-usage-chart/lab-usage-chart.component.ts`
- `apps/web/src/app/features/reports/reports-page/reports-page.component.ts`
- `apps/web/src/app/features/reservations/components/my-reservation-detail/my-reservation-detail.component.ts`
- `apps/web/src/app/features/reservations/components/reservation-stepper-form/reservation-stepper-form.component.ts`
- `apps/web/src/app/features/reservations/my-reservations-page/my-reservations-page.component.ts`
- `apps/web/src/app/features/reservations/reservation-form/reservation-form.component.ts`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.html`
- `apps/web/src/app/features/reservations/reserve-lab-page/reserve-lab-page.component.ts`
- `apps/web/src/app/features/reservations/services/my-reservations.service.ts`
- `apps/web/src/app/features/responsible/responsible-reservation-detail-page/responsible-reservation-detail-page.component.ts`
- `apps/web/src/app/features/responsible/services/reservation-review.service.ts`
- `docs/03_DATA_MODEL_SDD.md`
- `docs/04_BUSINESS_RULES_SDD.md`
- `docs/07_FRONTEND_UI_UX_SDD.md`
- `docs/10_TESTING_AND_ACCEPTANCE_SDD.md`
- `functions/src/modules/admin/admin-rules.function.ts`
- `functions/src/modules/reservations/get-lab-availability.function.ts`
- `functions/src/modules/reservations/reservation.repository.ts`
- `functions/src/modules/reservations/reservation.utils.ts`
- `functions/src/modules/reservations/reservation.validators.ts`

Archivos eliminados: ninguno.

## Evidencia del cierre productivo

- Commit desplegado: `da38623b110d03470bb841fb6bc960d0bb3a1787`.
- Push a `origin/main` completado y árbol Git limpio al cerrar la fase.
- Functions y Hosting: `Deploy complete!`, código de salida 0.
- 28 Functions activas, runtime Node.js 22 y hash actualizado en las 28.
- `/`, `/login` y `/admin/reglas`: HTTP 200 y contenido idéntico al build local.
- Disponibilidad, creación/edición de reglas y creación de reservas: HTTP 401
  `UNAUTHENTICATED` ante llamadas sin sesión, como se esperaba.
- Smoke: confirmado por el propietario tras la publicación.
- Esta entrega se incorpora a `v1.1.0`; véase `21_V1_1_0_RELEASE.md`.
