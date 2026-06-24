import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom, take } from 'rxjs';

import {
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  AppSectionCardComponent,
  AppStatusChipComponent,
  StatusChipVariant,
} from '../../../shared/components';
import { UserRole } from '../../../shared/models';
import { AuthService } from '../../../core/services/auth.service';
import {
  AdminUserEditDialogComponent,
  AdminUserEditResult,
} from '../components/admin-user-edit-dialog/admin-user-edit-dialog.component';
import { AdminLabView, AdminLabsService } from '../services/admin-labs.service';
import {
  AdminPreauthorizedUsersService,
  PreauthorizedUserView,
} from '../services/admin-preauthorized-users.service';
import {
  AdminPreauthorizeUserDialogComponent,
  AdminPreauthorizeUserDialogResult,
} from '../components/admin-preauthorize-user-dialog/admin-preauthorize-user-dialog.component';
import {
  AdminRevokePreauthorizationDialogComponent,
  AdminRevokePreauthorizationDialogResult,
} from '../components/admin-revoke-preauthorization-dialog/admin-revoke-preauthorization-dialog.component';
import {
  AdminUsersService,
  AdminUserView,
} from '../services/admin-users.service';

type ActiveFilter = 'all' | 'active' | 'inactive';
type PreauthorizationStatus = {
  label: string;
  variant: StatusChipVariant;
  icon: string;
};

