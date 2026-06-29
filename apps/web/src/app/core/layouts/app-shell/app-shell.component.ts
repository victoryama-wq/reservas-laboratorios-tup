import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { User } from 'firebase/auth';
import {
  catchError,
  from,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';

import { AppUser, UserRole } from '../../../shared/models';
import { AuthService } from '../../services/auth.service';
import {
  INSTITUTIONAL_LOGO_ALT,
  INSTITUTIONAL_LOGO_PATH,
} from '../../constants/institutional-assets';
import {
  UserProfileService,
  UserProfileStatus,
} from '../../services/user-profile.service';

type ShellProfileState =
  | { kind: 'signed-out' }
  | { kind: 'loading'; user: User }
  | { kind: 'ready'; user: User; profile: AppUser }
  | { kind: 'unavailable'; user: User; status: UserProfileStatus };

@Component({
  selector: 'app-shell',
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(UserProfileService);
  private readonly router = inject(Router);

  protected readonly systemName = 'Sistema Web de Reservas de Laboratorios';
  protected readonly institutionalLogoPath = INSTITUTIONAL_LOGO_PATH;
  protected readonly institutionalLogoAlt = INSTITUTIONAL_LOGO_ALT;
  protected headerLogoFailed = false;
  protected readonly profileState$ = this.authService.authState$.pipe(
    switchMap((user) => {
      if (!user) {
        return of({ kind: 'signed-out' } as ShellProfileState);
      }

      return from(this.profileService.getProfile(user.uid)).pipe(
        map((result): ShellProfileState => {
          if (
            result.status === 'active' &&
            result.profile &&
            result.profile.uid === user.uid
          ) {
            return { kind: 'ready', user, profile: result.profile };
          }

          return { kind: 'unavailable', user, status: result.status };
        }),
        startWith({ kind: 'loading', user } as ShellProfileState),
        catchError(() =>
          of({ kind: 'unavailable', user, status: 'error' } as ShellProfileState),
        ),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  protected readonly canSeeResponsibleNav$ = this.profileState$.pipe(
    map(
      (state) =>
        state.kind === 'ready' &&
        (state.profile.role === 'responsable_laboratorio' ||
          state.profile.role === 'admin_sistemas'),
    ),
  );
  protected readonly canSeeAdminNav$ = this.profileState$.pipe(
    map(
      (state) =>
        state.kind === 'ready' && state.profile.role === 'admin_sistemas',
    ),
  );

  protected async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/login']);
  }

  protected getInitials(
    displayName: string | undefined,
    email: string | null,
  ): string {
    const source = displayName?.trim() || email || 'TU';
    const words = source
      .replace(/@.*/, '')
      .split(/[\s._-]+/)
      .filter(Boolean);

    return (words[0]?.[0] ?? 'T').concat(words[1]?.[0] ?? 'U').toUpperCase();
  }

  protected getRoleLabel(role: UserRole | undefined): string {
    if (role === 'admin_sistemas') {
      return 'Admin';
    }

    if (role === 'responsable_laboratorio') {
      return 'Responsable';
    }

    if (role === 'docente') {
      return 'Docente';
    }

    return 'Rol no valido';
  }

  protected getUnavailableProfileLabel(status: UserProfileStatus): string {
    if (status === 'missing') {
      return 'Perfil pendiente';
    }

    if (status === 'inactive') {
      return 'Perfil inactivo';
    }

    if (status === 'invalid-role') {
      return 'Rol no valido';
    }

    return 'Perfil en validacion';
  }
}
