import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import {
  DecisionPanelComponent,
  ProtocolFileCardComponent,
  ReservationDataGridComponent,
  ReservationTimelineComponent,
  ReservationTimelineEvent,
} from '../components';
import {
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../../shared/components';
import { ProtocolFile, ReservationLogDoc } from '../../../shared/models';
import {
  ReservationReviewService,
  ResponsibleReservationView,
} from '../services/reservation-review.service';

@Component({
  selector: 'app-responsible-reservation-detail-page',
  imports: [
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    DecisionPanelComponent,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    ProtocolFileCardComponent,
    ReservationDataGridComponent,
    ReservationTimelineComponent,
  ],
  templateUrl: './responsible-reservation-detail-page.component.html',
  styleUrl: './responsible-reservation-detail-page.component.scss',
})
export class ResponsibleReservationDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly reviewService = inject(ReservationReviewService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly protocolMessage = signal('');
  protected readonly reservation = signal<ResponsibleReservationView | null>(null);
  protected readonly logs = signal<ReservationLogDoc[]>([]);
  protected approvalNote = '';
  protected rejectionReason = '';

  ngOnInit(): void {
    void this.loadReservation();
  }

  protected async loadReservation(): Promise<void> {
    const reservationId = this.route.snapshot.paramMap.get('reservationId');

    if (!reservationId) {
      this.errorMessage.set('No se recibio la reserva solicitada.');
      this.loading.set(false);
      return;
    }

    try {
      const reservation =
        await this.reviewService.getReservationById(reservationId);
      this.reservation.set(reservation);
      this.logs.set(await this.reviewService.getReservationLogs(reservationId));

      if (!reservation) {
        this.errorMessage.set('La reserva no existe o no esta disponible.');
      }
    } catch (error) {
      this.errorMessage.set(
        (error as { message?: string }).message ??
          'No fue posible cargar la reserva.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDate(): string {
    return this.reviewService.formatDate(this.reservation()?.startDate ?? null);
  }

  protected formatTime(): string {
    const reservation = this.reservation();
    return reservation
      ? this.reviewService.formatTimeRange(reservation)
      : 'Horario no disponible';
  }

  protected formatFileSize(sizeBytes?: number): string {
    if (!sizeBytes) {
      return '';
    }

    if (sizeBytes < 1024 * 1024) {
      return `${Math.round(sizeBytes / 1024)} KB`;
    }

    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected fileType(file: ProtocolFile): string {
    if (file.contentType === 'application/pdf') {
      return 'PDF';
    }

    if (file.contentType.includes('word')) {
      return 'Word';
    }

    if (file.contentType.startsWith('image/')) {
      return 'Imagen';
    }

    return file.contentType || 'Archivo';
  }

  protected timelineEvents(): ReservationTimelineEvent[] {
    return this.logs().map((log) => ({
      status: log.action,
      label: log.note || 'Sin nota',
      date: this.formatLogDate(log),
      actor: log.actorEmail || log.actorUid || 'Sistema',
      variant: this.logVariant(log.action),
      icon: this.logIcon(log.action),
    }));
  }

  protected async openProtocol(storagePath: string): Promise<void> {
    this.protocolMessage.set('');

    try {
      const url = await this.reviewService.getProtocolUrl(storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      this.protocolMessage.set(
        'No fue posible abrir el protocolo con las reglas actuales de Storage. Admin/Sistemas debe revisar permisos de lectura para responsables.',
      );
    }
  }

  protected async approve(): Promise<void> {
    const reservation = this.reservation();

    if (!reservation) {
      return;
    }

    const confirmed = await this.confirmDecision({
      title: 'Aprobar reserva',
      message: `Se aprobará la solicitud ${reservation.folio} y se intentará crear el evento en Google Calendar.`,
      confirmLabel: 'Aprobar reserva',
      cancelLabel: 'Cancelar',
      variant: 'primary',
      icon: 'check_circle',
    });

    if (!confirmed) {
      return;
    }

    await this.submitDecision(() =>
      this.reviewService.approveReservation(reservation.id, this.approvalNote),
    );
  }

  protected async reject(): Promise<void> {
    const reservation = this.reservation();
    const reason = this.rejectionReason.trim();

    if (!reservation) {
      return;
    }

    if (!reason) {
      this.snackBar.open('Debe indicar el motivo de rechazo.', 'Cerrar', {
        duration: 4500,
      });
      return;
    }

    const confirmed = await this.confirmDecision({
      title: 'Rechazar reserva',
      message: `Se rechazará la solicitud ${reservation.folio}. El motivo indicado se notificará al docente.`,
      confirmLabel: 'Rechazar reserva',
      cancelLabel: 'Cancelar',
      variant: 'danger',
      icon: 'cancel',
    });

    if (!confirmed) {
      return;
    }

    await this.submitDecision(() =>
      this.reviewService.rejectReservation(reservation.id, reason),
    );
  }

  private async submitDecision(
    action: () => Promise<{ message: string }>,
  ): Promise<void> {
    this.submitting.set(true);

    try {
      const result = await action();
      this.snackBar.open(result.message, 'Cerrar', { duration: 6500 });
      await this.router.navigate(['/responsable/solicitudes']);
    } catch (error) {
      this.snackBar.open(
        (error as { message?: string }).message ??
          'No fue posible completar la revision.',
        'Cerrar',
        { duration: 6500 },
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private async confirmDecision(data: ConfirmationDialogData): Promise<boolean> {
    const result = await firstValueFrom(
      this.dialog
        .open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
          ConfirmationDialogComponent,
          {
            data,
            maxWidth: '460px',
            width: 'calc(100vw - 32px)',
            panelClass: 'app-confirmation-dialog-panel',
            restoreFocus: false,
          },
        )
        .afterClosed(),
    );

    return result === true;
  }

  private formatLogDate(log: ReservationLogDoc): string {
    const createdAt = log.createdAt as unknown;
    const date = this.toDate(createdAt);

    if (!date) {
      return '';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return value;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { toDate?: unknown }).toDate === 'function'
    ) {
      return (value as { toDate: () => Date }).toDate();
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { seconds?: unknown }).seconds === 'number'
    ) {
      const timestamp = value as { seconds: number; nanoseconds?: number };
      return new Date(
        timestamp.seconds * 1000 +
          Math.floor((timestamp.nanoseconds ?? 0) / 1_000_000),
      );
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { _seconds?: unknown })._seconds === 'number'
    ) {
      const timestamp = value as { _seconds: number; _nanoseconds?: number };
      return new Date(
        timestamp._seconds * 1000 +
          Math.floor((timestamp._nanoseconds ?? 0) / 1_000_000),
      );
    }

    return null;
  }

  private logVariant(
    action: ReservationLogDoc['action'],
  ): ReservationTimelineEvent['variant'] {
    if (action === 'APPROVED' || action === 'EMAIL_SENT') {
      return 'success';
    }

    if (action === 'REJECTED' || action === 'CALENDAR_ERROR' || action === 'EMAIL_ERROR') {
      return 'danger';
    }

    if (action === 'PENDING_APPROVAL') {
      return 'warning';
    }

    return 'info';
  }

  private logIcon(action: ReservationLogDoc['action']): string {
    const icons: Partial<Record<ReservationLogDoc['action'], string>> = {
      APPROVED: 'check_circle',
      AUTO_CONFIRMED: 'check_circle',
      CALENDAR_ERROR: 'error',
      CREATED: 'add_circle',
      EMAIL_ERROR: 'mark_email_unread',
      EMAIL_SENT: 'mail',
      PENDING_APPROVAL: 'schedule',
      REJECTED: 'cancel',
    };

    return icons[action] ?? 'radio_button_checked';
  }
}
