Regla 1. Laboratorio activo

Solo se pueden reservar laboratorios con:
active === true

Regla 2. Usuario autenticado

Toda reserva requiere usuario autenticado.

Regla 3. Dominio institucional

El sistema debe validar que el correo pertenezca al dominio institucional configurado:
email.endsWith('@tecplayacar.edu.mx')
El dominio debe ser configurable en systemSettings/global.

Regla 4. Datos obligatorios

Campos mínimos:

laboratorio;
docente;
correo institucional;
fecha;
hora de inicio;
hora de finalización;
asignatura;
grupo;
nombre de práctica;
objetivo;
tipo de práctica;
indicador de riesgo.

Regla 5. Rango horario válido

La hora final debe ser posterior a la hora inicial.

Regla 6. No domingos por defecto

Domingo no disponible, salvo que el laboratorio tenga configuración explícita.

Regla 7. Horario por laboratorio

Cada laboratorio tendrá un horario semanal configurable desde Firestore.

Ejemplo:
{
  "monday": { "enabled": true, "start": "08:00", "end": "20:00" },
  "saturday": { "enabled": true, "start": "08:00", "end": "18:00" },
  "sunday": { "enabled": false, "start": null, "end": null }
}

Regla 8. Anticipación mínima

Cada laboratorio tendrá:
minNoticeHours: number

Para los laboratorios que actualmente requieren mínimo 24 horas:
minNoticeHours = 24

Regla 9. Reglas especiales por cuatrimestre

Las reglas especiales deben estar en Firestore, no hardcodeadas.

labs/{labId}.specialRules

Ejemplo:
{
  "id": "rule_001",
  "name": "Bloqueo martes 08:00-13:00",
  "active": true,
  "daysOfWeek": [2],
  "blockedStart": "08:00",
  "blockedEnd": "13:00",
  "termStart": "2026-01-01",
  "termEnd": "2026-12-20",
  "reason": "Bloqueo académico del cuatrimestre"
}

Regla 10. Conflicto de horario

No se permite una reserva si existe otra reserva del mismo laboratorio que se traslape con el rango solicitado.

Estados que bloquean:
PENDIENTE_VALIDACION
CONFIRMADA
CONFIRMADA_TRAS_VALIDACION
ERROR_CALENDAR

Estados que no bloquean:
RECHAZADA_CONFLICTO
RECHAZADA_REGLA_HORARIO
RECHAZADA_MIN_ANTICIPACION
RECHAZADA_POR_RESPONSABLE
CANCELADA

ERROR_CALENDAR es un estatus técnico bloqueante hasta que Admin/Sistemas resuelva la inconsistencia con Google Calendar.

Los errores de correo no deben cambiar el estatus de la reserva ni liberar el horario. Deben registrarse en notifications.status = FAILED y reservationLogs.action = EMAIL_ERROR.

Regla 11. Validación en backend

La validación definitiva debe ejecutarse en Cloud Functions.

El frontend solo puede mostrar advertencias, pero no decide la confirmación final.

Regla 12. Práctica riesgosa

Si:
risky === true || externalParticipants === true
la reserva no debe confirmarse automáticamente.

Debe quedar como:
PENDIENTE_VALIDACION

Regla 13. Protocolo obligatorio

Si:
risky === true || externalParticipants === true
entonces debe existir al menos un archivo válido en protocolFiles.

Secuencia técnica oficial para protocolos:

1. El frontend sube el archivo a Cloud Storage con usuario autenticado.
2. Storage valida tipo, tamaño y permisos.
3. El frontend envía metadata a createReservation.
4. createReservation verifica existencia, propiedad y validez del archivo.
5. createReservation vincula protocolFiles a la reserva.
6. Una función programada futura podrá limpiar archivos huérfanos.

Regla 14. Revalidación al aprobar

Cuando un responsable aprueba, el backend debe revalidar:

fecha vigente;
laboratorio activo;
horario permitido;
reglas especiales;
traslape;
disponibilidad de Google Calendar;
existencia de protocolo si aplica.

Regla 15. QR por laboratorio

Cada laboratorio tendrá una ruta directa:

/reservar/:labSlug

Si el usuario entra desde QR y no ha iniciado sesión, se debe redirigir a login y después regresarlo al laboratorio solicitado.

Actualizacion Fase 13.4: tipo de practica, participacion externa y protocolo

Esta seccion sustituye cualquier regla anterior que hiciera depender el
protocolo obligatorio solamente de risky o de requiresProtocolWhenRisky.

La lista oficial de tipos de practica es:

- Teorica
- Simulacion
- Taller
- Evaluacion practica
- Investigacion
- Otro

Si practiceType === 'Otro', el backend debe exigir practiceTypeOther con texto
no vacio y maximo 120 caracteres. Si practiceType no es 'Otro',
practiceTypeOther debe quedar vacio, null o no guardarse.

El formulario debe mostrar dos preguntas formales de seguridad:

1. Se utilizaran sustancias, muestras biologicas o material potencialmente
   riesgoso?
   - Campo asociado: risky
2. Participan pacientes, usuarios simulados o poblacion externa?
   - Campo asociado: externalParticipants

La pregunta de pacientes, usuarios simulados o poblacion externa reemplaza el
checkbox visual anterior de participantes externos.

La regla operativa de protocolo obligatorio es:

protocolRequired = risky === true || externalParticipants === true

Si risky === true o externalParticipants === true, debe existir al menos un
archivo valido en protocolFiles. Si ambas respuestas son false, el protocolo no
es obligatorio. Si se envia un protocolo valido aunque no sea requerido, el
backend puede conservarlo como adjunto opcional.

Si risky === true o externalParticipants === true, la reserva debe crearse con
estatus PENDIENTE_VALIDACION. No debe confirmarse automaticamente ni crear
evento en Google Calendar hasta que el responsable del laboratorio asignado o
un admin_sistemas apruebe la solicitud.

Al aprobar una reserva pendiente, approveReservation debe revalidar el
protocolo con la misma regla:

protocolRequired = risky === true || externalParticipants === true

## Actualizacion Fase 16C: bloqueos administrativos

Admin/Sistemas puede configurar dos tipos de restriccion operativa:

1. Reglas especiales por laboratorio en `labs/{labId}.specialRules`.
2. Bloqueos extraordinarios en `blockedPeriods`.

Las reservas deben ser rechazadas por regla de horario cuando el rango
solicitado intersecta una regla o bloqueo activo aplicable.

Estatus esperado:

```text
RECHAZADA_REGLA_HORARIO
```

La validacion se ejecuta en backend en:

- `createReservation`, antes de confirmar o dejar pendiente una reserva;
- `approveReservation`, antes de crear evento en Google Calendar.

Los bloqueos extraordinarios no modifican reservas ya existentes ni crean
eventos por si mismos en Google Calendar. Solo bloquean nuevas confirmaciones
o aprobaciones dentro del rango configurado.
