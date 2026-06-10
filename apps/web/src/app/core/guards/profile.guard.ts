import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { UserProfileService } from '../services/user-profile.service';

export const profileGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const profileService = inject(UserProfileService);
  const router = inject(Router);
  const user = await firstValueFrom(authService.authState$.pipe(take(1)));

  if (!user) {
    return router.createUrlTree(['/login']);
  }

  const profileResult = await profileService.getProfile(user.uid);

  if (profileResult.status !== 'active') {
    return router.createUrlTree(['/acceso-pendiente'], {
      queryParams: { status: profileResult.status },
    });
  }

  return true;
};
