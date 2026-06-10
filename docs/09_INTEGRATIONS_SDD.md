Actualizacion Fase 13.4: Calendar y Gmail

Google Calendar debe recibir una descripcion de evento en texto plano que
incluya folio, docente, correo, laboratorio, asignatura, grupo, tipo de
practica, especificacion si practiceType === 'Otro', material riesgoso Si/No,
pacientes, usuarios simulados o poblacion externa Si/No, protocolo requerido
Si/No, protocolo adjunto Si/No, nombres de archivos si aplica, material
requerido, practica, objetivo y aviso de que fue generado por el Sistema Web de
Reservas de Laboratorios.

No se deben incluir enlaces publicos a Cloud Storage en Google Calendar.

Gmail API debe enviar correos institucionales con plantilla HTML y fallback de
texto plano. Los correos deben mantener encabezado morado institucional, tarjeta
blanca, folio destacado, estatus y datos principales de la reserva. Tambien
deben incluir tipo de practica, especificacion de Otro si aplica, material
riesgoso, pacientes/usuarios/poblacion externa, protocolo requerido, protocolo
adjunto, material requerido, practica y objetivo.

Actualizacion pre Fase 14:

- La plantilla HTML debe seguir el patron visual institucional TUP: contenedor
  centrado, encabezado blanco con logotipo, franja azul marino/morada, titulo,
  saludo, estatus destacado, tabla de datos y pie institucional.
- La paleta oficial de correo es `#888887`, `#252a86`, `#271e5d` y `#ffffff`.
- El logotipo institucional debe viajar como imagen inline con MIME `cid`, no
  como enlace publico.
- Gmail debe enviar el mensaje como `multipart/related` cuando incluya imagen
  inline y como `multipart/alternative` para conservar fallback de texto plano.
- Fase 13.5 formaliza `cid:tup-logo` como identificador del logotipo inline y
  mantiene el archivo institucional en
  `functions/src/modules/notifications/assets/logo_tup.png`.
- Las plantillas deben cubrir `RESERVATION_CONFIRMED`,
  `RESERVATION_PENDING_APPROVAL`, `RESERVATION_APPROVED`,
  `RESERVATION_REJECTED`, `CALENDAR_ERROR`, `TECHNICAL_ERROR` y
  `RESERVATION_CANCELLED` cuando aplique.
- Los asuntos deben indicar estatus y laboratorio o folio sin revelar datos
  operativos como `calendarId` o rutas privadas de Storage.

No se deben adjuntar protocolos ni generar enlaces publicos a Storage en
correos. Cuando exista protocolo, el correo debe indicar que debe revisarse
desde el sistema.

Google Calendar

Uso
Consultar disponibilidad.
Crear evento al confirmar reserva.
Crear evento tras aprobación.
Cancelar evento si se cancela reserva.
Guardar calendarEventId.
Registrar ERROR_CALENDAR si falla una operación crítica de confirmación.

Cuenta operativa de Google Calendar

La cuenta operativa será:

escenarios.tup@tecplayacar.edu.mx

Los calendarios de laboratorio deben estar compartidos con esa cuenta con permiso de escritura.

El calendario de Centro de Cómputo usa como calendarId:

centro.computo@tecplayacar.edu.mx

El calendario de Centro de Cómputo ya está compartido con la cuenta operativa.

La cuenta escenarios.tup@tecplayacar.edu.mx también será la cuenta operativa para escribir eventos en Google Calendar, siempre que los calendarios estén compartidos con permisos de escritura.

Reglas

Cada laboratorio debe tener:

calendarId: string;

El evento debe incluir en la descripción:

docente;
correo;
laboratorio;
asignatura;
grupo;
tipo de práctica;
riesgo;
participantes externos;
material;
objetivo;
folio;
nota de validación si aplica.

Importante
Google Calendar no será la fuente de verdad principal. Firestore controla estatus, permisos, protocolos y trazabilidad.
ERROR_CALENDAR es un estatus técnico de reserva y bloquea el horario hasta resolución por Admin/Sistemas.

Actualizacion Fase 16B: calendarId administrable

Admin/Sistemas puede configurar `labs/{labId}.calendarId` desde
`/admin/laboratorios`. El valor es un dato operativo para Google Calendar y
solo debe mostrarse en vistas administrativas.

Fase 16B no consulta Google Calendar API para validar el `calendarId` al
guardarlo. La validacion se limita a exigir texto no vacio. Las funciones de
reserva y aprobacion siguen siendo responsables de usar Calendar API para
validar conflictos, crear eventos o registrar `ERROR_CALENDAR`.

Los calendarios de laboratorio deben continuar compartidos con:

```text
escenarios.tup@tecplayacar.edu.mx
```

con permisos de escritura.

Correo

Proveedor oficial

El proveedor de correos para notificaciones será Google Workspace mediante Gmail API.

La cuenta remitente oficial será:

escenarios.tup@tecplayacar.edu.mx

Las Cloud Functions deberán enviar correos usando Gmail API con la cuenta operativa escenarios.tup@tecplayacar.edu.mx.

No se utilizarán proveedores externos como SendGrid, Mailgun, Resend u otros, salvo autorización posterior.

La integración recomendada será mediante una cuenta de servicio con delegación de dominio de Google Workspace, autorizada para actuar como escenarios.tup@tecplayacar.edu.mx.

Scopes mínimos requeridos:

https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/calendar

Eventos de correo
Reserva confirmada.
Reserva pendiente.
Reserva rechazada por conflicto.
Reserva rechazada por horario.
Reserva rechazada por anticipación mínima.
Reserva aprobada.
Reserva rechazada por responsable.
Reserva cancelada.
Error técnico.

Destinatarios
Docente.
Responsable de laboratorio.
Admin/Sistemas en errores.
Correos configurados por laboratorio.

Plantillas recomendadas
RESERVATION_CONFIRMED
RESERVATION_PENDING_APPROVAL
RESERVATION_APPROVED
RESERVATION_REJECTED
RESERVATION_CANCELLED
TECHNICAL_ERROR
CALENDAR_ERROR
EMAIL_ERROR

Los errores de correo no cambian el estatus de la reserva. Deben registrarse en notifications.status = FAILED y reservationLogs.action = EMAIL_ERROR.

QR

Cada laboratorio tendrá una ruta directa:

/reservar/:labSlug

El QR debe apuntar a esa ruta.

Ejemplo conceptual:

/reservar/camara-gesell
/reservar/quirofano
/reservar/centro-computo

Storage

Uso:
guardar protocolos;
asociar archivos a reserva;
permitir lectura solo por permisos;
registrar metadatos.

Secuencia técnica oficial para protocolos:

1. El frontend sube el archivo a Cloud Storage con usuario autenticado.
2. Storage valida tipo, tamaño y permisos.
3. El frontend envía metadata a createReservation.
4. createReservation verifica existencia, propiedad y validez del archivo.
5. createReservation vincula protocolFiles a la reserva.
6. Una función programada futura podrá limpiar archivos huérfanos.
