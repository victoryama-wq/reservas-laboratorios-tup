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
                </div>

                <footer class="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
    return error instanceof Error
      ? error.message
      : 'No fue posible completar la operacion administrativa.';
  }
}
