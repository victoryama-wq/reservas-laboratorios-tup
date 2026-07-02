import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import {
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  ConfirmationDialogComponent,
  StatusChipVariant,
} from '../../../shared/components';
import {
  ProtocolFile,
  ReservationStatus,
} from '../../../shared/models';
import { MyReservationDetailComponent } from '../components';
import {
  MyReservationTimelineItem,
  MyReservationsService,
  MyReservationView,
} from '../services/my-reservations.service';
import { CancelReservationService } from '../services/cancel-reservation.service';

@Component({
  selector: 'app-my-reservation-detail-page',
  imports: [
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MyReservationDetailComponent,
  ],
  templateUrl: './my-reservation-detail-page.component.html',
  styleUrl: './my-reservation-detail-page.component.scss',
})
export class MyReservationDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly reservationsService = inject(MyReservationsService);
  private readonly cancelReservationService = inject(CancelReservationService);

  protected readonly loading = signal(true);
  protected readonly protocolLoading = signal(false);
  protected readonly cancelLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly logErrorMessage = signal('');
  protected readonly reservation = signal<MyReservationView | null>(null);
  protected readonly logs = signal<MyReservationTimelineItem[]>([]);

  ngOnInit(): void {
    void this.loadReservation();
  }

  protected async loadReservation(): Promise<void> {
    const reservationId = this.route.snapshot.paramMap.get('reservationId');

    if (!reservationId) {
      this.errorMessage.set('No se encontro el identificador de la reserva.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.logErrorMessage.set('');

    try {
      const reservation =
        await this.reservationsService.getMyReservationById(reservationId);

      if (!reservation) {
        this.errorMessage.set(
          'No se encontro la reserva o no pertenece a tu usuario.',
        );
        return;
      }

      this.reservation.set(reservation);
      await this.loadReservationLogs(reservationId);
    } catch (error) {
      this.errorMessage.set(
        (error as { message?: string }).message ??
          'No fue posible cargar el detalle de la reserva.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async loadReservationLogs(reservationId: string): Promise<void> {
    this.logErrorMessage.set('');

    try {
      this.logs.set(await this.reservationsService.getReservationLogs(
        reservationId,
      ));
    } catch (error) {
      this.logs.set([]);
      this.logErrorMessage.set(this.toLogErrorMessage(error));
    }
  }

  protected async goBack(): Promise<void> {
    await this.router.navigate(['/mis-reservas']);
  }

  protected formatDate(reservation: MyReservationView): string {
    return this.reservationsService.formatDate(reservation.startDate);
  }

  protected formatTime(reservation: MyReservationView): string {
    return this.reservationsService.formatTimeRange(reservation);
  }

  protected async openProtocol(file: ProtocolFile): Promise<void> {
    this.protocolLoading.set(true);

    try {
      const url = await this.reservationsService.getProtocolUrl(file);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      this.snackBar.open(
        'No fue posible abrir el protocolo. Verifica permisos o contacta a Admin/Sistemas.',
        'Cerrar',
        { duration: 6000, panelClass: ['app-snackbar-warning'] },
      );
    } finally {
      this.protocolLoading.set(false);
    }
  }

  protected canCancelReservation(
    reservation: MyReservationView,
  ): boolean {
    if (!reservation.startDate || reservation.startDate.getTime() <= Date.now()) {
      return false;
    }

    return [
      'PENDIENTE_VALIDACION',
      'CONFIRMADA',
      'CONFIRMADA_TRAS_VALIDACION',
    ].includes(reservation.status);
  }

  protected async confirmCancelReservation(
    reservation: MyReservationView,
  ): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmationDialogComponent, {
          width: 'min(92vw, 460px)',
          data: {
            title: 'Cancelar reserva',
            message: [
              `Se cancelara la reserva ${reservation.folio}.`,
              'Esta accion liberara el horario y enviara notificaciones.',
            ].join(' '),
            confirmLabel: 'Si, cancelar',
            cancelLabel: 'Conservar reserva',
            variant: 'danger',
            icon: 'event_busy',
          },
        })
        .afterClosed(),
    );

    if (!confirmed) {
      return;
    }

    this.cancelLoading.set(true);

    try {
      const result =
        await this.cancelReservationService.cancelReservation({
          reservationId: reservation.id,
        });
      this.snackBar.open(result.message, 'Cerrar', {
        duration: 5000,
        panelClass: ['app-snackbar-success'],
      });
      await this.loadReservation();
    } catch (error) {
      this.snackBar.open(
        this.toErrorMessage(error),
        'Cerrar',
        { duration: 7000, panelClass: ['app-snackbar-danger'] },
      );
    } finally {
      this.cancelLoading.set(false);
    }
  }

  protected statusLabel(status: ReservationStatus): string {
    const labels: Record<ReservationStatus, string> = {
      RECIBIDA: 'Recibida',
      PENDIENTE_VALIDACION: 'Pendiente de validacion',
      CONFIRMADA: 'Confirmada',
      CONFIRMADA_TRAS_VALIDACION: 'Confirmada tras validacion',
      RECHAZADA_CONFLICTO: 'Rechazada por conflicto',
      RECHAZADA_REGLA_HORARIO: 'Rechazada por horario',
      RECHAZADA_MIN_ANTICIPACION: 'Rechazada por anticipacion',
      RECHAZADA_POR_RESPONSABLE: 'Rechazada por responsable',
      CANCELADA: 'Cancelada',
      ERROR_CALENDAR: 'Error Calendar',
    };

    return labels[status];
  }

  protected statusVariant(status: ReservationStatus): StatusChipVariant {
    if (status === 'CONFIRMADA' || status === 'CONFIRMADA_TRAS_VALIDACION') {
      return 'success';
    }

    if (status === 'PENDIENTE_VALIDACION' || status === 'RECIBIDA') {
      return 'warning';
    }

    if (status === 'CANCELADA') {
      return 'neutral';
    }

    return 'danger';
  }

  protected statusIcon(status: ReservationStatus): string {
    if (status === 'CONFIRMADA' || status === 'CONFIRMADA_TRAS_VALIDACION') {
      return 'check_circle';
    }

    if (status === 'PENDIENTE_VALIDACION' || status === 'RECIBIDA') {
      return 'schedule';
    }

    if (status === 'CANCELADA') {
      return 'block';
    }

    return 'warning';
  }

  private toErrorMessage(error: unknown): string {
    const record = error as { message?: unknown };
    return typeof record.message === 'string' && record.message.trim()
      ? record.message
      : 'No fue posible cancelar la reserva.';
  }

  private toLogErrorMessage(error: unknown): string {
    const record = error as { message?: unknown };
    return typeof record.message === 'string' && record.message.trim()
      ? record.message
      : 'No fue posible cargar la bitacora. Intenta nuevamente.';
  }
}