@Component({
  selector: 'app-admin-users-page',
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
  ],
  template: `
    <section class="app-container grid gap-8">
      <app-page-header
        kicker="Admin/Sistemas"
        title="Usuarios"
        subtitle="Gestiona perfiles institucionales, roles oficiales y laboratorios asignados a responsables."
      />

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <app-info-callout
          variant="info"
          icon="verified_user"
          message="Los docentes con correo tup-dNUMEROS@tecplayacar.edu.mx se registran automaticamente al iniciar sesion. Usa prealta solo para responsables/coordinadores. Los usuarios existentes no se eliminan: para impedir acceso, suspende el perfil."
        />

        <button
          mat-flat-button
          color="primary"
          type="button"
          class="shrink-0"
          (click)="openPreauthorizeDialog()"
        >
          <mat-icon>person_add</mat-icon>
          Agregar responsable
        </button>
      </div>

      <app-section-card icon="filter_list" title="Filtros">
        <div class="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <mat-form-field appearance="outline">
            <mat-label>Buscar usuario</mat-label>
            <input
              matInput
              [(ngModel)]="searchTerm"
              placeholder="Nombre o correo"
            />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Rol</mat-label>
            <mat-select [(ngModel)]="roleFilter">
              <mat-option value="all">Todos</mat-option>
              <mat-option value="docente">Docente</mat-option>
              <mat-option value="responsable_laboratorio">
                Responsable
              </mat-option>
              <mat-option value="admin_sistemas">Admin/Sistemas</mat-option>
            </mat-select>
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
            <mat-label>Laboratorio asignado</mat-label>
            <mat-select [(ngModel)]="labFilter">
              <mat-option value="all">Todos</mat-option>
              @for (lab of labs; track lab.id) {
                <mat-option [value]="lab.id">{{ lab.name }}</mat-option>
              }
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
          message="Cargando usuarios administrativos..."
        />
      } @else {
        <app-section-card
          title="Prealtas administrativas"
          subtitle="Correos institucionales preautorizados, reclamados o revocados."
          icon="how_to_reg"
        >
          @if (preauthorizations.length === 0) {
            <app-info-callout
              variant="info"
              icon="check_circle"
              message="No hay prealtas administrativas registradas."
            />
          } @else {
            <div class="mt-5 grid gap-4 xl:grid-cols-2">
              @for (preauth of preauthorizations; track preauth.email) {
                <article class="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <header class="flex flex-wrap items-start justify-between gap-4">
                    <div class="min-w-0">
                      <p class="app-page-kicker">
                        {{ roleLabel(preauth.role) }}
                      </p>
                      <h2 class="m-0 mt-1 break-words text-lg font-extrabold text-slate-950">
                        {{ preauth.displayName || 'Prealta sin nombre' }}
                      </h2>
                      <p class="m-0 mt-1 break-words text-sm text-slate-600">
                        {{ preauth.email }}
                      </p>
                    </div>

                    <app-status-chip
                      [variant]="preauthorizationStatus(preauth).variant"
                      [icon]="preauthorizationStatus(preauth).icon"
                      [label]="preauthorizationStatus(preauth).label"
                    />
                  </header>

                  <div class="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
                    <div>
                      <span class="font-bold text-violet-700">
                        Laboratorios asignados
                      </span>
                      <p class="m-0 mt-1">
                        {{ assignedLabNamesForIds(preauth.labsAssigned) }}
                      </p>
                    </div>
                    <div>
                      <span class="font-bold text-violet-700">
                        Actualizada
                      </span>
                      <p class="m-0 mt-1">
                        {{ preauthService.formatDate(preauth.updatedDate) }}
                      </p>
                    </div>
                    @if (preauth.claimedByUid) {
                      <div class="sm:col-span-2">
                        <span class="font-bold text-violet-700">
                          Estado
                        </span>
                        <p class="m-0 mt-1">
                          Prealta reclamada. Los cambios posteriores se hacen
                          en usuarios existentes.
                        </p>
                      </div>
                    }
                    @if (preauth.revokedDate) {
                      <div class="sm:col-span-2">
                        <span class="font-bold text-violet-700">
                          Revocada
                        </span>
                        <p class="m-0 mt-1">
                          {{ preauthService.formatDate(preauth.revokedDate) }}
                        </p>
                        @if (preauth.revocationReason) {
                          <p class="m-0 mt-2 text-slate-600">
                            {{ preauth.revocationReason }}
                          </p>
                        }
                      </div>
                    }
                  </div>

                  @if (canRevokePreauthorization(preauth)) {
                    <footer class="flex justify-end">
                      <button
                        mat-stroked-button
                        color="warn"
                        type="button"
                        [disabled]="busyPreauthorizationEmail === preauth.email"
                        (click)="revokePreauthorization(preauth)"
                      >
                        <mat-icon>person_off</mat-icon>
                        Revocar prealta
                      </button>
                    </footer>
                  }
                </article>
              }
            </div>
          }
        </app-section-card>

        <app-section-card
          title="Usuarios existentes"
          subtitle="Perfiles ya vinculados a un UID real de Firebase Auth."
          icon="groups"
        >
          @if (filteredUsers().length === 0) {
            <app-info-callout
              variant="info"
              icon="person_search"
              message="No hay usuarios que coincidan con los filtros actuales."
            />
          } @else {
            <div class="mt-5 grid gap-4 xl:grid-cols-2">
              @for (user of filteredUsers(); track user.uid) {
                <article class="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <header class="flex flex-wrap items-start justify-between gap-4">
                    <div class="min-w-0">
                      <p class="app-page-kicker">{{ roleLabel(user.role) }}</p>
                      <h2 class="m-0 mt-1 break-words text-xl font-extrabold text-slate-950">
                        {{ user.displayName || 'Usuario sin nombre' }}
                      </h2>
                      <p class="m-0 mt-1 break-words text-sm text-slate-600">
                        {{ user.email }}
                      </p>
                    </div>

                    <div class="flex flex-wrap justify-end gap-2">
                      <app-status-chip
                        [variant]="user.active ? 'success' : 'neutral'"
                        [icon]="user.active ? 'check_circle' : 'pause_circle'"
                        [label]="user.active ? 'Activo' : 'Inactivo'"
                      />
                      <app-status-chip
                        [variant]="roleVariant(user.role)"
                        icon="badge"
                        [label]="roleLabel(user.role)"
                      />
                    </div>
                  </header>

                  <div class="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                    <div>
                      <span class="font-bold text-violet-700">
                        Estado de acceso
                      </span>
                      <p class="m-0 mt-1">
                        {{ user.active ? 'Puede iniciar sesion' : 'Acceso suspendido' }}
                      </p>
                    </div>
                    <div>
                      <span class="font-bold text-violet-700">
                        Actualizado
                      </span>
                      <p class="m-0 mt-1">{{ usersService.formatDate(user.updatedDate) }}</p>
                    </div>
                    <div class="md:col-span-2">
                      <span class="font-bold text-violet-700">
                        Laboratorios asignados
                      </span>
                      <p class="m-0 mt-1">
                        {{ assignedLabNames(user) }}
                      </p>
                    </div>
                  </div>

                  <footer class="flex justify-end">
                    <button
                      mat-flat-button
                      color="primary"
                      type="button"
                      [disabled]="busyUid === user.uid"
                      (click)="editUser(user)"
                    >
                      <mat-icon>edit</mat-icon>
                      Editar perfil
                    </button>
                  </footer>
                </article>
              }
            </div>
          }
        </app-section-card>
      }
    </section>
  `,
})
export class AdminUsersPageComponent implements OnInit {
  protected readonly usersService = inject(AdminUsersService);
  protected readonly preauthService = inject(AdminPreauthorizedUsersService);
  private readonly labsService = inject(AdminLabsService);
  private readonly authService = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected users: AdminUserView[] = [];
  protected labs: AdminLabView[] = [];
  protected preauthorizations: PreauthorizedUserView[] = [];
  protected loading = true;
  protected errorMessage = '';
  protected busyUid = '';
  protected busyPreauthorizationEmail = '';
  protected currentUid: string | null = null;
  protected searchTerm = '';
  protected roleFilter: UserRole | 'all' = 'all';
  protected activeFilter: ActiveFilter = 'all';
  protected labFilter = 'all';

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  protected filteredUsers(): AdminUserView[] {
    const search = this.searchTerm.trim().toLowerCase();
    return this.users
      .filter((user) =>
        this.roleFilter === 'all' ? true : user.role === this.roleFilter,
      )
      .filter((user) =>
        this.activeFilter === 'all'
          ? true
          : this.activeFilter === 'active'
            ? user.active
            : !user.active,
      )
      .filter((user) =>
        this.labFilter === 'all'
          ? true
          : user.labsAssigned.includes(this.labFilter),
      )
      .filter((user) =>
        search
          ? [user.displayName, user.email].some((value) =>
              value.toLowerCase().includes(search),
            )
          : true,
      );
  }

