import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import {
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  AppSectionCardComponent,
  AppStatusChipComponent,
} from '../../../shared/components';
import {
  AdminBlockedPeriodDialogComponent,
  AdminBlockedPeriodDialogResult,
} from '../components/admin-blocked-period-dialog/admin-blocked-period-dialog.component';
import {
  AdminSpecialRuleDialogComponent,
  AdminSpecialRuleDialogResult,
} from '../components/admin-special-rule-dialog/admin-special-rule-dialog.component';
import { AdminLabView } from '../services/admin-labs.service';
import {
  AdminBlockedPeriodView,
  AdminCreateBlockedPeriodInput,
  AdminCreateSpecialRuleInput,
  AdminRulesService,
  AdminSpecialRuleView,
  AdminUpdateBlockedPeriodInput,
  AdminUpdateSpecialRuleInput,
} from '../services/admin-rules.service';

type BlockedPeriodFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-admin-rules-page',
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
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
  ],
  template: `
    <section class="app-container grid gap-8">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <app-page-header
          kicker="Admin/Sistemas"
          title="Reglas y bloqueos"
          subtitle="Configura excepciones operativas que se validan antes de crear o aprobar reservas."
        />

        <div class="flex flex-col gap-3 sm:flex-row lg:shrink-0">
          <button
            mat-stroked-button
            type="button"
            (click)="openBlockedPeriodDialog('create')"
          >
            <mat-icon>event_busy</mat-icon>
            Nuevo bloqueo
          </button>
          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="labs.length === 0"
            (click)="openSpecialRuleDialog('create')"
          >
            <mat-icon>rule</mat-icon>
            Nueva regla
          </button>
        </div>
      </div>

      <app-info-callout
        variant="info"
        icon="verified_user"
        message="El frontend solo administra configuracion. La validacion critica ocurre en Cloud Functions al crear o aprobar reservas."
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
          message="Cargando reglas y bloqueos administrativos..."
        />
      } @else {
        <mat-tab-group animationDuration="150ms">
          <mat-tab label="Reglas especiales">
            <div class="grid gap-6 pt-6">
              <app-section-card icon="science" title="Laboratorio">
                <div class="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <mat-form-field appearance="outline">
                    <mat-label>Seleccionar laboratorio</mat-label>
                    <mat-select [(ngModel)]="selectedLabId">
                      @for (lab of labs; track lab.id) {
                        <mat-option [value]="lab.id">{{ lab.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    [disabled]="!selectedLabId"
                    (click)="openSpecialRuleDialog('create')"
                  >
                    <mat-icon>add</mat-icon>
                    Agregar regla
                  </button>
                </div>
              </app-section-card>

              @if (selectedLabRules().length === 0) {
                <app-info-callout
                  variant="info"
                  icon="rule"
                  message="Este laboratorio aun no tiene reglas especiales configuradas."
                />
              } @else {
                <div class="grid gap-4 xl:grid-cols-2">
                  @for (rule of selectedLabRules(); track rule.id) {
                    <app-section-card>
                      <article class="grid h-full gap-5">
                        <header class="flex flex-wrap items-start justify-between gap-3">
                          <div class="min-w-0">
                            <p class="app-page-kicker">{{ rule.labName }}</p>
                            <h2 class="m-0 mt-1 text-xl font-extrabold text-slate-950">
                              {{ rule.name }}
                            </h2>
                            <p class="m-0 mt-2 text-sm leading-6 text-slate-600">
                              {{ rule.reason }}
                            </p>
                          </div>

                          <app-status-chip
                            [variant]="rule.active ? 'success' : 'neutral'"
                            [icon]="rule.active ? 'check_circle' : 'pause_circle'"
                            [label]="rule.active ? 'Activa' : 'Inactiva'"
                          />
                        </header>

                        <div class="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                          <div>
                            <span class="app-page-kicker">Vigencia</span>
                            <p class="m-0 mt-1 font-semibold">
                              {{ rulesService.formatRuleDate(rule.termStart) }}
                              -
                              {{ rulesService.formatRuleDate(rule.termEnd) }}
                            </p>
                          </div>
                          <div>
                            <span class="app-page-kicker">Horario bloqueado</span>
                            <p class="m-0 mt-1 font-semibold">
                              {{ rule.fullDayBlocked ? 'Dia completo' : rule.blockedStart + ' - ' + rule.blockedEnd }}
                            </p>
                          </div>
                          <div class="md:col-span-2">
                            <span class="app-page-kicker">Dias</span>
                            <p class="m-0 mt-1 font-semibold">
                              {{ dayLabels(rule.daysOfWeek) }}
                            </p>
                          </div>
                        </div>

                        <footer class="flex flex-col gap-3 sm:flex-row sm:justify-end">
                          <button
                            mat-stroked-button
                            type="button"
                            [disabled]="busy"
                            (click)="toggleSpecialRule(rule)"
                          >
                            <mat-icon>{{ rule.active ? 'pause_circle' : 'play_circle' }}</mat-icon>
                            {{ rule.active ? 'Desactivar' : 'Activar' }}
                          </button>
                          <button
                            mat-flat-button
                            color="primary"
                            type="button"
                            [disabled]="busy"
                            (click)="openSpecialRuleDialog('edit', rule)"
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
            </div>
          </mat-tab>

          <mat-tab label="Bloqueos extraordinarios">
            <div class="grid gap-6 pt-6">
              <app-section-card icon="filter_list" title="Filtros">
                <div class="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                  <mat-form-field appearance="outline">
                    <mat-label>Estado</mat-label>
                    <mat-select [(ngModel)]="blockedPeriodFilter">
                      <mat-option value="all">Todos</mat-option>
                      <mat-option value="active">Activos</mat-option>
                      <mat-option value="inactive">Inactivos</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    (click)="openBlockedPeriodDialog('create')"
                  >
                    <mat-icon>add</mat-icon>
                    Nuevo bloqueo
                  </button>
                </div>
              </app-section-card>

              @if (filteredBlockedPeriods().length === 0) {
                <app-info-callout
                  variant="info"
                  icon="event_busy"
                  message="No hay bloqueos extraordinarios con el filtro seleccionado."
                />
              } @else {
                <div class="grid gap-4 xl:grid-cols-2">
                  @for (period of filteredBlockedPeriods(); track period.id) {
                    <app-section-card>
                      <article class="grid h-full gap-5">
                        <header class="flex flex-wrap items-start justify-between gap-3">
                          <div class="min-w-0">
                            <p class="app-page-kicker">
                              {{ period.scope === 'global' ? 'Global' : 'Por laboratorio' }}
                            </p>
                            <h2 class="m-0 mt-1 text-xl font-extrabold text-slate-950">
                              {{ period.name }}
                            </h2>
                            <p class="m-0 mt-2 text-sm leading-6 text-slate-600">
                              {{ period.description || period.reason }}
                            </p>
                          </div>

                          <app-status-chip
                            [variant]="period.active ? 'success' : 'neutral'"
                            [icon]="period.active ? 'check_circle' : 'pause_circle'"
                            [label]="period.active ? 'Activo' : 'Inactivo'"
                          />
                        </header>

                        <div class="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                          <div>
                            <span class="app-page-kicker">Periodo</span>
                            <p class="m-0 mt-1 font-semibold">
                              {{ rulesService.formatDateTime(period.startDate) }}
                              -
                              {{ rulesService.formatDateTime(period.endDate) }}
                            </p>
                          </div>
                          <div>
                            <span class="app-page-kicker">Laboratorios</span>
                            <p class="m-0 mt-1 font-semibold">
                              {{ period.scope === 'global' ? 'Todos los laboratorios' : period.labNames.join(', ') }}
                            </p>
                          </div>
                          <div>
                            <span class="app-page-kicker">Motivo</span>
                            <p class="m-0 mt-1 font-semibold">{{ period.reason }}</p>
                          </div>
                        </div>

                        <footer class="flex flex-col gap-3 sm:flex-row sm:justify-end">
                          <button
                            mat-stroked-button
                            type="button"
                            [disabled]="busy"
                            (click)="toggleBlockedPeriod(period)"
                          >
                            <mat-icon>{{ period.active ? 'pause_circle' : 'play_circle' }}</mat-icon>
                            {{ period.active ? 'Desactivar' : 'Activar' }}
                          </button>
                          <button
                            mat-flat-button
                            color="primary"
                            type="button"
                            [disabled]="busy"
                            (click)="openBlockedPeriodDialog('edit', period)"
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
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </section>
  `,
})
export class AdminRulesPageComponent implements OnInit {
  protected readonly rulesService = inject(AdminRulesService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected labs: AdminLabView[] = [];
  protected specialRules: AdminSpecialRuleView[] = [];
  protected blockedPeriods: AdminBlockedPeriodView[] = [];
  protected selectedLabId = '';
  protected blockedPeriodFilter: BlockedPeriodFilter = 'all';
  protected loading = true;
  protected busy = false;
  protected errorMessage = '';

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  protected selectedLabRules(): AdminSpecialRuleView[] {
    return this.specialRules
      .filter((rule) => rule.labId === this.selectedLabId)
      .sort((first, second) => first.name.localeCompare(second.name, 'es-MX'));
  }

  protected filteredBlockedPeriods(): AdminBlockedPeriodView[] {
    return this.blockedPeriods.filter((period) =>
      this.blockedPeriodFilter === 'all'
        ? true
        : this.blockedPeriodFilter === 'active'
          ? period.active
          : !period.active,
    );
  }

  protected dayLabels(days?: number[]): string {
    if (!days?.length) {
      return 'Todos los dias';
    }
    const labels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    return days.map((day) => labels[day] ?? String(day)).join(', ');
  }

  protected async openSpecialRuleDialog(
    mode: 'create' | 'edit',
    rule?: AdminSpecialRuleView,
  ): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<
          AdminSpecialRuleDialogComponent,
          unknown,
          AdminSpecialRuleDialogResult
        >(AdminSpecialRuleDialogComponent, {
          width: 'min(760px, calc(100vw - 32px))',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
          data: {
            mode,
            labs: this.labs,
            selectedLabId: this.selectedLabId,
            rule,
          },
        })
        .afterClosed(),
    );

