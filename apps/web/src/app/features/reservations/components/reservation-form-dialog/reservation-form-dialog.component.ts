import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { AppIconBoxComponent } from '../../../../shared/components';
import { LabDoc } from '../../../../shared/models';
import { AvailabilitySlot } from '../../../calendar/components';
import {
  ReservationCreatedEvent,
  ReservationFormComponent,
} from '../../reservation-form/reservation-form.component';

export interface ReservationFormDialogData {
  lab: LabDoc;
  calendarSlot: AvailabilitySlot | null;
}

@Component({
  selector: 'app-reservation-form-dialog',
  imports: [
    AppIconBoxComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    ReservationFormComponent,
  ],
  templateUrl: './reservation-form-dialog.component.html',
  styleUrl: './reservation-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationFormDialogComponent {
  protected readonly data = inject<ReservationFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<
    MatDialogRef<ReservationFormDialogComponent, ReservationCreatedEvent>
  >(MatDialogRef);

  protected readonly submitting = signal(false);

  protected onSubmittingChange(isSubmitting: boolean): void {
    this.submitting.set(isSubmitting);
    this.dialogRef.disableClose = isSubmitting;
  }

  protected onReservationCreated(event: ReservationCreatedEvent): void {
    this.dialogRef.close(event);
  }
}
