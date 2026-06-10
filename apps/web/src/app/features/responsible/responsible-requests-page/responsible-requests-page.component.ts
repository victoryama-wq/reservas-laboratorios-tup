import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import {
  ReservationReviewService,
  ResponsibleReservationView,
} from '../services/reservation-review.service';
import {
  AppIconBoxComponent,
  AppPageHeaderComponent,
} from '../../../shared/components';
import { PendingRequestCardComponent } from '../components';

@Component({
  selector: 'app-responsible-requests-page',
  imports: [
    AppIconBoxComponent,
    AppPageHeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    PendingRequestCardComponent,
  ],
  templateUrl: './responsible-requests-page.component.html',
  styleUrl: './responsible-requests-page.component.scss',
})
export class ResponsibleRequestsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly reviewService = inject(ReservationReviewService);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly reservations = signal<ResponsibleReservationView[]>([]);
  protected readonly selectedLab = signal('all');

  ngOnInit(): void {
    void this.loadReservations();
  }

  protected async loadReservations(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      this.reservations.set(await this.reviewService.listPendingReservations());
    } catch (error) {
      this.errorMessage.set(
        (error as { message?: string }).message ??
          'No fue posible cargar las solicitudes pendientes.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected filteredReservations(): ResponsibleReservationView[] {
    const lab = this.selectedLab();

    if (lab === 'all') {
      return this.reservations();
    }

    return this.reservations().filter((reservation) => reservation.labId === lab);
  }

  protected labOptions(): { id: string; name: string }[] {
    const labs = new Map<string, string>();

    for (const reservation of this.reservations()) {
      labs.set(reservation.labId, reservation.labName);
    }

    return [...labs.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((first, second) => first.name.localeCompare(second.name));
  }

  protected riskCount(): number {
    return this.filteredReservations().filter((reservation) => reservation.risky)
      .length;
  }

  protected protocolCount(): number {
    return this.filteredReservations().filter(
      (reservation) => reservation.protocolFiles.length > 0,
    ).length;
  }

  protected formatDate(reservation: ResponsibleReservationView): string {
    return this.reviewService.formatDate(reservation.startDate);
  }

  protected formatTime(reservation: ResponsibleReservationView): string {
    return this.reviewService.formatTimeRange(reservation);
  }

  protected async onReviewRequest(
    reservation: ResponsibleReservationView,
  ): Promise<void> {
    await this.router.navigate(['/responsable/reserva', reservation.id]);
  }
}
