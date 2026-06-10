import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';

import { UserRole } from '../../shared/models';
import { AuthService } from '../services/auth.service';
import { UserProfileService } from '../services/user-profile.service';

export const roleGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const profileService = inject(UserProfileService);
  const router = inject(Router);
  const allowedRoles = (route.data['roles'] ?? []) as UserRole[];
  const user = await firstValueFrom(authService.authState$.pipe(take(1)));

  if (!user) {
    return router.createUrlTree(['/login']);
  }

  const profileResult = await profileService.getProfile(user.uid);

  if (profileResult.status !== 'active' || !profileResult.profile) {
    return router.createUrlTree(['/acceso-pendiente'], {
      queryParams: { status: profileResult.status },
    });
  }

  if (!allowedRoles.includes(profileResult.profile.role)) {
    return router.createUrlTree([getDefaultRouteByRole(profileResult.profile.role)]);
  }

  return true;
};

function getDefaultRouteByRole(role: UserRole): string {
  if (role === 'admin_sistemas') {
    return '/admin/dashboard';
  }

  if (role === 'responsable_laboratorio') {
    return '/responsable/solicitudes';
  }

  return '/laboratorios';
}
