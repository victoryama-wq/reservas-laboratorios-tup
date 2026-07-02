import { Component, OnInit, inject, signal } from '@angular/core';
import { EventInput } from '@fullcalendar/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  AppSectionCardComponent,
} from '../../../shared/components';
import { PublicLab } from '../../../shared/models';
import { AvailabilitySlot } from '../../calendar/components';
import { LabCalendarComponent } from '../../calendar/lab-calendar/lab-calendar.component';
import { LabService } from '../../labs/services/lab.service';
import {
  ReservationCreatedEvent,
} from '../reservation-form/reservation-form.component';
import {
  ReservationFormDialogComponent,
  ReservationFormDialogData,
} from '../components';

@Component({
  selector: 'app-reserve-lab-page',
  imports: [
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    AppSectionCardComponent,
    LabCalendarComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
  ],
  templateUrl: './reserve-lab-page.component.html',
  styleUrl: './reserve-lab-page.component.scss',
})
export class ReserveLabPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly labService = inject(LabService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly lab = signal<PublicLab | null>(null);
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

  protected openReservationDialog(selectedLab: PublicLab): void {
    const dialogRef = this.dialog.open<
      ReservationFormDialogComponent,
      ReservationFormDialogData,
      ReservationCreatedEvent
    >(ReservationFormDialogComponent, {
      width: 'min(1120px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100vh - 32px)',
      autoFocus: 'dialog',
      restoreFocus: true,
      ariaLabel: 'Nueva solicitud de reserva',
      panelClass: 'reservation-form-dialog-panel',
      data: {
        lab: selectedLab,
        calendarSlot: this.selectedCalendarSlot(),
      },
    });

    dialogRef.afterClosed().subscribe((event) => {
      if (!event) {
        return;
      }

      this.onReservationCreated(event);
      this.showReservationResultMessage(event);
    });
  }

  protected selectedSlotSummary(): string {
    const slot = this.selectedCalendarSlot();

    if (!slot) {
      return '';
    }

    const date = this.formatDayKey(slot.dayKey);
    const endTime = slot.endTime ? ` - ${slot.endTime}` : '';

    return `${date}, ${slot.startTime}${endTime}`;
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

  private showReservationResultMessage(event: ReservationCreatedEvent): void {
    const status = event.result.status;

    if (status === 'CONFIRMADA' || status === 'CONFIRMADA_TRAS_VALIDACION') {
      this.snackBar.open(
        'Reserva confirmada. Se agrego al calendario institucional.',
        'Cerrar',
        { duration: 6500, panelClass: ['app-snackbar--success'] },
      );
      return;
    }

    if (status === 'PENDIENTE_VALIDACION') {
      this.snackBar.open(
        'Solicitud enviada. Quedo pendiente de revision por el responsable.',
        'Cerrar',
        { duration: 7000, panelClass: ['app-snackbar--info'] },
      );
      return;
    }

    if (status === 'ERROR_CALENDAR') {
      this.snackBar.open(
        'La solicitud requiere revision tecnica por un error de calendario.',
        'Cerrar',
        { duration: 7500, panelClass: ['app-snackbar--warning'] },
      );
      return;
    }

    if (status.startsWith('RECHAZADA')) {
      this.snackBar.open(
        'No fue posible confirmar la solicitud. Revise el motivo indicado.',
        'Cerrar',
        { duration: 7500, panelClass: ['app-snackbar--warning'] },
      );
      return;
    }

    this.snackBar.open(
      event.result.message ?? 'Solicitud procesada correctamente.',
      'Cerrar',
      { duration: 6500, panelClass: ['app-snackbar--info'] },
    );
  }

  private formatDayKey(dayKey: string): string {
    const date = new Date(`${dayKey}T00:00:00`);

    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }
}
