Nombre del proyecto

Sistema Web de Reservas de Laboratorios

Objetivo general

Desarrollar una web app institucional, moderna, segura, responsive y mobile-first para gestionar la reserva de laboratorios académicos, sustituyendo el flujo actual basado en Google Sites, Google Forms, Google Sheets y Google Apps Script.

Objetivos específicos
Permitir que los docentes consulten disponibilidad y soliciten reservas desde celular, tablet o computadora.
Permitir acceso directo por QR a cada laboratorio.
Validar automáticamente horarios, traslapes, anticipación mínima y reglas especiales.
Gestionar solicitudes que requieran protocolo o revisión por riesgo.
Permitir que el responsable de laboratorio apruebe o rechace solicitudes asignadas.
Permitir que Admin/Sistemas administre laboratorios, usuarios, reglas, horarios, calendarios, responsables y reportes.
Sincronizar reservas confirmadas con Google Calendar.
Mantener trazabilidad completa de solicitudes, cambios de estatus, errores y notificaciones.
Mejorar la presentación institucional con una interfaz clara, moderna y usable.
Problema actual

El sistema actual funciona, pero depende de varias herramientas separadas:

Google Sites para mostrar laboratorios.
Google Calendar para visualizar disponibilidad.
Google Forms para capturar solicitudes.
Google Sheets para registrar respuestas.
Google Apps Script para validar, notificar, crear eventos y gestionar aprobaciones.

Esta arquitectura dificulta la presentación moderna, la administración centralizada, la trazabilidad, la experiencia móvil y el control de permisos.

Alcance del MVP

El MVP debe incluir:

Login institucional.
Catálogo de laboratorios.
QR por laboratorio.
Vista responsive de disponibilidad.
Formulario de reserva optimizado para celular.
Carga de protocolo.
Validación automática de reglas.
Panel de responsable de laboratorio.
Panel Admin/Sistemas.
Creación de eventos en Google Calendar.
Notificaciones por correo.
Historial de reservas.
Bitácora básica.
Diseño responsive mobile-first.
Fuera de alcance inicial
Aplicación móvil nativa Android/iOS.
Firma electrónica avanzada.
Integración directa con Moodle.
Pagos.
Control físico de acceso.
Inventario completo de materiales.
App publicada en tiendas móviles.
Enfoque de producto

El sistema será una web app responsive con enfoque mobile-first. La prioridad de experiencia será el docente que escanea un QR desde su celular para reservar un laboratorio.