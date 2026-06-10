import { inject, Injectable } from '@angular/core';
import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { Functions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { firstValueFrom, take } from 'rxjs';

import {
  FIREBASE_FIRESTORE,
  FIREBASE_FUNCTIONS,
  FIREBASE_STORAGE,
} from '../../../core/firebase/firebase.providers';
import { AuthService } from '../../../core/services/auth.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import {
  AppUser,
  LabDoc,
  ReservationDoc,
  ReservationLogDoc,
  ReservationStatus,
} from '../../../shared/models';

export interface ReviewReservationResult {
  reservationId: string;
  folio: string;
  status: ReservationStatus;
  message: string;
}

export interface ResponsibleReservationView extends ReservationDoc {
  startDate: Date | null;
  endDate: Date | null;
}

@Injectable({
  providedIn: 'root',
})
export class ReservationReviewService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);
  private readonly storage = inject(FIREBASE_STORAGE);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(UserProfileService);

  async listPendingReservations(): Promise<ResponsibleReservationView[]> {
    const profile = await this.getActiveProfile();
    const reservations = await this.readReservationsForProfile(
      profile,
      'PENDIENTE_VALIDACION',
    );

    return reservations
      .map((reservation) => this.toView(reservation))
      .sort((first, second) =>
        (first.startDate?.getTime() ?? 0) - (second.startDate?.getTime() ?? 0),
      );
  }

  async listHistoryReservations(): Promise<ResponsibleReservationView[]> {
    const profile = await this.getActiveProfile();
    const reservations = await this.readReservationsForProfile(profile);

    return reservations
      .filter((reservation) => reservation.status !== 'PENDIENTE_VALIDACION')
      .map((reservation) => this.toView(reservation))
      .sort(
        (first, second) =>
          (second.startDate?.getTime() ?? 0) - (first.startDate?.getTime() ?? 0),
      );
  }

  async getReservationById(
    reservationId: string,
  ): Promise<ResponsibleReservationView | null> {
    const snapshot = await getDoc(
      doc(this.firestore, 'reservations', reservationId),
    );

    return snapshot.exists()
      ? this.toView(snapshot.data() as ReservationDoc)
      : null;
  }

  async getReservationLogs(
    reservationId: string,
  ): Promise<ReservationLogDoc[]> {
    try {
      const logsQuery = query(
        collection(this.firestore, 'reservationLogs'),
        where('reservationId', '==', reservationId),
      );
      const snapshot = await getDocs(logsQuery);

      return snapshot.docs
        .map((document) => document.data() as ReservationLogDoc)
        .sort(
          (first, second) =>
            (this.toDate(first.createdAt)?.getTime() ?? 0) -
            (this.toDate(second.createdAt)?.getTime() ?? 0),
        );
    } catch {
      return [];
    }
  }

  async approveReservation(
    reservationId: string,
    note?: string,
  ): Promise<ReviewReservationResult> {
    const callable = httpsCallable<
      { reservationId: string; note?: string },
      ReviewReservationResult
    >(this.functions, 'approveReservation');
    const result = await callable({ reservationId, note });
    return result.data;
  }

  async rejectReservation(
    reservationId: string,
    reason: string,
  ): Promise<ReviewReservationResult> {
    const callable = httpsCallable<
      { reservationId: string; reason: string },
      ReviewReservationResult
    >(this.functions, 'rejectReservation');
    const result = await callable({ reservationId, reason });
    return result.data;
  }

  async getProtocolUrl(storagePath: string): Promise<string> {
    return getDownloadURL(ref(this.storage, storagePath));
  }

  formatDate(value: Date | null): string {
    if (!value) {
      return 'Fecha no disponible';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(value);
  }

  formatTimeRange(reservation: ResponsibleReservationView): string {
    if (!reservation.startDate || !reservation.endDate) {
      return 'Horario no disponible';
    }

    const formatter = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return `${formatter.format(reservation.startDate)} - ${formatter.format(
      reservation.endDate,
    )}`;
  }

  private async getActiveProfile(): Promise<AppUser> {
    const user = await firstValueFrom(this.authService.authState$.pipe(take(1)));

    if (!user) {
      throw new Error('Debe iniciar sesion.');
    }

    const profileResult = await this.profileService.getProfile(user.uid);

    if (profileResult.status !== 'active' || !profileResult.profile) {
      throw new Error('Su perfil institucional no esta activo.');
    }

    return profileResult.profile;
  }

  private async readReservationsForProfile(
    profile: AppUser,
    status?: ReservationStatus,
  ): Promise<ReservationDoc[]> {
    if (profile.role === 'admin_sistemas') {
      return this.readReservations(undefined, status);
    }

    if (profile.role !== 'responsable_laboratorio') {
      return [];
    }

    const labIds = profile.labsAssigned ?? [];

    if (!labIds.length) {
      return [];
    }

    const chunks = this.chunk(labIds, 10);
    const result = await Promise.all(
      chunks.map((chunk) => this.readReservations(chunk, status)),
    );

    return result.flat();
  }

  private async readReservations(
    labIds?: string[],
    status?: ReservationStatus,
  ): Promise<ReservationDoc[]> {
    const constraints = [];

    if (status) {
      constraints.push(where('status', '==', status));
    }

    if (labIds?.length) {
      constraints.push(where('labId', 'in', labIds));
    }

    const reservationsQuery = query(
      collection(this.firestore, 'reservations'),
      ...constraints,
    );
    const snapshot = await getDocs(reservationsQuery);

    return snapshot.docs.map((document) => document.data() as ReservationDoc);
  }

  private toView(reservation: ReservationDoc): ResponsibleReservationView {
    return {
      ...reservation,
      startDate: this.toDate(reservation.startAt),
      endDate: this.toDate(reservation.endAt),
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

    if (this.isSerializedAdminTimestamp(value)) {
      return new Date(
        value._seconds * 1000 +
          Math.floor((value._nanoseconds ?? 0) / 1_000_000),
      );
    }

    if (this.isSerializedClientTimestamp(value)) {
      return new Date(
        value.seconds * 1000 +
          Math.floor((value.nanoseconds ?? 0) / 1_000_000),
      );
    }

    return null;
  }

  private isSerializedAdminTimestamp(value: unknown): value is {
    _seconds: number;
    _nanoseconds?: number;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { _seconds?: unknown })._seconds === 'number'
    );
  }

  private isSerializedClientTimestamp(value: unknown): value is {
    seconds: number;
    nanoseconds?: number;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { seconds?: unknown }).seconds === 'number'
    );
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }
}
