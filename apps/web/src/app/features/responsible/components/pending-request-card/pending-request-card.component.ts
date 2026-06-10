import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
  AppIconBoxComponent,
  AppSectionCardComponent,
  AppStatusChipComponent,
} from '../../../../shared/components';
import { ResponsibleReservationView } from '../../services/reservation-review.service';

@Component({
  selector: 'app-pending-request-card',
  imports: [
    AppIconBoxComponent,
    AppSectionCardComponent,
    AppStatusChipComponent,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './pending-request-card.component.html',
  styleUrl: './pending-request-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingRequestCardComponent {
  readonly request = input.required<ResponsibleReservationView>();
  readonly dateLabel = input('Fecha no disponible');
  readonly timeLabel = input('Horario no disponible');
  readonly showActions = input(true);

  readonly review = output<ResponsibleReservationView>();

  protected emitReview(): void {
    this.review.emit(this.request());
  }
}
