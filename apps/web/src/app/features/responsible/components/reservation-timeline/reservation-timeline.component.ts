import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  AppSectionCardComponent,
  AppStatusChipComponent,
  StatusChipVariant,
} from '../../../../shared/components';

export interface ReservationTimelineEvent {
  status: string;
  label: string;
  date?: string;
  actor?: string;
  variant?: StatusChipVariant;
  icon?: string;
}

@Component({
  selector: 'app-reservation-timeline',
  imports: [AppSectionCardComponent, AppStatusChipComponent, MatIconModule],
  templateUrl: './reservation-timeline.component.html',
  styleUrl: './reservation-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationTimelineComponent {
  readonly events = input<ReservationTimelineEvent[]>([]);
}
