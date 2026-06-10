import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import {
  collection,
  Firestore,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { FIREBASE_FIRESTORE } from '../../../core/firebase/firebase.providers';
import {
  AppIconBoxComponent,
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  AppSectionCardComponent,
} from '../../../shared/components';
import { ReservationDoc } from '../../../shared/models';
import { AdminLabsService } from '../services/admin-labs.service';
import { AdminUsersService } from '../services/admin-users.service';

interface AdminStatCard {
  label: string;
  value: number;
  icon: string;
  helper: string;
  variant: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [
    AppIconBoxComponent,
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    AppSectionCardComponent,
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
  template: `
    <section class="app-container grid gap-8">
      <app-page-header
        kicker="Admin/Sistemas"
        title="Panel administrativo"
        subtitle="Resumen operativo para usuarios, laboratorios, reservas y eventos técnicos."
      />

      @if (errorMessage) {
        <app-info-callout
          variant="danger"
          icon="error"
          [message]="errorMessage"
        />
      }

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (stat of stats; track stat.label) {
          <app-section-card>
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="app-page-kicker">{{ stat.label }}</p>
                <p class="m-0 mt-2 text-4xl font-extrabold text-slate-950">
                  {{ stat.value }}
                </p>
                <p class="m-0 mt-2 text-sm text-slate-600">
                  {{ stat.helper }}
                </p>
              </div>
              <app-icon-box [icon]="stat.icon" [variant]="stat.variant" />
            </div>
          </app-section-card>
        }
      </div>

      <app-section-card
        title="Accesos rápidos"
        subtitle="Operaciones administrativas disponibles en esta fase."
        icon="dashboard_customize"
      >
        <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (action of quickActions; track action.link) {
            <a
              mat-stroked-button
              class="justify-start"
              [routerLink]="action.link"
              [attr.aria-label]="action.ariaLabel"
            >
              <mat-icon>{{ action.icon }}</mat-icon>
              {{ action.label }}
            </a>
          }
        </div>
      </app-section-card>

      <app-info-callout
        variant="info"
        icon="info"
        message="Esta fase habilita usuarios, responsables y lectura operativa. La edición completa de laboratorios, reglas y reportes avanzados queda para fases posteriores."
      />
    </section>
  `,
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly usersService = inject(AdminUsersService);
  private readonly labsService = inject(AdminLabsService);
  private readonly firestore = inject<Firestore>(FIREBASE_FIRESTORE);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected stats: AdminStatCard[] = [];
  protected errorMessage = '';
  protected readonly quickActions = [
    {
      label: 'Gestionar usuarios',
      link: '/admin/usuarios',
      icon: 'manage_accounts',
      ariaLabel: 'Ir a gestion de usuarios',
    },
    {
      label: 'Ver laboratorios',
      link: '/admin/laboratorios',
      icon: 'science',
      ariaLabel: 'Ir a laboratorios administrativos',
    },
    {
      label: 'Ver bitacora',
      link: '/admin/bitacora',
      icon: 'history',
      ariaLabel: 'Ir a bitacora administrativa',
    },
    {
      label: 'Solicitudes',
      link: '/responsable/solicitudes',
      icon: 'fact_check',
      ariaLabel: 'Ir a solicitudes pendientes',
    },
  ];

  async ngOnInit(): Promise<void> {
    await this.loadDashboard();
  }

  private async loadDashboard(): Promise<void> {
    try {
      const [
        users,
        labs,
        pendingReservations,
        calendarErrors,
        failedNotifications,
      ] = await Promise.all([
        this.usersService.listUsers(),
        this.labsService.listLabs(),
        this.countReservations('PENDIENTE_VALIDACION'),
        this.countReservations('ERROR_CALENDAR'),
        this.countFailedNotifications(),
      ]);

      this.stats = [
        {
          label: 'Usuarios activos',
          value: users.filter((user) => user.active).length,
          icon: 'verified_user',
          helper: 'Perfiles institucionales habilitados',
          variant: 'success',
        },
        {
          label: 'Pendientes o inactivos',
          value: users.filter((user) => !user.active).length,
          icon: 'person_off',
          helper: 'Cuentas que requieren atención',
          variant: 'warning',
        },
        {
          label: 'Laboratorios activos',
          value: labs.filter((lab) => lab.active).length,
          icon: 'science',
          helper: 'Espacios operativos registrados',
          variant: 'primary',
        },
        {
          label: 'Pendientes de validación',
          value: pendingReservations,
          icon: 'pending_actions',
          helper: 'Solicitudes esperando revisión',
          variant: 'warning',
        },
        {
          label: 'Error Calendar',
          value: calendarErrors,
          icon: 'event_busy',
          helper: 'Reservas con atención técnica',
          variant: 'danger',
        },
        {
          label: 'Notificaciones fallidas',
          value: failedNotifications,
          icon: 'mark_email_unread',
          helper: 'Correos que requieren revisión',
          variant: 'danger',
        },
      ];
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'No fue posible cargar el panel administrativo.';
    } finally {
      this.changeDetector.detectChanges();
    }
  }

  private async countReservations(status: ReservationDoc['status']): Promise<number> {
    const snapshot = await getDocs(
      query(collection(this.firestore, 'reservations'), where('status', '==', status)),
    );
    return snapshot.size;
  }

  private async countFailedNotifications(): Promise<number> {
    const snapshot = await getDocs(
      query(collection(this.firestore, 'notifications'), where('status', '==', 'FAILED')),
    );
    return snapshot.size;
  }
}
