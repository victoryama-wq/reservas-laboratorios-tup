import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import {
  DecisionDialogComponent,
  DecisionDialogData,
  DecisionDialogResult,
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
import { ProtocolFile } from '../../../shared/models';
import {
  closeProtocolWindow,
  openUrlInProtocolWindow,
  prepareProtocolWindow,
} from '../../../shared/utils/protocol-window.utils';
import {
  ReservationReviewService,
  ReservationReviewTimelineItem,
  ResponsibleReservationView,
} from '../services/reservation-review.service';

@Component({
  selector: 'app-responsible-reservation-detail-page',
  imports: [
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
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
  protected readonly logsMessage = signal('');
  protected readonly protocolMessage = signal('');
  protected readonly openingProtocolPath = signal<string | null>(null);
  protected readonly reservation = signal<ResponsibleReservationView | null>(null);
  protected readonly logs = signal<ReservationReviewTimelineItem[]>([]);
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
      await this.loadTimeline(reservationId);

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
      status: log.title,
      label: log.description,
      date: this.formatLogDate(log.createdAt),
      actor: log.actorLabel,
      variant: log.severity,
      icon: this.logIcon(log.action),
    }));
  }

  protected async openProtocol(file: ProtocolFile): Promise<void> {
    const reservation = this.reservation();

    if (!reservation) {
      return;
    }

    this.protocolMessage.set('');
    this.openingProtocolPath.set(file.storagePath);
    const protocolWindow = prepareProtocolWindow();

    try {
      const access = await this.reviewService.getProtocolAccess(
        reservation.id,
        file.storagePath,
      );

      if (!openUrlInProtocolWindow(protocolWindow, access.url)) {
        throw new Error(
          'El navegador bloqueo la apertura del protocolo.',
        );
      }
    } catch (error) {
      closeProtocolWindow(protocolWindow);
      this.protocolMessage.set(
        (error as { message?: string }).message ??
          'No fue posible abrir el protocolo. Verifique permisos con Admin/Sistemas.',
      );
    } finally {
      this.openingProtocolPath.set(null);
    }
  }

  protected canShowDecisionAction(): boolean {
    const reservation = this.reservation();

    return Boolean(
      reservation?.status === 'PENDIENTE_VALIDACION' &&
        !this.submitting() &&
        !this.openingProtocolPath(),
    );
  }

  protected async openDecisionDialog(): Promise<void> {
    const reservation = this.reservation();

    if (!reservation || !this.canShowDecisionAction()) {
      return;
    }

    const result = await firstValueFrom(
      this.dialog
        .open<DecisionDialogComponent, DecisionDialogData, DecisionDialogResult>(
          DecisionDialogComponent,
          {
            data: {
              folio: reservation.folio,
              labName: reservation.labName,
              timeLabel: this.formatTime(),
            },
            maxWidth: '560px',
            width: 'calc(100vw - 32px)',
            panelClass: 'app-decision-dialog-panel',
            restoreFocus: false,
          },
        )
        .afterClosed(),
    );

    if (!result) {
      return;
    }

    if (result.action === 'reject' && !result.reason?.trim()) {
      this.snackBar.open('Debe indicar el motivo de rechazo.', 'Cerrar', {
        duration: 4500,
      });
      return;
    }

    if (result.action === 'approve') {
      await this.submitDecision(() =>
        this.reviewService.approveReservation(
          reservation.id,
          result.note?.trim() ?? '',
        ),
      );
      return;
    }

    await this.submitDecision(() =>
      this.reviewService.rejectReservation(reservation.id, result.reason ?? ''),
    );
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

  private async loadTimeline(reservationId: string): Promise<void> {
    try {
      this.logs.set(await this.reviewService.getReservationLogs(reservationId));
      this.logsMessage.set('');
    } catch (error) {
      this.logs.set([]);
      this.logsMessage.set(
        (error as { message?: string }).message ??
          'No fue posible cargar la bitacora. Intenta nuevamente.',
      );
    }
  }

  private formatLogDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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

  private logIcon(action: string): string {
    const icons: Record<string, string> = {
      APPROVED: 'check_circle',
      AUTO_CONFIRMED: 'check_circle',
      CALENDAR_ERROR: 'error',
      CALENDAR_EVENT_CANCELLED: 'event_busy',
      CALENDAR_EVENT_CREATED: 'event_available',
      CANCELLED: 'event_busy',
      CREATED: 'add_circle',
      EMAIL_ERROR: 'mark_email_unread',
      EMAIL_SENT: 'mail',
      PENDING_APPROVAL: 'schedule',
      REJECTED: 'cancel',
      STATUS_CHANGED: 'sync_alt',
    };

    return icons[action] ?? 'radio_button_checked';
  }
}