  protected roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      docente: 'Docente',
      responsable_laboratorio: 'Responsable de laboratorio',
      admin_sistemas: 'Admin/Sistemas',
    };

    return labels[role];
  }

  protected roleVariant(role: UserRole): StatusChipVariant {
    if (role === 'admin_sistemas') {
      return 'info';
    }

    if (role === 'responsable_laboratorio') {
      return 'warning';
    }

    return 'neutral';
  }

  protected preauthorizationStatus(
    preauthorization: PreauthorizedUserView,
  ): PreauthorizationStatus {
    if (preauthorization.claimedByUid) {
      return {
        label: 'Reclamada',
        variant: 'success',
        icon: 'how_to_reg',
      };
    }

    if (preauthorization.revokedDate || preauthorization.active === false) {
      return {
        label: 'Revocada',
        variant: 'danger',
        icon: 'person_off',
      };
    }

    return {
      label: 'Pendiente',
      variant: 'warning',
      icon: 'pending',
    };
  }

  protected canRevokePreauthorization(
    preauthorization: PreauthorizedUserView,
  ): boolean {
    return (
      !preauthorization.claimedByUid &&
      preauthorization.active !== false &&
      !preauthorization.revokedDate
    );
  }

  protected assignedLabNames(user: AdminUserView): string {
    return this.assignedLabNamesForIds(user.labsAssigned);
  }

  protected assignedLabNamesForIds(labIds: string[]): string {
    if (!labIds.length) {
      return 'Sin laboratorios asignados';
    }

    return labIds
      .map((labId) => this.labs.find((lab) => lab.id === labId)?.name ?? labId)
      .join(', ');
  }

  protected async openPreauthorizeDialog(): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<
          AdminPreauthorizeUserDialogComponent,
          unknown,
          AdminPreauthorizeUserDialogResult
        >(AdminPreauthorizeUserDialogComponent, {
          width: 'min(720px, 94vw)',
          data: { labs: this.labs },
        })
        .afterClosed(),
    );

    if (!result) {
      return;
    }

    this.loading = true;
    this.changeDetector.detectChanges();
    try {
      const response = await this.preauthService.preauthorizeUser(result);
      this.snackBar.open(response.message, 'Cerrar', {
        duration: 4500,
      });
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

  protected async revokePreauthorization(
    preauthorization: PreauthorizedUserView,
  ): Promise<void> {
    if (!this.canRevokePreauthorization(preauthorization)) {
      return;
    }

    const result = await firstValueFrom(
      this.dialog
        .open<
          AdminRevokePreauthorizationDialogComponent,
          unknown,
          AdminRevokePreauthorizationDialogResult
        >(AdminRevokePreauthorizationDialogComponent, {
          width: 'min(640px, 94vw)',
          data: {
            preauthorization,
            labsLabel: this.assignedLabNamesForIds(
              preauthorization.labsAssigned,
            ),
            roleLabel: this.roleLabel(preauthorization.role),
          },
        })
        .afterClosed(),
    );

    if (!result) {
      return;
    }

    this.busyPreauthorizationEmail = preauthorization.email;
    this.changeDetector.detectChanges();
    try {
      const response = await this.preauthService.revokePreauthorizedUser({
        email: preauthorization.email,
        reason: result.reason,
      });
      this.snackBar.open(response.message, 'Cerrar', {
        duration: 4500,
      });
      await this.loadData(false);
    } catch (error) {
      this.snackBar.open(this.toRevokePreauthorizationError(error), 'Cerrar', {
        duration: 6500,
      });
    } finally {
      this.busyPreauthorizationEmail = '';
      this.changeDetector.detectChanges();
    }
  }

  protected async editUser(user: AdminUserView): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<AdminUserEditDialogComponent, unknown, AdminUserEditResult>(
          AdminUserEditDialogComponent,
          {
            width: 'min(720px, 94vw)',
            data: {
              user,
              labs: this.labs,
              currentUid: this.currentUid,
            },
          },
        )
        .afterClosed(),
    );

    if (!result) {
      return;
    }

    this.busyUid = user.uid;
    this.changeDetector.detectChanges();
    try {
      await this.usersService.updateUser({
        uid: user.uid,
        role: result.role,
        active: result.active,
        labsAssigned: result.labsAssigned,
      });
      this.snackBar.open('Usuario actualizado correctamente.', 'Cerrar', {
        duration: 4500,
      });
      await this.loadData(false);
    } catch (error) {
      this.snackBar.open(this.toErrorMessage(error), 'Cerrar', {
        duration: 6500,
      });
    } finally {
      this.busyUid = '';
      this.changeDetector.detectChanges();
    }
  }

  private async loadData(showLoading = true): Promise<void> {
    if (showLoading) {
      this.loading = true;
      this.changeDetector.detectChanges();
    }

    try {
      const currentUser = await firstValueFrom(
        this.authService.authState$.pipe(take(1)),
      );
      this.currentUid = currentUser?.uid ?? null;
      const [users, labs, preauthorizations] = await Promise.all([
        this.usersService.listUsers(),
        this.labsService.listLabs(),
        this.preauthService.listPreauthorizations(),
      ]);
      this.users = users;
      this.labs = labs;
      this.preauthorizations = preauthorizations;
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage = this.toErrorMessage(error);
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  private toRevokePreauthorizationError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.trim();
      if (message && message.toLowerCase() !== 'internal') {
        return message;
      }
    }

    return 'No fue posible revocar la prealta. Intente de nuevo o revise la bitacora tecnica.';
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'No fue posible completar la operación administrativa.';
  }
}
