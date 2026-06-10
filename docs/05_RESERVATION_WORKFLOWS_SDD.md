Actualizacion Fase 13.4: condiciones de seguridad y protocolo

El flujo de reserva debe capturar el tipo de practica con la lista oficial:
Teorica, Simulacion, Taller, Evaluacion practica, Investigacion u Otro. Cuando
se seleccione Otro, debe capturarse practiceTypeOther y validarse como texto
obligatorio de maximo 120 caracteres.

El checkbox anterior de participantes externos queda eliminado. En su lugar, el
formulario debe mostrar dos preguntas Si/No:

1. Se utilizaran sustancias, muestras biologicas o material potencialmente
   riesgoso? Campo: risky.
2. Participan pacientes, usuarios simulados o poblacion externa? Campo:
   externalParticipants.

La carga de protocolo es obligatoria cuando:

protocolRequired = risky === true || externalParticipants === true

Si cualquiera de las dos respuestas es Si, el frontend debe solicitar protocolo
y createReservation debe rechazar la solicitud si no recibe metadata valida de
protocolFiles. Si ambas respuestas son No, el protocolo no es obligatorio.

Las reservas con risky === true o externalParticipants === true quedan en
PENDIENTE_VALIDACION. La participacion externa exige protocolo y revision del
responsable aunque la practica no marque material riesgoso.

Flujo A. Reserva no riesgosa

Docente escanea QR o entra al sistema
  -> inicia sesión institucional
  -> selecciona laboratorio o entra directo por QR
  -> consulta disponibilidad
  -> llena formulario
  -> envía solicitud
  -> Cloud Function valida reglas
  -> Cloud Function valida traslape
  -> Cloud Function crea reserva CONFIRMADA
  -> Cloud Function crea evento en Google Calendar
  -> Cloud Function envía correos
  -> docente ve confirmación

Resultado:

status = CONFIRMADA
calendarEventId != null

Flujo B. Reserva con protocolo y revision requerida

Docente escanea QR o entra al sistema
  -> inicia sesión institucional
  -> selecciona laboratorio
  -> llena formulario
  -> sube protocolo a Cloud Storage si aplica
  -> frontend recibe metadata del archivo
  -> envía solicitud
  -> Cloud Function valida reglas
  -> Cloud Function verifica existencia, propiedad y validez del archivo
  -> Cloud Function vincula protocolFiles a la reserva
  -> Cloud Function crea reserva PENDIENTE_VALIDACION
  -> responsable recibe notificación
  -> responsable revisa solicitud en panel
  -> responsable aprueba o rechaza

si aprueba:

Cloud Function revalida conflicto
  -> crea evento en Calendar
  -> cambia a CONFIRMADA_TRAS_VALIDACION
  -> notifica docente
  -> notifica responsable

Si rechaza:

Responsable rechaza solicitud
  -> backend valida permiso y motivo
  -> registra rechazo
  -> status = RECHAZADA_POR_RESPONSABLE
  -> notifica docente

Flujo C. Conflicto de horario

Docente envía solicitud
  -> backend detecta reserva existente
  -> registra intento rechazado
  -> status = RECHAZADA_CONFLICTO
  -> notifica docente

Flujo D. Regla de anticipación mínima

Docente envía solicitud
  -> backend calcula diferencia entre startAt y now
  -> si diff < minNoticeHours
  -> status = RECHAZADA_MIN_ANTICIPACION
  -> notifica docente

Flujo E. Regla especial por cuatrimestre

Docente envía solicitud
  -> backend identifica reglas especiales activas
  -> valida día, horario y vigencia
  -> si la solicitud cae en bloqueo
  -> status = RECHAZADA_REGLA_HORARIO
  -> notifica docente

Flujo F. Cancelación controlada

Usuario solicita cancelar desde /mis-reservas/:reservationId
  -> frontend muestra dialogo de confirmacion
  -> frontend llama cancelReservation
  -> backend valida sesion y perfil activo
  -> backend valida permiso:
     docente propietario;
     responsable_laboratorio asignado;
     admin_sistemas
  -> backend valida reserva futura
  -> backend valida estatus cancelable
  -> si existe calendarEventId, elimina el evento de Google Calendar
  -> si Calendar responde 404 Not Found o 410 Gone, continua como evento ya eliminado
  -> si Calendar falla, registra CALENDAR_ERROR y no cambia estatus
  -> si Calendar responde correctamente, status = CANCELADA
  -> registra CANCELLED
  -> registra CALENDAR_EVENT_CANCELLED si existia evento
  -> crea notificacion RESERVATION_CANCELLED
  -> envia correo Gmail API sin bloquear la cancelacion si falla el correo

Estatus cancelables:

PENDIENTE_VALIDACION
CONFIRMADA
CONFIRMADA_TRAS_VALIDACION

ERROR_CALENDAR solo puede cancelarse por admin_sistemas o por un responsable
asignado al laboratorio. Un docente no debe cancelar una reserva con
ERROR_CALENDAR desde su vista personal.

Flujo G. Acceso por QR

Docente escanea QR
  -> entra a /reservar/:labSlug
  -> si no tiene sesión, va a /login
  -> después de login regresa a /reservar/:labSlug
  -> formulario aparece con laboratorio precargado
  -> docente selecciona fecha/hora y completa datos

Tipos oficiales de notificación

RESERVATION_CONFIRMED
RESERVATION_PENDING_APPROVAL
RESERVATION_APPROVED
RESERVATION_REJECTED
RESERVATION_CANCELLED
TECHNICAL_ERROR
CALENDAR_ERROR
EMAIL_ERROR

RECHAZADA_CONFLICTO queda reservado exclusivamente para traslapes de horario.
