import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  ReactiveFormsModule,
  UntypedFormControl,
  UntypedFormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';

import { AppInfoCalloutComponent } from '../../../../shared/components';
import {
  LabGalleryImage,
  LabQrConfig,
  LabQrFrameStyle,
  LabQrPrintSize,
  WeeklySchedule,
} from '../../../../shared/models';
import { AdminLabQrPreviewComponent } from '../admin-lab-qr-preview/admin-lab-qr-preview.component';
import {
  AdminLabGalleryService,
  MAX_LAB_GALLERY_IMAGES,
} from '../../services/admin-lab-gallery.service';
import {
  AdminCreateLabInput,
  AdminLabsService,
  AdminLabView,
  AdminUpdateLabInput,
  CalendarValidationResult,
} from '../../services/admin-labs.service';
import { AdminUserView } from '../../services/admin-users.service';

const INSTITUTIONAL_DOMAIN = '@tecplayacar.edu.mx';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_QR_CONFIG: Required<LabQrConfig> = {
  title: 'Reserva de laboratorio',
  subtitle: 'Escanea para solicitar este espacio academico.',
  customLabel: 'Sistema Web de Reservas de Laboratorios',
  primaryColor: '#271e5d',
  secondaryColor: '#252a86',
  backgroundColor: '#ffffff',
  showLogo: true,
  frameStyle: 'card',
  printSize: 'medium',
};

type DialogMode = 'create' | 'edit';
type CalendarCalloutVariant = 'info' | 'success' | 'warning' | 'danger';

interface WeekdayOption {
  key: keyof WeeklySchedule;
  label: string;
}

export interface AdminLabEditDialogData {
  mode: DialogMode;
  lab?: AdminLabView;
  responsibleCandidates: AdminUserView[];
}

export type AdminLabEditDialogResult =
  | AdminCreateLabInput
  | AdminUpdateLabInput;

