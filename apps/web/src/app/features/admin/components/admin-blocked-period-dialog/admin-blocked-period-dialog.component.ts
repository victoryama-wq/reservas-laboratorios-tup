import { institutionalDateKey, institutionalDateTime, institutionalTime, shiftDateKey } from '../../../../shared/utils/institutional-time.utils';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { BlockedPeriodScope } from '../../../../shared/models';
import { AdminLabView } from '../../services/admin-labs.service';
import {
  AdminBlockedPeriodView,
  AdminCreateBlockedPeriodInput,
  AdminUpdateBlockedPeriodInput,
} from '../../services/admin-rules.service';

type DialogMode = 'create' | 'edit';

export interface AdminBlockedPeriodDialogData {
  mode: DialogMode;
  save: (input: AdminBlockedPeriodDialogResult) => Promise<string>;
  labs: AdminLabView[];
  period?: AdminBlockedPeriodView;
}

export type AdminBlockedPeriodDialogResult =
  | AdminCreateBlockedPeriodInput
  | AdminUpdateBlockedPeriodInput;

@Component({
  selector: 'app-admin-blocked-period-dialog',
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
          <mat-icon>{{ data.mode === 'create' ? 'event_busy' : 'edit_calendar' }}</mat-icon>
        </span>
        <div class="min-w-0">
          <h2 class="m-0 text-xl font-extrabold text-slate-950">
            {{ data.mode === 'create' ? 'Nuevo bloqueo extraordinario' : 'Editar bloqueo extraordinario' }}
          </h2>
          <p class="m-0 mt-1 text-sm leading-6 text-slate-600">
            Bloquea periodos globales o por laboratorio sin escribir reservas.
          </p>
        </div>
      </header>

      <app-info-callout
        variant="warning"
        icon="warning"
        message="Zona horaria: Cancún. Los bloqueos activos impiden crear o aprobar reservas que se traslapen con el periodo configurado."
      />

      <form class="grid gap-4" [formGroup]="form">
        <div class="grid gap-4 md:grid-cols-2">
          <mat-form-field appearance="outline">
            <mat-label>Nombre del bloqueo</mat-label>
            <input matInput formControlName="name" />
            @if (form.get('name')?.hasError('required')) {
              <mat-error>El nombre es obligatorio.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Alcance</mat-label>
            <mat-select formControlName="scope">
              <mat-option value="global">Global</mat-option>
              <mat-option value="lab">Por laboratorio</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        @if (form.get('scope')?.value === 'lab') {
          <mat-form-field appearance="outline">
            <mat-label>Laboratorios afectados</mat-label>
            <mat-select formControlName="labIds" multiple>
              @for (lab of data.labs; track lab.id) {
                <mat-option [value]="lab.id">{{ lab.name }}</mat-option>
              }
            </mat-select>
            @if (form.hasError('labRequired')) {
              <mat-error>Seleccione al menos un laboratorio.</mat-error>
            }
          </mat-form-field>
        }

        <div class="grid gap-4 md:grid-cols-2">
          <mat-form-field appearance="outline">
            <mat-label>Inicio</mat-label>
            <input matInput [type]="form.get('fullDay')?.value ? 'date' : 'datetime-local'" formControlName="startAt" />
            @if (form.get('startAt')?.hasError('required')) {
              <mat-error>La fecha inicial es obligatoria.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ form.get('fullDay')?.value ? 'Último día incluido' : 'Fin' }}</mat-label>
            <input matInput type="datetime-local" formControlName="endAt" />
            @if (form.get('endAt')?.hasError('required')) {
              <mat-error>La fecha final es obligatoria.</mat-error>
            }
            @if (form.hasError('dateTimeRange')) {
              <mat-error>El fin debe ser posterior al inicio.</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Motivo operativo</mat-label>
          <textarea matInput formControlName="reason" rows="3"></textarea>
          @if (form.get('reason')?.hasError('required')) {
            <mat-error>El motivo es obligatorio.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Descripción opcional</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
        </mat-form-field>

        <div class="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
          <mat-checkbox formControlName="fullDay" (change)="changeFullDay($event.checked)">Bloqueo de día completo</mat-checkbox>
          <mat-checkbox formControlName="active">Bloqueo activo</mat-checkbox>
        </div>
      </form>

      @if (saveError()) {
        <app-info-callout variant="danger" icon="error" [message]="saveError()" />
      }
      @if (form.invalid && form.touched) {
        <app-info-callout variant="warning" icon="warning"
          message="Revise los campos: nombre y motivo obligatorios, fechas ordenadas y hora final mayor que la inicial. Seleccione los laboratorios si el alcance es por laboratorio." />
      }
      <footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button mat-button type="button" [disabled]="saving()" (click)="close()">Cancelar</button>
        <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()">
          <mat-icon>save</mat-icon>
          {{ saving() ? 'Guardando...' : 'Guardar bloqueo' }}
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
export class AdminBlockedPeriodDialogComponent {
  protected readonly data = inject<AdminBlockedPeriodDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<AdminBlockedPeriodDialogComponent, AdminBlockedPeriodDialogResult>,
  );

  protected readonly form = new UntypedFormGroup(
    {
      name: new UntypedFormControl(this.data.period?.name ?? '', [
        Validators.required,
      ]),
      description: new UntypedFormControl(this.data.period?.description ?? ''),
      reason: new UntypedFormControl(this.data.period?.reason ?? '', [
        Validators.required,
      ]),
      scope: new UntypedFormControl(this.data.period?.scope ?? 'global', [
        Validators.required,
      ]),
      labIds: new UntypedFormControl(this.data.period?.labIds ?? []),
      startAt: new UntypedFormControl(
        toDatetimeLocal(this.data.period?.startDate, this.data.period?.fullDay),
        [Validators.required],
      ),
      endAt: new UntypedFormControl(toDatetimeLocal(this.data.period?.fullDay && this.data.period.endDate ? new Date(this.data.period.endDate.getTime() - 1) : this.data.period?.endDate, this.data.period?.fullDay), [
        Validators.required,
      ]),
      fullDay: new UntypedFormControl(this.data.period?.fullDay ?? false),
      active: new UntypedFormControl(this.data.period?.active ?? true),
    },
    [blockedPeriodValidator],
  );

  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  protected changeFullDay(fullDay: boolean): void {
    for (const field of ['startAt', 'endAt']) {
      const control = this.form.get(field);
      if (control?.value) control.setValue(fullDay ? control.value.slice(0, 10) : control.value.slice(0, 10) + 'T00:00');
    }
  }

  protected close(): void {
    if (this.saving()) return;
    this.dialogRef.close();
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const scope = value.scope as BlockedPeriodScope;
    const payload: AdminCreateBlockedPeriodInput = {
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      reason: value.reason.trim(),
      scope,
      labIds: scope === 'lab' ? value.labIds ?? [] : [],
      startAt: parseCivilInput(value.startAt).toISOString(),
      endAt: (value.fullDay ? institutionalDateTime(shiftDateKey(value.endAt.slice(0, 10), 1)) : parseCivilInput(value.endAt)).toISOString(),
      fullDay: Boolean(value.fullDay),
      active: Boolean(value.active),
    };

    const result =
      this.data.mode === 'edit' && this.data.period
        ? { ...payload, blockedPeriodId: this.data.period.id }
        : payload;
    this.saving.set(true);
    this.saveError.set('');
    this.dialogRef.disableClose = true;
    this.form.disable();
    try {
      await this.data.save(result);
      this.dialogRef.close(result);
    } catch (error) {
      const code = (error as {code?: string})?.code;
      this.saveError.set(code === 'functions/invalid-argument' || code === 'functions/failed-precondition'
        ? (error as Error).message
        : 'No fue posible guardar. Los datos se conservaron; revise la conexión y vuelva a intentar.');
    } finally {
      this.form.enable();
      this.saving.set(false);
      this.dialogRef.disableClose = false;
    }
  }
}

function blockedPeriodValidator(control: AbstractControl): ValidationErrors | null {
  const scope = control.get('scope')?.value as BlockedPeriodScope;
  const labIds = control.get('labIds')?.value as string[];
  const startAt = control.get('startAt')?.value;
  const endAt = control.get('endAt')?.value;

  if (scope === 'lab' && (!Array.isArray(labIds) || labIds.length === 0)) {
    return { labRequired: true };
  }
  if (startAt && endAt && (control.get('fullDay')?.value ? endAt < startAt : endAt <= startAt)) {
    return { dateTimeRange: true };
  }

  return null;
}

function toDatetimeLocal(value?: Date | null, fullDay = false): string {
  if (!value) return '';
  return institutionalDateKey(value) + (fullDay ? '' : 'T' + institutionalTime(value));
}

function parseCivilInput(value: string): Date {
  const [day, time = '00:00'] = value.split('T');
  return institutionalDateTime(day, time);
}
