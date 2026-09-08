import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { provideRouter, Router } from '@angular/router';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { BehaviorSubject } from 'rxjs';

import { AppUser, UserRole } from '../../../shared/models';
import { AuthService } from '../../services/auth.service';
import { UserProfileService } from '../../services/user-profile.service';
import { AppShellComponent } from './app-shell.component';

@Component({ template: '' })
class DestinationComponent {}

describe('Navegación de AppShell', () => {
  const user = { uid: 'qa-user', email: 'qa@tecplayacar.edu.mx' } as User;
  let authState: BehaviorSubject<User | null>;

  async function render(role: UserRole, active = true) {
    authState = new BehaviorSubject<User | null>(user);
    const profile: AppUser = {
      uid: user.uid,
      email: user.email!,
      displayName: 'Usuario de prueba',
      role,
      active,
      labsAssigned: [],
      createdAt: Timestamp.fromMillis(0),
      updatedAt: Timestamp.fromMillis(0),
    };
    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([{ path: '**', component: DestinationComponent }]),
        {
          provide: AuthService,
          useValue: {
            authState$: authState,
            signOut: () => Promise.resolve(),
          },
        },
        {
          provide: UserProfileService,
          useValue: {
            getProfile: () =>
              Promise.resolve({
                status: active ? 'active' : 'inactive',
                profile,
              }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppShellComponent);
    await fixture.whenStable();
    return fixture;
  }

  it.each([
    ['docente', ['Laboratorios', 'Mis reservas']],
    [
      'responsable_laboratorio',
      ['Laboratorios', 'Mis reservas', 'Responsable', 'Reportes'],
    ],
  ] as [UserRole, string[]][])(
    'conserva los enlaces de %s sin Administración',
    async (role, labels) => {
      const fixture = await render(role);
      const nav = (fixture.nativeElement as HTMLElement).querySelector('nav')!;
      expect(
        Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim()),
      ).toEqual(labels);
      expect(nav.textContent).not.toContain('Administración');
    },
  );

  it('agrupa los cuatro destinos y navega indicando la sección activa', async () => {
    const fixture = await render('admin_sistemas');
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const menu = await loader.getHarness(
      MatMenuHarness.with({ selector: '.admin-menu-trigger' }),
    );
    const router = TestBed.inject(Router);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('nav a').length).toBe(4);
    await menu.open();
    const items = await menu.getItems();
    expect(await Promise.all(items.map((item) => item.getText()))).toEqual([
      expect.stringMatching(/Usuarios$/),
      expect.stringMatching(/Laboratorios admin$/),
      expect.stringMatching(/Reglas$/),
      expect.stringMatching(/Bitácora$/),
    ]);
    await items[0].click();
    await fixture.whenStable();
    expect(router.url).toBe('/admin/usuarios');
    expect(await menu.isOpen()).toBe(false);
    expect(
      element
        .querySelector('.admin-menu-trigger')
        ?.classList.contains('active-link'),
    ).toBe(true);
    await router.navigateByUrl('/admin');
    await fixture.whenStable();
    expect(
      element
        .querySelector('.admin-menu-trigger')
        ?.classList.contains('active-link'),
    ).toBe(true);
    await router.navigateByUrl('/reportes');
    await fixture.whenStable();
    expect(
      element
        .querySelector('.admin-menu-trigger')
        ?.classList.contains('active-link'),
    ).toBe(false);
  });

  it('permite abrir Administración desde el menú móvil y cerrar al navegar', async () => {
    const fixture = await render('admin_sistemas');
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const mobile = await loader.getHarness(
      MatMenuHarness.with({ selector: '.mobile-menu-button' }),
    );
    await mobile.open();
    await mobile.clickItem({ text: /Administración$/ }, { text: /Reglas$/ });
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/admin/reglas');
    expect(await mobile.isOpen()).toBe(false);
  });

  it('retira los accesos administrativos al cerrar sesión', async () => {
    const fixture = await render('admin_sistemas');
    authState.next(null);
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.admin-menu-trigger',
      ),
    ).toBeNull();
  });

  it('no muestra Administración para un perfil inactivo', async () => {
    const fixture = await render('admin_sistemas', false);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.admin-menu-trigger',
      ),
    ).toBeNull();
  });
});
