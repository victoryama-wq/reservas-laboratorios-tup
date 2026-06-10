import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { AppSectionCardComponent } from '../../../../shared/components';

@Component({
  selector: 'app-decision-panel',
  imports: [
    AppSectionCardComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './decision-panel.component.html',
  styleUrl: './decision-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionPanelComponent {
  readonly approvalNote = input('');
  readonly rejectionReason = input('');
  readonly approveLabel = input('Aprobar reserva');
  readonly rejectLabel = input('Rechazar');
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly maxLength = input(500);

  readonly approvalNoteChange = output<string>();
  readonly rejectionReasonChange = output<string>();
  readonly approve = output<void>();
  readonly reject = output<void>();

  protected updateApprovalNote(value: string): void {
    this.approvalNoteChange.emit(value);
  }

  protected updateRejectionReason(value: string): void {
    this.rejectionReasonChange.emit(value);
  }

  protected emitApprove(): void {
    this.approve.emit();
  }

  protected emitReject(): void {
    this.reject.emit();
  }
}
