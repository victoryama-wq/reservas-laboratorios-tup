import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import {
  AppInfoCalloutComponent,
  AppStatusChipComponent,
} from '../../../../shared/components';
import { UserRole } from '../../../../shared/models';
import { AdminLabView } from '../../services/admin-labs.service';
import { AdminUserView } from '../../services/admin-users.service';

export interface AdminUserEditDialogData {
  user: AdminUserView;
  labs: AdminLabView[];
  currentUid: string | null;
}

export interface AdminUserEditResult {
  role: UserRole;
  active: boolean;
  labsAssigned: string[];
}

@Component({
  selector: 'app-admin-user-edit-dialog',
  imports: [
    AppInfoCalloutComponent,
    AppStatusChipComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <section class="grid gap-5 p-5 sm:p-6">
      <header class="grid gap-2">
        <div class="flex items-start gap-3">
          <span class="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-700">
            <mat-icon>manage_accounts</mat-icon>
          </span>
          <div class="min-w-0">
            <h2 class="m-0 text-xl font-extrabold text-slate-950">
              Editar usuario
            </h2>
            <p class="m-0 mt-1 break-words text-sm text-slate-600">
              {{ data.user.displayName || data.user.email }}
            </p>
          </div>
        </div>

        @if (isSelfEdit()) {
          <app-info-callout
            variant="warning"
            icon="warning"
            message="Por seguridad no puedes desactivar tu propia cuenta ni quitarte el rol Admin/Sistemas."
          />
        }
      </header>

      <form class="grid gap-4" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Rol oficial</mat-label>
          <mat-select formControlName="role">
            @for (role of roles; track role) {
              <mat-option [value]="role">{{ roleLabel(role) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <mat-checkbox formControlName="active">Perfil activo</mat-checkbox>
          <app-status-chip
            [variant]="form.controls.active.value ? 'success' : 'neutral'"
            [icon]="form.controls.active.value ? 'check_circle' : 'pause_circle'"
            [label]="form.controls.active.value ? 'Activo' : 'Inactivo'"
          />
        </label>

        @if (form.controls.role.value === 'responsable_laboratorio') {
          <mat-form-field appearance="outline">
            <mat-label>Laboratorios asignados</mat-label>
            <mat-select formControlName="labsAssigned" multiple>
              @for (lab of data.labs; track lab.id) {
                <mat-option [value]="lab.id">{{ lab.name }}</mat-option>
              }
            </mat-select>
            <mat-hint>
              Solo aplica para responsables de laboratorio.
            </mat-hint>
          </mat-form-field>
        } @else {
          <app-info-callout
            variant="info"
            icon="info"
            message="Los laboratorios asignados se guardarán vacíos para roles distintos a responsable_laboratorio."
          />
        }
      </form>

      <footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button mat-button type="button" (click)="close()">
          Cancelar
        </button>
        <button mat-flat-button color="primary" type="button" (click)="save()">
          Guardar cambios
        </button>
      </footer>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserEditDialogComponent {
  protected readonly data = inject<AdminUserEditDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<AdminUserEditDialogComponent, AdminUserEditResult>,
  );

  protected readonly roles: UserRole[] = [
    'docente',
    'responsable_laboratorio',
    'admin_sistemas',
  ];
  protected readonly form = new FormGroup({
    role: new FormControl<UserRole>(this.data.user.role, { nonNullable: true }),
    active: new FormControl<boolean>(this.data.user.active, {
      nonNullable: true,
    }),
    labsAssigned: new FormControl<string[]>(this.data.user.labsAssigned ?? [], {
      nonNullable: true,
    }),
  });

  constructor() {
    if (this.isSelfEdit()) {
      this.form.controls.role.disable();
      this.form.controls.active.disable();
    }
  }

  protected isSelfEdit(): boolean {
    return this.data.currentUid === this.data.user.uid;
  }

  protected roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      docente: 'Docente',
      responsable_laboratorio: 'Responsable de laboratorio',
      admin_sistemas: 'Admin/Sistemas',
    };

    return labels[role];
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    const value = this.form.getRawValue();
    this.dialogRef.close({
      role: value.role,
      active: value.active,
      labsAssigned:
        value.role === 'responsable_laboratorio' ? value.labsAssigned : [],
    });
  }
}
