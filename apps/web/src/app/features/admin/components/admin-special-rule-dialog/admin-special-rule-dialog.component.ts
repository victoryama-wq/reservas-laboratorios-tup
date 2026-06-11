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

import { AppInfoCalloutComponent } from '../../../../shared/components';
import { AdminLabView } from '../../services/admin-labs.service';
import {
  AdminCreateSpecialRuleInput,
  AdminSpecialRuleView,
  AdminUpdateSpecialRuleInput,
} from '../../services/admin-rules.service';

type DialogMode = 'create' | 'edit';

interface DayOption {
  value: number;
  label: string;
}

export interface AdminSpecialRuleDialogData {
  mode: DialogMode;
  labs: AdminLabView[];
  selectedLabId?: string;
  rule?: AdminSpecialRuleView;
}

export type AdminSpecialRuleDialogResult =
  | AdminCreateSpecialRuleInput
  | AdminUpdateSpecialRuleInput;

@Component({
  selector: 'app-admin-special-rule-dialog',
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
    <section class="grid max-h-[calc(100vh-2rem)] gap-5 overflow-y-auto p-5 sm:p-6">
      <header class="flex items-start gap-3">
        <span class="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-700">
          <mat-icon>{{ data.mode === 'create' ? 'rule' : 'edit_calendar' }}</mat-icon>
        </span>
        <div class="min-w-0">
          <h2 class="m-0 text-xl font-extrabold text-slate-950">
            {{ data.mode === 'create' ? 'Nueva regla especial' : 'Editar regla especial' }}
          </h2>
          <p class="m-0 mt-1 text-sm leading-6 text-slate-600">
            Define excepciones de horario para un laboratorio especifico.
          </p>
        </div>
      </header>

      <app-info-callout
        variant="info"
        icon="info"
        message="Las reglas especiales se vuelven a validar en backend al crear o aprobar reservas."
      />

      <form class="grid gap-4" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Laboratorio</mat-label>
          <mat-select formControlName="labId">
            @for (lab of data.labs; track lab.id) {
              <mat-option [value]="lab.id">{{ lab.name }}</mat-option>
            }
          </mat-select>
          @if (form.get('labId')?.hasError('required')) {
            <mat-error>Seleccione un laboratorio.</mat-error>
          }
        </mat-form-field>

        <div class="grid gap-4 md:grid-cols-2">
          <mat-form-field appearance="outline">
            <mat-label>Nombre de la regla</mat-label>
            <input matInput formControlName="name" />
            @if (form.get('name')?.hasError('required')) {
              <mat-error>El nombre es obligatorio.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Dias aplicables</mat-label>
            <mat-select formControlName="daysOfWeek" multiple>
              @for (day of dayOptions; track day.value) {
                <mat-option [value]="day.value">{{ day.label }}</mat-option>
              }
            </mat-select>
            <mat-hint>Sin seleccion aplica a todos los dias.</mat-hint>
          </mat-form-field>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <mat-form-field appearance="outline">
            <mat-label>Fecha inicial</mat-label>
            <input matInput type="date" formControlName="termStart" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha final</mat-label>
            <input matInput type="date" formControlName="termEnd" />
            @if (form.hasError('dateRange')) {
              <mat-error>La fecha final debe ser posterior o igual.</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <mat-checkbox formControlName="fullDayBlocked">
            Bloqueo de dia completo
          </mat-checkbox>
        </div>

        @if (!form.get('fullDayBlocked')?.value) {
          <div class="grid gap-4 md:grid-cols-2">
            <mat-form-field appearance="outline">
              <mat-label>Hora inicio</mat-label>
              <input matInput type="time" formControlName="blockedStart" />
              @if (form.get('blockedStart')?.hasError('required')) {
                <mat-error>La hora inicial es obligatoria.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Hora fin</mat-label>
              <input matInput type="time" formControlName="blockedEnd" />
              @if (form.get('blockedEnd')?.hasError('required')) {
                <mat-error>La hora final es obligatoria.</mat-error>
              }
              @if (form.hasError('timeRange')) {
                <mat-error>La hora final debe ser mayor.</mat-error>
              }
            </mat-form-field>
          </div>
        }

        <mat-form-field appearance="outline">
          <mat-label>Motivo visible para administracion</mat-label>
          <textarea matInput formControlName="reason" rows="3"></textarea>
          @if (form.get('reason')?.hasError('required')) {
            <mat-error>El motivo es obligatorio.</mat-error>
          }
        </mat-form-field>

        <mat-checkbox formControlName="active">Regla activa</mat-checkbox>
      </form>

      <footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button mat-button type="button" (click)="close()">Cancelar</button>
        <button mat-flat-button color="primary" type="button" (click)="save()">
          <mat-icon>save</mat-icon>
          Guardar regla
        </button>
      </footer>
    </section>
  `,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; }
    mat-icon { overflow: visible; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSpecialRuleDialogComponent {
  protected readonly data = inject<AdminSpecialRuleDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<AdminSpecialRuleDialogComponent, AdminSpecialRuleDialogResult>,
  );

  protected readonly dayOptions: DayOption[] = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miercoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sabado' },
    { value: 0, label: 'Domingo' },
  ];

  protected readonly form = new UntypedFormGroup(
    {
      labId: new UntypedFormControl(
        this.data.rule?.labId ?? this.data.selectedLabId ?? '',
        [Validators.required],
      ),
      name: new UntypedFormControl(this.data.rule?.name ?? '', [
        Validators.required,
      ]),
      active: new UntypedFormControl(this.data.rule?.active ?? true),
      termStart: new UntypedFormControl(this.data.rule?.termStart ?? ''),
      termEnd: new UntypedFormControl(this.data.rule?.termEnd ?? ''),
      daysOfWeek: new UntypedFormControl(this.data.rule?.daysOfWeek ?? []),
      blockedStart: new UntypedFormControl(this.data.rule?.blockedStart ?? '08:00'),
      blockedEnd: new UntypedFormControl(this.data.rule?.blockedEnd ?? '20:00'),
      fullDayBlocked: new UntypedFormControl(
        this.data.rule?.fullDayBlocked ?? false,
      ),
      reason: new UntypedFormControl(this.data.rule?.reason ?? '', [
        Validators.required,
      ]),
    },
    [specialRuleValidator],
  );

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const fullDayBlocked = Boolean(value.fullDayBlocked);
    const payload: AdminCreateSpecialRuleInput = {
      labId: value.labId,
      name: value.name.trim(),
      active: Boolean(value.active),
      termStart: value.termStart || undefined,
      termEnd: value.termEnd || undefined,
      daysOfWeek: value.daysOfWeek?.length ? value.daysOfWeek : undefined,
      blockedStart: fullDayBlocked ? undefined : value.blockedStart,
      blockedEnd: fullDayBlocked ? undefined : value.blockedEnd,
      fullDayBlocked,
      reason: value.reason.trim(),
    };

    this.dialogRef.close(
      this.data.mode === 'edit' && this.data.rule
        ? { ...payload, ruleId: this.data.rule.id }
        : payload,
    );
  }
}

function specialRuleValidator(control: AbstractControl): ValidationErrors | null {
  const termStart = control.get('termStart')?.value;
  const termEnd = control.get('termEnd')?.value;
  const fullDayBlocked = Boolean(control.get('fullDayBlocked')?.value);
  const blockedStart = control.get('blockedStart')?.value;
  const blockedEnd = control.get('blockedEnd')?.value;

  if (termStart && termEnd && termEnd < termStart) {
    return { dateRange: true };
  }
  if (!fullDayBlocked && (!blockedStart || !blockedEnd)) {
    return { timeRequired: true };
  }
  if (!fullDayBlocked && blockedStart && blockedEnd && blockedEnd <= blockedStart) {
    return { timeRange: true };
  }

  return null;
}
