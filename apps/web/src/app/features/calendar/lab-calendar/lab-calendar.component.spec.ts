import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { LabCalendarComponent } from './lab-calendar.component';
import { AvailabilityService } from '../services/availability.service';
import { LabService } from '../../labs/services/lab.service';

describe('Consulta de disponibilidad', () => {
  it('no ofrece espacios libres cuando la consulta falla', async () => {
    await TestBed.configureTestingModule({ imports: [LabCalendarComponent], providers: [
      {provide: AvailabilityService, useValue: {getAvailabilityEvents: () => of({events: [], hasReadLimit: true})}},
      {provide: BreakpointObserver, useValue: {observe: () => of({matches: true})}},
      {provide: LabService, useValue: {getWeeklyScheduleSummary: () => '08:00–13:00'}},
    ]}).compileComponents();
    const fixture = TestBed.createComponent(LabCalendarComponent);
    fixture.componentRef.setInput('lab', {id: 'lab-1', name: 'Laboratorio', weeklySchedule:
      Object.fromEntries(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        .map((day) => [day, {enabled: true, start: '08:00', end: '13:00'}]))});
    await fixture.whenStable();
    expect(fixture.componentInstance['calendarSlots']().every((slot) => slot.disabled)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No fue posible consultar');
  });
});
