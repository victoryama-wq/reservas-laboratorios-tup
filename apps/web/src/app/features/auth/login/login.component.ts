import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';

import { UserRole } from '../../../shared/models';
import { AuthService } from '../../../core/services/auth.service';
import { UserProfileService } from '../../../core/services/user-profile.service';

@Component({
  selector: 'app-login',
  imports: [MatButtonModule, MatCardModule, MatProgressSpinnerModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(UserProfileService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected loading = false;
  protected errorMessage = this.getInitialErrorMessage();
  protected showRedirectFallback = false;
  protected loginMode: 'popup' | 'redirect' | 'profile' | null = null;

  ngOnInit(): void {
    void this.completeRedirectLogin();
  }

  async signInWithGoogle(): Promise<void> {
    this.loading = true;
    this.loginMode = 'popup';
    this.errorMessage = '';
    this.showRedirectFallback = false;

    try {
      const user = await this.authService.signInWithGooglePopup();
      this.loginMode = 'profile';
      await this.completeLoginForUser(user.uid);
    } catch (error) {
      this.errorMessage = this.getReadableError(error);
      this.showRedirectFallback = true;
      this.loading = false;
      this.loginMode = null;
    }
  }

  async signInWithGoogleRedirect(): Promise<void> {
    this.loading = true;
    this.loginMode = 'redirect';
    this.errorMessage = '';
    this.showRedirectFallback = false;

    try {
      void this.authService.signInWithGoogle();

      window.setTimeout(() => {
        if (!this.loading) {
          return;
        }

        this.errorMessage =
          'No se pudo iniciar la redireccion a Google. Pruebe Chrome o desactive Brave Shields para localhost.';
        this.loading = false;
        this.loginMode = null;
        this.showRedirectFallback = true;
      }, 10000);
    } catch (error) {
      this.errorMessage = this.getReadableError(error);
      this.showRedirectFallback = true;
      this.loading = false;
      this.loginMode = null;
    }
  }

  protected loadingText(): string {
    if (this.loginMode === 'profile') {
      return 'Validando perfil...';
    }

    if (this.loginMode === 'redirect') {
      return 'Redirigiendo a Google...';
    }

    return 'Abriendo Google...';
  }

  private async completeRedirectLogin(): Promise<void> {
    const redirectWasPending = this.authService.consumeLoginRedirectPending();

    try {
      if (!redirectWasPending) {
        const existingUser =
          this.authService.currentUser() ??
          (await this.authService.waitForAuthenticatedUser(1200));

        if (!existingUser) {
          return;
        }

        this.loading = true;
        this.loginMode = 'profile';
        await this.completeLoginForUser(
          existingUser.uid,
          6000,
          'Hay una sesion previa, pero no fue posible validar el perfil institucional. Intente ingresar de nuevo.',
        );
        return;
      }

      this.loading = true;
      this.loginMode = 'redirect';
      let user = await this.authService.handleGoogleRedirectResult();

      if (!user) {
        user = await this.authService.waitForAuthenticatedUser();
      }

      if (!user) {
        this.errorMessage =
          'Google devolvio el control a la app, pero Firebase no pudo restaurar la sesion. Pruebe desactivar Brave Shields para localhost o use Chrome. Tambien verifique que Google Sign-In este habilitado.';
        this.loading = false;
        this.loginMode = null;
        return;
      }

      this.loginMode = 'profile';
      await this.completeLoginForUser(user.uid);
    } catch (error) {
      this.errorMessage = this.getReadableError(error);
      this.loading = false;
      this.loginMode = null;
    }
  }

  private async completeLoginForUser(
    uid: string,
    timeoutMs = 15000,
    timeoutMessage =
      'No fue posible validar el perfil institucional. Revise la conexion con Firestore e intente nuevamente.',
  ): Promise<void> {
    let profileResult = await this.withTimeout(
      this.profileService.getProfile(uid),
      timeoutMs,
      timeoutMessage,
    );

    if (profileResult.status === 'missing') {
      const ensureResult = await this.withTimeout(
        this.profileService.ensureUserProfile(),
        timeoutMs,
        timeoutMessage,
      );

      if (ensureResult.status === 'PENDING_ACCESS') {
        await this.router.navigate(['/acceso-pendiente'], {
          queryParams: { status: 'pending-access' },
        });
        return;
      }

      profileResult = await this.withTimeout(
        this.profileService.getProfile(uid),
        timeoutMs,
        timeoutMessage,
      );
    }

    if (profileResult.status !== 'active' || !profileResult.profile) {
      await this.router.navigate(['/acceso-pendiente'], {
        queryParams: { status: profileResult.status },
      });
      return;
    }

    const redirectUrl =
      this.authService.getRedirectUrl() ??
      this.getDefaultRouteByRole(profileResult.profile.role);

    this.authService.clearRedirectUrl();
    await this.router.navigateByUrl(redirectUrl);
  }

  private withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(
        () => reject(new Error(timeoutMessage)),
        timeoutMs,
      );

      operation
        .then((result) => {
          window.clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          window.clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private getDefaultRouteByRole(role: UserRole): string {
    if (role === 'admin_sistemas') {
      return '/admin/dashboard';
    }

    if (role === 'responsable_laboratorio') {
      return '/responsable/solicitudes';
    }

    return '/laboratorios';
  }

  private getInitialErrorMessage(): string {
    return this.route.snapshot.queryParamMap.get('error') === 'dominio'
      ? 'Solo se permite ingresar con correo institucional @tecplayacar.edu.mx.'
      : '';
  }

  private getReadableError(error: unknown): string {
    const errorCode = (error as { code?: string }).code;

    if (errorCode === 'auth/unauthorized-domain') {
      return 'El dominio local no esta autorizado en Firebase Authentication. Agregue localhost en Authorized domains.';
    }

    if (errorCode === 'auth/redirect-cancelled-by-user') {
      return 'El inicio de sesion fue cancelado antes de completarse.';
    }

    if (errorCode === 'auth/popup-closed-by-user') {
      return 'La ventana de Google se cerro antes de completar el inicio de sesion.';
    }

    if (errorCode === 'auth/popup-blocked') {
      return 'El navegador bloqueo la ventana de Google. Permita ventanas emergentes o pruebe con redireccion.';
    }

    if (errorCode === 'auth/operation-not-allowed') {
      return 'Google Sign-In no esta habilitado en Firebase Authentication para este proyecto.';
    }

    if (errorCode === 'auth/network-request-failed') {
      return 'No fue posible conectar con Firebase Auth. Revise su conexion e intente nuevamente.';
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'No fue posible iniciar sesion. Intente nuevamente.';
  }
}
