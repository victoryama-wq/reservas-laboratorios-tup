import { BreakpointObserver } from '@angular/cdk/layout';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { LabDoc } from '../../../shared/models';
import { AvailabilitySlot } from '../../calendar/components';
import { ReservationStepperFormComponent } from '../components/reservation-stepper-form/reservation-stepper-form.component';
import {
  CreateReservationOutput,
  ReservationService,
} from '../services/reservation.service';
import {
  ProtocolUploadMetadata,
  ProtocolUploadService,
} from '../services/protocol-upload.service';

export interface ReservationDraftPayload {
  labId: string;
  labSlug: string;
  startAt: string;
  endAt: string;
  protocolFiles?: ProtocolUploadMetadata[];
  subject: string;
  group: string;
  practiceName: string;
  objective: string;
  materialRequired: string;
  practiceType: string;
  practiceTypeOther?: string;
  externalParticipants: boolean;
  risky: boolean;
  protocolRequired: boolean;
  source: 'web' | 'qr';
}

export interface ReservationCreatedEvent {
  result: CreateReservationOutput;
  payload: ReservationDraftPayload;
}

@Component({
  selector: 'app-reservation-form',
  imports: [
    MatSnackBarModule,
    ReservationStepperFormComponent,
  ],
  templateUrl: './reservation-form.component.html',
  styleUrl: './reservation-form.component.scss',
})
export class ReservationFormComponent {
  readonly lab = input.required<LabDoc>();
  readonly calendarSlot = input<AvailabilitySlot | null>(null);
  readonly reservationCreated = output<ReservationCreatedEvent>();
  readonly submittingChange = output<boolean>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly reservationService = inject(ReservationService);
  private readonly protocolUploadService = inject(ProtocolUploadService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly selectedProtocolFile = signal<File | null>(null);
  protected readonly isDesktop = signal(false);
  protected readonly submitting = signal(false);
  protected readonly uploadingProtocol = signal(false);
  protected readonly result = signal<CreateReservationOutput | null>(null);
  protected readonly minDate = new Date();

  protected readonly practiceTypes = [
    'Teórica',
    'Simulación',
    'Taller',
    'Evaluación práctica',
    'Investigación',
    'Otro',
  ];

  protected readonly scheduleForm = this.formBuilder.group(
    {
      date: [null as Date | null, [Validators.required]],
      startTime: ['', [Validators.required]],
      endTime: ['', [Validators.required]],
    },
    { validators: [this.timeRangeValidator.bind(this)] },
  );

  protected readonly academicForm = this.formBuilder.group({
    subject: ['', [Validators.required, Validators.maxLength(120)]],
    group: ['', [Validators.required, Validators.maxLength(60)]],
    practiceName: ['', [Validators.required, Validators.maxLength(160)]],
    objective: ['', [Validators.required, Validators.maxLength(800)]],
  });

  protected readonly practiceForm = this.formBuilder.group(
    {
      materialRequired: ['', [Validators.maxLength(800)]],
      practiceType: ['', [Validators.required]],
      practiceTypeOther: ['', [Validators.maxLength(120)]],
    },
    { validators: [this.practiceTypeOtherValidator.bind(this)] },
  );

  protected readonly riskForm = this.formBuilder.group({
    risky: [null as boolean | null, [Validators.required]],
    externalParticipants: [null as boolean | null, [Validators.required]],
  });

  protected readonly reservationForm = this.formBuilder.group({
    schedule: this.scheduleForm,
    academic: this.academicForm,
    practice: this.practiceForm,
    risk: this.riskForm,
  });

  protected readonly stepperOrientation = computed(() =>
    this.isDesktop() ? 'horizontal' : 'vertical',
  );

  constructor() {
    effect(() => {
      const slot = this.calendarSlot();

      if (slot) {
        this.applyCalendarSlot(slot);
      }
    });

    this.breakpointObserver.observe('(min-width: 900px)').subscribe((state) => {
      this.isDesktop.set(state.matches);
    });

    this.riskForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearProtocolWhenNotRequired());
  }

  protected onProtocolFileSelected(file: File | null): void {
    if (file) {
      try {
        this.protocolUploadService.validateFile(file);
      } catch (error) {
        this.selectedProtocolFile.set(null);
        this.snackBar.open(this.getReadableError(error), 'Cerrar', {
          duration: 5500,
        });
        return;
      }
    }

    this.selectedProtocolFile.set(file);
  }

  protected removeProtocolFile(): void {
    this.selectedProtocolFile.set(null);
  }

  protected hasDateInPastError(): boolean {
    const date = this.scheduleForm.controls.date.value;
    return date ? this.isDateBeforeToday(date) : false;
  }

  protected hasMinNoticeWarning(): boolean {
    const lab = this.lab();
    const startAt = this.getStartDateTime();

    if (!startAt || lab.minNoticeHours <= 0) {
      return false;
    }

    const minimumDate = new Date();
    minimumDate.setHours(minimumDate.getHours() + lab.minNoticeHours);

    return startAt < minimumDate;
  }

  protected hasProtocolWarning(): boolean {
    return (
      this.isProtocolRequiredByConditions() &&
      !this.selectedProtocolFile()
    );
  }

  protected protocolFileSummary(): string {
    const file = this.selectedProtocolFile();

    if (!file) {
      return 'Sin archivo seleccionado';
    }

    const sizeInMb = file.size / 1024 / 1024;
    return `${file.name} (${sizeInMb.toFixed(2)} MB)`;
  }

