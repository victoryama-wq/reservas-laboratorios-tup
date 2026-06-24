import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { AppInfoCalloutComponent } from '../../../../shared/components';
import { PreauthorizedUserView } from '../../services/admin-preauthorized-users.service';

export interface AdminRevokePreauthorizationDialogData {
  preauthorization: PreauthorizedUserView;
  labsLabel: string;
  roleLabel: string;
}

export interface AdminRevokePreauthorizationDialogResult {
  reason?: string;
}

@Component({
  selector: 'app-admin-revoke-preauthorization-dialog',
  imports: [
    AppInfoCalloutComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <section class="grid gap-5 p-5 sm:p-6">
      <header class="flex items-start gap-3">
        <span class="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-700">
          <mat-icon>person_off</mat-icon>
        </span>
        <div class="min-w-0">
          <h2 class="m-0 text-xl font-extrabold text-slate-950">
            Revocar prealta
          </h2>
          <p class="m-0 mt-1 break-words text-sm text-slate-600">
            {{ data.preauthorization.email }}
          </p>
        </div>
      </header>

      <app-info-callout
        variant="warning"
        icon="warning"
        message="La persona ya no podra reclamar esta prealta al iniciar sesion. Si despues se requiere acceso, debera crear una nueva prealta."
      />

      <div class="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div>
          <span class="font-bold text-violet-700">Rol preautorizado</span>
          <p class="m-0 mt-1">{{ data.roleLabel }}</p>
        </div>
        <div>
          <span class="font-bold text-violet-700">
            Laboratorios asignados
          </span>
          <p class="m-0 mt-1">{{ data.labsLabel }}</p>
        </div>
      </div>

      <mat-form-field appearance="outline">
        <mat-label>Motivo opcional</mat-label>
        <textarea
          matInput
          rows="4"
          maxlength="280"
          [formControl]="reasonControl"
          placeholder="Ejemplo: prealta creada por error"
        ></textarea>
        <mat-hint align="end">
          {{ reasonControl.value.length }}/280
        </mat-hint>
      </mat-form-field>

      <footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button mat-button type="button" (click)="close()">
          Cancelar
        </button>
        <button
          mat-flat-button
          color="warn"
          type="button"
          (click)="confirm()"
        >
          <mat-icon>person_off</mat-icon>
          Revocar prealta
        </button>
      </footer>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRevokePreauthorizationDialogComponent {
  protected readonly data = inject<AdminRevokePreauthorizationDialogData>(
    MAT_DIALOG_DATA,
  );
  private readonly dialogRef = inject(
    MatDialogRef<
      AdminRevokePreauthorizationDialogComponent,
      AdminRevokePreauthorizationDialogResult
    >,
  );

  protected readonly reasonControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.maxLength(280)],
  });

  protected close(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    if (this.reasonControl.invalid) {
      this.reasonControl.markAsTouched();
      return;
    }

    const reason = this.reasonControl.value.trim();
    this.dialogRef.close({
      reason: reason || undefined,
    });
  }
}