    if (!result) {
      return;
    }

    await this.saveSpecialRule(mode, result);
  }

  protected async openBlockedPeriodDialog(
    mode: 'create' | 'edit',
    period?: AdminBlockedPeriodView,
  ): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<
          AdminBlockedPeriodDialogComponent,
          unknown,
          AdminBlockedPeriodDialogResult
        >(AdminBlockedPeriodDialogComponent, {
          width: 'min(780px, calc(100vw - 32px))',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
          data: { mode, labs: this.labs, period },
        })
        .afterClosed(),
    );

    if (!result) {
      return;
    }

    await this.saveBlockedPeriod(mode, result);
  }

  protected async toggleSpecialRule(rule: AdminSpecialRuleView): Promise<void> {
    await this.saveSpecialRule('edit', {
      labId: rule.labId,
      ruleId: rule.id,
      active: !rule.active,
    });
  }

  protected async toggleBlockedPeriod(
    period: AdminBlockedPeriodView,
  ): Promise<void> {
    await this.saveBlockedPeriod('edit', {
      blockedPeriodId: period.id,
      active: !period.active,
    });
  }

  private async saveSpecialRule(
    mode: 'create' | 'edit',
    result: AdminSpecialRuleDialogResult,
  ): Promise<void> {
    this.busy = true;
    this.changeDetector.detectChanges();
    try {
      const message = mode === 'create'
        ? await this.rulesService.createSpecialRule(
          result as AdminCreateSpecialRuleInput,
        )
        : await this.rulesService.updateSpecialRule(
          result as AdminUpdateSpecialRuleInput,
        );
      this.snackBar.open(message, 'Cerrar', { duration: 4500 });
      await this.loadData(false);
    } catch (error) {
      this.snackBar.open(this.toErrorMessage(error), 'Cerrar', {
        duration: 6500,
      });
    } finally {
      this.busy = false;
      this.changeDetector.detectChanges();
    }
  }

  private async saveBlockedPeriod(
    mode: 'create' | 'edit',
    result: AdminBlockedPeriodDialogResult,
  ): Promise<void> {
    this.busy = true;
    this.changeDetector.detectChanges();
    try {
      const message = mode === 'create'
        ? await this.rulesService.createBlockedPeriod(
          result as AdminCreateBlockedPeriodInput,
        )
        : await this.rulesService.updateBlockedPeriod(
          result as AdminUpdateBlockedPeriodInput,
        );
      this.snackBar.open(message, 'Cerrar', { duration: 4500 });
      await this.loadData(false);
    } catch (error) {
      this.snackBar.open(this.toErrorMessage(error), 'Cerrar', {
        duration: 6500,
      });
    } finally {
      this.busy = false;
      this.changeDetector.detectChanges();
    }
  }

  private async loadData(showLoading = true): Promise<void> {
    if (showLoading) {
      this.loading = true;
      this.changeDetector.detectChanges();
    }

    try {
      const state = await this.rulesService.loadState();
      this.labs = state.labs;
      this.specialRules = state.specialRules;
      this.blockedPeriods = state.blockedPeriods;
      this.selectedLabId = this.selectedLabId || this.labs[0]?.id || '';
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
