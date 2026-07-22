import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
  AppIconBoxComponent,
  InfoCalloutVariant,
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
import { buildReservationStatusReasonNotice } from './reservation-status-reason.utils';

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

interface StatusReasonNotice {
  title: string;
  message: string;
  variant: InfoCalloutVariant;
  icon: string;
  dateLabel?: string;
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
      { label: 'Práctica', value: reservation.practiceName },
      { label: 'Objetivo', value: reservation.objective },
      {
        label: 'Material requerido',
        value: reservation.materialRequired || 'Sin material especificado',
      },
      { label: 'Tipo de práctica', value: reservation.practiceType },
      {
        label: 'Material riesgoso',
        value: this.yesNo(reservation.risky),
      },
      {
        label: 'Pacientes, usuarios simulados o población externa',
        value: this.yesNo(reservation.externalParticipants),
      },
      {
        label: 'Protocolo requerido',
        value: this.yesNo(reservation.protocolRequired),
      },
      {
        label: 'Revisión requerida',
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
        label: 'Especificación',
        value: reservation.practiceTypeOther || 'No especificada',
      });
    }

    return items;
  }

  protected statusLabel(status: ReservationStatus): string {
    const labels: Record<ReservationStatus, string> = {
      RECIBIDA: 'Recibida',
      PENDIENTE_VALIDACION: 'Pendiente de validación',
      CONFIRMADA: 'Confirmada',
      CONFIRMADA_TRAS_VALIDACION: 'Confirmada tras validación',
      RECHAZADA_CONFLICTO: 'Rechazada por conflicto',
      RECHAZADA_REGLA_HORARIO: 'Rechazada por horario',
      RECHAZADA_MIN_ANTICIPACION: 'Rechazada por anticipación',
      RECHAZADA_POR_RESPONSABLE: 'Rechazada por responsable',
      CANCELADA: 'Cancelada',
      ERROR_CALENDAR: 'Revisión técnica',
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

  protected statusReasonNotice(): StatusReasonNotice | null {
    const reservation = this.reservation();
    const notice = buildReservationStatusReasonNotice(reservation);

    if (!notice) {
      return null;
    }

    const eventDate = reservation.status === 'RECHAZADA_POR_RESPONSABLE'
      ? reservation.rejectedAt
      : reservation.status === 'CANCELADA'
        ? reservation.cancelledAt
        : undefined;

    return {
      ...notice,
      dateLabel: this.formatOptionalDate(eventDate),
    };
  }

  protected formatFileSize(sizeBytes: number): string {
    if (!sizeBytes) {
      return 'Tamaño no disponible';
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
    return value ? 'Sí' : 'No';
  }

  protected timelineItem(log: MyReservationTimelineItem): TimelineItem {
    return {
      title: log.title,
      description: log.description,
      variant: log.severity,
    };
  }

  private formatOptionalDate(value: unknown): string | undefined {
    const date = this.toDate(value);

    if (!date) {
      return undefined;
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return value;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate?: unknown }).toDate === 'function'
    ) {
      return (value as { toDate: () => Date }).toDate();
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      '_seconds' in value &&
      typeof (value as { _seconds?: unknown })._seconds === 'number'
    ) {
      const timestamp = value as {
        _seconds: number;
        _nanoseconds?: number;
      };

      return new Date(
        timestamp._seconds * 1000 +
          Math.floor((timestamp._nanoseconds ?? 0) / 1_000_000),
      );
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'seconds' in value &&
      typeof (value as { seconds?: unknown }).seconds === 'number'
    ) {
      const timestamp = value as {
        seconds: number;
        nanoseconds?: number;
      };

      return new Date(
        timestamp.seconds * 1000 +
          Math.floor((timestamp.nanoseconds ?? 0) / 1_000_000),
      );
    }

    return null;
  }
}
