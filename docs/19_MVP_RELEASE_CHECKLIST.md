# Checklist de Liberacion MVP

Fecha de auditoria: `2026-07-22`
Proyecto: `reservas-laboratorios-tup`
Version candidata: `v1.0.0`
Responsable funcional: `victor.yama@tecplayacar.edu.mx`

## Estados permitidos

- `PASS`: evidencia tecnica directa y vigente.
- `VERIFIED_MANUAL`: validacion manual registrada.
- `NOT_CONFIGURED`: capacidad confirmada como no configurada.
- `BLOCKED`: no fue posible obtener evidencia o existe una precondicion.
- `NOT_APPLICABLE`: no corresponde al alcance.

No usar `PASS` por inferencia.

## Checklist

| Area | Estado | Evidencia | Fecha | Responsable | Observacion |
| --- | --- | --- | --- | --- | --- |
| Raiz, rama y SHA esperados | PASS | Git: raiz del proyecto, `main`, SHA `0b47755cc757f4a68d32eca0581f16f1b6bd728b` | 2026-07-22 | Codex | Arbol limpio al iniciar |
| Version candidata | PASS | `package.json` raiz en `1.0.0`; Angular conserva `0.0.0` por convencion interna | 2026-07-22 | Codex | Functions no declara version de producto independiente |
| Inventario local/remoto de Functions | PASS | 25 exports locales y 25 Functions `ACTIVE` | 2026-07-22 | Codex | Sin faltantes ni extras |
| Runtime y region de Functions | PASS | Node.js 22, `us-central1` | 2026-07-22 | Codex | Cuenta de ejecucion comun confirmada |
| Hosting raiz | PASS | HTTP 200, `text/html` | 2026-07-22 | Codex | Sitio accesible |
| Hosting ruta SPA `/reportes` | PASS | HTTP 200 y shell SPA | 2026-07-22 | Codex | Rewrite operativo |
| Firebase project activo | PASS | `.firebaserc`, `firebase use`, `projects:list` | 2026-07-22 | Codex | Proyecto correcto |
| Firestore Rules locales | PASS | Denegacion por defecto + validacion de sintaxis en emulador | 2026-07-22 | Codex | Sin deploy durante auditoria |
| Storage Rules locales | PASS | Acceso privado + validacion de sintaxis en emulador | 2026-07-22 | Codex | Sin deploy durante auditoria |
| Privacidad de protocolos | PASS | Reglas privadas y acceso temporal mediante callable | 2026-07-22 | Codex | Sin URLs publicas ni `storagePath` en UI |
| Indices declarados en Git | PASS | `firebase/firestore.indexes.json` vacio y valido | 2026-07-22 | Codex | Barrido local sin necesidad compuesta inequivoca |
| Indices remotos | BLOCKED | `gcloud` requiere reautenticacion | 2026-07-22 | Sistemas | Verificar en consola antes de release |
| Secrets: nombres y versiones | PASS | Firebase CLI: JSON v1/v2 y subject v1 habilitados | 2026-07-22 | Codex | Valores no consultados |
| Delegacion Workspace | VERIFIED_MANUAL | Calendar y Gmail operaron en QA Fase 18C | 2026-07-22 | Propietario | Revisar scopes exactos en Admin Console |
| Scopes minimos Calendar/Gmail | BLOCKED | Configuracion de Admin Console no accesible | 2026-07-22 | Sistemas Workspace | Confirmar solo `calendar` y `gmail.send` |
| Cuenta de ejecucion de Functions | PASS | Firebase Functions list | 2026-07-22 | Codex | `261669564296-compute@developer.gserviceaccount.com` |
| Politica IAM de menor privilegio | BLOCKED | `gcloud` requiere reautenticacion | 2026-07-22 | Sistemas GCP | Auditar roles directos y heredados |
| Capacidad `signBlob` | VERIFIED_MANUAL | Protocolos abiertos en QA posterior al incidente | 2026-07-22 | Propietario | Logs historicos fallaron hasta 2026-06-30 |
| Scheduler desplegado | PASS | Function programada `ACTIVE` | 2026-07-22 | Codex | 03:00 America/Cancun |
| Scheduler saludable | PASS | Logs 15-22 julio: 0 errores y 0 borrados | 2026-07-22 | Codex | 13 escaneados/referenciados |
| Dry run manual de limpieza | VERIFIED_MANUAL | Cierre documental 17I | 2026-07-22 | Propietario | No se ejecuto borrado en esta auditoria |
| Logs de Functions criticas | PASS | Muestra de 500 entradas revisada | 2026-07-22 | Codex | Sin `ERROR_CALENDAR` ni `FAILED` en muestra |
| Alertas de Functions/Scheduler | BLOCKED | Politicas no inventariables sin reautenticacion | 2026-07-22 | Sistemas GCP | Configurar o documentar alertas minimas |
| Firestore backup/PITR | BLOCKED | Sin evidencia accesible | 2026-07-22 | Sistemas GCP | Definir RPO/RTO y probar restauracion aislada |
| Storage versionado/retencion | BLOCKED | Sin evidencia accesible | 2026-07-22 | Sistemas GCP | Revisar lifecycle y recuperacion |
| Procedimientos de incidente | PASS | `docs/18_PRODUCTION_OPERATIONS_RUNBOOK.md` | 2026-07-22 | Codex | Calendar, correo, protocolo, usuario y scheduler |
| Procedimiento de rollback | PASS | Runbook, seccion Rollback | 2026-07-22 | Codex | Sin ejecucion productiva |
| Auth y roles reales | VERIFIED_MANUAL | QA Fase 18C con docente y responsable | 2026-07-22 | Propietario | Admin validado en fases previas |
| Reserva no riesgosa | VERIFIED_MANUAL | QA productiva Fase 18C | 2026-07-22 | Propietario | Calendar y estado confirmados |
| Reserva riesgosa y protocolo | VERIFIED_MANUAL | QA productiva Fase 18C | 2026-07-22 | Propietario | Pendiente, revision y acceso privado |
| Aprobacion y rechazo | VERIFIED_MANUAL | QA Fase 18C y cierre commit productivo | 2026-07-22 | Propietario | Razones separadas en commit validado |
| Cancelacion | VERIFIED_MANUAL | QA Fase 18C | 2026-07-22 | Propietario | Calendar reconciliado |
| Calendar idempotente | PASS | Suite automatizada 18/18 + smoke 18B | 2026-07-22 | Equipo | Sin duplicados conocidos |
| Gmail institucional | VERIFIED_MANUAL | Correos reales observados en fases 12-18C | 2026-07-22 | Propietario | Fallo de correo no cambia reserva |
| Reportes por rol | VERIFIED_MANUAL | Fase 18A.3 | 2026-07-22 | Propietario | Datos agregados, sin PII innecesaria |
| Responsive autenticado | VERIFIED_MANUAL | QA Fase 18C en breakpoints definidos | 2026-07-22 | Propietario | Registrar nueva regresion si cambia UI |
| Accesibilidad funcional | VERIFIED_MANUAL | QA de flujos, labels, teclado y controles Material en fases visuales/18C | 2026-07-22 | Propietario | Mantener regresion manual por release |
| Documentacion de operacion | PASS | Runbook, checklist, changelog, README y SDD de pruebas/cierre | 2026-07-22 | Codex | Sin valores de secretos ni datos personales de QA |
| Pruebas Functions | PASS | `npm --prefix functions test` | 2026-07-22 | Codex | Resultado final se registra en el commit |
| Pruebas Angular | PASS | `npm --prefix apps/web test -- --watch=false` | 2026-07-22 | Codex | Angular 21 no acepta `--run` |
| Lint y builds | PASS | Scripts directos y `npm run validate` | 2026-07-22 | Codex | Advertencias no bloqueantes registradas |
| CI remota | NOT_CONFIGURED | No existe `.github/workflows` | 2026-07-22 | Equipo | No se crea workflow en esta fase |
| Deploy en Fase 18D.1 | NOT_APPLICABLE | Alcance prohibe deploy | 2026-07-22 | Codex | Solo auditoria y preparacion |
| Tag/release `v1.0.0` | BLOCKED | Requiere cerrar backups, alertas e IAM | 2026-07-22 | Propietario | No crear tag aun |

## Dictamen

**APTO CONDICIONADO PARA LIBERACION CONTROLADA.**

La aplicacion, Functions, reglas locales, Hosting y flujos funcionales criticos
cuentan con evidencia tecnica o QA manual. Antes de declarar `v1.0.0` como
liberacion institucional definitiva deben cerrarse con evidencia los bloqueos
de IAM, alertas, indices remotos, backups/PITR, proteccion de Storage y scopes
de delegacion Workspace.

## Criterio de desbloqueo

1. Reautenticar `gcloud` con una cuenta autorizada.
2. Adjuntar evidencia sin secretos de IAM, alertas, indices y backups.
3. Confirmar scopes de delegacion en Workspace Admin.
4. Aprobar RPO/RTO y una prueba de restauracion aislada.
5. Reejecutar `npm test`, `npm run validate` y smoke final.
6. Crear tag/release solo con autorizacion expresa.
