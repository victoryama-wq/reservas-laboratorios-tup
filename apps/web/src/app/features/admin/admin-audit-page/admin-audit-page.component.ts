import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import {
  collection,
  Firestore,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

import { FIREBASE_FIRESTORE } from '../../../core/firebase/firebase.providers';
import {
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  AppSectionCardComponent,
  AppStatusChipComponent,
  StatusChipVariant,
} from '../../../shared/components';
import { AuditEventDoc, AuditEventType } from '../../../shared/models';

interface AuditEventView extends AuditEventDoc {
  createdDate: Date | null;
}

@Component({
  selector: 'app-admin-audit-page',
  imports: [
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    AppSectionCardComponent,
    AppStatusChipComponent,
  ],
  template: `
    <section class="app-container grid gap-8">
      <app-page-header
        kicker="Admin/Sistemas"
        title="Bitácora administrativa"
        subtitle="Eventos administrativos y cambios sensibles registrados por backend."
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
          message="Cargando bitácora administrativa..."
        />
      } @else if (events.length === 0) {
        <app-info-callout
          variant="info"
          icon="history"
          message="Aún no hay eventos administrativos registrados."
        />
      } @else {
        <div class="grid gap-4">
          @for (event of events; track event.id) {
            <app-section-card>
              <article class="grid gap-4">
                <header class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="app-page-kicker">{{ event.action }}</p>
                    <h2 class="m-0 mt-1 text-lg font-extrabold text-slate-950">
                      {{ event.description }}
                    </h2>
                  </div>

                  <app-status-chip
                    [variant]="typeVariant(event.type)"
                    [icon]="typeIcon(event.type)"
                    [label]="typeLabel(event.type)"
                  />
                </header>

                <div class="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-4">
                  <div>
                    <span class="font-bold text-violet-700">Fecha</span>
                    <p class="m-0 mt-1">{{ formatDate(event.createdDate) }}</p>
                  </div>
                  <div>
                    <span class="font-bold text-violet-700">Actor</span>
                    <p class="m-0 mt-1 break-words">
                      {{ event.actorEmail || event.actorUid || 'Sistema' }}
                    </p>
                  </div>
                  <div>
                    <span class="font-bold text-violet-700">Target</span>
                    <p class="m-0 mt-1 break-words">
                      {{ targetLabel(event) }}
                    </p>
                  </div>
                  <div>
                    <span class="font-bold text-violet-700">Evento</span>
                    <p class="m-0 mt-1">{{ event.id }}</p>
                  </div>
                </div>
              </article>
            </app-section-card>
          }
        </div>
      }
    </section>
  `,
})
export class AdminAuditPageComponent implements OnInit {
  private readonly firestore = inject<Firestore>(FIREBASE_FIRESTORE);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected events: AuditEventView[] = [];
  protected loading = true;
  protected errorMessage = '';

  async ngOnInit(): Promise<void> {
    try {
      const snapshot = await getDocs(
        query(
          collection(this.firestore, 'auditEvents'),
          orderBy('createdAt', 'desc'),
          limit(50),
        ),
      );
      this.events = snapshot.docs.map((document) =>
        this.toView(document.data() as AuditEventDoc, document.id),
      );
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'No fue posible cargar la bitácora administrativa.';
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  protected typeLabel(type: AuditEventType): string {
    const labels: Record<AuditEventType, string> = {
      ADMIN_ACTION: 'Acción admin',
      SENSITIVE_CHANGE: 'Cambio sensible',
      TECHNICAL_ERROR: 'Error técnico',
      CALENDAR_ERROR: 'Error Calendar',
      EMAIL_ERROR: 'Error correo',
      SECURITY_EVENT: 'Seguridad',
    };

    return labels[type];
  }

  protected typeVariant(type: AuditEventType): StatusChipVariant {
    if (type === 'ADMIN_ACTION') {
      return 'info';
    }

    if (type === 'SENSITIVE_CHANGE' || type === 'SECURITY_EVENT') {
      return 'warning';
    }

    if (type === 'TECHNICAL_ERROR' || type === 'CALENDAR_ERROR' || type === 'EMAIL_ERROR') {
      return 'danger';
    }

    return 'neutral';
  }

  protected typeIcon(type: AuditEventType): string {
    const icons: Record<AuditEventType, string> = {
      ADMIN_ACTION: 'admin_panel_settings',
      SENSITIVE_CHANGE: 'warning',
      TECHNICAL_ERROR: 'bug_report',
      CALENDAR_ERROR: 'event_busy',
      EMAIL_ERROR: 'mark_email_unread',
      SECURITY_EVENT: 'shield',
    };

    return icons[type];
  }

  protected targetLabel(event: AuditEventDoc): string {
    if (!event.targetCollection && !event.targetId) {
      return 'Sin target';
    }

    return `${event.targetCollection ?? 'colección'}/${event.targetId ?? 'id'}`;
  }

  protected formatDate(value: Date | null): string {
    if (!value) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  }

  private toView(event: AuditEventDoc, documentId: string): AuditEventView {
    return {
      ...event,
      id: event.id || documentId,
      createdDate: this.toDate(event.createdAt),
    };
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Timestamp) {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    return null;
  }
}
