import { institutionalDateTime, institutionalDateKey, datePickerKey, datePickerDate } from './institutional-time.utils';

describe('Fechas institucionales', () => {
  it('convierte 08:00 de Cancún a 13:00 UTC', () => {
    expect(institutionalDateTime('2026-09-08', '08:00').toISOString()).toBe('2026-09-08T13:00:00.000Z');
    expect(institutionalDateKey(new Date('2026-09-09T04:59:00Z'))).toBe('2026-09-08');
  });
  it('conserva la fecha civil del Datepicker y rechaza fechas imposibles', () => {
    expect(datePickerKey(datePickerDate('2026-09-08'))).toBe('2026-09-08');
    expect(() => institutionalDateTime('2026-02-30')).toThrow();
    expect(() => institutionalDateTime('2026-09-08', '25:00')).toThrow();
  });
});