@Component({
  selector: 'app-admin-lab-edit-dialog',
  imports: [
    AppInfoCalloutComponent,
    AdminLabQrPreviewComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  template: `
    <section class="admin-lab-dialog grid max-h-[calc(100vh-2rem)] gap-5 overflow-y-auto overflow-x-hidden p-5 sm:p-6">
      <header class="flex items-start gap-3">
        <span class="admin-lab-dialog__icon grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-700">
          <mat-icon>{{ data.mode === 'create' ? 'add_business' : 'edit' }}</mat-icon>
        </span>
        <div class="min-w-0">
          <h2 class="m-0 text-xl font-extrabold text-slate-950">
            {{ data.mode === 'create' ? 'Nuevo laboratorio' : 'Editar laboratorio' }}
          </h2>
          <p class="m-0 mt-1 text-sm leading-6 text-slate-600">
            Configura datos visibles, responsables, horario base y calendario.
          </p>
        </div>
      </header>

      <form class="grid gap-5" [formGroup]="form">
        <mat-tab-group animationDuration="150ms">
          <mat-tab label="Datos generales">
            <div class="grid gap-4 pt-5">
              <div class="grid min-w-0 gap-4 md:grid-cols-2">
                <mat-form-field appearance="outline">
                  <mat-label>Nombre</mat-label>
                  <input matInput formControlName="name" />
                  @if (form.get('name')?.hasError('required')) {
                    <mat-error>El nombre es obligatorio.</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Slug</mat-label>
                  <input matInput formControlName="slug" />
                  <mat-hint>Ejemplo: laboratorio-de-alimentos</mat-hint>
                  @if (form.get('slug')?.hasError('required')) {
                    <mat-error>El slug es obligatorio.</mat-error>
                  }
                  @if (form.get('slug')?.hasError('pattern')) {
                    <mat-error>Use minusculas, numeros y guiones.</mat-error>
                  }
                </mat-form-field>
              </div>

              @if (data.mode === 'edit') {
                <app-info-callout
                  variant="warning"
                  icon="qr_code"
                  message="Cambiar el slug modifica la ruta QR /reservar/:labSlug. Actualice los QR impresos si aplica."
                />
              }

              <mat-form-field appearance="outline">
                <mat-label>Descripcion</mat-label>
                <textarea matInput formControlName="description" rows="3"></textarea>
                @if (form.get('description')?.hasError('required')) {
                  <mat-error>La descripcion es obligatoria.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Descripcion breve</mat-label>
                <textarea matInput formControlName="shortDescription" rows="2"></textarea>
              </mat-form-field>

              <div class="grid min-w-0 gap-4 md:grid-cols-2">
                <mat-form-field appearance="outline">
                  <mat-label>Ubicacion</mat-label>
                  <input matInput formControlName="location" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>URL de imagen</mat-label>
                  <input matInput formControlName="imageUrl" />
                  <mat-hint>Campo legado opcional. Use Galeria para imagenes nuevas.</mat-hint>
                </mat-form-field>
              </div>

              <div class="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                <mat-checkbox formControlName="active">
                  Laboratorio activo
                </mat-checkbox>
                <mat-checkbox formControlName="visibleInCatalog">
                  Visible en catalogo
                </mat-checkbox>
                <mat-checkbox formControlName="requiresApprovalWhenRisky">
                  Validacion si hay riesgo
                </mat-checkbox>
                <mat-checkbox formControlName="requiresProtocolWhenRisky">
                  Protocolo si hay riesgo
                </mat-checkbox>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Anticipacion minima en horas</mat-label>
                <input
                  matInput
                  type="number"
                  min="0"
                  formControlName="minNoticeHours"
                />
                @if (form.get('minNoticeHours')?.hasError('min')) {
                  <mat-error>Debe ser mayor o igual a cero.</mat-error>
                }
              </mat-form-field>
            </div>
          </mat-tab>

          <mat-tab label="Galeria">
            <div class="grid gap-4 pt-5">
              <app-info-callout
                variant="info"
                icon="photo_library"
                message="Sube hasta 8 imagenes activas por laboratorio. No se guardan URLs publicas; solo metadata y rutas privadas de Storage."
              />

              <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="m-0 text-sm font-bold uppercase tracking-wide text-violet-700">
                    {{ activeGalleryCount() }} de {{ maxGalleryImages }} imagenes activas
                  </p>
                  <p class="m-0 mt-1 text-sm text-slate-600">
                    Formatos permitidos: JPG, PNG o WebP. Tamano maximo: 5 MB.
                  </p>
                </div>

                <input
                  #galleryInput
                  class="hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  (change)="onGalleryFilesSelected($event)"
                />
                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  [disabled]="uploading || activeGalleryCount() >= maxGalleryImages"
                  (click)="galleryInput.click()"
                >
                  <mat-icon>add_photo_alternate</mat-icon>
                  Agregar imagenes
                </button>
              </div>

              @if (uploading) {
                <div class="grid gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <div class="flex items-center justify-between gap-3 text-sm font-semibold text-violet-800">
                    <span>Subiendo imagen...</span>
                    <span>{{ uploadProgress }}%</span>
                  </div>
                  <mat-progress-bar mode="determinate" [value]="uploadProgress" />
                </div>
              }

              @if (galleryError) {
                <app-info-callout
                  variant="danger"
                  icon="error"
                  [message]="galleryError"
                />
              }

              @if (galleryImages().length === 0) {
                <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <mat-icon class="text-[32px] text-violet-700">image</mat-icon>
                  <p class="m-0 mt-2 text-sm font-semibold text-slate-800">
                    Sin imagenes registradas
                  </p>
                  <p class="m-0 mt-1 text-sm text-slate-600">
                    Agregue imagenes institucionales del laboratorio para preparar el catalogo visual.
                  </p>
                </div>
              } @else {
                <div class="grid gap-4">
                  @for (image of galleryImages(); track image.id; let index = $index) {
                    <article
                      class="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[160px_1fr]"
                      [class.opacity-60]="!image.active"
                    >
                      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        @if (previewUrl(image)) {
                          <img
                            class="h-36 w-full object-cover"
                            [src]="previewUrl(image)"
                            [alt]="image.alt || image.fileName"
                          />
                        } @else {
                          <div class="grid h-36 place-items-center text-slate-500">
                            <mat-icon>image</mat-icon>
                          </div>
                        }
                      </div>

                      <div class="grid gap-4">
                        <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div class="min-w-0">
                            <p class="m-0 break-all text-sm font-bold text-slate-950">
                              {{ image.fileName }}
                            </p>
                            <p class="m-0 mt-1 text-xs text-slate-500">
                              {{ image.contentType }} · {{ formatBytes(image.sizeBytes) }}
                            </p>
                          </div>

                          <div class="flex flex-wrap gap-2">
                            <button
                              mat-stroked-button
                              type="button"
                              [disabled]="index === 0"
                              (click)="moveGalleryImage(image.id, -1)"
                            >
                              <mat-icon>arrow_upward</mat-icon>
                              Subir
                            </button>
                            <button
                              mat-stroked-button
                              type="button"
                              [disabled]="index === galleryImages().length - 1"
                              (click)="moveGalleryImage(image.id, 1)"
                            >
                              <mat-icon>arrow_downward</mat-icon>
                              Bajar
                            </button>
                          </div>
                        </header>

                        <div class="grid gap-3 md:grid-cols-2">
                          <mat-form-field appearance="outline">
                            <mat-label>Texto alternativo</mat-label>
                            <input
                              matInput
                              maxlength="120"
                              [value]="image.alt ?? ''"
                              (input)="updateGalleryText(image.id, 'alt', $any($event.target).value)"
                            />
                          </mat-form-field>

                          <mat-form-field appearance="outline">
                            <mat-label>Descripcion breve</mat-label>
                            <input
                              matInput
                              maxlength="120"
                              [value]="image.caption ?? ''"
                              (input)="updateGalleryText(image.id, 'caption', $any($event.target).value)"
                            />
                          </mat-form-field>
                        </div>

                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div class="flex flex-wrap items-center gap-3">
                            <mat-checkbox
                              [checked]="image.active"
                              (change)="toggleGalleryActive(image.id, $event.checked)"
                            >
                              Imagen activa
                            </mat-checkbox>

                            <button
                              mat-stroked-button
                              type="button"
                              [disabled]="!image.active"
                              (click)="setCoverImage(image.id)"
                            >
                              <mat-icon>
                                {{ isCoverImage(image.id) ? 'star' : 'star_border' }}
                              </mat-icon>
                              {{ isCoverImage(image.id) ? 'Portada' : 'Usar como portada' }}
                            </button>
                          </div>

                          <p class="m-0 text-xs text-slate-500">
                            Orden {{ image.order + 1 }}
                          </p>
                        </div>
                      </div>
                    </article>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <mat-tab label="Disponibilidad">
            <div class="grid gap-4 pt-5" formGroupName="weeklySchedule">
              <app-info-callout
                variant="info"
                icon="schedule"
                message="El horario base se valida nuevamente en backend. Las reglas especiales se gestionan desde el modulo Reglas."
              />

              @if (data.mode === 'edit') {
                <div class="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div class="min-w-0">
                    <p class="m-0 text-sm font-bold uppercase tracking-wide text-violet-700">
                      Reglas especiales
                    </p>
                    <p class="m-0 mt-1 text-sm leading-6 text-slate-700">
                      {{ specialRulesDialogMessage() }}
                    </p>
                  </div>

                  <a
                    mat-stroked-button
                    [routerLink]="['/admin/reglas']"
                    [queryParams]="{ labId: data.lab?.id }"
                    (click)="close()"
                  >
                    <mat-icon>rule</mat-icon>
                    Gestionar reglas
                  </a>
                </div>
              }

              @for (day of weekdays; track day.key) {
                <div
                  class="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_150px_150px]"
                  [formGroupName]="day.key"
                >
                  <mat-checkbox formControlName="enabled">
                    {{ day.label }}
                  </mat-checkbox>

                  <mat-form-field appearance="outline">
                    <mat-label>Inicio</mat-label>
                    <input matInput type="time" formControlName="start" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Fin</mat-label>
                    <input matInput type="time" formControlName="end" />
                    @if (dayGroup(day.key).hasError('timeRange')) {
                      <mat-error>Fin debe ser mayor que inicio.</mat-error>
                    }
                  </mat-form-field>
                </div>
              }
            </div>
          </mat-tab>

          <mat-tab label="Responsables">
            <div class="grid gap-4 pt-5">
              <app-info-callout
                variant="info"
                icon="sync"
                message="Al guardar, el sistema sincroniza automaticamente los laboratorios asignados en el perfil de cada responsable. Los usuarios Admin/Sistemas tienen acceso global y no dependen de labsAssigned."
              />

              <mat-form-field appearance="outline">
                <mat-label>Responsables por UID</mat-label>
                <mat-select formControlName="responsibleUids" multiple>
                  @for (user of data.responsibleCandidates; track user.uid) {
                    <mat-option [value]="user.uid">
                      {{ user.displayName || user.email }} - {{ user.email }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Correos responsables</mat-label>
                <textarea
                  matInput
                  formControlName="responsibleEmailsText"
                  rows="3"
                  placeholder="responsable@tecplayacar.edu.mx"
                ></textarea>
                <mat-hint>Separe varios correos con coma o salto de linea.</mat-hint>
                @if (form.get('responsibleEmailsText')?.hasError('emailList')) {
                  <mat-error>Solo correos @tecplayacar.edu.mx.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Correos de notificacion</mat-label>
                <textarea
                  matInput
                  formControlName="defaultNotifyEmailsText"
                  rows="3"
                  placeholder="avisos@tecplayacar.edu.mx"
                ></textarea>
                <mat-hint>Separe varios correos con coma o salto de linea.</mat-hint>
                @if (form.get('defaultNotifyEmailsText')?.hasError('emailList')) {
                  <mat-error>Solo correos @tecplayacar.edu.mx.</mat-error>
                }
              </mat-form-field>
            </div>
          </mat-tab>

          <mat-tab label="Calendario">
            <div class="grid gap-4 pt-5">
              <app-info-callout
                variant="info"
                icon="event"
                message="calendarId es dato operativo solo para Admin/Sistemas. No se muestra al docente."
              />

              <mat-form-field appearance="outline">
                <mat-label>calendarId</mat-label>
                <input matInput formControlName="calendarId" />
                @if (form.get('calendarId')?.hasError('required')) {
                  <mat-error>El calendarId es obligatorio.</mat-error>
                }
              </mat-form-field>

              <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="m-0 text-sm font-bold uppercase tracking-wide text-violet-700">
                      Validacion real de calendario
                    </p>
                    <p class="m-0 mt-1 text-sm leading-6 text-slate-600">
                      Verifica que el calendario exista y que la cuenta operativa pueda escribir eventos.
                    </p>
                  </div>

                  <button
                    mat-stroked-button
                    type="button"
                    [disabled]="calendarValidationLoading || form.get('calendarId')?.invalid"
                    (click)="validateCalendar()"
                  >
                    <mat-icon>
                      {{ calendarValidationLoading ? 'hourglass_top' : 'event_available' }}
                    </mat-icon>
                    {{ calendarValidationLoading ? 'Validando...' : 'Validar calendario' }}
                  </button>
                </div>

                @if (calendarValidationLoading) {
                  <app-info-callout
                    variant="info"
                    icon="hourglass_top"
                    message="Validando acceso real con Google Calendar..."
                  />
                } @else if (calendarValidationResult) {
                  <app-info-callout
                    [variant]="calendarValidationVariant()"
                    [icon]="calendarValidationIcon()"
                    [message]="calendarValidationResult.message"
                  />

                  <div class="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                    <div>
                      <span class="block text-xs font-bold uppercase tracking-wide text-violet-700">
                        Calendario
                      </span>
                      <span class="mt-1 block break-all font-semibold text-slate-950">
                        {{ calendarValidationResult.summary || calendarValidationResult.calendarId }}
                      </span>
                    </div>

                    <div>
                      <span class="block text-xs font-bold uppercase tracking-wide text-violet-700">
                        Permiso detectado
                      </span>
                      <span class="mt-1 block font-semibold text-slate-950">
                        {{ calendarAccessSummary() }}
                      </span>
                    </div>

                    @if (calendarValidationResult.timeZone) {
                      <div>
                        <span class="block text-xs font-bold uppercase tracking-wide text-violet-700">
                          Zona horaria
                        </span>
                        <span class="mt-1 block font-semibold text-slate-950">
                          {{ calendarValidationResult.timeZone }}
                        </span>
                      </div>
                    }

                    <div>
                      <span class="block text-xs font-bold uppercase tracking-wide text-violet-700">
                        Escritura de eventos
                      </span>
                      <span class="mt-1 block font-semibold text-slate-950">
                        {{ calendarValidationResult.canWrite ? 'Permitida' : 'No permitida' }}
                      </span>
                    </div>
                  </div>
                } @else if (calendarIdChanged()) {
                  <app-info-callout
                    variant="warning"
                    icon="info"
                    message="Valide el calendario antes de guardar. El backend tambien bloqueara el guardado si la cuenta operativa no tiene permisos de escritura."
                  />
                }
              </div>
            </div>
          </mat-tab>

          <mat-tab label="QR">
            <div class="grid gap-5 pt-5" formGroupName="qrConfig">
              <app-info-callout
                variant="info"
                icon="qr_code_2"
                message="El QR apunta siempre a la ruta publica de reserva del laboratorio. No se guardan imagenes QR ni archivos generados."
              />

              @if (slugChanged()) {
                <app-info-callout
                  variant="warning"
                  icon="warning"
                  message="El slug cambio. La URL del QR tambien cambiara y debera actualizar los QR impresos."
                />
              }

              <div class="grid gap-4 lg:grid-cols-2">
                <mat-form-field appearance="outline">
                  <mat-label>Titulo del QR</mat-label>
                  <input matInput maxlength="120" formControlName="title" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Etiqueta institucional</mat-label>
                  <input matInput maxlength="120" formControlName="customLabel" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Subtitulo</mat-label>
                <textarea
                  matInput
                  maxlength="120"
                  rows="2"
                  formControlName="subtitle"
                ></textarea>
              </mat-form-field>

              <div class="grid gap-4 md:grid-cols-3">
                <mat-form-field appearance="outline">
                  <mat-label>Color primario</mat-label>
                  <input matInput type="color" formControlName="primaryColor" />
                  @if (qrConfigGroup().get('primaryColor')?.hasError('pattern')) {
                    <mat-error>Use formato hexadecimal.</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Color secundario</mat-label>
                  <input matInput type="color" formControlName="secondaryColor" />
                  @if (qrConfigGroup().get('secondaryColor')?.hasError('pattern')) {
                    <mat-error>Use formato hexadecimal.</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Color de fondo</mat-label>
                  <input matInput type="color" formControlName="backgroundColor" />
                  @if (qrConfigGroup().get('backgroundColor')?.hasError('pattern')) {
                    <mat-error>Use formato hexadecimal.</mat-error>
                  }
                </mat-form-field>
              </div>

              <div class="grid gap-4 md:grid-cols-3">
                <mat-form-field appearance="outline">
                  <mat-label>Estilo de marco</mat-label>
                  <mat-select formControlName="frameStyle">
                    <mat-option value="classic">Clasico</mat-option>
                    <mat-option value="card">Tarjeta</mat-option>
                    <mat-option value="minimal">Minimal</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Tamano de impresion</mat-label>
                  <mat-select formControlName="printSize">
                    <mat-option value="small">Pequeno</mat-option>
                    <mat-option value="medium">Mediano</mat-option>
                    <mat-option value="large">Grande</mat-option>
                  </mat-select>
                </mat-form-field>

                <div class="grid items-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <mat-checkbox formControlName="showLogo">
                    Mostrar logo institucional
                  </mat-checkbox>
                </div>
              </div>

              <app-admin-lab-qr-preview
                [labName]="form.get('name')?.value || 'Laboratorio'"
                [slug]="form.get('slug')?.value || ''"
                [qrConfig]="qrPreviewConfig()"
              />
            </div>
          </mat-tab>
        </mat-tab-group>
      </form>

      @if (data.mode === 'edit' && !hasChanges()) {
        <app-info-callout
          variant="info"
          icon="info"
          message="No hay cambios por guardar."
        />
      }

      <footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button mat-button type="button" (click)="close()">Cancelar</button>
        <button
          mat-flat-button
          color="primary"
          type="button"
          [disabled]="form.invalid || (data.mode === 'edit' && !hasChanges())"
          (click)="save()"
        >
          <mat-icon>save</mat-icon>
          Guardar laboratorio
        </button>
      </footer>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }

    .admin-lab-dialog {
      width: 100%;
      min-width: 0;
    }

    .admin-lab-dialog__icon mat-icon {
      display: inline-flex;
      width: 24px;
      height: 24px;
      align-items: center;
      justify-content: center;
      overflow: visible;
      font-size: 24px;
      line-height: 24px;
    }

    mat-tab-group,
    mat-form-field {
      min-width: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLabEditDialogComponent {
  protected readonly data = inject<AdminLabEditDialogData>(MAT_DIALOG_DATA);
  private readonly adminLabsService = inject(AdminLabsService);
  private readonly galleryService = inject(AdminLabGalleryService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(
    MatDialogRef<AdminLabEditDialogComponent, AdminLabEditDialogResult>,
  );

  protected readonly maxGalleryImages = MAX_LAB_GALLERY_IMAGES;
  protected uploadProgress = 0;
  protected uploading = false;
  protected galleryError = '';
  protected calendarValidationLoading = false;
  protected calendarValidationResult: CalendarValidationResult | null = null;
  private readonly initialCalendarId = this.data.lab?.calendarId?.trim() ?? '';
  private readonly galleryPreviewUrls = new Map<string, string>();
  private readonly initialComparablePayload = this.data.mode === 'edit'
    ? stableStringify(toComparablePayload(this.data.lab))
    : '';

  protected readonly weekdays: WeekdayOption[] = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miercoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sabado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  protected readonly form = new UntypedFormGroup({
    name: new UntypedFormControl(this.data.lab?.name ?? '', [
      Validators.required,
    ]),
    slug: new UntypedFormControl(this.data.lab?.slug ?? '', [
      Validators.required,
      Validators.pattern(SLUG_PATTERN),
    ]),
    description: new UntypedFormControl(this.data.lab?.description ?? '', [
      Validators.required,
    ]),
    shortDescription: new UntypedFormControl(
      this.data.lab?.shortDescription ?? '',
    ),
    imageUrl: new UntypedFormControl(this.data.lab?.imageUrl ?? ''),
    gallery: new UntypedFormControl(this.data.lab?.gallery ?? []),
    coverImageId: new UntypedFormControl(this.data.lab?.coverImageId ?? ''),
    location: new UntypedFormControl(this.data.lab?.location ?? ''),
    calendarId: new UntypedFormControl(this.data.lab?.calendarId ?? '', [
      Validators.required,
    ]),
    active: new UntypedFormControl(this.data.lab?.active ?? true),
    visibleInCatalog: new UntypedFormControl(
      this.data.lab?.visibleInCatalog ?? true,
    ),
    minNoticeHours: new UntypedFormControl(
      this.data.lab?.minNoticeHours ?? 0,
      [Validators.min(0)],
    ),
    requiresApprovalWhenRisky: new UntypedFormControl(
      this.data.lab?.requiresApprovalWhenRisky ?? true,
    ),
    requiresProtocolWhenRisky: new UntypedFormControl(
      this.data.lab?.requiresProtocolWhenRisky ?? true,
    ),
    responsibleUids: new UntypedFormControl(
      this.data.lab?.responsibleUids ?? [],
    ),
    responsibleEmailsText: new UntypedFormControl(
      (this.data.lab?.responsibleEmails ?? []).join(', '),
      [institutionalEmailListValidator],
    ),
    defaultNotifyEmailsText: new UntypedFormControl(
      (this.data.lab?.defaultNotifyEmails ?? []).join(', '),
      [institutionalEmailListValidator],
    ),
    weeklySchedule: this.buildScheduleGroup(this.data.lab?.weeklySchedule),
    qrConfig: this.buildQrConfigGroup(this.data.lab?.qrConfig),
  });

  constructor() {
    if (this.data.mode === 'create') {
      this.form.get('name')?.valueChanges.subscribe((name) => {
        if (!this.form.get('slug')?.dirty) {
          this.form.get('slug')?.setValue(generateSlug(name ?? ''));
        }
      });
    }

    this.form.get('calendarId')?.valueChanges.subscribe(() => {
      this.calendarValidationResult = null;
      this.changeDetector.markForCheck();
    });

    void this.loadGalleryPreviewUrls();
  }

  protected dayGroup(day: keyof WeeklySchedule): UntypedFormGroup {
    return this.form.get('weeklySchedule')?.get(day) as UntypedFormGroup;
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected galleryImages(): LabGalleryImage[] {
    return [...(this.form.get('gallery')?.value ?? [])].sort(
      (first, second) => first.order - second.order,
    );
  }

  protected activeGalleryCount(): number {
    return this.galleryImages().filter((image) => image.active).length;
  }

  protected qrConfigGroup(): UntypedFormGroup {
    return this.form.get('qrConfig') as UntypedFormGroup;
  }

  protected qrPreviewConfig(): LabQrConfig {
    return this.serializeQrConfig();
  }

  protected slugChanged(): boolean {
    if (this.data.mode !== 'edit') {
      return false;
    }

    const originalSlug = this.data.lab?.slug ?? '';
    const currentSlug = String(this.form.get('slug')?.value ?? '').trim();
    return Boolean(originalSlug && currentSlug && originalSlug !== currentSlug);
  }

  protected calendarIdChanged(): boolean {
    const currentCalendarId = String(
      this.form.get('calendarId')?.value ?? '',
    ).trim();

    if (this.data.mode === 'create') {
      return Boolean(currentCalendarId);
    }

    return currentCalendarId !== this.initialCalendarId;
  }

  protected specialRulesDialogMessage(): string {
    const activeCount = (this.data.lab?.specialRules ?? [])
      .filter((rule) => rule.active)
      .length;

    if (activeCount === 0) {
      return 'Este laboratorio no tiene reglas especiales activas.';
    }

    const summary = activeCount === 1
      ? 'Este laboratorio tiene 1 regla especial activa.'
      : `Este laboratorio tiene ${activeCount} reglas especiales activas.`;

    return `${summary} Use Reglas para consultar o editar el detalle.`;
  }

  protected hasChanges(): boolean {
    if (this.data.mode === 'create') {
      return true;
    }

    return stableStringify(toComparablePayload(this.buildPayload())) !==
      this.initialComparablePayload;
  }

  protected calendarValidationVariant(): CalendarCalloutVariant {
    if (!this.calendarValidationResult) {
      return 'info';
    }

    return this.calendarValidationResult.valid &&
      this.calendarValidationResult.canWrite
      ? 'success'
      : 'danger';
  }

  protected calendarValidationIcon(): string {
    if (!this.calendarValidationResult) {
      return 'info';
    }

    return this.calendarValidationResult.valid &&
      this.calendarValidationResult.canWrite
      ? 'check_circle'
      : 'error';
  }

  protected calendarAccessSummary(): string {
    const result = this.calendarValidationResult;
    if (!result) {
      return 'Sin validar';
    }

    if (!result.accessRole) {
      return result.canWrite ? 'Escritura permitida' : 'Sin permiso confirmado';
    }

    return `${result.accessRole}${
      result.canWrite ? ' - escritura permitida' : ' - sin escritura'
    }`;
  }

  protected async validateCalendar(): Promise<void> {
    const calendarControl = this.form.get('calendarId');
    if (!calendarControl || calendarControl.invalid) {
      calendarControl?.markAsTouched();
      return;
    }

    const calendarId = String(calendarControl.value ?? '').trim();
    this.calendarValidationLoading = true;
    this.calendarValidationResult = null;
    this.changeDetector.markForCheck();

    try {
      this.calendarValidationResult =
        await this.adminLabsService.validateLabCalendar(calendarId);
    } catch (error) {
      this.calendarValidationResult = {
        valid: false,
        calendarId,
        canWrite: false,
        message: getErrorMessage(
          error,
          'No fue posible validar el calendario.',
        ),
        reason: 'TECHNICAL_ERROR',
      };
    } finally {
      this.calendarValidationLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  protected previewUrl(image: LabGalleryImage): string {
    return this.galleryPreviewUrls.get(image.id) ?? '';
  }

  protected isCoverImage(imageId: string): boolean {
    return this.form.get('coverImageId')?.value === imageId;
  }

  protected formatBytes(value: number): string {
    if (value >= 1024 * 1024) {
      return `${(value / 1024 / 1024).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  protected async onGalleryFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.galleryError = '';

    if (files.length === 0) {
      return;
    }

    const labId = this.storageLabId();
    if (!labId) {
      this.galleryError =
        'Capture un slug valido antes de subir imagenes de galeria.';
      return;
    }

    for (const file of files) {
      if (this.activeGalleryCount() >= MAX_LAB_GALLERY_IMAGES) {
        this.galleryError =
          `Solo se permiten ${MAX_LAB_GALLERY_IMAGES} imagenes activas.`;
        break;
      }

      const validationError = this.galleryService.validateImageFile(file);
      if (validationError) {
        this.galleryError = `${file.name}: ${validationError}`;
        continue;
      }

      this.uploading = true;
      this.uploadProgress = 0;
      this.changeDetector.markForCheck();

      try {
        const image = await this.galleryService.uploadLabImage({
          labId,
          file,
          order: this.galleryImages().length,
          onProgress: (progress) => {
            this.uploadProgress = progress;
            this.changeDetector.markForCheck();
          },
        });
        this.galleryPreviewUrls.set(image.id, URL.createObjectURL(file));
        this.setGalleryImages([...this.galleryImages(), image]);

        if (!this.form.get('coverImageId')?.value) {
          this.form.get('coverImageId')?.setValue(image.id);
        }
      } catch (error) {
        this.galleryError = error instanceof Error ?
          error.message :
          'No fue posible subir la imagen.';
      } finally {
        this.uploading = false;
        this.uploadProgress = 0;
        this.changeDetector.markForCheck();
      }
    }
  }

  protected updateGalleryText(
    imageId: string,
    field: 'alt' | 'caption',
    value: string,
  ): void {
    this.setGalleryImages(
      this.galleryImages().map((image) =>
        image.id === imageId ?
          { ...image, [field]: value.trim() || undefined } :
          image,
      ),
    );
  }

  protected toggleGalleryActive(imageId: string, active: boolean): void {
    if (active && this.activeGalleryCount() >= MAX_LAB_GALLERY_IMAGES) {
      this.galleryError =
        `Solo se permiten ${MAX_LAB_GALLERY_IMAGES} imagenes activas.`;
      return;
    }

    this.setGalleryImages(
      this.galleryImages().map((image) =>
        image.id === imageId ? { ...image, active } : image,
      ),
    );

    if (!active && this.isCoverImage(imageId)) {
      this.form.get('coverImageId')?.setValue(
        this.galleryImages().find((image) => image.active)?.id ?? '',
      );
    }
  }

  protected setCoverImage(imageId: string): void {
    const image = this.galleryImages().find((entry) => entry.id === imageId);
    if (!image?.active) {
      this.galleryError = 'La portada debe ser una imagen activa.';
      return;
    }

    this.form.get('coverImageId')?.setValue(imageId);
    this.galleryError = '';
  }

  protected moveGalleryImage(imageId: string, delta: -1 | 1): void {
    const images = this.galleryImages();
    const currentIndex = images.findIndex((image) => image.id === imageId);
    const targetIndex = currentIndex + delta;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= images.length) {
      return;
    }

    const [image] = images.splice(currentIndex, 1);
    images.splice(targetIndex, 0, image);
    this.setGalleryImages(images);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.data.mode === 'edit' && !this.hasChanges()) {
      return;
    }

    const payload = this.buildPayload();

    this.dialogRef.close(
      this.data.mode === 'create'
        ? payload
        : { ...payload, labId: this.data.lab?.id ?? '' },
    );
  }

  private buildPayload(): AdminCreateLabInput {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      slug: value.slug.trim().toLowerCase(),
      description: value.description.trim(),
      shortDescription: value.shortDescription.trim() || undefined,
      imageUrl: value.imageUrl.trim() || undefined,
      gallery: this.serializeGallery(),
      coverImageId: value.coverImageId || undefined,
      calendarId: value.calendarId.trim(),
      location: value.location.trim() || undefined,
      responsibleUids: value.responsibleUids ?? [],
      responsibleEmails: parseEmailText(value.responsibleEmailsText),
      defaultNotifyEmails: parseEmailText(value.defaultNotifyEmailsText),
      active: Boolean(value.active),
      visibleInCatalog: Boolean(value.visibleInCatalog),
      minNoticeHours: Number(value.minNoticeHours ?? 0),
      requiresApprovalWhenRisky: Boolean(value.requiresApprovalWhenRisky),
      requiresProtocolWhenRisky: Boolean(value.requiresProtocolWhenRisky),
      weeklySchedule: value.weeklySchedule as WeeklySchedule,
      qrConfig: this.serializeQrConfig(),
    };
  }

  private buildScheduleGroup(schedule?: WeeklySchedule): UntypedFormGroup {
    const group = new UntypedFormGroup({});
    for (const day of this.weekdays) {
      const value = schedule?.[day.key];
      group.addControl(
        day.key,
        new UntypedFormGroup(
          {
            enabled: new UntypedFormControl(value?.enabled ?? false),
            start: new UntypedFormControl(value?.start || '08:00'),
            end: new UntypedFormControl(value?.end || '20:00'),
          },
          [dayScheduleValidator],
        ),
      );
    }
    return group;
  }

  private buildQrConfigGroup(config?: LabQrConfig): UntypedFormGroup {
    const normalized = {
      ...DEFAULT_QR_CONFIG,
      ...(config ?? {}),
    };

    return new UntypedFormGroup({
      title: new UntypedFormControl(normalized.title, [
        Validators.maxLength(120),
      ]),
      subtitle: new UntypedFormControl(normalized.subtitle, [
        Validators.maxLength(120),
      ]),
      customLabel: new UntypedFormControl(normalized.customLabel, [
        Validators.maxLength(120),
      ]),
      primaryColor: new UntypedFormControl(normalized.primaryColor, [
        Validators.pattern(HEX_COLOR_PATTERN),
      ]),
      secondaryColor: new UntypedFormControl(normalized.secondaryColor, [
        Validators.pattern(HEX_COLOR_PATTERN),
      ]),
      backgroundColor: new UntypedFormControl(normalized.backgroundColor, [
        Validators.pattern(HEX_COLOR_PATTERN),
      ]),
      showLogo: new UntypedFormControl(normalized.showLogo),
      frameStyle: new UntypedFormControl(normalized.frameStyle),
      printSize: new UntypedFormControl(normalized.printSize),
    });
  }

  private setGalleryImages(images: LabGalleryImage[]): void {
    const normalized = images.map((image, order) => ({
      ...image,
      order,
    }));
    this.form.get('gallery')?.setValue(normalized);
    this.form.get('gallery')?.markAsDirty();
    this.form.get('gallery')?.updateValueAndValidity();
    this.changeDetector.markForCheck();
  }

  private serializeGallery(): LabGalleryImage[] {
    return this.galleryImages().map((image) => {
      const serialized: LabGalleryImage = {
        id: image.id,
        storagePath: image.storagePath,
        fileName: image.fileName,
        contentType: image.contentType,
        sizeBytes: image.sizeBytes,
        order: image.order,
        active: image.active,
        createdAt: image.createdAt,
      };

      if (image.alt?.trim()) {
        serialized.alt = image.alt.trim();
      }

      if (image.caption?.trim()) {
        serialized.caption = image.caption.trim();
      }

      if (image.updatedAt) {
        serialized.updatedAt = image.updatedAt;
      }

      return serialized;
    });
  }

  private serializeQrConfig(): LabQrConfig {
    const value = this.qrConfigGroup().getRawValue();

    return {
      title: String(value.title ?? '').trim() || DEFAULT_QR_CONFIG.title,
      subtitle:
        String(value.subtitle ?? '').trim() || DEFAULT_QR_CONFIG.subtitle,
      customLabel:
        String(value.customLabel ?? '').trim() || DEFAULT_QR_CONFIG.customLabel,
      primaryColor:
        String(value.primaryColor ?? '').trim() || DEFAULT_QR_CONFIG.primaryColor,
      secondaryColor:
        String(value.secondaryColor ?? '').trim() ||
        DEFAULT_QR_CONFIG.secondaryColor,
      backgroundColor:
        String(value.backgroundColor ?? '').trim() ||
        DEFAULT_QR_CONFIG.backgroundColor,
      showLogo: Boolean(value.showLogo),
      frameStyle: normalizeFrameStyle(value.frameStyle),
      printSize: normalizePrintSize(value.printSize),
    };
  }

  private storageLabId(): string {
    if (this.data.mode === 'edit' && this.data.lab?.id) {
      return this.data.lab.id;
    }

    const slug = String(this.form.get('slug')?.value ?? '').trim();
    return SLUG_PATTERN.test(slug) ? slug : '';
  }

  private async loadGalleryPreviewUrls(): Promise<void> {
    const images = this.galleryImages();
    await Promise.all(
      images.map(async (image) => {
        if (this.galleryPreviewUrls.has(image.id)) {
          return;
        }

        try {
          const previewUrl = await this.galleryService.getPreviewUrl(
            image.storagePath,
          );
          this.galleryPreviewUrls.set(image.id, previewUrl);
        } catch {
          // La vista puede operar sin preview si Storage no entrega la URL.
        }
      }),
    );
    this.changeDetector.markForCheck();
  }
}

