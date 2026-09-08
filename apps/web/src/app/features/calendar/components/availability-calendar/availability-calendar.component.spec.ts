import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { AvailabilityCalendarComponent } from './availability-calendar.component';

describe('Bloques del calendario por día institucional', () => {
  it('recorta bloqueos de varios días sin desplazarlos fuera del horario visible', async () => {
    await TestBed.configureTestingModule({ imports: [AvailabilityCalendarComponent],
      providers: [{provide: MatDialog, useValue: {open: vi.fn()}}],
    }).compileComponents();
    const fixture = TestBed.createComponent(AvailabilityCalendarComponent);
    const meta = { start: '2026-09-08T05:00:00Z', end: '2026-09-10T05:00:00Z',
      extendedProps: {source: 'blockedPeriod'} };
    fixture.componentRef.setInput('hours', ['08:00', '09:00', '10:00']);
    fixture.componentRef.setInput('slots', ['08:00', '09:00', '10:00'].map((hour) => ({
      dayKey: '2026-09-09', startTime: hour, endTime: '00:00',
      status: 'unavailable', label: 'No disponible', meta,
    })));
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const blocks = component['blocksForDay']('2026-09-09');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].startTime).toBe('00:00');
    expect(blocks[0].endTime).toBe('24:00');
    expect(component['blockOffsetMinutes'](blocks[0])).toBe(0);
    expect(component['blockDurationMinutes'](blocks[0])).toBe(180);
  });
});
