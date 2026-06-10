import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AppSectionCardComponent } from '../../../../shared/components';
import { ResponsibleReservationView } from '../../services/reservation-review.service';

export interface ReservationDataField {
  label: string;
  value: string | null | undefined;
  icon?: string;
}

@Component({
  selector: 'app-reservation-data-grid',
  imports: [AppSectionCardComponent],
  templateUrl: './reservation-data-grid.component.html',
  styleUrl: './reservation-data-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationDataGridComponent {
  readonly reservation = input.required<ResponsibleReservationView>();
  readonly dateLabel = input('Fecha no disponible');
  readonly timeLabel = input('Horario no disponible');
  readonly fields = input<ReservationDataField[] | null>(null);

  protected readonly items = computed(() => this.fields() ?? this.defaultFields());

  protected valueOrFallback(value: string | null | undefined): string {
    return value?.trim() ? value : 'No especificado';
  }

  private defaultFields(): ReservationDataField[] {
    const reservation = this.reservation();

    const fields: ReservationDataField[] = [
      { label: 'Docente', value: reservation.teacherName },
      { label: 'Correo', value: reservation.teacherEmail },
      { label: 'Fecha', value: this.dateLabel() },
      { label: 'Horario', value: this.timeLabel() },
      { label: 'Asignatura', value: reservation.subject },
      { label: 'Grupo', value: reservation.group },
      { label: 'Practica', value: reservation.practiceName },
      { label: 'Objetivo', value: reservation.objective },
      { label: 'Material', value: reservation.materialRequired },
      { label: 'Tipo de practica', value: reservation.practiceType },
      { label: 'Material riesgoso', value: reservation.risky ? 'Si' : 'No' },
      {
        label: 'Pacientes, usuarios simulados o poblacion externa',
        value: reservation.externalParticipants ? 'Si' : 'No',
      },
    ];

    if (reservation.practiceType === 'Otro') {
      fields.splice(10, 0, {
        label: 'Especificacion',
        value: reservation.practiceTypeOther,
      });
    }

    return fields;
  }
}
