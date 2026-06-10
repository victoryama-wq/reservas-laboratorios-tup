import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  ReservationReviewService,
  ResponsibleReservationView,
} from '../services/reservation-review.service';

@Component({
  selector: 'app-responsible-history-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    <section class="history-page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Responsable</p>
          <h1>Historial de reservas</h1>
        </div>
      </header>

      @if (loading()) {
        <div class="state-card">
          <mat-progress-spinner mode="indeterminate" diameter="36" />
          <p>Cargando historial...</p>
        </div>
      } @else if (errorMessage()) {
        <div class="state-card error">
          <p>{{ errorMessage() }}</p>
        </div>
      } @else if (reservations().length) {
        <div class="history-list">
          @for (reservation of reservations(); track reservation.id) {
            <mat-card>
              <mat-card-content>
                <div class="row">
                  <div>
                    <strong>{{ reservation.folio }}</strong>
                    <p>{{ reservation.labName }}</p>
                  </div>
                  <mat-chip>{{ reservation.status }}</mat-chip>
                </div>
                <p>
                  {{ formatDate(reservation) }} · {{ formatTime(reservation) }}
                </p>
                <p>{{ reservation.practiceName }}</p>
              </mat-card-content>
              <mat-card-actions align="end">
                <a
                  mat-button
                  [routerLink]="['/responsable/reserva', reservation.id]"
                >
                  Ver detalle
                </a>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      } @else {
        <div class="state-card">
          <p>No hay historial disponible.</p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .history-page {
        max-width: 1120px;
        margin: 0 auto;
        padding: 0 0 40px;
      }

      .eyebrow {
        color: var(--color-accent);
        font-size: 0.78rem;
        font-weight: 850;
        letter-spacing: 0.06em;
        margin: 0 0 6px;
        text-transform: uppercase;
      }

      h1 {
        color: var(--color-text-primary);
        font-size: clamp(2rem, 4vw, 2.8rem);
        font-weight: 850;
        margin: 0 0 24px;
      }

      .history-list {
        display: grid;
        gap: 16px;
      }

      .row {
        align-items: flex-start;
        display: flex;
        gap: 16px;
        justify-content: space-between;
      }

      .state-card {
        align-items: center;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        background: #ffffff;
        box-shadow: var(--shadow-card);
        display: flex;
        gap: 14px;
        justify-content: center;
        min-height: 180px;
        padding: 24px;
      }

      .state-card.error {
        border-color: #f7c6c6;
        color: #bd3232;
      }
    `,
  ],
})
export class ResponsibleHistoryPageComponent implements OnInit {
  private readonly reviewService = inject(ReservationReviewService);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly reservations = signal<ResponsibleReservationView[]>([]);

  ngOnInit(): void {
    void this.loadHistory();
  }

  protected async loadHistory(): Promise<void> {
    try {
      this.reservations.set(await this.reviewService.listHistoryReservations());
    } catch (error) {
      this.errorMessage.set(
        (error as { message?: string }).message ??
          'No fue posible cargar el historial.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDate(reservation: ResponsibleReservationView): string {
    return this.reviewService.formatDate(reservation.startDate);
  }

  protected formatTime(reservation: ResponsibleReservationView): string {
    return this.reviewService.formatTimeRange(reservation);
  }
}
