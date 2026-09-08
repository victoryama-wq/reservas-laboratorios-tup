# Versión 1.1.0 — Reservas de Laboratorios

Fecha: 2026-09-08. Versión estable compatible con v1.0.0.

## Cambios incluidos

- Solicitudes de hasta 20 fechas en 90 días, resultados por fecha y correos
  consolidados; formularios adaptados al tipo de solicitante.
- Evidencias privadas de reservas confirmadas, compresión de imágenes,
  acceso temporal y limpieza a los 90 días.
- Acceso para personal administrativo nominal con los tres roles oficiales.
- Menú «Administración» para despejar el navbar de Admin/Sistemas.
- Correcciones de creación y edición de reglas y bloqueos, conservación de
  formularios ante errores y resultados de reserva persistentes.
- Fechas y calendario en `America/Cancun`, vigencia inclusiva y bloqueos con
  fin exclusivo; consistencia de disponibilidad con validación backend.
- Mantenimiento de Firebase Admin/Functions sobre Node.js 22 y revisión de
  textos de interfaz.

Se utiliza una versión menor por las capacidades añadidas desde v1.0.0.
Se conservan roles, estatus, rutas y colecciones institucionales.

## Trazabilidad

Última etiqueta anterior: `v1.0.0`, commit
`c7bab6c58ba91980e8d7e8e7806830cc82563bf2`.

Cambios de producto incluidos desde esa etiqueta:

| Commit | Cambio |
| --- | --- |
| `2675196` | Reservas por varias fechas y evidencias |
| `5121d30` | Acceso para personal administrativo |
| `2e17ada` | Mantenimiento Firebase y contratos |
| `f9b2cbe` | Menú de administración en navbar |
| `da38623` | Reglas, calendario y zona horaria de Cancún |

Código desplegado y validado:
`da38623b110d03470bb841fb6bc960d0bb3a1787`.

El tag anotado `v1.1.0` apunta al commit de versionado que contiene este
reporte. Ese commit solo modifica versión raíz, lockfile y documentación;
su código de aplicación y backend coincide con el commit desplegado.
Angular conserva `0.0.0` y Functions no declara una versión independiente,
siguiendo la convención documentada del proyecto.

## Evidencia de aceptación

| Comprobación | Resultado |
| --- | --- |
| `npm run validate` sobre el código desplegado | Código de salida 0 |
| Pruebas backend | 49 aprobadas |
| Pruebas Angular/Vitest | 22 aprobadas en 9 archivos |
| Lint y compilaciones | Aprobados |
| Deploy de Functions y Hosting | Completado, código de salida 0 |
| Functions posteriores al deploy | 28 activas, Node.js 22, hashes actualizados |
| Hosting `/`, `/login`, `/admin/reglas` | HTTP 200, contenido idéntico al build |
| Endpoints críticos sin sesión | HTTP 401 `UNAUTHENTICATED` |
| Smoke operativo | Confirmado por el propietario tras el deploy |

Confirmación del propietario: «Quedo excelente, los smoke pasaron».
Esta aceptación manual se registra sin atribuir a Codex pruebas funcionales
con escrituras que no ejecutó.

Se mantienen las advertencias conocidas de Sass `@import`, tamaños de bundles
/ estilos y CommonJS `qrcode`. Los riesgos operativos históricos no se
consideran resueltos por este versionado; permanecen en el runbook.

## Publicación y alcance del cierre

- Versión raíz y lockfile: `1.1.0`, sin alterar dependencias.
- Commit de cierre en `origin/main` y tag anotado `v1.1.0`.
- GitHub Release estable, latest, sin draft ni prerelease.
- Este cierre no requiere otro deploy: versiona el código ya productivo.
- El historial de v1.0.0 y su checklist se conservan.

Archivos del versionado: `package.json`, `package-lock.json`, `CHANGELOG.md`,
`README.md`, `docs/17_MVP_CLOSURE_REPORT.md`,
`docs/20_RULES_TIMEZONE_REVIEW.md` y este reporte. Un archivo creado, seis
modificados y ninguno eliminado.

La igualdad entre tag y commit se verifica con:

```powershell
git rev-list -n 1 v1.1.0
git rev-parse HEAD
```
