import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await firstValueFrom(authService.authState$.pipe(take(1)));

  if (!user) {
    authService.setRedirectUrl(state.url);
    return router.createUrlTree(['/login']);
  }

  if (!authService.validateInstitutionalEmail(user.email)) {
    await authService.signOut();
    authService.setRedirectUrl(state.url);
    return router.createUrlTree(['/login'], {
      queryParams: { error: 'dominio' },
    });
  }

  return true;
};
