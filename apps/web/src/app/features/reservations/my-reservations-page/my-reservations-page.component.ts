import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import {
  MatDatepickerInputEvent,
  MatDatepickerModule,
} from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import {
  AppIconBoxComponent,
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
} from '../../../shared/components';
import { ReservationStatus } from '../../../shared/models';
import { MyReservationCardComponent } from '../components';
import {
  MyReservationsService,
  MyReservationView,
} from '../services/my-reservations.service';

type StatusFilter = ReservationStatus | 'all';
type ReviewFilter = 'all' | 'required' | 'not-required';
type SortOrder = 'recent' | 'upcoming';
type ReservationsViewMode = 'recent' | 'history' | 'all';

@Component({
  selector: 'app-my-reservations-page',
  imports: [
    AppIconBoxComponent,
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MyReservationCardComponent,
    RouterLink,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
  ],
  templateUrl: './my-reservations-page.component.html',
  styleUrl: './my-reservations-page.component.scss',
})
export class MyReservationsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly reservationsService = inject(MyReservationsService);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly reservations = signal<MyReservationView[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly reviewFilter = signal<ReviewFilter>('all');
  protected readonly startDateFilter = signal('');
  protected readonly endDateFilter = signal('');
  protected readonly sortOrder = signal<SortOrder>('recent');
  protected readonly viewMode = signal<ReservationsViewMode>('recent');

  protected readonly dateRangeError = computed(() => {
    const startDate = this.parseFilterDate(this.startDateFilter());
    const endDate = this.parseFilterDate(this.endDateFilter());

    return startDate && endDate && startDate.getTime() > endDate.getTime()
      ? 'La fecha inicial no puede ser posterior a la fecha final.'
      : '';
  });

  protected readonly viewOptions: Array<{
    value: ReservationsViewMode;
    label: string;
    description: string;
  }> = [
    {
      value: 'recent',
      label: 'Recientes',
      description: 'Futuras y últimos 3 meses',
    },
    {
      value: 'history',
      label: 'Histórico',
      description: 'Anteriores a 3 meses',
    },
    {
      value: 'all',
      label: 'Todas',
      description: 'Sin corte temporal',
    },
  ];

  protected readonly statusOptions: Array<{
    value: StatusFilter;
    label: string;
  }> = [
    { value: 'all', label: 'Todos los estatus' },
    { value: 'RECIBIDA', label: 'Recibida' },
    { value: 'PENDIENTE_VALIDACION', label: 'Pendiente de validación' },
    { value: 'CONFIRMADA', label: 'Confirmada' },
    {
      value: 'CONFIRMADA_TRAS_VALIDACION',
      label: 'Confirmada tras validación',
    },
    { value: 'RECHAZADA_CONFLICTO', label: 'Rechazada por conflicto' },
    { value: 'RECHAZADA_REGLA_HORARIO', label: 'Rechazada por horario' },
    {
      value: 'RECHAZADA_MIN_ANTICIPACION',
      label: 'Rechazada por anticipación',
    },
    {
      value: 'RECHAZADA_POR_RESPONSABLE',
      label: 'Rechazada por responsable',
    },
    { value: 'CANCELADA', label: 'Cancelada' },
    { value: 'ERROR_CALENDAR', label: 'Revisión técnica' },
  ];

  protected readonly filteredReservations = computed(() => {
    const search = this.normalizeSearchText(this.searchTerm());
    const status = this.statusFilter();
    const review = this.reviewFilter();
    const startDate = this.parseFilterDate(this.startDateFilter());
    const endDate = this.parseFilterDate(this.endDateFilter(), true);
    const direction = this.sortOrder();

    return this.reservations()
      .filter((reservation) =>
        search
          ? this.searchableReservationFields(reservation).some((value) =>
              this.normalizeSearchText(value).includes(search),
            )
          : true,
      )
      .filter((reservation) =>
        status === 'all' ? true : reservation.status === status,
      )
      .filter((reservation) => {
        if (review === 'all') {
          return true;
        }

        return review === 'required'
          ? reservation.requiresManualReview
          : !reservation.requiresManualReview;
      })
      .filter((reservation) => {
        const time = reservation.startDate?.getTime();

        if (!time) {
          return true;
        }

        return (
          (!startDate || time >= startDate.getTime()) &&
          (!endDate || time <= endDate.getTime())
        );
      })
      .sort((first, second) => {
        const firstTime = first.startDate?.getTime() ?? 0;
        const secondTime = second.startDate?.getTime() ?? 0;

        return direction === 'upcoming'
          ? firstTime - secondTime
          : secondTime - firstTime;
      });
  });

  protected readonly displayedReservations = computed(() => {
    const mode = this.viewMode();

    return this.filteredReservations().filter((reservation) => {
      if (mode === 'all') {
        return true;
      }

      return mode === 'history'
        ? this.isHistoricReservation(reservation)
        : this.isRecentReservation(reservation);
    });
  });

  protected readonly emptyStateTitle = computed(() => {
    const mode = this.viewMode();

    if (mode === 'recent') {
      return 'Sin reservas recientes';
    }

    if (mode === 'history') {
      return 'No hay reservas históricas';
    }

    return 'Sin resultados';
  });

  protected readonly emptyStateMessage = computed(() => {
    const mode = this.viewMode();

    if (mode === 'recent') {
      return 'Las reservas futuras y de los últimos 3 meses aparecerán aquí.';
    }

    if (mode === 'history') {
      return 'Las reservas anteriores a 3 meses aparecerán aquí sin eliminarse del sistema.';
    }

    return 'Ajusta los filtros para ver más reservas personales.';
  });

  ngOnInit(): void {
    void this.loadReservations();
  }

  protected async loadReservations(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      this.reservations.set(
        await this.reservationsService.listMyReservations(),
      );
    } catch (error) {
      this.errorMessage.set(
        (error as { message?: string }).message ??
          'No fue posible cargar tus reservas.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected resetFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.reviewFilter.set('all');
    this.startDateFilter.set('');
    this.endDateFilter.set('');
    this.sortOrder.set('recent');
    this.viewMode.set('recent');
  }

  protected setViewMode(mode: ReservationsViewMode): void {
    this.viewMode.set(mode);
  }

  protected datepickerValue(value: string): Date | null {
    return this.parseFilterDate(value);
  }

  protected setStartDateFilter(event: MatDatepickerInputEvent<Date>): void {
    this.startDateFilter.set(this.toFilterDateValue(event.value));
  }

  protected setEndDateFilter(event: MatDatepickerInputEvent<Date>): void {
    this.endDateFilter.set(this.toFilterDateValue(event.value));
  }

  protected formatDate(reservation: MyReservationView): string {
    return this.reservationsService.formatDate(reservation.startDate);
  }

  protected formatTime(reservation: MyReservationView): string {
    return this.reservationsService.formatTimeRange(reservation);
  }

  protected async viewDetails(reservation: MyReservationView): Promise<void> {
    await this.router.navigate(['/mis-reservas', reservation.id]);
  }

  private parseFilterDate(value: string, endOfDay = false): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    }

    return date;
  }

  private toFilterDateValue(value: Date | null): string {
    if (!value || Number.isNaN(value.getTime())) {
      return '';
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private isRecentReservation(reservation: MyReservationView): boolean {
    if (this.mustRemainVisibleByStatus(reservation.status)) {
      return true;
    }

    const startDate = reservation.startDate;

    if (!startDate) {
      return true;
    }

    return startDate.getTime() >= this.recentCutoffDate().getTime();
  }

  private isHistoricReservation(reservation: MyReservationView): boolean {
    if (this.mustRemainVisibleByStatus(reservation.status)) {
      return false;
    }

    const startDate = reservation.startDate;

    if (!startDate) {
      return false;
    }

    return startDate.getTime() < this.recentCutoffDate().getTime();
  }

  private mustRemainVisibleByStatus(status: ReservationStatus): boolean {
    return (
      status === 'PENDIENTE_VALIDACION' ||
      status === 'CONFIRMADA' ||
      status === 'CONFIRMADA_TRAS_VALIDACION' ||
      status === 'ERROR_CALENDAR'
    );
  }

  private searchableReservationFields(
    reservation: MyReservationView,
  ): string[] {
    return [
      reservation.folio,
      reservation.labName,
      reservation.subject,
      reservation.practiceName,
      reservation.group,
      reservation.practiceType,
    ];
  }

  private normalizeSearchText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private recentCutoffDate(): Date {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    cutoff.setHours(0, 0, 0, 0);

    return cutoff;
  }
}
