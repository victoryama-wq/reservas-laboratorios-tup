import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface AvailabilitySlotDetailDialogData {
  title: string;
  icon: string;
  variant: 'danger' | 'warning' | 'neutral';
  statusLabel: string;
  timeRange: string;
  message: string;
}

@Component({
  selector: 'app-availability-slot-detail-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './availability-slot-detail-dialog.component.html',
  styleUrl: './availability-slot-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailabilitySlotDetailDialogComponent {
  protected readonly data = inject<AvailabilitySlotDetailDialogData>(MAT_DIALOG_DATA);
}
