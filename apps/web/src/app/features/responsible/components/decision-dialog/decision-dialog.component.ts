import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface DecisionDialogData {
  folio: string;
  labName: string;
  timeLabel: string;
  maxLength?: number;
}

export type DecisionDialogResult =
  | { action: 'approve'; note: string }
  | { action: 'reject'; reason: string };

@Component({
  selector: 'app-decision-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './decision-dialog.component.html',
  styleUrl: './decision-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionDialogComponent {
  protected readonly data = inject<DecisionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<DecisionDialogComponent, DecisionDialogResult>,
  );

  protected readonly maxLength = this.data.maxLength ?? 500;
  protected approvalNote = '';
  protected rejectionReason = '';
  protected rejectionTouched = false;

  protected updateApprovalNote(value: string): void {
    this.approvalNote = value;
  }

  protected updateRejectionReason(value: string): void {
    this.rejectionReason = value;
    this.rejectionTouched = false;
  }

  protected approve(): void {
    this.dialogRef.close({
      action: 'approve',
      note: this.approvalNote.trim(),
    });
  }

  protected reject(): void {
    const reason = this.rejectionReason.trim();

    if (!reason) {
      this.rejectionTouched = true;
      return;
    }

    this.dialogRef.close({
      action: 'reject',
      reason,
    });
  }
}
