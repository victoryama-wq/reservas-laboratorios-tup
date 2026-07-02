import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
  AppIconBoxComponent,
  AppInfoCalloutComponent,
  AppSectionCardComponent,
  AppStatusChipComponent,
  StatusChipVariant,
} from '../../../../shared/components';
import {
  ProtocolFile,
  ReservationStatus,
} from '../../../../shared/models';
import {
  MyReservationTimelineItem,
  MyReservationView,
} from '../../services/my-reservations.service';

interface DetailItem {
  label: string;
  value: string;
}

type TimelineVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface TimelineItem {
  title: string;
  description: string;
  variant: TimelineVariant;
}

@Component({
  selector: 'app-my-reservation-detail',
  imports: [
    AppIconBoxComponent,
    AppInfoCalloutComponent,
    AppSectionCardComponent,
    AppStatusChipComponent,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './my-reservation-detail.component.html',
  styleUrl: './my-reservation-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyReservationDetailComponent {
  readonly reservation = input.required<MyReservationView>();
  readonly logs = input<MyReservationTimelineItem[]>([]);
  readonly logErrorMessage = input('');
  readonly dateLabel = input.required<string>();
  readonly timeLabel = input.required<string>();
  readonly protocolLoadingPath = input<string | null>(null);
  readonly canCancel = input(false);
  readonly cancelLoading = input(false);

  readonly downloadProtocol = output<ProtocolFile>();
  readonly cancelReservation = output<void>();

  protected detailItems(): DetailItem[] {
    const reservation = this.reservation();
    const items: DetailItem[] = [
      { label: 'Laboratorio', value: reservation.labName },
      { label: 'Fecha', value: this.dateLabel() },
      { label: 'Horario', value: this.timeLabel() },
      { label: 'Asignatura', value: reservation.subject },
      { label: 'Grupo', value: reservation.group },
      { label: 'Practica', value: reservation.practiceName },
      { label: 'Objetivo', value: reservation.objective },
      {
        label: 'Material requerido',
        value: reservation.materialRequired || 'Sin material especificado',
      },
      { label: 'Tipo de practica', value: reservation.practiceType },
      {
        label: 'Material riesgoso',
        value: this.yesNo(reservation.risky),
      },
      {
        label: 'Pacientes, usuarios simulados o poblacion externa',
        value: this.yesNo(reservation.externalParticipants),
      },
      {
        label: 'Protocolo requerido',
        value: this.yesNo(reservation.protocolRequired),
      },
      {
        label: 'Revision requerida',
        value: this.yesNo(reservation.requiresManualReview),
      },
      {
        label: 'Protocolo adjunto',
        value: this.yesNo(reservation.protocolFiles.length > 0),
      },
      {
        label: 'Evento Calendar',
        value: reservation.calendarEventId
          ? 'Sincronizado'
          : 'Sin evento confirmado',
      },
    ];

    if (reservation.practiceType === 'Otro') {
      items.splice(9, 0, {
        label: 'Especificacion',
        value: reservation.practiceTypeOther || 'No especificada',
      });
    }

    return items;
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

  protected formatFileSize(sizeBytes: number): string {
    if (!sizeBytes) {
      return 'Tamano no disponible';
    }

    return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
  }

  protected isProtocolLoading(file: ProtocolFile): boolean {
    return this.protocolLoadingPath() === file.storagePath;
  }

  protected formatLogDate(log: MyReservationTimelineItem): string {
    const date = new Date(log.createdAt);

    if (Number.isNaN(date.getTime())) {
      return 'Fecha no disponible';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  protected yesNo(value: boolean): string {
    return value ? 'Si' : 'No';
  }

  protected timelineItem(log: MyReservationTimelineItem): TimelineItem {
    return {
      title: log.title,
      description: log.description,
      variant: log.severity,
    };
  }
}
