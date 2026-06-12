import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';

import {
  AppIconBoxComponent,
  AppInfoCalloutComponent,
  AppSectionCardComponent,
} from '../../../../shared/components';
import { CreateReservationOutput } from '../../services/reservation.service';

export type ReservationStepperOrientation = 'horizontal' | 'vertical';

type ReservationStepGroup = 'schedule' | 'academic' | 'practice' | 'risk';

@Component({
  selector: 'app-reservation-stepper-form',
  imports: [
    AppIconBoxComponent,
    AppInfoCalloutComponent,
    AppSectionCardComponent,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reservation-stepper-form.component.html',
  styleUrl: './reservation-stepper-form.component.scss',
})
export class ReservationStepperFormComponent {
  readonly form = input.required<FormGroup>();
  readonly stepperOrientation = input<ReservationStepperOrientation>('vertical');
  readonly selectedLabName = input('');
  readonly selectedLabSlug = input('');
  readonly minDate = input<Date | null>(null);
  readonly maxDate = input<Date | null>(null);
  readonly availableStartTimes = input<string[]>([]);
  readonly availableEndTimes = input<string[]>([]);
  readonly practiceTypes = input<string[]>([]);
  readonly riskOptions = input<Array<{ label: string; value: boolean }>>([
    { label: 'No', value: false },
    { label: 'Si', value: true },
  ]);
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly submitting = input(false);
  readonly uploadingProtocol = input(false);
  readonly protocolFileName = input<string | null>(null);
  readonly protocolFileSummary = input('Sin archivo seleccionado');
  readonly protocolRequired = input(false);
  readonly dateInPastError = input(false);
  readonly minNoticeWarning = input(false);
  readonly minNoticeHours = input(0);
  readonly protocolWarning = input(false);
  readonly result = input<CreateReservationOutput | null>(null);
  readonly submitLabel = input('Crear reserva');
  readonly cancelLabel = input('Cancelar');

  readonly currentStepIndexChange = output<number>();
  readonly protocolSelected = output<File | null>();
  readonly protocolRemoved = output<void>();
  readonly cancel = output<void>();
  readonly submitReservation = output<void>();

  protected group(name: ReservationStepGroup): FormGroup {
    return this.form().get(name) as FormGroup;
  }

  protected controlValue(groupName: ReservationStepGroup, controlName: string): unknown {
    return this.group(groupName).get(controlName)?.value;
  }

  protected hasRequiredError(
    groupName: ReservationStepGroup,
    controlName: string,
  ): boolean {
    const control = this.group(groupName).get(controlName);
    return !!control?.hasError('required');
  }

  protected hasTimeRangeError(): boolean {
    return this.group('schedule').hasError('timeRange');
  }

  protected isRisky(): boolean {
    return this.controlValue('risk', 'risky') === true;
  }

  protected hasExternalParticipants(): boolean {
    return this.controlValue('risk', 'externalParticipants') === true;
  }

  protected isPracticeTypeOther(): boolean {
    return this.controlValue('practice', 'practiceType') === 'Otro';
  }

  protected protocolIsRequired(): boolean {
    return this.isRisky() || this.hasExternalParticipants();
  }

  protected hasPracticeTypeOtherError(): boolean {
    const control = this.group('practice').get('practiceTypeOther');
    return (
      this.group('practice').hasError('practiceTypeOtherRequired') &&
      !!control?.touched
    );
  }

  protected openDatepicker(picker: MatDatepicker<Date>): void {
    if (!this.disabled()) {
      picker.open();
    }
  }

  protected formatDate(value: unknown): string {
    if (!(value instanceof Date)) {
      return 'Pendiente';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(value);
  }

  protected yesNo(value: unknown): string {
    return value ? 'Si' : 'No';
  }

  protected displayValue(
    groupName: ReservationStepGroup,
    controlName: string,
    fallback = 'Pendiente',
  ): string {
    const value = this.controlValue(groupName, controlName);

    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    return String(value);
  }

  protected onProtocolInputChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.item(0) ?? null;
    this.protocolSelected.emit(file);
    inputElement.value = '';
  }
}
