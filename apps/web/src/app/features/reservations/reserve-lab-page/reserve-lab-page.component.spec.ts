import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ReserveLabPageComponent } from './reserve-lab-page.component';
import { LabService } from '../../labs/services/lab.service';
import { ReservationCreatedEvent } from '../reservation-form/reservation-form.component';

describe('Resultado persistente por fecha', () => {
  it('mantiene los motivos y evita ofrecer reenvío de un lote parcialmente aceptado', async () => {
    await TestBed.configureTestingModule({ imports: [ReserveLabPageComponent], providers: [
      provideRouter([]), {provide: ActivatedRoute, useValue: {snapshot: {paramMap: {get: () => 'lab'}}}},
      {provide: LabService, useValue: {getLabBySlug: () => of(null)}},
      {provide: MatDialog, useValue: {}}, {provide: MatSnackBar, useValue: {}},
    ]}).compileComponents();
    const fixture = TestBed.createComponent(ReserveLabPageComponent);
    await fixture.whenStable();
    const rejected = {reservationId: 'r1', folio: 'F1', status: 'RECHAZADA_REGLA_HORARIO' as const,
      message: 'Horario bloqueado. Seleccione otra fecha.', startAt: '2026-09-08T13:00:00Z', endAt: '2026-09-08T14:00:00Z'};
    const event: ReservationCreatedEvent = {result: {...rejected, results: [rejected]},
      payload: {startAt: rejected.startAt, endAt: rejected.endAt,
        labId: 'lab-1', labSlug: 'lab', subject: 'Prueba', group: 'A', practiceName: 'Prueba',
        reservationMode: 'academic', objective: 'Prueba', materialRequired: '', practiceType: 'Taller',
        externalParticipants: false, risky: false, protocolRequired: false, source: 'web'}};
    const component = fixture.componentInstance;
    component['onReservationCreated'](event);
    expect(component['resultRows']()[0].message).toContain('Horario bloqueado');
    expect(component['canChooseAnotherTime']()).toBe(true);
    component['onReservationCreated']({...event, result: {...event.result, results: [
      rejected, {...rejected, reservationId: 'r2', status: 'CONFIRMADA', message: 'Confirmada'},
    ]}});
    expect(component['resultRows']()).toHaveLength(2);
    expect(component['canChooseAnotherTime']()).toBe(false);
    expect(component['optimisticCalendarEvents']()).toHaveLength(1);
  });
});
