import { Component, OnInit, inject, signal } from '@angular/core';
import { EventInput } from '@fullcalendar/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AppPageHeaderComponent } from '../../../shared/components';
import { LabDoc } from '../../../shared/models';
import { AvailabilitySlot } from '../../calendar/components';
import { LabCalendarComponent } from '../../calendar/lab-calendar/lab-calendar.component';
import { LabService } from '../../labs/services/lab.service';
import {
  ReservationCreatedEvent,
  ReservationFormComponent,
} from '../reservation-form/reservation-form.component';

@Component({
  selector: 'app-reserve-lab-page',
  imports: [
    AppPageHeaderComponent,
    LabCalendarComponent,
    MatProgressSpinnerModule,
    ReservationFormComponent,
    RouterLink,
  ],
  templateUrl: './reserve-lab-page.component.html',
  styleUrl: './reserve-lab-page.component.scss',
})
export class ReserveLabPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly labService = inject(LabService);

  protected readonly lab = signal<LabDoc | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly labSlug = signal('');
  protected readonly selectedCalendarSlot = signal<AvailabilitySlot | null>(null);
  protected readonly calendarRefreshKey = signal(0);
  protected readonly optimisticCalendarEvents = signal<EventInput[]>([]);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('labSlug') ?? '';
    this.labSlug.set(slug);

    if (!slug) {
      this.errorMessage.set('No se recibio el laboratorio solicitado.');
      this.loading.set(false);
      return;
    }

    this.labService.getLabBySlug(slug).subscribe({
      next: (lab) => {
        this.lab.set(lab);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar el laboratorio.');
        this.loading.set(false);
      },
    });
  }

  protected onCalendarSlotSelected(slot: AvailabilitySlot): void {
    this.selectedCalendarSlot.set(slot);
  }

  protected onReservationCreated(event: ReservationCreatedEvent): void {
    this.selectedCalendarSlot.set(null);
    const calendarEvent = this.toOptimisticCalendarEvent(event);

    if (calendarEvent) {
      this.optimisticCalendarEvents.update((events) => [
        ...events.filter((item) => item.id !== calendarEvent.id),
        calendarEvent,
      ]);
    }

    this.calendarRefreshKey.update((value) => value + 1);
  }

  private toOptimisticCalendarEvent(
    event: ReservationCreatedEvent,
  ): EventInput | null {
    if (!this.isBlockingStatus(event.result.status)) {
      return null;
    }

    return {
      id: event.result.reservationId,
      title:
        event.result.status === 'PENDIENTE_VALIDACION'
          ? 'Pendiente de validacion'
          : 'Ocupado',
      start: event.payload.startAt,
      end: event.payload.endAt,
      extendedProps: {
        source: 'reservation',
        status: event.result.status,
      },
    };
  }

  private isBlockingStatus(status: ReservationCreatedEvent['result']['status']): boolean {
    return [
      'PENDIENTE_VALIDACION',
      'CONFIRMADA',
      'CONFIRMADA_TRAS_VALIDACION',
      'ERROR_CALENDAR',
    ].includes(status);
  }
}
