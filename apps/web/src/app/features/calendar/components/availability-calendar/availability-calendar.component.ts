import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AppInfoCalloutComponent } from '../../../../shared/components';
import {
  AvailabilitySlotDetailDialogComponent,
  AvailabilitySlotDetailDialogData,
} from './availability-slot-detail-dialog.component';

export type AvailabilityViewMode = 'week' | 'month';

export type AvailabilitySlotStatus =
  | 'available'
  | 'occupied'
  | 'risk'
  | 'unavailable'
  | 'selected';

export interface AvailabilityDay {
  key: string;
  label: string;
  dateLabel?: string;
  isToday?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
}

export interface AvailabilitySlot {
  id?: string;
  dayKey: string;
  startTime: string;
  endTime?: string;
  status: AvailabilitySlotStatus;
  label?: string;
  disabled?: boolean;
  meta?: unknown;
}

interface AvailabilityBlock {
  dayKey: string;
  startTime: string;
  endTime: string;
  startIndex: number;
  span: number;
  status: AvailabilitySlotStatus;
  label: string;
  slot: AvailabilitySlot;
}

@Component({
  selector: 'app-availability-calendar',
  imports: [
    AppInfoCalloutComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    NgClass,
  ],
  templateUrl: './availability-calendar.component.html',
  styleUrl: './availability-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailabilityCalendarComponent {
  private readonly dialog = inject(MatDialog);

  readonly title = input('Disponibilidad');
  readonly subtitle = input<string>();
  readonly scheduleSummary = input<string>();
  readonly viewMode = input<AvailabilityViewMode>('week');
  readonly currentRangeLabel = input('');
  readonly days = input<AvailabilityDay[]>([]);
  readonly hours = input<string[]>([]);
  readonly slots = input<AvailabilitySlot[]>([]);
  readonly selectedSlot = input<AvailabilitySlot | null>(null);
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly emptyMessage = input('');
  readonly errorMessage = input('');
  readonly readLimitMessage = input('');
  readonly showLegend = input(true);

  readonly previousRange = output<void>();
  readonly nextRange = output<void>();
  readonly today = output<void>();
  readonly viewModeChange = output<AvailabilityViewMode>();
  readonly slotSelected = output<AvailabilitySlot>();

  protected readonly slotMap = computed(() => {
    const map = new Map<string, AvailabilitySlot>();

    for (const slot of this.slots()) {
      map.set(this.slotKey(slot.dayKey, slot.startTime), slot);
    }

    return map;
  });

  protected readonly legendItems: {
    label: string;
    status: AvailabilitySlotStatus;
  }[] = [
    { label: 'Disponible', status: 'available' },
    { label: 'Ocupado', status: 'occupied' },
    { label: 'Riesgo', status: 'risk' },
    { label: 'No disponible', status: 'unavailable' },
    { label: 'Seleccionado', status: 'selected' },
  ];

  protected readonly monthWeekdayLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

  protected slotFor(dayKey: string, hour: string): AvailabilitySlot | null {
    return this.slotMap().get(this.slotKey(dayKey, hour)) ?? null;
  }

  protected slotsForDay(dayKey: string): AvailabilitySlot[] {
    return this.slots().filter((slot) => slot.dayKey === dayKey);
  }

  protected selectSlot(slot: AvailabilitySlot | null): void {
    if (!slot || this.disabled() || slot.disabled) {
      return;
    }

    this.slotSelected.emit(slot);
  }

  protected isSelected(slot: AvailabilitySlot | null): boolean {
    const selected = this.selectedSlot();

    return Boolean(
      selected &&
        slot &&
        selected.dayKey === slot.dayKey &&
        selected.startTime === slot.startTime,
    );
  }

  protected cellClasses(slot: AvailabilitySlot | null): string[] {
    if (!slot || slot.disabled || slot.status === 'unavailable') {
      return ['availability-cell--muted'];
    }

    return ['availability-cell--available'];
  }

  protected blocksForDay(dayKey: string): AvailabilityBlock[] {
    const blocks: AvailabilityBlock[] = [];

    for (const [index, hour] of this.hours().entries()) {
      const slot = this.slotFor(dayKey, hour);
      const status = this.visualStatus(slot);

      if (!slot || status === 'available') {
        continue;
      }

      const label = this.blockLabel(slot, status);
      const lastBlock = blocks.at(-1);

      if (lastBlock && this.canExtendBlock(lastBlock, slot, status, label, index)) {
        lastBlock.span += 1;
        lastBlock.endTime = this.blockEndTime(slot, index);
        continue;
      }

      blocks.push({
        dayKey,
        startTime: this.blockStartTime(slot),
        endTime: this.blockEndTime(slot, index),
        startIndex: index,
        span: 1,
        status,
        label,
        slot,
      });
    }

    return blocks;
  }

  protected summaryBlocksForDay(dayKey: string): AvailabilityBlock[] {
    return this.blocksForDay(dayKey)
      .filter((block) => block.status !== 'unavailable' || this.isExplicitUnavailable(block.slot))
      .slice(0, 3);
  }

  protected remainingBlocksForDay(dayKey: string): number {
    const blocks = this.blocksForDay(dayKey).filter(
      (block) => block.status !== 'unavailable' || this.isExplicitUnavailable(block.slot),
    );

    return Math.max(blocks.length - 3, 0);
  }

  protected blockClasses(block: AvailabilityBlock): string[] {
    return [`availability-block--${block.status}`];
  }

  protected blockDisabled(block: AvailabilityBlock): boolean {
    return this.disabled() || (block.status === 'available' && block.slot.disabled === true);
  }

  protected blockOffsetMinutes(block: AvailabilityBlock): number {
    const firstHour = this.hours().at(0);

    if (!firstHour) {
      return 0;
    }

    const visibleStart = this.timeToMinutes(firstHour);
    const visibleEnd = visibleStart + this.visibleDurationMinutes();
    const start = this.normalizeEndMinutes(
      this.timeToMinutes(block.startTime),
      visibleStart,
    );
    const clippedStart = Math.min(Math.max(start, visibleStart), visibleEnd);

    return clippedStart - visibleStart;
  }

  protected blockDurationMinutes(block: AvailabilityBlock): number {
    const firstHour = this.hours().at(0);

    if (!firstHour) {
      return 0;
    }

    const visibleStart = this.timeToMinutes(firstHour);
    const visibleEnd = visibleStart + this.visibleDurationMinutes();
    const start = this.normalizeEndMinutes(
      this.timeToMinutes(block.startTime),
      visibleStart,
    );
    const end = this.normalizeEndMinutes(this.timeToMinutes(block.endTime), start);
    const clippedStart = Math.min(Math.max(start, visibleStart), visibleEnd);
    const clippedEnd = Math.min(Math.max(end, visibleStart), visibleEnd);

    return Math.max(clippedEnd - clippedStart, 1);
  }

  protected blockAriaLabel(day: AvailabilityDay, block: AvailabilityBlock): string {
    return `${day.label} ${day.dateLabel ?? ''}, ${block.startTime} a ${block.endTime}: ${block.label}`;
  }

  protected ariaLabel(day: AvailabilityDay, slot: AvailabilitySlot | null): string {
    const status = this.isSelected(slot) ? 'Seleccionado' : (slot?.label ?? 'No disponible');
    const endTime = slot?.endTime ? ` a ${slot.endTime}` : '';
    return `${day.label} ${day.dateLabel ?? ''}, ${slot?.startTime ?? ''}${endTime}: ${status}`;
  }

  protected monthDayNumber(day: AvailabilityDay): string {
    return day.dateLabel?.split('/').at(0) ?? '';
  }

  protected selectBlock(block: AvailabilityBlock): void {
    if (this.blockDisabled(block)) {
      return;
    }

    if (block.status === 'occupied' || block.status === 'risk' || block.status === 'unavailable') {
      this.openBlockDetail(block);
      return;
    }

    this.selectSlot(block.slot);
  }

  protected emitPreviousRange(): void {
    this.previousRange.emit();
  }

  protected emitNextRange(): void {
    this.nextRange.emit();
  }

  protected emitToday(): void {
    this.today.emit();
  }

  protected setViewMode(viewMode: AvailabilityViewMode): void {
    if (this.viewMode() === viewMode) {
      return;
    }

    this.viewModeChange.emit(viewMode);
  }

  private slotKey(dayKey: string, hour: string): string {
    return `${dayKey}__${hour}`;
  }

  private visualStatus(slot: AvailabilitySlot | null): AvailabilitySlotStatus {
    return this.isSelected(slot) ? 'selected' : (slot?.status ?? 'unavailable');
  }

  private openBlockDetail(block: AvailabilityBlock): void {
    const data = this.blockDetailData(block);

    this.dialog.open<AvailabilitySlotDetailDialogComponent, AvailabilitySlotDetailDialogData>(
      AvailabilitySlotDetailDialogComponent,
      {
        data,
        maxWidth: '440px',
        width: 'calc(100vw - 32px)',
        panelClass: 'app-calendar-detail-dialog-panel',
        restoreFocus: false,
      },
    );
  }

  private blockDetailData(block: AvailabilityBlock): AvailabilitySlotDetailDialogData {
    if (block.status === 'risk') {
      return {
        title: 'Solicitud pendiente',
        icon: 'warning',
        variant: 'warning',
        statusLabel: block.label,
        timeRange: `${block.startTime} - ${block.endTime}`,
        message:
          'Este horario esta ocupado por una solicitud pendiente de validacion. No se muestran datos personales o academicos en esta vista.',
      };
    }

    if (block.status === 'unavailable') {
      return {
        title: 'Horario no disponible',
        icon: 'event_busy',
        variant: 'neutral',
        statusLabel: block.label,
        timeRange: `${block.startTime} - ${block.endTime}`,
        message:
          'Este rango no esta disponible para reserva de acuerdo con el calendario o reglas del laboratorio.',
      };
    }

    return {
      title: 'Horario ocupado',
      icon: 'event_busy',
      variant: 'danger',
      statusLabel: block.label,
      timeRange: `${block.startTime} - ${block.endTime}`,
      message:
        'Este horario ya tiene una reserva o evento bloqueante. Por privacidad, solo se muestra informacion de disponibilidad.',
    };
  }

  private blockLabel(
    slot: AvailabilitySlot,
    status: AvailabilitySlotStatus,
  ): string {
    if (status === 'selected') {
      return 'Seleccionado';
    }

    if (status === 'occupied') {
      return 'Ocupado';
    }

    if (status === 'risk') {
      return slot.label === 'Pendiente' ? 'Pendiente' : 'Riesgo';
    }

    return slot.label ?? 'No disponible';
  }

  private blockStartTime(slot: AvailabilitySlot): string {
    if (this.isAllDayMeta(slot.meta)) {
      return slot.startTime;
    }

    const eventStart = this.metaDate(slot.meta, 'start');
    return eventStart ? this.formatTime(eventStart) : slot.startTime;
  }

  private blockEndTime(slot: AvailabilitySlot, index: number): string {
    if (this.isAllDayMeta(slot.meta)) {
      return slot.endTime ?? this.nextHourLabel(index);
    }

    const eventEnd = this.metaDate(slot.meta, 'end');
    return eventEnd ?
      this.formatTime(eventEnd) :
      (slot.endTime ?? this.nextHourLabel(index));
  }

  private canExtendBlock(
    block: AvailabilityBlock,
    slot: AvailabilitySlot,
    status: AvailabilitySlotStatus,
    label: string,
    index: number,
  ): boolean {
    return (
      block.status === status &&
      block.label === label &&
      block.startIndex + block.span === index &&
      this.hasSameVisualSource(block.slot, slot)
    );
  }

  private isExplicitUnavailable(slot: AvailabilitySlot): boolean {
    const source = (slot.meta as { extendedProps?: { source?: string } } | undefined)
      ?.extendedProps?.source;

    return source === 'blockedPeriod' || source === 'specialRule';
  }

  private hasSameVisualSource(
    previous: AvailabilitySlot,
    current: AvailabilitySlot,
  ): boolean {
    if (previous.meta && current.meta) {
      return previous.meta === current.meta;
    }

    if (previous.id && current.id) {
      return previous.id === current.id;
    }

    return previous.status === current.status && previous.label === current.label;
  }

  private nextHourLabel(index: number): string {
    return this.hours().at(index + 1) ?? this.hours().at(index) ?? '';
  }

  private metaDate(meta: unknown, field: 'start' | 'end'): Date | null {
    const value = (meta as { start?: unknown; end?: unknown } | undefined)
      ?.[field];
    return this.toDate(value);
  }

  private isAllDayMeta(meta: unknown): boolean {
    return (meta as { allDay?: unknown } | undefined)?.allDay === true;
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

  private formatTime(date: Date): string {
    return [
      date.getHours().toString().padStart(2, '0'),
      date.getMinutes().toString().padStart(2, '0'),
    ].join(':');
  }

  private timeToMinutes(time: string): number {
    const [hours = '0', minutes = '0'] = time.split(':');
    return Number(hours) * 60 + Number(minutes);
  }

  private visibleDurationMinutes(): number {
    return this.hours().length * 60;
  }

  private normalizeEndMinutes(minutes: number, referenceMinutes: number): number {
    return minutes < referenceMinutes ? minutes + 24 * 60 : minutes;
  }
}
