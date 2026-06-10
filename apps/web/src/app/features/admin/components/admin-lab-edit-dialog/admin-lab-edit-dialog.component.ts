import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AbstractControl,
  ReactiveFormsModule,
  UntypedFormControl,
  UntypedFormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';

import { AppInfoCalloutComponent } from '../../../../shared/components';
import { WeeklySchedule } from '../../../../shared/models';
import {
  AdminCreateLabInput,
  AdminLabView,
  AdminUpdateLabInput,
} from '../../services/admin-labs.service';
import { AdminUserView } from '../../services/admin-users.service';

const INSTITUTIONAL_DOMAIN = '@tecplayacar.edu.mx';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type DialogMode = 'create' | 'edit';

interface WeekdayOption {
  key: keyof WeeklySchedule;
  label: string;
}

export interface AdminLabEditDialogData {
  mode: DialogMode;
  lab?: AdminLabView;
  responsibleCandidates: AdminUserView[];
}

export type AdminLabEditDialogResult =
  | AdminCreateLabInput
  | AdminUpdateLabInput;

@Component({
  selector: 'app-admin-lab-edit-dialog',
  imports: [
    AppInfoCalloutComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    ReactiveFormsModule,
  ],
  template: `
    <section class="admin-lab-dialog grid max-h-[calc(100vh-2rem)] gap-5 overflow-y-auto overflow-x-hidden p-5 sm:p-6">
      <header class="flex items-start gap-3">
        <span class="admin-lab-dialog__icon grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-700">
          <mat-icon>{{ data.mode === 'create' ? 'add_business' : 'edit' }}</mat-icon>
        </span>
        <div class="min-w-0">
          <h2 class="m-0 text-xl font-extrabold text-slate-950">
            {{ data.mode === 'create' ? 'Nuevo laboratorio' : 'Editar laboratorio' }}
          </h2>
          <p class="m-0 mt-1 text-sm leading-6 text-slate-600">
            Configura datos visibles, responsables, horario base y calendario.
          </p>
        </div>
      </header>

      <form class="grid gap-5" [formGroup]="form">
        <mat-tab-group animationDuration="150ms">
          <mat-tab label="Datos generales">
            <div class="grid gap-4 pt-5">
              <div class="grid min-w-0 gap-4 md:grid-cols-2">
                <mat-form-field appearance="outline">
                  <mat-label>Nombre</mat-label>
                  <input matInput formControlName="name" />
                  @if (form.get('name')?.hasError('required')) {
                    <mat-error>El nombre es obligatorio.</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Slug</mat-label>
                  <input matInput formControlName="slug" />
                  <mat-hint>Ejemplo: laboratorio-de-alimentos</mat-hint>
                  @if (form.get('slug')?.hasError('required')) {
                    <mat-error>El slug es obligatorio.</mat-error>
                  }
                  @if (form.get('slug')?.hasError('pattern')) {
                    <mat-error>Use minusculas, numeros y guiones.</mat-error>
                  }
                </mat-form-field>
              </div>

              @if (data.mode === 'edit') {
                <app-info-callout
                  variant="warning"
                  icon="qr_code"
                  message="Cambiar el slug modifica la ruta QR /reservar/:labSlug. Actualice los QR impresos si aplica."
                />
              }

              <mat-form-field appearance="outline">
                <mat-label>Descripcion</mat-label>
                <textarea matInput formControlName="description" rows="3"></textarea>
                @if (form.get('description')?.hasError('required')) {
                  <mat-error>La descripcion es obligatoria.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Descripcion breve</mat-label>
                <textarea matInput formControlName="shortDescription" rows="2"></textarea>
              </mat-form-field>

              <div class="grid min-w-0 gap-4 md:grid-cols-2">
                <mat-form-field appearance="outline">
                  <mat-label>Ubicacion</mat-label>
                  <input matInput formControlName="location" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>URL de imagen</mat-label>
                  <input matInput formControlName="imageUrl" />
                  <mat-hint>No sube imagenes a Storage en esta fase.</mat-hint>
                </mat-form-field>
              </div>

              <div class="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                <mat-checkbox formControlName="active">
                  Laboratorio activo
                </mat-checkbox>
                <mat-checkbox formControlName="visibleInCatalog">
                  Visible en catalogo
                </mat-checkbox>
                <mat-checkbox formControlName="requiresApprovalWhenRisky">
                  Validacion si hay riesgo
                </mat-checkbox>
                <mat-checkbox formControlName="requiresProtocolWhenRisky">
                  Protocolo si hay riesgo
                </mat-checkbox>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Anticipacion minima en horas</mat-label>
                <input
                  matInput
                  type="number"
                  min="0"
                  formControlName="minNoticeHours"
                />
                @if (form.get('minNoticeHours')?.hasError('min')) {
                  <mat-error>Debe ser mayor o igual a cero.</mat-error>
                }
              </mat-form-field>
            </div>
          </mat-tab>

          <mat-tab label="Disponibilidad">
            <div class="grid gap-4 pt-5" formGroupName="weeklySchedule">
              <app-info-callout
                variant="info"
                icon="schedule"
                message="El horario base se valida nuevamente en backend. Las reglas especiales quedan fuera de esta fase."
              />

              @for (day of weekdays; track day.key) {
                <div
                  class="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_150px_150px]"
                  [formGroupName]="day.key"
                >
                  <mat-checkbox formControlName="enabled">
                    {{ day.label }}
                  </mat-checkbox>

                  <mat-form-field appearance="outline">
                    <mat-label>Inicio</mat-label>
                    <input matInput type="time" formControlName="start" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Fin</mat-label>
                    <input matInput type="time" formControlName="end" />
                    @if (dayGroup(day.key).hasError('timeRange')) {
                      <mat-error>Fin debe ser mayor que inicio.</mat-error>
                    }
                  </mat-form-field>
                </div>
              }
            </div>
          </mat-tab>

          <mat-tab label="Responsables">
            <div class="grid gap-4 pt-5">
              <app-info-callout
                variant="warning"
                icon="info"
                message="Asignar responsibleUids al laboratorio no modifica users.labsAssigned. Para que el responsable vea solicitudes, gestionelo tambien desde Usuarios."
              />

              <mat-form-field appearance="outline">
                <mat-label>Responsables por UID</mat-label>
                <mat-select formControlName="responsibleUids" multiple>
                  @for (user of data.responsibleCandidates; track user.uid) {
                    <mat-option [value]="user.uid">
                      {{ user.displayName || user.email }} - {{ user.email }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Correos responsables</mat-label>
                <textarea
                  matInput
                  formControlName="responsibleEmailsText"
                  rows="3"
                  placeholder="responsable@tecplayacar.edu.mx"
                ></textarea>
                <mat-hint>Separe varios correos con coma o salto de linea.</mat-hint>
                @if (form.get('responsibleEmailsText')?.hasError('emailList')) {
                  <mat-error>Solo correos @tecplayacar.edu.mx.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Correos de notificacion</mat-label>
                <textarea
                  matInput
                  formControlName="defaultNotifyEmailsText"
                  rows="3"
                  placeholder="avisos@tecplayacar.edu.mx"
                ></textarea>
                <mat-hint>Separe varios correos con coma o salto de linea.</mat-hint>
                @if (form.get('defaultNotifyEmailsText')?.hasError('emailList')) {
                  <mat-error>Solo correos @tecplayacar.edu.mx.</mat-error>
                }
              </mat-form-field>
            </div>
          </mat-tab>

          <mat-tab label="Calendario">
            <div class="grid gap-4 pt-5">
              <app-info-callout
                variant="info"
                icon="event"
                message="calendarId es dato operativo solo para Admin/Sistemas. No se muestra al docente."
              />

              <mat-form-field appearance="outline">
                <mat-label>calendarId</mat-label>
                <input matInput formControlName="calendarId" />
                @if (form.get('calendarId')?.hasError('required')) {
                  <mat-error>El calendarId es obligatorio.</mat-error>
                }
              </mat-form-field>
            </div>
          </mat-tab>
        </mat-tab-group>
      </form>

      <footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button mat-button type="button" (click)="close()">Cancelar</button>
        <button mat-flat-button color="primary" type="button" (click)="save()">
          <mat-icon>save</mat-icon>
          Guardar laboratorio
        </button>
      </footer>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }

    .admin-lab-dialog {
      width: 100%;
      min-width: 0;
    }

    .admin-lab-dialog__icon mat-icon {
      display: inline-flex;
      width: 24px;
      height: 24px;
      align-items: center;
      justify-content: center;
      overflow: visible;
      font-size: 24px;
      line-height: 24px;
    }

    mat-tab-group,
    mat-form-field {
      min-width: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLabEditDialogComponent {
  protected readonly data = inject<AdminLabEditDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<AdminLabEditDialogComponent, AdminLabEditDialogResult>,
  );

  protected readonly weekdays: WeekdayOption[] = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miercoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sabado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  protected readonly form = new UntypedFormGroup({
    name: new UntypedFormControl(this.data.lab?.name ?? '', [
      Validators.required,
    ]),
    slug: new UntypedFormControl(this.data.lab?.slug ?? '', [
      Validators.required,
      Validators.pattern(SLUG_PATTERN),
    ]),
    description: new UntypedFormControl(this.data.lab?.description ?? '', [
      Validators.required,
    ]),
    shortDescription: new UntypedFormControl(
      this.data.lab?.shortDescription ?? '',
    ),
    imageUrl: new UntypedFormControl(this.data.lab?.imageUrl ?? ''),
    location: new UntypedFormControl(this.data.lab?.location ?? ''),
    calendarId: new UntypedFormControl(this.data.lab?.calendarId ?? '', [
      Validators.required,
    ]),
    active: new UntypedFormControl(this.data.lab?.active ?? true),
    visibleInCatalog: new UntypedFormControl(
      this.data.lab?.visibleInCatalog ?? true,
    ),
    minNoticeHours: new UntypedFormControl(
      this.data.lab?.minNoticeHours ?? 0,
      [Validators.min(0)],
    ),
    requiresApprovalWhenRisky: new UntypedFormControl(
      this.data.lab?.requiresApprovalWhenRisky ?? true,
    ),
    requiresProtocolWhenRisky: new UntypedFormControl(
      this.data.lab?.requiresProtocolWhenRisky ?? true,
    ),
    responsibleUids: new UntypedFormControl(
      this.data.lab?.responsibleUids ?? [],
    ),
    responsibleEmailsText: new UntypedFormControl(
      (this.data.lab?.responsibleEmails ?? []).join(', '),
      [institutionalEmailListValidator],
    ),
    defaultNotifyEmailsText: new UntypedFormControl(
      (this.data.lab?.defaultNotifyEmails ?? []).join(', '),
      [institutionalEmailListValidator],
    ),
    weeklySchedule: this.buildScheduleGroup(this.data.lab?.weeklySchedule),
  });

  constructor() {
    if (this.data.mode === 'create') {
      this.form.get('name')?.valueChanges.subscribe((name) => {
        if (!this.form.get('slug')?.dirty) {
          this.form.get('slug')?.setValue(generateSlug(name ?? ''));
        }
      });
    }
  }

  protected dayGroup(day: keyof WeeklySchedule): UntypedFormGroup {
    return this.form.get('weeklySchedule')?.get(day) as UntypedFormGroup;
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
    const payload = {
      name: value.name.trim(),
      slug: value.slug.trim().toLowerCase(),
      description: value.description.trim(),
      shortDescription: value.shortDescription.trim() || undefined,
      imageUrl: value.imageUrl.trim() || undefined,
      calendarId: value.calendarId.trim(),
      location: value.location.trim() || undefined,
      responsibleUids: value.responsibleUids ?? [],
      responsibleEmails: parseEmailText(value.responsibleEmailsText),
      defaultNotifyEmails: parseEmailText(value.defaultNotifyEmailsText),
      active: Boolean(value.active),
      visibleInCatalog: Boolean(value.visibleInCatalog),
      minNoticeHours: Number(value.minNoticeHours ?? 0),
      requiresApprovalWhenRisky: Boolean(value.requiresApprovalWhenRisky),
      requiresProtocolWhenRisky: Boolean(value.requiresProtocolWhenRisky),
      weeklySchedule: value.weeklySchedule as WeeklySchedule,
    };

    this.dialogRef.close(
      this.data.mode === 'create'
        ? payload
        : { ...payload, labId: this.data.lab?.id ?? '' },
    );
  }

  private buildScheduleGroup(schedule?: WeeklySchedule): UntypedFormGroup {
    const group = new UntypedFormGroup({});
    for (const day of this.weekdays) {
      const value = schedule?.[day.key];
      group.addControl(
        day.key,
        new UntypedFormGroup(
          {
            enabled: new UntypedFormControl(value?.enabled ?? false),
            start: new UntypedFormControl(value?.start || '08:00'),
            end: new UntypedFormControl(value?.end || '20:00'),
          },
          [dayScheduleValidator],
        ),
      );
    }
    return group;
  }
}

function dayScheduleValidator(control: AbstractControl): ValidationErrors | null {
  const enabled = control.get('enabled')?.value;
  const start = control.get('start')?.value;
  const end = control.get('end')?.value;

  if (!enabled) {
    return null;
  }

  if (!start || !end || end <= start) {
    return { timeRange: true };
  }

  return null;
}

function institutionalEmailListValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const emails = parseEmailText(control.value ?? '');
  return emails.every((email) => email.endsWith(INSTITUTIONAL_DOMAIN))
    ? null
    : { emailList: true };
}

function parseEmailText(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,;]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function generateSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
