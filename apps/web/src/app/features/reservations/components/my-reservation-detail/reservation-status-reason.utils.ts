import { ReservationStatus } from '../../../../shared/models';

export interface ReservationReasonSource {
  status: ReservationStatus;
  statusReason?: string;
  rejectionReason?: string;
  cancellationReason?: string;
}

export interface ReservationStatusReasonNotice {
  title: string;
  message: string;
  variant: 'info' | 'warning' | 'danger';
  icon: string;
}

/**
 * Builds user-facing notices for terminal and technical reservation states.
 * Cancellation deliberately ignores statusReason because historical approval
 * notes may have been stored there before the fields were separated.
 */
export function buildReservationStatusReasonNotice(
  reservation: ReservationReasonSource,
): ReservationStatusReasonNotice | null {
  switch (reservation.status) {
    case 'RECHAZADA_POR_RESPONSABLE':
      return {
        title: 'Motivo del rechazo',
        message: firstAvailableText(
          reservation.rejectionReason,
          reservation.statusReason,
          'La solicitud fue rechazada por el responsable del laboratorio.',
        ),
        variant: 'danger',
        icon: 'cancel',
      };
    case 'RECHAZADA_CONFLICTO':
      return {
        title: 'Motivo del rechazo',
        message: firstAvailableText(
          reservation.statusReason,
          'La solicitud no pudo confirmarse porque existe un traslape de horario para este laboratorio.',
        ),
        variant: 'warning',
        icon: 'event_busy',
      };
    case 'RECHAZADA_REGLA_HORARIO':
      return {
        title: 'Motivo del rechazo',
        message: firstAvailableText(
          reservation.statusReason,
          'La solicitud no cumple con las reglas de disponibilidad del laboratorio.',
        ),
        variant: 'warning',
        icon: 'rule',
      };
    case 'RECHAZADA_MIN_ANTICIPACION':
      return {
        title: 'Motivo del rechazo',
        message: firstAvailableText(
          reservation.statusReason,
          'La solicitud no cumple con la anticipación mínima requerida para este laboratorio.',
        ),
        variant: 'warning',
        icon: 'schedule',
      };
    case 'CANCELADA':
      return {
        title: 'Motivo de cancelación',
        message: firstAvailableText(
          reservation.cancellationReason,
          'La reserva fue cancelada sin motivo especificado.',
        ),
        variant: 'info',
        icon: 'event_busy',
      };
    case 'ERROR_CALENDAR':
      return {
        title: 'Revisión técnica requerida',
        message: firstAvailableText(
          reservation.statusReason,
          'La reserva requiere revisión técnica por sincronización de calendario.',
        ),
        variant: 'danger',
        icon: 'sync_problem',
      };
    default:
      return null;
  }
}

function firstAvailableText(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? '';
}