function dayScheduleValidator(control: AbstractControl): ValidationErrors | null {
  const enabled = control.get('enabled')?.value;
  const start = control.get('start')?.value;
  const end = control.get('end')?.value;

  if (!enabled) {
    return null;
  }

  if (!start || !end || end <= start) {
    return { timeRange: true };
  }

  return null;
}

function institutionalEmailListValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const emails = parseEmailText(control.value ?? '');
  return emails.every((email) => email.endsWith(INSTITUTIONAL_DOMAIN))
    ? null
    : { emailList: true };
}

function parseEmailText(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,;]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
      ),
  ];
}

function toComparablePayload(
  source?: Partial<AdminCreateLabInput & AdminLabView>,
): unknown {
  if (!source) {
    return {};
  }

  return normalizeValueForComparison({
    name: String(source.name ?? '').trim(),
    slug: String(source.slug ?? '').trim().toLowerCase(),
    description: String(source.description ?? '').trim(),
    shortDescription: optionalTrim(source.shortDescription),
    imageUrl: optionalTrim(source.imageUrl),
    gallery: normalizeGalleryForComparison(source.gallery ?? []),
    coverImageId: optionalTrim(source.coverImageId),
    calendarId: String(source.calendarId ?? '').trim(),
    location: optionalTrim(source.location),
    responsibleUids: normalizeStringSet(source.responsibleUids ?? []),
    responsibleEmails: normalizeStringSet(source.responsibleEmails ?? []),
    defaultNotifyEmails: normalizeStringSet(source.defaultNotifyEmails ?? []),
    active: Boolean(source.active),
    visibleInCatalog: Boolean(source.visibleInCatalog),
    minNoticeHours: Number(source.minNoticeHours ?? 0),
    requiresApprovalWhenRisky: source.requiresApprovalWhenRisky ?? true,
    requiresProtocolWhenRisky: source.requiresProtocolWhenRisky ?? true,
    weeklySchedule: normalizeWeeklyScheduleForComparison(
      source.weeklySchedule,
    ),
    qrConfig: normalizeQrConfigForComparison(source.qrConfig),
  });
}

