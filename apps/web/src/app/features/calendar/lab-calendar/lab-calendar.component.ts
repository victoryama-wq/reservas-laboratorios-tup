import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { EventInput } from '@fullcalendar/core';

import { LabDoc } from '../../../shared/models';
import { LabService } from '../../labs/services/lab.service';
import {
  AvailabilityCalendarComponent,
  AvailabilityDay,
  AvailabilitySlot,
  AvailabilitySlotStatus,
  AvailabilityViewMode,
} from '../components';
import { AvailabilityService } from '../services/availability.service';

type WeekdayName =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

@Component({
  selector: 'app-lab-calendar',
  imports: [AvailabilityCalendarComponent],
  templateUrl: './lab-calendar.component.html',
  styleUrl: './lab-calendar.component.scss',
})
export class LabCalendarComponent {
  readonly lab = input.required<LabDoc>();
  readonly refreshKey = input(0);
  readonly optimisticEvents = input<EventInput[]>([]);
  readonly slotSelected = output<AvailabilitySlot>();

  private readonly availabilityService = inject(AvailabilityService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly labService = inject(LabService);

  protected readonly events = signal<EventInput[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly hasReadLimit = signal(false);
  protected readonly isMobile = signal(false);
  protected readonly selectedView = signal<AvailabilityViewMode>('week');
  protected readonly currentDate = signal(new Date());
  protected readonly selectedSlot = signal<AvailabilitySlot | null>(null);

  protected readonly scheduleSummary = computed(() =>
    this.labService.getWeeklyScheduleSummary(this.lab().weeklySchedule),
  );

  protected readonly currentRangeLabel = computed(() =>
    this.selectedView() === 'month'
      ? this.formatMonthRange(this.currentDate())
      : this.formatWeekRange(this.weekDays()),
  );

  protected readonly calendarDays = computed<AvailabilityDay[]>(() =>
    this.selectedView() === 'month' ? this.monthDays() : this.weekDays(),
  );

  protected readonly calendarHours = computed(() => this.getCalendarHours());

  protected readonly visibleEvents = computed(() => {
    const eventsById = new Map<string, EventInput>();
    const eventsWithoutId: EventInput[] = [];

    for (const event of [...this.events(), ...this.optimisticEvents()]) {
      if (event.id) {
        eventsById.set(String(event.id), event);
      } else {
        eventsWithoutId.push(event);
      }
    }

    return [...eventsById.values(), ...eventsWithoutId];
  });

  protected readonly calendarSlots = computed<AvailabilitySlot[]>(() => {
    const days = this.calendarDays();
    const hours = this.calendarHours();

    return days.flatMap((day) =>
      hours.map((hour) => this.createSlot(day, hour)),
    );
  });

  protected readonly emptyMessage = computed(() =>
    this.visibleEvents().length
      ? ''
      : 'No hay reservas ni bloqueos internos registrados para este laboratorio.',
  );

  protected readonly readLimitMessage = computed(() =>
    this.hasReadLimit()
      ? 'La vista actual puede estar limitada por permisos de lectura. En fases posteriores se usara una vista publica sanitizada para disponibilidad.'
      : '',
  );

  constructor() {
    this.breakpointObserver.observe('(max-width: 767px)').subscribe((state) => {
      this.isMobile.set(state.matches);
      this.selectedView.set('week');
    });

    effect((onCleanup) => {
      const lab = this.lab();
      this.refreshKey();
      this.loading.set(true);
      this.errorMessage.set('');
      this.selectedSlot.set(null);

      const subscription = this.availabilityService.getAvailabilityEvents(lab).subscribe({
        next: (state) => {
          this.events.set(state.events);
          this.hasReadLimit.set(state.hasReadLimit);
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set(
            'No fue posible cargar la disponibilidad interna.',
          );
          this.loading.set(false);
        },
      });

      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected setView(view: AvailabilityViewMode): void {
    this.selectedView.set(view);
    this.selectedSlot.set(null);
  }

  protected goToPreviousRange(): void {
    this.currentDate.update((date) =>
      this.selectedView() === 'month' ? this.addMonths(date, -1) : this.addDays(date, -7),
    );
    this.selectedSlot.set(null);
  }

  protected goToNextRange(): void {
    this.currentDate.update((date) =>
      this.selectedView() === 'month' ? this.addMonths(date, 1) : this.addDays(date, 7),
    );
    this.selectedSlot.set(null);
  }

  protected goToToday(): void {
    this.currentDate.set(new Date());
    this.selectedSlot.set(null);
  }

  protected selectCalendarSlot(slot: AvailabilitySlot): void {
    if (slot.disabled) {
      return;
    }

    this.selectedSlot.set(slot);
    this.slotSelected.emit(slot);
  }

  private createSlot(day: AvailabilityDay, hour: string): AvailabilitySlot {
    const start = this.slotDate(day.key, hour);
    const end = this.addHours(start, 1);
    const schedule = this.scheduleForDay(start);
    const event = this.visibleEvents().find((item) => this.overlapsEvent(item, start, end));

    if (event) {
      const status = this.eventStatus(event);
      const eventEnd = this.toDate(event.end);

      return {
        id: String(event.id ?? `${day.key}-${hour}`),
        dayKey: day.key,
        startTime: hour,
        endTime: eventEnd ? this.formatTime(eventEnd) : this.formatHour(end),
        status,
        label: this.eventLabel(event, status),
        disabled: status !== 'available',
        meta: event,
      };
    }

    if (!schedule?.enabled || !this.isInsideSchedule(hour, schedule)) {
      return {
        dayKey: day.key,
        startTime: hour,
        endTime: this.formatHour(end),
        status: 'unavailable',
        label: 'No disponible',
        disabled: true,
      };
    }

    return {
      dayKey: day.key,
      startTime: hour,
      endTime: this.formatHour(end),
      status: 'available',
      label: 'Disponible',
    };
  }

  private weekDays(): AvailabilityDay[] {
    const start = this.startOfWeek(this.currentDate());

    return Array.from({ length: 7 }, (_, index) =>
      this.toAvailabilityDay(this.addDays(start, index), false),
    );
  }

  private monthDays(): AvailabilityDay[] {
    const current = this.currentDate();
    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
    const start = this.startOfWeek(firstDay);

    return Array.from({ length: 42 }, (_, index) => {
      const date = this.addDays(start, index);
      return this.toAvailabilityDay(date, date.getMonth() !== current.getMonth());
    });
  }

  private toAvailabilityDay(date: Date, outsideMonth: boolean): AvailabilityDay {
    const schedule = this.scheduleForDay(date);

    return {
      key: this.dateKey(date),
      label: new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(date),
      dateLabel: new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: '2-digit',
      }).format(date),
      isToday: this.dateKey(date) === this.dateKey(new Date()),
      disabled: outsideMonth || !schedule?.enabled,
    };
  }

  private getCalendarHours(): string[] {
    const schedules = Object.values(this.lab().weeklySchedule).filter(
      (schedule): schedule is NonNullable<typeof schedule> =>
        Boolean(schedule?.enabled),
    );

    if (!schedules.length) {
      return this.hoursBetween(8, 20);
    }

    const startHour = Math.min(
      ...schedules.map((schedule) => this.hourFromTime(schedule.start)),
    );
    const endHour = Math.max(
      ...schedules.map((schedule) => this.hourFromTime(schedule.end)),
    );

    return this.hoursBetween(startHour, endHour);
  }

  private hoursBetween(startHour: number, endHour: number): string[] {
    const hours: string[] = [];

    for (let hour = startHour; hour < endHour; hour += 1) {
      hours.push(`${hour.toString().padStart(2, '0')}:00`);
    }

    return hours;
  }

  private scheduleForDay(date: Date): LabDoc['weeklySchedule'][WeekdayName] {
    const weekdays: WeekdayName[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];

    return this.lab().weeklySchedule[weekdays[date.getDay()]];
  }

  private isInsideSchedule(
    hour: string,
    schedule: NonNullable<LabDoc['weeklySchedule'][WeekdayName]>,
  ): boolean {
    return hour >= schedule.start && hour < schedule.end;
  }

  private overlapsEvent(event: EventInput, start: Date, end: Date): boolean {
    const eventStart = this.toDate(event.start);
    const eventEnd = this.toDate(event.end) ?? eventStart;

    if (!eventStart) {
      return false;
    }

    if (event.allDay) {
      return this.dateKey(start) >= this.dateKey(eventStart) &&
        this.dateKey(start) <= this.dateKey(eventEnd ?? eventStart);
    }

    return eventStart < end && (eventEnd ?? eventStart) > start;
  }

  private eventStatus(event: EventInput): AvailabilitySlotStatus {
    const status = (event.extendedProps as { status?: string } | undefined)?.status;
    const source = (event.extendedProps as { source?: string } | undefined)?.source;

    if (status === 'PENDIENTE_VALIDACION') {
      return 'risk';
    }

    if (source === 'blockedPeriod' || source === 'specialRule') {
      return 'unavailable';
    }

    return 'occupied';
  }

  private eventLabel(
    event: EventInput,
    status: AvailabilitySlotStatus,
  ): string {
    if (status === 'risk') {
      return 'Pendiente';
    }

    if (status === 'unavailable') {
      return 'No disponible';
    }

    return typeof event.title === 'string' ? event.title : 'Ocupado';
  }

  private formatWeekRange(days: AvailabilityDay[]): string {
    const first = days.at(0)?.key;
    const last = days.at(-1)?.key;

    if (!first || !last) {
      return '';
    }

    const firstDate = this.slotDate(first, '00:00');
    const lastDate = this.slotDate(last, '00:00');
    const monthYear = new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(lastDate);

    return `${firstDate.getDate()} - ${lastDate.getDate()} ${monthYear}`;
  }

  private formatMonthRange(date: Date): string {
    return new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private startOfWeek(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return start;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  private slotDate(dayKey: string, hour: string): Date {
    return new Date(`${dayKey}T${hour}:00`);
  }

  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatHour(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:00`;
  }

  private formatTime(date: Date): string {
    return [
      date.getHours().toString().padStart(2, '0'),
      date.getMinutes().toString().padStart(2, '0'),
    ].join(':');
  }

  private hourFromTime(time: string): number {
    return Number(time.slice(0, 2));
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }
}
