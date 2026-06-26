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

import { AppInfoCalloutComponent } from '../../../../shared/components';
import { LabGalleryImage, WeeklySchedule } from '../../../../shared/models';
import {
  AdminLabGalleryService,
  MAX_LAB_GALLERY_IMAGES,
} from '../../services/admin-lab-gallery.service';
import {
  AdminCreateLabInput,
  AdminLabView,
  AdminUpdateLabInput,
} from '../../services/admin-labs.service';
import { AdminUserView } from '../../services/admin-users.service';

const INSTITUTIONAL_DOMAIN = '@tecplayacar.edu.mx';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type DialogMode = 'create' | 'edit';

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
                message="El horario base se valida nuevamente en backend. Las reglas especiales quedan fuera de esta fase."
              />

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
                variant="warning"
                icon="info"
                message="Asignar responsibleUids al laboratorio no modifica users.labsAssigned. Para que el responsable vea solicitudes, gestionelo tambien desde Usuarios."
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
            </div>
          </mat-tab>
        </mat-tab-group>
      </form>

      <footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button mat-button type="button" (click)="close()">Cancelar</button>
        <button mat-flat-button color="primary" type="button" (click)="save()">
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
  private readonly galleryService = inject(AdminLabGalleryService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(
    MatDialogRef<AdminLabEditDialogComponent, AdminLabEditDialogResult>,
  );

  protected readonly maxGalleryImages = MAX_LAB_GALLERY_IMAGES;
  protected uploadProgress = 0;
  protected uploading = false;
  protected galleryError = '';
  private readonly galleryPreviewUrls = new Map<string, string>();

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
  });

  constructor() {
    if (this.data.mode === 'create') {
      this.form.get('name')?.valueChanges.subscribe((name) => {
        if (!this.form.get('slug')?.dirty) {
          this.form.get('slug')?.setValue(generateSlug(name ?? ''));
        }
      });
    }

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

    const value = this.form.getRawValue();
    const payload = {
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
    };

    this.dialogRef.close(
      this.data.mode === 'create'
        ? payload
        : { ...payload, labId: this.data.lab?.id ?? '' },
    );
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
    return this.galleryImages().map((image) => ({
      id: image.id,
      storagePath: image.storagePath,
      fileName: image.fileName,
      contentType: image.contentType,
      sizeBytes: image.sizeBytes,
      alt: image.alt || undefined,
      caption: image.caption || undefined,
      order: image.order,
      active: image.active,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    }));
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

function generateSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