  protected buildReservationDraftPayload(
    protocolFiles: ProtocolUploadMetadata[] = [],
  ): ReservationDraftPayload {
    const schedule = this.scheduleForm.getRawValue();
    const academic = this.academicForm.getRawValue();
    const practice = this.practiceForm.getRawValue();
    const risky = this.riskForm.controls.risky.value === true;
    const externalParticipants =
      this.riskForm.controls.externalParticipants.value === true;
    const practiceTypeOther =
      practice.practiceType === 'Otro' ?
        practice.practiceTypeOther?.trim() :
        undefined;
    const startAt = this.toIsoDateTime(schedule.date, schedule.startTime);
    const endAt = this.toIsoDateTime(schedule.date, schedule.endTime);

    if (!startAt || !endAt) {
      throw new Error('Fecha u horario incompleto.');
    }

    return {
      labId: this.lab().id,
      labSlug: this.lab().slug,
      startAt,
      endAt,
      protocolFiles,
      subject: academic.subject ?? '',
      group: academic.group ?? '',
      practiceName: academic.practiceName ?? '',
      objective: academic.objective ?? '',
      materialRequired: practice.materialRequired ?? '',
      practiceType: practice.practiceType ?? '',
      practiceTypeOther,
      externalParticipants,
      risky,
      protocolRequired: risky || externalParticipants,
      source: 'qr',
    };
  }

  protected async submitDraft(): Promise<void> {
    this.reservationForm.markAllAsTouched();
    this.result.set(null);

    if (this.reservationForm.invalid || this.hasDateInPastError()) {
      this.snackBar.open(
        'Revise los campos requeridos antes de continuar.',
        'Cerrar',
        { duration: 4500 },
      );
      return;
    }

    const mustUploadProtocol = this.isProtocolRequiredByConditions();

    if (mustUploadProtocol && !this.selectedProtocolFile()) {
      this.snackBar.open(
        'Debe seleccionar un protocolo antes de enviar esta solicitud.',
        'Cerrar',
        { duration: 6500 },
      );
      return;
    }

    try {
      this.submitting.set(true);
      this.submittingChange.emit(true);
      const protocolFiles = await this.uploadProtocolFilesIfNeeded(
        mustUploadProtocol,
      );
      const payload = this.buildReservationDraftPayload(protocolFiles);
      const result = await this.reservationService.createReservation(payload);
      this.result.set(result);
      this.reservationCreated.emit({ result, payload });
    } catch (error) {
      this.snackBar.open(this.getReadableError(error), 'Cerrar', {
        duration: 6500,
      });
    } finally {
      this.submitting.set(false);
      this.submittingChange.emit(false);
    }
  }

  private async uploadProtocolFilesIfNeeded(
    mustUploadProtocol: boolean,
  ): Promise<ProtocolUploadMetadata[]> {
    const file = this.selectedProtocolFile();

    if (!mustUploadProtocol || !file) {
      return [];
    }

    this.uploadingProtocol.set(true);
    try {
      return [await this.protocolUploadService.uploadProtocolFile(file)];
    } finally {
      this.uploadingProtocol.set(false);
    }
  }

  private timeRangeValidator(control: AbstractControl): ValidationErrors | null {
    const startTime = control.get('startTime')?.value as string | null;
    const endTime = control.get('endTime')?.value as string | null;

    if (!startTime || !endTime) {
      return null;
    }

    return endTime > startTime ? null : { timeRange: true };
  }

  private practiceTypeOtherValidator(
    control: AbstractControl,
  ): ValidationErrors | null {
    const practiceType = control.get('practiceType')?.value as string | null;
    const practiceTypeOther =
      control.get('practiceTypeOther')?.value as string | null;

    if (practiceType !== 'Otro') {
      return null;
    }

    return practiceTypeOther?.trim() ? null : { practiceTypeOtherRequired: true };
  }

  private isProtocolRequiredByConditions(): boolean {
    return (
      this.riskForm.controls.risky.value === true ||
      this.riskForm.controls.externalParticipants.value === true
    );
  }

  private clearProtocolWhenNotRequired(): void {
    if (!this.isProtocolRequiredByConditions() && this.selectedProtocolFile()) {
      this.selectedProtocolFile.set(null);
    }
  }

  private applyCalendarSlot(slot: AvailabilitySlot): void {
    if (!this.isSelectableCalendarSlot(slot) || !slot.endTime) {
      return;
    }

    this.scheduleForm.patchValue({
      date: this.dateFromSlotKey(slot.dayKey),
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    this.scheduleForm.markAsDirty();
    this.scheduleForm.updateValueAndValidity();
    this.reservationForm.markAsDirty();
    this.reservationForm.updateValueAndValidity();
  }

  private isSelectableCalendarSlot(slot: AvailabilitySlot): boolean {
    return (
      !slot.disabled &&
      slot.status !== 'occupied' &&
      slot.status !== 'unavailable'
    );
  }

  private dateFromSlotKey(dayKey: string): Date {
    return new Date(`${dayKey}T00:00:00`);
  }

  private getStartDateTime(): Date | null {
    const schedule = this.scheduleForm.getRawValue();
    return this.toDateTime(schedule.date, schedule.startTime);
  }

  private toIsoDateTime(date: Date | null, time: string | null): string | null {
    return this.toDateTime(date, time)?.toISOString() ?? null;
  }

  private toDateTime(date: Date | null, time: string | null): Date | null {
    if (!date || !time) {
      return null;
    }

    const [hours, minutes] = time.split(':').map(Number);
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  }

  private isDateBeforeToday(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    return selectedDate < today;
  }

  private getReadableError(error: unknown): string {
    const message = (error as { message?: string }).message;
    return message ?? 'No fue posible crear la reserva.';
  }
}