function optionalTrim(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function normalizeStringSet(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, 'es-MX'));
}

function normalizeGalleryForComparison(
  gallery: LabGalleryImage[],
): unknown[] {
  return [...gallery]
    .sort((first, second) => first.order - second.order)
    .map((image, order) =>
      normalizeValueForComparison({
        id: image.id,
        storagePath: image.storagePath,
        fileName: image.fileName,
        contentType: image.contentType,
        sizeBytes: image.sizeBytes,
        alt: optionalTrim(image.alt),
        caption: optionalTrim(image.caption),
        order,
        active: Boolean(image.active),
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
}

function normalizeWeeklyScheduleForComparison(
  schedule?: WeeklySchedule,
): Record<string, unknown> {
  return {
    monday: normalizeDaySchedule(schedule?.monday),
    tuesday: normalizeDaySchedule(schedule?.tuesday),
    wednesday: normalizeDaySchedule(schedule?.wednesday),
    thursday: normalizeDaySchedule(schedule?.thursday),
    friday: normalizeDaySchedule(schedule?.friday),
    saturday: normalizeDaySchedule(schedule?.saturday),
    sunday: normalizeDaySchedule(schedule?.sunday),
  };
}

function normalizeDaySchedule(
  day: WeeklySchedule[keyof WeeklySchedule] | undefined,
): Record<string, unknown> {
  return {
    enabled: Boolean(day?.enabled),
    start: day?.start || '08:00',
    end: day?.end || '20:00',
  };
}

function normalizeQrConfigForComparison(
  config?: LabQrConfig,
): Required<LabQrConfig> {
  return {
    ...DEFAULT_QR_CONFIG,
    ...(config ?? {}),
    title: optionalTrim(config?.title) ?? DEFAULT_QR_CONFIG.title,
    subtitle: optionalTrim(config?.subtitle) ?? DEFAULT_QR_CONFIG.subtitle,
    customLabel:
      optionalTrim(config?.customLabel) ?? DEFAULT_QR_CONFIG.customLabel,
    primaryColor:
      optionalTrim(config?.primaryColor) ?? DEFAULT_QR_CONFIG.primaryColor,
    secondaryColor:
      optionalTrim(config?.secondaryColor) ?? DEFAULT_QR_CONFIG.secondaryColor,
    backgroundColor:
      optionalTrim(config?.backgroundColor) ??
      DEFAULT_QR_CONFIG.backgroundColor,
    showLogo: config?.showLogo ?? DEFAULT_QR_CONFIG.showLogo,
    frameStyle: normalizeFrameStyle(config?.frameStyle),
    printSize: normalizePrintSize(config?.printSize),
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeValueForComparison(value));
}

function normalizeValueForComparison(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeValueForComparison(entry))
      .filter((entry) => entry !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const normalized = normalizeValueForComparison(
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

function normalizeFrameStyle(value: unknown): LabQrFrameStyle {
  return value === 'classic' || value === 'minimal' || value === 'card'
    ? value
    : DEFAULT_QR_CONFIG.frameStyle;
}

function normalizePrintSize(value: unknown): LabQrPrintSize {
  return value === 'small' || value === 'large' || value === 'medium'
    ? value
    : DEFAULT_QR_CONFIG.printSize;
}

function getErrorMessage(error: unknown, fallback: string): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '').toLowerCase()
    : '';

  if (code.includes('permission-denied')) {
    return 'No tienes permisos para realizar esta accion.';
  }

  if (code.includes('failed-precondition')) {
    return error instanceof Error && error.message
      ? error.message
      : 'No se cumple una condicion necesaria para validar el calendario.';
  }

  if (code.includes('unavailable')) {
    return 'El servicio no esta disponible temporalmente. Intenta nuevamente.';
  }

  if (code.includes('internal')) {
    return 'Ocurrio un error tecnico. Contacta a Sistemas.';
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    return message || fallback;
  }

  return fallback;
}

function generateSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
