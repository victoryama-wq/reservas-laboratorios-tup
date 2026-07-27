# Checklist de Liberacion MVP

Fecha de auditoria: `2026-07-27`
Proyecto: `reservas-laboratorios-tup`
Version candidata: `v1.0.0`
Responsable funcional: `victor.yama@tecplayacar.edu.mx`

## Estados permitidos

- `PASS`: evidencia tecnica directa y vigente.
- `VERIFIED_MANUAL`: validacion manual registrada.
- `NOT_CONFIGURED`: capacidad confirmada como no configurada.
- `ACCEPTED_RISK`: limitacion confirmada y aceptada expresamente por el
  propietario para el MVP.
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
| Indices remotos | PASS | Firebase CLI: sin indices compuestos ni excepciones de campo | 2026-07-27 | Codex | Coincide con declaracion vacia en Git |
| Secrets: nombres y versiones | PASS | Firebase CLI: JSON v1/v2 y subject v1 habilitados | 2026-07-22 | Codex | Valores no consultados |
| Delegacion Workspace | VERIFIED_MANUAL | Delegacion activa, client ID OAuth coincidente y cuenta delegada confirmada | 2026-07-27 | Propietario | `escenarios.tup@tecplayacar.edu.mx` |
| Scopes minimos Calendar/Gmail | VERIFIED_MANUAL | Admin Console: solo `calendar` y `gmail.send` | 2026-07-27 | Propietario | Sin scopes adicionales |
| Cuenta de ejecucion de Functions | PASS | Firebase Functions list | 2026-07-22 | Codex | `261669564296-compute@developer.gserviceaccount.com` |
| Politica IAM de menor privilegio | ACCEPTED_RISK | Cuenta de ejecucion conserva `roles/editor` | 2026-07-27 | Propietario | Endurecimiento posterior al MVP |
| Capacidad `signBlob` | PASS | IAM y apertura de protocolos verificados | 2026-07-27 | Codex | Capacidad operativa vigente |
| Acceso de Functions a secrets | PASS | Secrets vinculados y ejecucion Calendar/Gmail verificada | 2026-07-27 | Codex | Valores no consultados |
| Scheduler desplegado | PASS | Function programada `ACTIVE` | 2026-07-22 | Codex | 03:00 America/Cancun |
| Scheduler saludable | PASS | Logs 15-22 julio: 0 errores y 0 borrados | 2026-07-22 | Codex | 13 escaneados/referenciados |
| Dry run manual de limpieza | VERIFIED_MANUAL | Cierre documental 17I | 2026-07-22 | Propietario | No se ejecuto borrado en esta auditoria |
| Logs de Functions criticas | PASS | Muestra de 500 entradas revisada | 2026-07-22 | Codex | Sin `ERROR_CALENDAR` ni `FAILED` en muestra |
| Canal de notificacion operativo | PASS | Canal de correo en el proyecto objetivo | 2026-07-27 | Codex | `victor.yama@tecplayacar.edu.mx` |
| Error Reporting | VERIFIED_MANUAL | Grupos nuevos y errores resueltos que reaparezcan | 2026-07-27 | Propietario | Canal operativo seleccionado |
| Uptime de Hosting | PASS | GET cada 5 min, timeout 10 s, tres regiones | 2026-07-27 | Codex | Alerta tras dos fallos consecutivos |
| Alertas metricas adicionales | NOT_CONFIGURED | Decision expresa del propietario | 2026-07-27 | Propietario | Revision manual mensual compensatoria |
| Presupuesto mensual | PASS | 500 MXN, proyecto unico, umbrales 50/80/100 real y 100 previsto | 2026-07-27 | Codex | Sin Pub/Sub ni suspension; existe presupuesto heredado de 300 MXN sin cambios |
| Firestore backup/PITR | ACCEPTED_RISK | PITR, backups y exports automaticos no configurados | 2026-07-27 | Propietario | RPO/RTO no garantizados; restore N/A MVP |
| Storage versionado/retencion | ACCEPTED_RISK | Soft delete 7 dias; sin versionado, retention ni lifecycle | 2026-07-27 | Propietario | Recuperacion posterior no garantizada |
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
| Deploy en Fases 18D.1/18D.2 | NOT_APPLICABLE | Alcance prohibe deploy de aplicacion y reglas | 2026-07-27 | Codex | Solo controles operativos y documentacion |
| Tag/release `v1.0.0` | NOT_APPLICABLE | No autorizado en esta fase | 2026-07-27 | Propietario | Crear solo con autorizacion expresa |

## Dictamen

**APTO PARA LIBERACION CONTROLADA CON RIESGOS ACEPTADOS.**

La aplicacion, Functions, reglas, Hosting, integraciones y flujos funcionales
criticos cuentan con evidencia tecnica o QA manual. Los controles operativos
seleccionados quedaron configurados. El propietario acepta expresamente la
ausencia de PITR/backups de Firestore, la recuperacion limitada de Storage y el
riesgo de `roles/editor` durante el MVP.

## Condiciones de operacion y liberacion

1. Mantener la revision manual mensual de Error Reporting, Functions,
   Scheduler, notificaciones `FAILED`, consumo y facturacion.
2. Registrar cualquier cambio a los riesgos aceptados de continuidad.
3. Resolver el endurecimiento IAM en una fase posterior al MVP.
4. Reejecutar `npm test`, `npm run validate` y smoke final antes del tag.
5. Crear tag/release solo con autorizacion expresa.
