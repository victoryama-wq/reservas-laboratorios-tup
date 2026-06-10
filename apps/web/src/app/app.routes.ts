import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { profileGuard } from './core/guards/profile.guard';
import { roleGuard } from './core/guards/role.guard';
import { AdminReportsPageComponent } from './features/admin/admin-reports-page/admin-reports-page.component';
import { AdminRulesPageComponent } from './features/admin/admin-rules-page/admin-rules-page.component';
import { AccessPendingComponent } from './features/auth/access-pending/access-pending.component';
import { LoginComponent } from './features/auth/login/login.component';
import { HomePageComponent } from './features/home/home-page/home-page.component';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
    title: 'Inicio',
    canActivate: [authGuard, profileGuard],
  },
  { path: 'login', component: LoginComponent, title: 'Login' },
  {
    path: 'acceso-pendiente',
    component: AccessPendingComponent,
    title: 'Acceso pendiente',
    canActivate: [authGuard],
  },
  {
    path: 'laboratorios',
    loadComponent: () =>
      import('./features/labs/lab-list/lab-list.component').then(
        (component) => component.LabListComponent,
      ),
    title: 'Laboratorios',
    canActivate: [authGuard, profileGuard],
  },
  {
    path: 'laboratorios/:labId',
    loadComponent: () =>
      import('./features/labs/lab-detail/lab-detail.component').then(
        (component) => component.LabDetailComponent,
      ),
    title: 'Detalle de laboratorio',
    canActivate: [authGuard, profileGuard],
  },
  {
    path: 'reservar/:labSlug',
    loadComponent: () =>
      import(
        './features/reservations/reserve-lab-page/reserve-lab-page.component'
      ).then((component) => component.ReserveLabPageComponent),
    title: 'Reservar laboratorio',
    canActivate: [authGuard, profileGuard],
  },
  {
    path: 'mis-reservas',
    loadComponent: () =>
      import(
        './features/reservations/my-reservations-page/my-reservations-page.component'
      ).then((component) => component.MyReservationsPageComponent),
    title: 'Mis reservas',
    canActivate: [authGuard, profileGuard],
  },
  {
    path: 'mis-reservas/:reservationId',
    loadComponent: () =>
      import(
        './features/reservations/my-reservation-detail-page/my-reservation-detail-page.component'
      ).then((component) => component.MyReservationDetailPageComponent),
    title: 'Detalle de mi reserva',
    canActivate: [authGuard, profileGuard],
  },
  {
    path: 'responsable/solicitudes',
    loadComponent: () =>
      import(
        './features/responsible/responsible-requests-page/responsible-requests-page.component'
      ).then((component) => component.ResponsibleRequestsPageComponent),
    title: 'Solicitudes',
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { roles: ['responsable_laboratorio', 'admin_sistemas'] },
  },
  {
    path: 'responsable/historial',
    loadComponent: () =>
      import(
        './features/responsible/responsible-history-page/responsible-history-page.component'
      ).then((component) => component.ResponsibleHistoryPageComponent),
    title: 'Historial',
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { roles: ['responsable_laboratorio', 'admin_sistemas'] },
  },
  {
    path: 'responsable/reserva/:reservationId',
    loadComponent: () =>
      import(
        './features/responsible/responsible-reservation-detail-page/responsible-reservation-detail-page.component'
      ).then(
        (component) => component.ResponsibleReservationDetailPageComponent,
      ),
    title: 'Detalle de reserva',
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { roles: ['responsable_laboratorio', 'admin_sistemas'] },
  },
  {
    path: 'admin/dashboard',
    loadComponent: () =>
      import(
        './features/admin/admin-dashboard-page/admin-dashboard-page.component'
      ).then((component) => component.AdminDashboardPageComponent),
    title: 'Dashboard',
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { roles: ['admin_sistemas'] },
  },
  {
    path: 'admin/laboratorios',
    loadComponent: () =>
      import('./features/admin/admin-labs-page/admin-labs-page.component').then(
        (component) => component.AdminLabsPageComponent,
      ),
    title: 'Administrar laboratorios',
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { roles: ['admin_sistemas'] },
  },
  {
    path: 'admin/usuarios',
    loadComponent: () =>
      import(
        './features/admin/admin-users-page/admin-users-page.component'
      ).then((component) => component.AdminUsersPageComponent),
    title: 'Administrar usuarios',
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { roles: ['admin_sistemas'] },
  },
  {
    path: 'admin/reglas',
    component: AdminRulesPageComponent,
    title: 'Administrar reglas',
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { roles: ['admin_sistemas'] },
  },
  {
    path: 'admin/reportes',
    component: AdminReportsPageComponent,
    title: 'Reportes',
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { roles: ['admin_sistemas'] },
  },
  {
    path: 'admin/bitacora',
    loadComponent: () =>
      import(
        './features/admin/admin-audit-page/admin-audit-page.component'
      ).then((component) => component.AdminAuditPageComponent),
    title: 'Bitacora',
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { roles: ['admin_sistemas'] },
  },
  { path: '**', redirectTo: '' },
];
