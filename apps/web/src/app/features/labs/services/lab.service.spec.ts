import { TestBed } from '@angular/core/testing';
import { FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.providers';
import { LabService } from './lab.service';

describe('Resumen del horario del laboratorio', () => {
  let service: LabService;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      {provide: FIREBASE_FUNCTIONS, useValue: {}},
    ]});
    service = TestBed.inject(LabService);
  });

  it('muestra el domingo abierto con sus horas reales', () => {
    const summary = service.getWeeklyScheduleSummary({
      sunday: {enabled: true, start: '09:00', end: '13:00'},
    });
    expect(summary).toContain('Domingo 09:00 - 13:00');
    expect(summary).not.toContain('Domingo cerrado');
  });

  it('muestra cerrado un domingo deshabilitado o sin configuración', () => {
    expect(service.getWeeklyScheduleSummary({
      sunday: {enabled: false, start: '08:00', end: '18:00'},
    })).toContain('Domingo cerrado');
    expect(service.getWeeklyScheduleSummary({})).toContain('Domingo cerrado');
  });

  it('respeta las diferencias entre los días de la semana', () => {
    const summary = service.getWeeklyScheduleSummary({
      monday: {enabled: true, start: '08:00', end: '18:00'},
      tuesday: {enabled: true, start: '10:00', end: '16:00'},
      wednesday: {enabled: false, start: '08:00', end: '18:00'},
    });
    expect(summary).toContain('Lun 08:00 - 18:00');
    expect(summary).toContain('Mar 10:00 - 16:00');
    expect(summary).toContain('Mié cerrado');
  });
});
