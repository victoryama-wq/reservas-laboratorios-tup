import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  icon?: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <section class="confirmation-dialog">
      <header class="confirmation-dialog__header">
        <span class="confirmation-dialog__icon" [class.is-danger]="data.variant === 'danger'">
          <mat-icon>{{ data.icon || defaultIcon }}</mat-icon>
        </span>
        <div>
          <h2 mat-dialog-title>{{ data.title }}</h2>
          <p mat-dialog-content>{{ data.message }}</p>
        </div>
      </header>

      <footer mat-dialog-actions align="end">
        <button mat-button type="button" (click)="close(false)">
          {{ data.cancelLabel || 'Cancelar' }}
        </button>
        <button
          mat-flat-button
          color="primary"
          type="button"
          [class.confirmation-dialog__danger-button]="data.variant === 'danger'"
          (click)="close(true)"
        >
          {{ data.confirmLabel || 'Confirmar' }}
        </button>
      </footer>
    </section>
  `,
  styles: [`
    .confirmation-dialog {
      display: grid;
      gap: 1.25rem;
      padding: 1.35rem;
    }

    .confirmation-dialog__header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }

    .confirmation-dialog__icon {
      display: grid;
      width: 3rem;
      height: 3rem;
      place-items: center;
      border-radius: 1rem;
      background: var(--info-bg);
      color: var(--info-text);
    }

    .confirmation-dialog__icon.is-danger {
      background: var(--danger-bg);
      color: var(--danger-text);
    }

    h2 {
      margin: 0;
      padding: 0;
      color: var(--text-primary);
      font-size: 1.2rem;
      font-weight: 800;
      line-height: 1.25;
    }

    p {
      margin: 0.45rem 0 0;
      padding: 0;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    footer {
      margin: 0;
      padding: 0;
      gap: 0.75rem;
    }

    .confirmation-dialog__danger-button {
      --mdc-filled-button-container-color: var(--danger-text);
    }

    @media (max-width: 520px) {
      footer {
        display: grid;
      }

      footer button {
        width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialogComponent {
  protected readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmationDialogComponent, boolean>);

  protected get defaultIcon(): string {
    return this.data.variant === 'danger' ? 'warning' : 'help';
  }

  protected close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
