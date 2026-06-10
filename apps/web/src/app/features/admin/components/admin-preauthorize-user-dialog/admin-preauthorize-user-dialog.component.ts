import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AppInfoCalloutComponent } from '../../../../shared/components';
import { AdminLabView } from '../../services/admin-labs.service';
import { PreauthorizedRole } from '../../services/admin-preauthorized-users.service';

const INSTITUTIONAL_DOMAIN = '@tecplayacar.edu.mx';
const DOCENTE_EMAIL_PATTERN = /^tup-d\d+@tecplayacar\.edu\.mx$/i;

export interface AdminPreauthorizeUserDialogData {
  labs: AdminLabView[];
}

export interface AdminPreauthorizeUserDialogResult {
  email: string;
  displayName?: string;
  role: PreauthorizedRole;
  active: boolean;
  labsAssigned: string[];
}

@Component({
  selector: 'app-admin-preauthorize-user-dialog',
  imports: [
    AppInfoCalloutComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <section class="grid gap-5 p-5 sm:p-6">
      <header class="flex items-start gap-3">
        <span class="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-700">
          <mat-icon>person_add</mat-icon>
        </span>
        <div>
          <h2 class="m-0 text-xl font-extrabold text-slate-950">
            Agregar responsable/coordinador
          </h2>
          <p class="m-0 mt-1 text-sm text-slate-600">
            Preautoriza una cuenta institucional. No se crean contraseñas.
          </p>
        </div>
      </header>

      <app-info-callout
        variant="info"
        icon="info"
        message="Los docentes con correo tup-dNUMEROS@tecplayacar.edu.mx entran automáticamente al iniciar sesión."
      />

      @if (looksLikeDocenteEmail()) {
        <app-info-callout
          variant="warning"
          icon="warning"
          message="Este correo parece de docente. Los docentes se registran automáticamente al iniciar sesión. Usa esta acción solo si será responsable/coordinador."
        />
      }

      <form class="grid gap-4" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre opcional</mat-label>
          <input
            matInput
            formControlName="displayName"
            placeholder="Nombre de la persona"
          />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Correo institucional</mat-label>
          <input
            matInput
            formControlName="email"
            autocomplete="email"
            placeholder="usuario@tecplayacar.edu.mx"
          />
          <mat-icon matSuffix>mail</mat-icon>
          @if (form.controls.email.hasError('required')) {
            <mat-error>El correo es obligatorio.</mat-error>
          }
          @if (form.controls.email.hasError('institutionalEmail')) {
            <mat-error>Use un correo @tecplayacar.edu.mx.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Rol</mat-label>
          <mat-select formControlName="role">
            <mat-option value="responsable_laboratorio">
              Responsable de laboratorio
            </mat-option>
            <mat-option value="admin_sistemas">Admin/Sistemas</mat-option>
          </mat-select>
        </mat-form-field>

        <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <mat-checkbox formControlName="active">Prealta activa</mat-checkbox>
        </label>

        @if (form.controls.role.value === 'responsable_laboratorio') {
          <mat-form-field appearance="outline">
            <mat-label>Laboratorios asignados</mat-label>
            <mat-select formControlName="labsAssigned" multiple>
              @for (lab of data.labs; track lab.id) {
                <mat-option [value]="lab.id">{{ lab.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else {
          <app-info-callout
            variant="info"
            icon="admin_panel_settings"
            message="Las prealtas Admin/Sistemas no guardan laboratorios asignados."
          />
        }
      </form>

      <footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button mat-button type="button" (click)="close()">Cancelar</button>
        <button mat-flat-button color="primary" type="button" (click)="save()">
          Guardar prealta
        </button>
      </footer>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPreauthorizeUserDialogComponent {
  protected readonly data = inject<AdminPreauthorizeUserDialogData>(
    MAT_DIALOG_DATA,
  );
  private readonly dialogRef = inject(
    MatDialogRef<
      AdminPreauthorizeUserDialogComponent,
      AdminPreauthorizeUserDialogResult
    >,
  );

  protected readonly form = new FormGroup({
    displayName: new FormControl<string>('', { nonNullable: true }),
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, institutionalEmailValidator],
    }),
    role: new FormControl<PreauthorizedRole>('responsable_laboratorio', {
      nonNullable: true,
    }),
    active: new FormControl<boolean>(true, { nonNullable: true }),
    labsAssigned: new FormControl<string[]>([], { nonNullable: true }),
  });

  constructor() {
    this.form.controls.role.valueChanges.subscribe((role) => {
      if (role === 'admin_sistemas') {
        this.form.controls.labsAssigned.setValue([]);
      }
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({
      email: value.email.trim().toLowerCase(),
      displayName: value.displayName.trim() || undefined,
      role: value.role,
      active: value.active,
      labsAssigned:
        value.role === 'responsable_laboratorio' ? value.labsAssigned : [],
    });
  }

  protected looksLikeDocenteEmail(): boolean {
    return DOCENTE_EMAIL_PATTERN.test(
      this.form.controls.email.value.trim().toLowerCase(),
    );
  }
}

function institutionalEmailValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  return control.value.trim().toLowerCase().endsWith(INSTITUTIONAL_DOMAIN)
    ? null
    : { institutionalEmail: true };
}
