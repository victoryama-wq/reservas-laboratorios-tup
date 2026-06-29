import { inject, Injectable } from '@angular/core';
import {
  collection,
  Firestore,
  getDocs,
  query,
  Timestamp,
} from 'firebase/firestore';
import { Functions, httpsCallable } from 'firebase/functions';

import {
  FIREBASE_FIRESTORE,
  FIREBASE_FUNCTIONS,
} from '../../../core/firebase/firebase.providers';
import {
  LabDoc,
  LabGalleryImage,
  LabQrConfig,
  WeeklySchedule,
} from '../../../shared/models';

export interface AdminLabView extends LabDoc {
  id: string;
  createdDate: Date | null;
  updatedDate: Date | null;
}

export interface AdminCreateLabInput {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  imageUrl?: string;
  gallery?: LabGalleryImage[];
  coverImageId?: string;
  qrConfig?: LabQrConfig;
  calendarId: string;
  location?: string;
  responsibleUids: string[];
  responsibleEmails: string[];
  defaultNotifyEmails: string[];
  active: boolean;
  visibleInCatalog: boolean;
  minNoticeHours: number;
  requiresApprovalWhenRisky?: boolean;
  requiresProtocolWhenRisky?: boolean;
  weeklySchedule: WeeklySchedule;
}

export interface AdminUpdateLabInput extends Partial<AdminCreateLabInput> {
  labId: string;
}

export interface AdminCreateLabOutput {
  labId: string;
  created: true;
  message: string;
}

export interface AdminUpdateLabOutput {
  labId: string;
  updated: true;
  message: string;
}

export type CalendarValidationReason =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INSUFFICIENT_PERMISSION'
  | 'INVALID_ID'
  | 'TECHNICAL_ERROR';

export interface CalendarValidationResult {
  valid: boolean;
  calendarId: string;
  summary?: string;
  timeZone?: string;
  accessRole?: string;
  canWrite?: boolean;
  message: string;
  reason?: CalendarValidationReason;
}

@Injectable({
  providedIn: 'root',
})
export class AdminLabsService {
  private readonly firestore = inject<Firestore>(FIREBASE_FIRESTORE);
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  async listLabs(): Promise<AdminLabView[]> {
    const labsQuery = query(collection(this.firestore, 'labs'));
    const snapshot = await getDocs(labsQuery);

    return snapshot.docs
      .map((document) => this.toView(document.data() as LabDoc, document.id))
      .sort((first, second) =>
        first.name.localeCompare(second.name, 'es-MX'),
      );
  }

  async createLab(input: AdminCreateLabInput): Promise<AdminCreateLabOutput> {
    const callable = httpsCallable<AdminCreateLabInput, AdminCreateLabOutput>(
      this.functions,
      'adminCreateLab',
    );
    const result = await callable(input);
    return result.data;
  }

  async updateLab(input: AdminUpdateLabInput): Promise<AdminUpdateLabOutput> {
    const callable = httpsCallable<AdminUpdateLabInput, AdminUpdateLabOutput>(
      this.functions,
      'adminUpdateLab',
    );
    const result = await callable(input);
    return result.data;
  }

  async validateLabCalendar(
    calendarId: string,
  ): Promise<CalendarValidationResult> {
    const callable = httpsCallable<
      { calendarId: string },
      CalendarValidationResult
    >(this.functions, 'adminValidateLabCalendar');
    const result = await callable({ calendarId });
    return result.data;
  }

  formatDate(value: Date | null): string {
    if (!value) {
      return 'Sin registro';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  }

  private toView(lab: LabDoc, documentId: string): AdminLabView {
    return {
      ...lab,
      id: lab.id || documentId,
      name: lab.name ?? 'Laboratorio sin nombre',
      slug: lab.slug ?? documentId,
      description: lab.description ?? '',
      shortDescription: lab.shortDescription ?? '',
      imageUrl: lab.imageUrl ?? '',
      gallery: lab.gallery ?? [],
      coverImageId: lab.coverImageId ?? '',
      qrConfig: lab.qrConfig,
      calendarId: lab.calendarId ?? '',
      location: lab.location ?? '',
      active: Boolean(lab.active),
      visibleInCatalog: Boolean(lab.visibleInCatalog),
      minNoticeHours: Number(lab.minNoticeHours ?? 0),
      requiresApprovalWhenRisky:
        lab.requiresApprovalWhenRisky ?? true,
      requiresProtocolWhenRisky:
        lab.requiresProtocolWhenRisky ?? true,
      responsibleUids: lab.responsibleUids ?? [],
      responsibleEmails: lab.responsibleEmails ?? [],
      defaultNotifyEmails: lab.defaultNotifyEmails ?? [],
      weeklySchedule: lab.weeklySchedule ?? {},
      specialRules: lab.specialRules ?? [],
      qrPath: lab.qrPath ?? `/reservar/${lab.slug ?? documentId}`,
      createdDate: this.toDate(lab.createdAt),
      updatedDate: this.toDate(lab.updatedAt),
    };
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Timestamp) {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }
}
