import { inject, Injectable } from '@angular/core';
import {
  Auth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  browserSessionPersistence,
  User,
} from 'firebase/auth';
import { firstValueFrom, map, Observable, shareReplay, take } from 'rxjs';

import { FIREBASE_AUTH } from '../firebase/firebase.providers';

const INSTITUTIONAL_DOMAIN = '@tecplayacar.edu.mx';
const REDIRECT_URL_KEY = 'reservas-laboratorios.redirectUrl';
const LOGIN_REDIRECT_PENDING_KEY = 'reservas-laboratorios.loginRedirectPending';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);

  readonly authState$: Observable<User | null> = new Observable<User | null>(
    (subscriber) =>
      onAuthStateChanged(
        this.auth,
        (user) => subscriber.next(user),
        (error) => subscriber.error(error),
      ),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  async signInWithGoogle(): Promise<void> {
    const provider = this.createGoogleProvider();

    await setPersistence(this.auth, browserSessionPersistence);
    window.sessionStorage.setItem(LOGIN_REDIRECT_PENDING_KEY, 'true');
    await signInWithRedirect(this.auth, provider);
  }

  async signInWithGooglePopup(): Promise<User> {
    await setPersistence(this.auth, browserSessionPersistence);

    const credential = await this.withRequiredResult(
      signInWithPopup(this.auth, this.createGoogleProvider()),
      30000,
      'El inicio de sesion con Google tardo demasiado. Intente de nuevo o pruebe con redireccion.',
    );
    const user = credential.user;

    if (!this.validateInstitutionalEmail(user.email)) {
      await this.signOut();
      throw new Error(
        'Solo se permite ingresar con correo institucional @tecplayacar.edu.mx.',
      );
    }

    return user;
  }

  async handleGoogleRedirectResult(): Promise<User | null> {
    const credential = await this.withTimeout(getRedirectResult(this.auth), 5000);
    const user =
      credential?.user ??
      this.currentUser() ??
      (await firstValueFrom(this.authState$.pipe(take(1))));

    if (!user) {
      return null;
    }

    if (!this.validateInstitutionalEmail(user.email)) {
      await this.signOut();
      throw new Error(
        'Solo se permite ingresar con correo institucional @tecplayacar.edu.mx.',
      );
    }

    return user;
  }

  waitForAuthenticatedUser(timeoutMs = 5000): Promise<User | null> {
    if (this.currentUser()) {
      return Promise.resolve(this.currentUser());
    }

    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        unsubscribe();
        resolve(this.currentUser());
      }, timeoutMs);

      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        if (!user) {
          return;
        }

        window.clearTimeout(timeoutId);
        unsubscribe();
        resolve(user);
      });
    });
  }

  consumeLoginRedirectPending(): boolean {
    const pending =
      window.sessionStorage.getItem(LOGIN_REDIRECT_PENDING_KEY) === 'true';
    window.sessionStorage.removeItem(LOGIN_REDIRECT_PENDING_KEY);
    return pending;
  }

  signOut(): Promise<void> {
    this.clearRedirectUrl();
    return firebaseSignOut(this.auth);
  }

  currentUser(): User | null {
    return this.auth.currentUser;
  }

  isAuthenticated(): Observable<boolean> {
    return this.authState$.pipe(map((user) => user !== null));
  }

  validateInstitutionalEmail(email: string | null | undefined): boolean {
    return email?.toLowerCase().endsWith(INSTITUTIONAL_DOMAIN) ?? false;
  }

  getRedirectUrl(): string | null {
    return window.sessionStorage.getItem(REDIRECT_URL_KEY);
  }

  setRedirectUrl(url: string): void {
    window.sessionStorage.setItem(REDIRECT_URL_KEY, url);
  }

  clearRedirectUrl(): void {
    window.sessionStorage.removeItem(REDIRECT_URL_KEY);
  }

  private withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => resolve(null), timeoutMs);

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

  private withRequiredResult<T>(
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

  private createGoogleProvider(): GoogleAuthProvider {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'tecplayacar.edu.mx' });
    return provider;
  }
}
