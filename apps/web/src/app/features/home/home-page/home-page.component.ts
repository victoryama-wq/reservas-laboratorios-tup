import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import {
  AppIconBoxComponent,
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  AppSectionCardComponent,
  AppStatusChipComponent,
  IconBoxVariant,
} from '../../../shared/components';

interface HomeAction {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly iconVariant: IconBoxVariant;
  readonly link: string;
}

interface HomeStep {
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
}

@Component({
  selector: 'app-home-page',
  imports: [
    AppIconBoxComponent,
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    AppSectionCardComponent,
    AppStatusChipComponent,
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-8">
      <section class="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8 lg:p-10">
        <div
          class="absolute right-0 top-0 h-56 w-56 rounded-full bg-violet-100/70 blur-3xl"
          aria-hidden="true"
        ></div>
        <div
          class="absolute bottom-0 left-8 h-32 w-32 rounded-full bg-indigo-100/70 blur-3xl"
          aria-hidden="true"
        ></div>

        <div class="relative grid gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:items-center">
          <div class="grid gap-6">
            <app-page-header
              kicker="RESERVAS DE LABORATORIOS"
              title="Gestion academica de espacios, disponibilidad y solicitudes"
              subtitle="Consulta laboratorios activos, revisa disponibilidad visual y da seguimiento a tus reservas desde una experiencia institucional, clara y responsive."
            >
              <div page-actions class="flex flex-wrap gap-3">
                <app-status-chip
                  variant="success"
                  icon="verified_user"
                  label="Sesion institucional"
                />
                <app-status-chip
                  variant="info"
                  icon="calendar_today"
                  label="Calendar sincronizado"
                />
              </div>
            </app-page-header>

            <div class="flex flex-col gap-3 sm:flex-row">
              <a
                mat-flat-button
                color="primary"
                routerLink="/laboratorios"
                class="!h-12 !rounded-xl"
              >
                <mat-icon aria-hidden="true">science</mat-icon>
                Ver laboratorios
              </a>
              <a
                mat-stroked-button
                routerLink="/mis-reservas"
                class="!h-12 !rounded-xl"
              >
                <mat-icon aria-hidden="true">event_note</mat-icon>
                Mis reservas
              </a>
            </div>

            <app-info-callout
              variant="info"
              icon="qr_code_2"
              title="Acceso desde QR"
              message="Si entras desde el QR de un laboratorio, el sistema conserva la ruta original y precarga el espacio correspondiente despues del inicio de sesion."
            />
          </div>

          <div class="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
            <div class="grid gap-4">
              <div class="flex items-start gap-4">
                <app-icon-box icon="dashboard" variant="primary" size="lg" />
                <div>
                  <p class="m-0 text-xs font-bold uppercase tracking-widest text-violet-700">
                    Panel operativo
                  </p>
                  <h2 class="m-0 mt-1 text-2xl font-bold tracking-tight text-slate-950">
                    Acciones frecuentes
                  </h2>
                </div>
              </div>

              <div class="grid gap-3">
                @for (action of quickActions; track action.title) {
                  <a
                    class="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
                    [routerLink]="action.link"
                  >
                    <app-icon-box
                      [icon]="action.icon"
                      [variant]="action.iconVariant"
                      size="sm"
                    />
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold text-slate-950">
                        {{ action.title }}
                      </span>
                      <span class="mt-1 block text-xs leading-5 text-slate-500">
                        {{ action.description }}
                      </span>
                    </span>
                    <mat-icon
                      class="text-[20px] text-violet-700 transition group-hover:translate-x-1"
                      aria-hidden="true"
                    >
                      arrow_forward
                    </mat-icon>
                  </a>
                }
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <app-section-card
          title="Flujo de reserva"
          subtitle="Proceso guiado para docentes y personal autorizado."
          icon="route"
        >
          <div class="mt-6 grid gap-4 md:grid-cols-3">
            @for (step of reservationSteps; track step.label) {
              <article class="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <div class="flex items-center gap-3">
                  <span class="grid h-9 w-9 place-items-center rounded-xl bg-violet-700 text-sm font-bold text-white">
                    {{ step.label }}
                  </span>
                  <mat-icon class="text-[22px] text-violet-700" aria-hidden="true">
                    {{ step.icon }}
                  </mat-icon>
                </div>
                <h3 class="m-0 mt-4 text-base font-bold text-slate-950">
                  {{ step.title }}
                </h3>
                <p class="m-0 mt-2 text-sm leading-6 text-slate-600">
                  {{ step.description }}
                </p>
              </article>
            }
          </div>
        </app-section-card>

        <app-section-card
          title="Buenas practicas"
          subtitle="Puntos clave para una solicitud clara y verificable."
          icon="verified"
          iconVariant="success"
        >
          <ul class="mt-6 grid gap-4 p-0">
            @for (tip of tips; track tip.title) {
              <li class="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <mat-icon class="text-[22px] text-emerald-700" aria-hidden="true">
                  check_circle
                </mat-icon>
                <span>
                  <span class="block text-sm font-bold text-slate-950">
                    {{ tip.title }}
                  </span>
                  <span class="mt-1 block text-sm leading-6 text-slate-600">
                    {{ tip.description }}
                  </span>
                </span>
              </li>
            }
          </ul>
        </app-section-card>
      </section>
    </div>
  `,
})
export class HomePageComponent {
  protected readonly quickActions: HomeAction[] = [
    {
      title: 'Explorar laboratorios',
      description: 'Consulta espacios activos, horarios y reglas generales.',
      icon: 'science',
      iconVariant: 'primary',
      link: '/laboratorios',
    },
    {
      title: 'Revisar mis reservas',
      description: 'Da seguimiento a folios, estatus y solicitudes recientes.',
      icon: 'event_note',
      iconVariant: 'neutral',
      link: '/mis-reservas',
    },
    {
      title: 'Solicitudes pendientes',
      description: 'Disponible para responsables y Admin/Sistemas.',
      icon: 'assignment',
      iconVariant: 'warning',
      link: '/responsable/solicitudes',
    },
  ];

  protected readonly reservationSteps: HomeStep[] = [
    {
      label: '1',
      title: 'Elige laboratorio',
      description: 'Revisa el catalogo y abre el detalle del espacio academico.',
      icon: 'grid_view',
    },
    {
      label: '2',
      title: 'Consulta disponibilidad',
      description: 'Identifica horarios ocupados y rangos disponibles.',
      icon: 'calendar_today',
    },
    {
      label: '3',
      title: 'Envia solicitud',
      description: 'Completa el formulario y adjunta protocolo cuando aplique.',
      icon: 'send',
    },
  ];

  protected readonly tips = [
    {
      title: 'Usa datos academicos completos',
      description: 'Incluye asignatura, grupo, practica, objetivo y material requerido.',
    },
    {
      title: 'Declara condiciones de seguridad',
      description: 'Indica si hay material riesgoso o participantes externos.',
    },
    {
      title: 'Carga protocolo cuando aplique',
      description: 'Los archivos se revisan desde el sistema y no son publicos.',
    },
  ];
}
