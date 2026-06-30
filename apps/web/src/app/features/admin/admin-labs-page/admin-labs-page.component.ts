import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  AppSectionCardComponent,
  AppStatusChipComponent,
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../../shared/components';
import {
  AdminLabEditDialogComponent,
  AdminLabEditDialogResult,
} from '../components/admin-lab-edit-dialog/admin-lab-edit-dialog.component';
import {
  AdminCreateLabInput,
  AdminLabView,
  AdminLabsService,
  AdminUpdateLabInput,
} from '../services/admin-labs.service';
import { AdminUsersService, AdminUserView } from '../services/admin-users.service';

type ActiveFilter = 'all' | 'active' | 'inactive';
type VisibilityFilter = 'all' | 'visible' | 'hidden';

@Component({
  selector: 'app-admin-labs-page',
  imports: [
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    AppSectionCardComponent,
    AppStatusChipComponent,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    RouterLink,
  ],
  template: `
    <section class="app-container grid gap-8">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <app-page-header
          kicker="Admin/Sistemas"
          title="Laboratorios"
          subtitle="Crea, edita y configura espacios reservables, responsables, horarios base y calendario operativo."
        />

        <button
          mat-flat-button
          color="primary"
          type="button"
          class="shrink-0"
          (click)="openCreateDialog()"
        >
          <mat-icon>add_business</mat-icon>
          Nuevo laboratorio
        </button>
      </div>

      <app-info-callout
        variant="info"
        icon="event"
        message="calendarId es visible solo para Admin/Sistemas. No se muestra al docente ni en el catalogo publico."
      />

      <app-section-card icon="filter_list" title="Filtros">
        <div class="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr]">
          <mat-form-field appearance="outline">
            <mat-label>Buscar laboratorio</mat-label>
            <input
              matInput
              [(ngModel)]="searchTerm"
              placeholder="Nombre, slug o descripcion"
            />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select [(ngModel)]="activeFilter">
              <mat-option value="all">Todos</mat-option>
              <mat-option value="active">Activos</mat-option>
              <mat-option value="inactive">Inactivos</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Catalogo</mat-label>
            <mat-select [(ngModel)]="visibilityFilter">
              <mat-option value="all">Todos</mat-option>
              <mat-option value="visible">Visibles</mat-option>
              <mat-option value="hidden">Ocultos</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </app-section-card>

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
      } @else if (filteredLabs().length === 0) {
        <app-info-callout
          variant="info"
          icon="search_off"
          message="No hay laboratorios que coincidan con los filtros."
        />
      } @else {
        <div class="grid gap-4 xl:grid-cols-2">
          @for (lab of filteredLabs(); track lab.id) {
            <app-section-card>
              <article class="grid h-full gap-5">
                <header class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="app-page-kicker">{{ lab.slug }}</p>
                    <h2 class="m-0 mt-1 break-words text-xl font-extrabold text-slate-950">
                      {{ lab.name }}
                    </h2>
                    <p class="m-0 mt-2 text-sm leading-6 text-slate-600">
                      {{ lab.shortDescription || lab.description }}
                    </p>
                  </div>

                  <div class="flex flex-wrap justify-end gap-2">
                    <app-status-chip
                      [variant]="lab.active ? 'success' : 'neutral'"
                      [icon]="lab.active ? 'check_circle' : 'pause_circle'"
                      [label]="lab.active ? 'Activo' : 'Inactivo'"
                    />
                    <app-status-chip
                      [variant]="lab.visibleInCatalog ? 'info' : 'neutral'"
                      [icon]="lab.visibleInCatalog ? 'visibility' : 'visibility_off'"
                      [label]="lab.visibleInCatalog ? 'Visible' : 'Oculto'"
                    />
                  </div>
                </header>

                <div class="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <span class="font-bold uppercase tracking-wide text-violet-700">
                      Anticipacion minima
                    </span>
                    <p class="m-0 mt-1">{{ lab.minNoticeHours }} h</p>
                  </div>

                  <div>
                    <span class="font-bold uppercase tracking-wide text-violet-700">
                      Ruta QR
                    </span>
                    <p class="m-0 mt-1 break-all">{{ lab.qrPath }}</p>
                  </div>

                  <div class="md:col-span-2">
                    <span class="font-bold uppercase tracking-wide text-violet-700">
                      calendarId
                    </span>
                    <p class="m-0 mt-1 break-all">
                      {{ lab.calendarId || 'Sin calendarId configurado' }}
                    </p>
                  </div>

                  <div class="md:col-span-2">
                    <span class="font-bold uppercase tracking-wide text-violet-700">
                      Responsables asignados
                    </span>
                    <p class="m-0 mt-1">{{ responsibleNames(lab) }}</p>
                  </div>

                  <div class="md:col-span-2">
                    <span class="font-bold uppercase tracking-wide text-violet-700">
                      Correos de notificacion
                    </span>
                    <p class="m-0 mt-1">
                      {{ emailSummary(lab.defaultNotifyEmails) }}
                    </p>
                  </div>

                  <div class="md:col-span-2">
                    <span class="font-bold uppercase tracking-wide text-violet-700">
                      Reglas especiales
                    </span>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <app-status-chip
                        [variant]="activeSpecialRulesCount(lab) > 0 ? 'warning' : 'neutral'"
                        icon="rule"
                        [label]="specialRulesSummary(lab)"
                      />
                      @if (inactiveSpecialRulesCount(lab) > 0) {
                        <app-status-chip
                          variant="neutral"
                          icon="pause_circle"
                          [label]="inactiveSpecialRulesCount(lab) + ' inactiva(s)'"
                        />
                      }
                    </div>
                  </div>
                </div>

                <footer class="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <a
                    mat-stroked-button
                    [routerLink]="['/admin/reglas']"
                    [queryParams]="{ labId: lab.id }"
                    [attr.aria-label]="'Gestionar reglas de ' + lab.name"
                  >
                    <mat-icon>rule</mat-icon>
                    Gestionar reglas
                  </a>
                  <a
                    mat-stroked-button
                    [routerLink]="['/laboratorios', lab.id]"
                    [attr.aria-label]="'Ver detalle de ' + lab.name"
                  >
                    <mat-icon>visibility</mat-icon>
                    Ver detalle
                  </a>
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    [disabled]="busyLabId === lab.id"
                    (click)="openEditDialog(lab)"
                  >
                    <mat-icon>edit</mat-icon>
                    Editar
                  </button>
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
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected labs: AdminLabView[] = [];
  protected users: AdminUserView[] = [];
  protected loading = true;
  protected errorMessage = '';
  protected busyLabId = '';
  protected searchTerm = '';
  protected activeFilter: ActiveFilter = 'all';
  protected visibilityFilter: VisibilityFilter = 'all';

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  protected filteredLabs(): AdminLabView[] {
    const search = this.searchTerm.trim().toLowerCase();
    return this.labs
      .filter((lab) =>
        this.activeFilter === 'all'
          ? true
          : this.activeFilter === 'active'
            ? lab.active
            : !lab.active,
      )
      .filter((lab) =>
        this.visibilityFilter === 'all'
          ? true
          : this.visibilityFilter === 'visible'
            ? lab.visibleInCatalog
            : !lab.visibleInCatalog,
      )
      .filter((lab) =>
        search
          ? [
              lab.name,
              lab.slug,
              lab.description,
              lab.shortDescription ?? '',
              lab.location ?? '',
            ].some((value) => value.toLowerCase().includes(search))
          : true,
      );
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

  protected emailSummary(emails: string[]): string {
    return emails.length ? emails.join(', ') : 'Sin correos configurados';
  }

  protected activeSpecialRulesCount(lab: AdminLabView): number {
    return (lab.specialRules ?? []).filter((rule) => rule.active).length;
  }

  protected inactiveSpecialRulesCount(lab: AdminLabView): number {
    return (lab.specialRules ?? []).filter((rule) => !rule.active).length;
  }

  protected specialRulesSummary(lab: AdminLabView): string {
    const activeCount = this.activeSpecialRulesCount(lab);

    if (activeCount === 0) {
      return 'Sin reglas especiales activas';
    }

    return activeCount === 1
      ? '1 regla especial activa'
      : `${activeCount} reglas especiales activas`;
  }

  protected async openCreateDialog(): Promise<void> {
    const result = await this.openLabDialog('create');
    if (!result) {
      return;
    }

    this.loading = true;
    this.changeDetector.detectChanges();
    try {
      const response = await this.labsService.createLab(
        result as AdminCreateLabInput,
      );
      this.snackBar.open(response.message, 'Cerrar', { duration: 4500 });
      await this.loadData(false);
    } catch (error) {
      this.snackBar.open(this.toErrorMessage(error), 'Cerrar', {
        duration: 6500,
      });
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  protected async openEditDialog(lab: AdminLabView): Promise<void> {
    const result = await this.openLabDialog('edit', lab);
    if (!result) {
      return;
    }

    this.busyLabId = lab.id;
    this.changeDetector.detectChanges();
    try {
      const importantChanges = this.importantChangeMessages(
        lab,
        result as AdminUpdateLabInput,
      );
      if (importantChanges.length > 0) {
        const confirmed = await this.confirmImportantChanges(importantChanges);
        if (!confirmed) {
          return;
        }
      }

      const response = await this.labsService.updateLab({
        ...(result as AdminUpdateLabInput),
        labId: lab.id,
      });
      this.snackBar.open(response.message, 'Cerrar', { duration: 4500 });
      await this.loadData(false);
    } catch (error) {
      this.snackBar.open(this.toErrorMessage(error), 'Cerrar', {
        duration: 6500,
      });
    } finally {
      this.busyLabId = '';
      this.changeDetector.detectChanges();
    }
  }

  private async openLabDialog(
    mode: 'create' | 'edit',
    lab?: AdminLabView,
  ): Promise<AdminLabEditDialogResult | undefined> {
    return firstValueFrom(
      this.dialog
        .open<
          AdminLabEditDialogComponent,
          unknown,
          AdminLabEditDialogResult
        >(AdminLabEditDialogComponent, {
          width: 'min(1120px, calc(100vw - 32px))',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
          panelClass: 'admin-lab-dialog-panel',
          data: {
            mode,
            lab,
            responsibleCandidates: this.responsibleCandidates(),
          },
        })
        .afterClosed(),
    );
  }

  private responsibleCandidates(): AdminUserView[] {
    return this.users.filter((user) =>
      user.role === 'responsable_laboratorio' ||
      user.role === 'admin_sistemas',
    );
  }

  private async loadData(showLoading = true): Promise<void> {
    if (showLoading) {
      this.loading = true;
      this.changeDetector.detectChanges();
    }

    try {
      const [labs, users] = await Promise.all([
        this.labsService.listLabs(),
        this.usersService.listUsers(),
      ]);
      this.labs = labs;
      this.users = users;
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage = this.toErrorMessage(error);
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  private toErrorMessage(error: unknown): string {
    const code = this.errorCode(error);
    const backendMessage = error instanceof Error ? error.message : '';

    if (code.includes('permission-denied')) {
      return 'No tienes permisos para realizar esta accion.';
    }

    if (code.includes('invalid-argument') && backendMessage) {
      return backendMessage;
    }

    if (code.includes('failed-precondition')) {
      return backendMessage ||
        'No se cumple una condicion necesaria para guardar el laboratorio.';
    }

    if (code.includes('unavailable')) {
      return 'El servicio no esta disponible temporalmente. Intenta nuevamente.';
    }

    if (code.includes('internal')) {
      return 'Ocurrio un error tecnico. Contacta a Sistemas.';
    }

    return backendMessage || 'No fue posible completar la operacion administrativa.';
  }

  private errorCode(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      return String((error as { code?: unknown }).code ?? '').toLowerCase();
    }

    return '';
  }

  private importantChangeMessages(
    lab: AdminLabView,
    update: AdminUpdateLabInput,
  ): string[] {
    const messages: string[] = [];

    if (update.slug && update.slug !== lab.slug) {
      messages.push(
        'Cambiar el slug modifica la URL del QR. Los QR impresos anteriormente pueden quedar obsoletos.',
      );
    }

    if (update.calendarId !== undefined && update.calendarId !== lab.calendarId) {
      messages.push(
        'Cambiar el calendario puede afectar la sincronizacion de futuras reservas.',
      );
    }

    if (update.active === false && lab.active) {
      messages.push('Desactivar este laboratorio impedira nuevas reservas.');
    }

    if (update.visibleInCatalog === false && lab.visibleInCatalog) {
      messages.push(
        'Ocultar del catalogo impedira que docentes lo vean como opcion.',
      );
    }

    if (
      update.responsibleUids !== undefined &&
      !sameStringSet(update.responsibleUids, lab.responsibleUids)
    ) {
      messages.push(
        'Cambiar responsables actualizara automaticamente los laboratorios asignados en sus perfiles.',
      );
    }

    if (
      update.weeklySchedule !== undefined &&
      stableStringify(update.weeklySchedule) !== stableStringify(lab.weeklySchedule)
    ) {
      messages.push(
        'Cambiar el horario afecta futuras reservas, no modifica reservas existentes.',
      );
    }

    if (
      update.gallery !== undefined &&
      activeGalleryCount(update.gallery) < activeGalleryCount(lab.gallery ?? [])
    ) {
      messages.push(
        'Desactivar imagenes activas puede cambiar la presentacion visual del laboratorio.',
      );
    }

    return messages;
  }

  private async confirmImportantChanges(messages: string[]): Promise<boolean> {
    return Boolean(
      await firstValueFrom(
        this.dialog
          .open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
            ConfirmationDialogComponent,
            {
              width: 'min(520px, calc(100vw - 32px))',
              panelClass: 'app-confirmation-dialog-panel',
              data: {
                title: 'Confirmar cambios importantes',
                message: messages.join('\n\n'),
                confirmLabel: 'Guardar cambios',
                cancelLabel: 'Revisar',
                icon: 'warning',
                variant: 'primary',
              },
            },
          )
          .afterClosed(),
      ),
    );
  }
}

function sameStringSet(first: string[], second: string[]): boolean {
  return stableStringify([...new Set(first)].sort()) ===
    stableStringify([...new Set(second)].sort());
}

function activeGalleryCount(gallery: { active: boolean }[]): number {
  return gallery.filter((image) => image.active).length;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForComparison(value));
}

function normalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForComparison(entry));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const normalized = normalizeForComparison(
          (value as Record<string, unknown>)[key],
        );
        if (normalized !== undefined) {
          accumulator[key] = normalized;
        }
        return accumulator;
      }, {});
  }

  return value;
}
