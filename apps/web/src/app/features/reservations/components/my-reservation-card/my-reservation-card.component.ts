import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
  AppIconBoxComponent,
  AppStatusChipComponent,
  StatusChipVariant,
} from '../../../../shared/components';
import { ReservationStatus } from '../../../../shared/models';
import { MyReservationView } from '../../services/my-reservations.service';

@Component({
  selector: 'app-my-reservation-card',
  imports: [
    AppIconBoxComponent,
    AppStatusChipComponent,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './my-reservation-card.component.html',
  styleUrl: './my-reservation-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyReservationCardComponent {
  readonly reservation = input.required<MyReservationView>();
  readonly dateLabel = input.required<string>();
  readonly timeLabel = input.required<string>();

  readonly viewDetails = output<MyReservationView>();

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

  protected yesNo(value: boolean): string {
    return value ? 'Si' : 'No';
  }
}
