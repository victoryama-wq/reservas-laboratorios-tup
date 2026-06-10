import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
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

@Component({
  selector: 'app-my-reservations-page',
  imports: [
    AppIconBoxComponent,
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MyReservationCardComponent,
    RouterLink,
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

  protected readonly statusOptions: Array<{
    value: StatusFilter;
    label: string;
  }> = [
    { value: 'all', label: 'Todos los estatus' },
    { value: 'RECIBIDA', label: 'Recibida' },
    { value: 'PENDIENTE_VALIDACION', label: 'Pendiente de validacion' },
    { value: 'CONFIRMADA', label: 'Confirmada' },
    {
      value: 'CONFIRMADA_TRAS_VALIDACION',
      label: 'Confirmada tras validacion',
    },
    { value: 'RECHAZADA_CONFLICTO', label: 'Rechazada por conflicto' },
    { value: 'RECHAZADA_REGLA_HORARIO', label: 'Rechazada por horario' },
    {
      value: 'RECHAZADA_MIN_ANTICIPACION',
      label: 'Rechazada por anticipacion',
    },
    {
      value: 'RECHAZADA_POR_RESPONSABLE',
      label: 'Rechazada por responsable',
    },
    { value: 'CANCELADA', label: 'Cancelada' },
    { value: 'ERROR_CALENDAR', label: 'Error Calendar' },
  ];

  protected readonly filteredReservations = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const review = this.reviewFilter();
    const startDate = this.parseFilterDate(this.startDateFilter());
    const endDate = this.parseFilterDate(this.endDateFilter(), true);
    const direction = this.sortOrder();

    return this.reservations()
      .filter((reservation) =>
        search
          ? [reservation.folio, reservation.labName].some((value) =>
              value.toLowerCase().includes(search),
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
}
