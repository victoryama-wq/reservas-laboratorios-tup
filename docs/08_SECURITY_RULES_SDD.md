Principios
Denegar por defecto.
Permitir lectura/escritura solo según rol.
Nunca confiar únicamente en el frontend.
Operaciones críticas mediante Cloud Functions.
Los usuarios no pueden cambiar su propio rol.
Los protocolos no son públicos.
Las reservas solo son visibles según permisos.

users

Lectura
Usuario puede leer su propio perfil.
Admin/Sistemas puede leer todos.
Responsable puede leer datos mínimos de docentes vinculados a sus reservas si se requiere.

Escritura
Solo Admin/Sistemas puede editar roles.
Usuario puede actualizar datos no críticos si se habilita.
Ningún usuario puede activarse o asignarse rol solo.

labs

Lectura
Usuarios autenticados pueden leer laboratorios activos.
Admin/Sistemas puede leer todos.

Nota sobre calendarId
Los calendarId son datos operativos institucionales.
No deben exponerse innecesariamente en el frontend.
Los usuarios docentes no necesitan leer calendarId.
Admin/Sistemas sí puede consultar y editar calendarId.

Escritura
Solo Admin/Sistemas.

reservations

Lectura
Docente lee sus propias reservas.
Responsable lee reservas de sus laboratorios asignados.
Admin/Sistemas lee todas.

Escritura
Crear, aprobar, rechazar y cancelar debe hacerse mediante Cloud Functions.
Evitar escritura directa desde cliente para reservas.

protocolFiles

Lectura
Docente propietario.
Responsable asignado.
Admin/Sistemas.

Escritura
Docente puede subir archivos para su solicitud.
Admin/Sistemas puede gestionar archivos en caso técnico.

Restricciones
No permitir lectura pública.
Validar tipo de archivo.
Validar tamaño máximo.
Guardar ruta vinculada a reserva.
Validar que el archivo pertenezca al usuario autenticado.

Secuencia oficial
El frontend sube el archivo con usuario autenticado.
Storage valida tipo, tamaño y permisos.
El frontend envía metadata a createReservation.
createReservation verifica existencia, propiedad y validez del archivo.
createReservation vincula protocolFiles a la reserva.
Una función programada futura podrá limpiar archivos huérfanos.

reservationLogs

Lectura
Admin/Sistemas: completa.
Responsable: solo logs de sus laboratorios.
Docente: logs básicos de sus propias reservas.

Escritura
Solo backend.

notifications

Los errores de correo se registran con:
notifications.status = FAILED
reservationLogs.action = EMAIL_ERROR

Un error de correo no debe cambiar el estatus de la reserva ni liberar el horario.

auditEvents

Debe registrar acciones administrativas, cambios sensibles, errores técnicos y eventos de auditoría.
La escritura debe realizarse desde backend o por rutas administrativas estrictamente controladas.

Actualizacion Fase 16A: gestion de usuarios

La gestion critica de usuarios se realiza mediante Cloud Function callable
`adminUpdateUser`. El cliente Angular no debe escribir directamente cambios de
rol, activacion o laboratorios asignados en `users`.

Requisitos de seguridad:

- solo usuarios autenticados con perfil activo y rol `admin_sistemas`;
- no permitir roles fuera de `docente`, `responsable_laboratorio` y
  `admin_sistemas`;
- no permitir que el admin actual se desactive o se quite su propio rol;
- validar que cada laboratorio asignado exista en `labs`;
- limpiar `labsAssigned` cuando el rol final no sea `responsable_laboratorio`;
- registrar `auditEvents` para trazabilidad administrativa;
- no guardar secretos ni metadata sensible.

Las reglas de Firestore pueden permitir lectura administrativa de `users`,
`labs` y `auditEvents` a `admin_sistemas`, pero la escritura critica de roles
debe mantenerse controlada por backend.
## Actualizacion Fase 16A.1: preauthorizedUsers

La coleccion `preauthorizedUsers` contiene correos preautorizados por
Admin/Sistemas para responsables/coordinadores y admins. Desde cliente:

- solo `admin_sistemas` puede leer/listar la coleccion;
- nadie puede crear, actualizar o borrar documentos directamente;
- las escrituras deben hacerse por Cloud Functions con Admin SDK
  (`adminPreauthorizeUser` y `ensureUserProfile` al reclamar prealta).

Angular no debe escribir `role`, `active`, `labsAssigned` ni documentos de
prealta con `setDoc` o `updateDoc`.
