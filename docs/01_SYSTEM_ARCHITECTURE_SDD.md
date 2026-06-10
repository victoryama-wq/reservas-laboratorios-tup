Arquitectura general

El sistema será una aplicación web alojada en Firebase, con frontend Angular y backend serverless mediante Cloud Functions.

Stack obligatorio
Frontend:
- Angular standalone
- TypeScript strict
- Tailwind CSS
- Angular Material
- FullCalendar Angular

Backend:
- Firebase Cloud Functions v2
- TypeScript
- Firebase Admin SDK

Base de datos:
- Cloud Firestore

Archivos:
- Cloud Storage for Firebase

Autenticación:
- Firebase Authentication
- Google Sign-In institucional

Hosting:
- Firebase Hosting o Firebase App Hosting

Integraciones:
- Google Calendar API
- Gmail API o proveedor transaccional de correo

Desarrollo asistido:
- Codex
- GitHub
Principio arquitectónico principal

Firestore será la fuente de verdad interna. Google Calendar funcionará como calendario institucional sincronizado, pero no debe ser la única fuente de control.

Diagrama conceptual

[Docente / Responsable / Admin]
          |
          v
[Web App Angular Responsive]
          |
          v
[Firebase Authentication]
          |
          v
[Cloud Functions v2]
          |
          +--> [Cloud Firestore]
          +--> [Cloud Storage]
          +--> [Google Calendar API]
          +--> [Gmail API / Email Provider]


Capas del sistema


1. Capa frontend

Responsable de:

login;
catálogo;
calendario visual;
formulario;
panel responsable;
panel Admin/Sistemas;
experiencia responsive;
navegación por QR;
validaciones visuales no críticas.

2. Capa backend

Responsable de:

validaciones críticas;
creación de reservas;
aprobación;
rechazo;
cancelación;
integración con Google Calendar;
envío de correos;
bitácoras;
control de permisos;
generación de folios.

3. Capa de datos

Responsable de:

usuarios;
laboratorios;
reglas;
reservas;
bitácoras;
notificaciones;
configuración global.

4. Capa de archivos

Responsable de:

almacenamiento de protocolos;
control de acceso;
metadatos de archivos;
vinculación con reservas.
Reglas arquitectónicas
No crear reservas directamente desde el frontend.
No aprobar ni rechazar directamente desde el frontend.
No confiar en validaciones frontend para reglas críticas.
Toda operación crítica debe pasar por Cloud Functions.
Firestore debe contener la reserva y su trazabilidad.
Google Calendar debe sincronizar solo reservas confirmadas.
Los roles se validan en backend y reglas de seguridad.
La interfaz debe ser responsive desde el primer desarrollo.
No crear una app móvil nativa en esta fase.
No duplicar sistemas para móvil y escritorio.


Estructura recomendada del repositorio

reservas-laboratorios/
  apps/
    web/
      src/
        app/
          core/
          shared/
          features/
            auth/
            labs/
            reservations/
            responsible/
            admin/
            calendar/
  functions/
    src/
      index.ts
      modules/
        auth/
        labs/
        reservations/
        calendar/
        notifications/
        users/
        logs/
      shared/
        models/
        validators/
        utils/
  firebase/
    firestore.rules
    storage.rules
    firestore.indexes.json
  docs/
  README.md
  firebase.json
  .firebaserc