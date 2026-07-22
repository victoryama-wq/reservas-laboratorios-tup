import { describe, expect, it } from 'vitest';

import { buildReservationStatusReasonNotice } from './reservation-status-reason.utils';

describe('buildReservationStatusReasonNotice', () => {
  it('shows the explicit cancellation reason', () => {
    const notice = buildReservationStatusReasonNotice({
      status: 'CANCELADA',
      cancellationReason: 'Cambio de fecha',
      statusReason: 'Nota de aprobación antigua',
    });

    expect(notice?.message).toBe('Cambio de fecha');
  });

  it('ignores historical statusReason for cancellation', () => {
    const notice = buildReservationStatusReasonNotice({
      status: 'CANCELADA',
      statusReason: 'Nota de aprobación antigua',
    });

    expect(notice?.message).toBe(
      'La reserva fue cancelada sin motivo especificado.',
    );
  });

  it('keeps statusReason for automatic rejections', () => {
    const notice = buildReservationStatusReasonNotice({
      status: 'RECHAZADA_CONFLICTO',
      statusReason: 'El horario ya está ocupado.',
    });

    expect(notice?.message).toBe('El horario ya está ocupado.');
  });

  it('keeps rejectionReason for responsible rejection', () => {
    const notice = buildReservationStatusReasonNotice({
      status: 'RECHAZADA_POR_RESPONSABLE',
      rejectionReason: 'El protocolo requiere correcciones.',
      statusReason: 'Motivo genérico',
    });

    expect(notice?.message).toBe('El protocolo requiere correcciones.');
  });

  it('keeps statusReason for Calendar errors', () => {
    const notice = buildReservationStatusReasonNotice({
      status: 'ERROR_CALENDAR',
      statusReason: 'No fue posible sincronizar Google Calendar.',
    });

    expect(notice?.message).toBe(
      'No fue posible sincronizar Google Calendar.',
    );
  });
});
