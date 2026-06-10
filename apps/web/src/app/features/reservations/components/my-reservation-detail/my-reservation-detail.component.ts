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
  ReservationLogDoc,
  ReservationStatus,
} from '../../../../shared/models';
import { MyReservationView } from '../../services/my-reservations.service';

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
  readonly logs = input<ReservationLogDoc[]>([]);
  readonly dateLabel = input.required<string>();
  readonly timeLabel = input.required<string>();
  readonly protocolLoading = input(false);
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

  protected formatLogDate(log: ReservationLogDoc): string {
    const date = log.createdAt?.toDate?.();

    if (!date) {
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

  protected timelineItem(log: ReservationLogDoc): TimelineItem {
    const fallback = this.defaultLogText(log);

    return {
      title: fallback.title,
      description: log.note || fallback.description,
      variant: fallback.variant,
    };
  }

  private defaultLogText(log: ReservationLogDoc): TimelineItem {
    switch (log.action) {
      case 'CREATED':
        return {
          title: 'Solicitud registrada',
          description: 'Tu solicitud fue recibida por el sistema.',
          variant: 'info',
        };
      case 'AUTO_CONFIRMED':
        return {
          title: 'Reserva confirmada',
          description:
            'La reserva fue confirmada automaticamente y quedo registrada.',
          variant: 'success',
        };
      case 'PENDING_APPROVAL':
        return {
          title: 'Pendiente de validacion',
          description:
            'Un responsable debe revisar la solicitud antes de confirmarla.',
          variant: 'warning',
        };
      case 'APPROVED':
        return {
          title: 'Reserva aprobada',
          description: 'La solicitud fue aprobada por el responsable.',
          variant: 'success',
        };
      case 'REJECTED':
        return {
          title: 'Reserva rechazada',
          description: 'La solicitud fue rechazada por el responsable.',
          variant: 'danger',
        };
      case 'CANCELLED':
        return {
          title: 'Reserva cancelada',
          description: 'La reserva fue cancelada.',
          variant: 'neutral',
        };
      case 'CALENDAR_EVENT_CREATED':
        return {
          title: 'Agendada en calendario',
          description:
            'El evento fue creado en el calendario institucional del laboratorio.',
          variant: 'success',
        };
      case 'CALENDAR_EVENT_CANCELLED':
        return {
          title: 'Evento de calendario cancelado',
          description: 'El evento asociado fue cancelado en Google Calendar.',
          variant: 'neutral',
        };
      case 'CALENDAR_ERROR':
        return {
          title: 'Error de calendario',
          description:
            'Hubo un problema tecnico al validar o sincronizar Google Calendar.',
          variant: 'danger',
        };
      case 'EMAIL_SENT':
        return {
          title: 'Notificacion enviada',
          description:
            'Se envio la notificacion correspondiente por correo institucional.',
          variant: 'success',
        };
      case 'EMAIL_ERROR':
        return {
          title: 'Error al enviar notificacion',
          description:
            'La reserva conserva su estatus, pero el correo no pudo enviarse.',
          variant: 'warning',
        };
      case 'STATUS_CHANGED':
        return this.statusChangedText(log);
      default:
        return {
          title: 'Actualizacion de reserva',
          description: 'Se registro una actualizacion en la reserva.',
          variant: 'info',
        };
    }
  }

  private statusChangedText(log: ReservationLogDoc): TimelineItem {
    const newStatus = log.newStatus;

    if (newStatus) {
      return {
        title: this.statusLabel(newStatus),
        description: 'El estatus de la reserva fue actualizado.',
        variant: this.timelineVariantFromStatus(newStatus),
      };
    }

    return {
      title: 'Estatus actualizado',
      description: 'El estatus de la reserva fue actualizado.',
      variant: 'info',
    };
  }

  private timelineVariantFromStatus(status: ReservationStatus): TimelineVariant {
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
}
