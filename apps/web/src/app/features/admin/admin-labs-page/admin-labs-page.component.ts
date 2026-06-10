import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import {
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  AppSectionCardComponent,
  AppStatusChipComponent,
} from '../../../shared/components';
import { AdminLabView, AdminLabsService } from '../services/admin-labs.service';
import { AdminUsersService, AdminUserView } from '../services/admin-users.service';

@Component({
  selector: 'app-admin-labs-page',
  imports: [
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    AppSectionCardComponent,
    AppStatusChipComponent,
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
  template: `
    <section class="app-container grid gap-8">
      <app-page-header
        kicker="Admin/Sistemas"
        title="Laboratorios"
        subtitle="Consulta operativa de laboratorios registrados. La edición completa se implementará en una fase posterior."
      />

      <app-info-callout
        variant="info"
        icon="info"
        message="Esta vista es de solo lectura en Fase 16A. No se muestra calendarId para evitar exposición innecesaria de datos operativos."
      />

      @if (errorMessage) {
        <app-info-callout
          variant="danger"
          icon="error"
          [message]="errorMessage"
        />
      }

      @if (loading) {
        <app-info-callout
          variant="info"
          icon="hourglass_top"
          message="Cargando laboratorios..."
        />
      } @else if (labs.length === 0) {
        <app-info-callout
          variant="info"
          icon="science"
          message="No hay laboratorios registrados."
        />
      } @else {
        <div class="grid gap-4 xl:grid-cols-2">
          @for (lab of labs; track lab.id) {
            <app-section-card>
              <article class="grid gap-5">
                <header class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p class="app-page-kicker">{{ lab.slug }}</p>
                    <h2 class="m-0 mt-1 text-xl font-extrabold text-slate-950">
                      {{ lab.name }}
                    </h2>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <app-status-chip
                      [variant]="lab.active ? 'success' : 'neutral'"
                      [icon]="lab.active ? 'check_circle' : 'pause_circle'"
                      [label]="lab.active ? 'Activo' : 'Inactivo'"
                    />
                    <app-status-chip
                      [variant]="lab.visibleInCatalog ? 'info' : 'neutral'"
                      icon="visibility"
                      [label]="lab.visibleInCatalog ? 'Visible' : 'Oculto'"
                    />
                  </div>
                </header>

                <div class="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <span class="font-bold text-violet-700">
                      Anticipación mínima
                    </span>
                    <p class="m-0 mt-1">
                      {{ lab.minNoticeHours }} h
                    </p>
                  </div>
                  <div>
                    <span class="font-bold text-violet-700">
                      Responsables UID
                    </span>
                    <p class="m-0 mt-1">
                      {{ lab.responsibleUids.length || 0 }}
                    </p>
                  </div>
                  <div class="md:col-span-2">
                    <span class="font-bold text-violet-700">
                      Responsables asignados
                    </span>
                    <p class="m-0 mt-1">
                      {{ responsibleNames(lab) }}
                    </p>
                  </div>
                  <div class="md:col-span-2">
                    <span class="font-bold text-violet-700">
                      Correos responsables
                    </span>
                    <p class="m-0 mt-1">
                      {{ lab.responsibleEmails.length ? lab.responsibleEmails.join(', ') : 'Sin correos configurados' }}
                    </p>
                  </div>
                </div>

                <footer class="flex justify-end">
                  <a
                    mat-stroked-button
                    [routerLink]="['/laboratorios', lab.id]"
                    [attr.aria-label]="'Ver detalle de ' + lab.name"
                  >
                    <mat-icon>visibility</mat-icon>
                    Ver detalle básico
                  </a>
                </footer>
              </article>
            </app-section-card>
          }
        </div>
      }
    </section>
  `,
})
export class AdminLabsPageComponent implements OnInit {
  private readonly labsService = inject(AdminLabsService);
  private readonly usersService = inject(AdminUsersService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected labs: AdminLabView[] = [];
  protected users: AdminUserView[] = [];
  protected loading = true;
  protected errorMessage = '';

  async ngOnInit(): Promise<void> {
    try {
      const [labs, users] = await Promise.all([
        this.labsService.listLabs(),
        this.usersService.listUsers(),
      ]);
      this.labs = labs;
      this.users = users;
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'No fue posible cargar laboratorios administrativos.';
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  protected responsibleNames(lab: AdminLabView): string {
    const names = lab.responsibleUids
      .map((uid) => this.users.find((user) => user.uid === uid))
      .filter((user): user is AdminUserView => Boolean(user))
      .map((user) => user.displayName || user.email);

    if (names.length) {
      return names.join(', ');
    }

    return lab.responsibleUids.length
      ? lab.responsibleUids.join(', ')
      : 'Sin responsables asignados';
  }
}
