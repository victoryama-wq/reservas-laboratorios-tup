import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { from, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { UserProfileService } from '../../services/user-profile.service';

@Component({
  selector: 'app-shell',
  imports: [
    AsyncPipe,
    MatButtonModule,
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
  protected readonly user$ = this.authService.authState$;
  protected readonly profile$ = this.user$.pipe(
    switchMap((user) =>
      user ? from(this.profileService.getProfile(user.uid)) : of(null),
    ),
  );
  protected readonly canSeeResponsibleNav$ = this.profile$.pipe(
    map(
      (result) =>
        result?.status === 'active' &&
        (result.profile?.role === 'responsable_laboratorio' ||
          result.profile?.role === 'admin_sistemas'),
    ),
  );
  protected readonly canSeeAdminNav$ = this.profile$.pipe(
    map(
      (result) =>
        result?.status === 'active' && result.profile?.role === 'admin_sistemas',
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

  protected getRoleLabel(role: string | undefined): string {
    if (role === 'admin_sistemas') {
      return 'Admin';
    }

    if (role === 'responsable_laboratorio') {
      return 'Responsable';
    }

    return 'Docente';
  }
}
