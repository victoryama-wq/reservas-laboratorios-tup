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
import { getDownloadURL, ref } from 'firebase/storage';
import { firstValueFrom, take } from 'rxjs';

import {
  FIREBASE_FIRESTORE,
  FIREBASE_STORAGE,
} from '../../../core/firebase/firebase.providers';
import { AuthService } from '../../../core/services/auth.service';
import {
  ProtocolFile,
  ReservationDoc,
  ReservationLogDoc,
  ReservationStatus,
} from '../../../shared/models';

export interface MyReservationView extends ReservationDoc {
  startDate: Date | null;
  endDate: Date | null;
  requiresManualReview: boolean;
}

export interface MyReservationsFilters {
  status?: ReservationStatus | 'all';
  search?: string;
}

@Injectable({
  providedIn: 'root',
})
export class MyReservationsService {
  private readonly firestore = inject<Firestore>(FIREBASE_FIRESTORE);
  private readonly storage = inject(FIREBASE_STORAGE);
  private readonly authService = inject(AuthService);

  async listMyReservations(
    filters: MyReservationsFilters = {},
  ): Promise<MyReservationView[]> {
    const uid = await this.getCurrentUid();
    const reservationsQuery = query(
      collection(this.firestore, 'reservations'),
      where('teacherUid', '==', uid),
    );
    const snapshot = await getDocs(reservationsQuery);
    const search = filters.search?.trim().toLowerCase() ?? '';

    return snapshot.docs
      .map((document) =>
        this.toView(document.data() as ReservationDoc, document.id),
      )
      .filter((reservation) =>
        filters.status && filters.status !== 'all'
          ? reservation.status === filters.status
          : true,
      )
      .filter((reservation) =>
        search
          ? [reservation.folio, reservation.labName]
              .some((value) => value.toLowerCase().includes(search))
          : true,
      )
      .sort(
        (first, second) =>
          (second.startDate?.getTime() ?? 0) -
          (first.startDate?.getTime() ?? 0),
      );
  }

  async getMyReservationById(
    reservationId: string,
  ): Promise<MyReservationView | null> {
    const uid = await this.getCurrentUid();
    const snapshot = await getDoc(
      doc(this.firestore, 'reservations', reservationId),
    );

    if (!snapshot.exists()) {
      return null;
    }

    const reservation = snapshot.data() as ReservationDoc;

    if (reservation.teacherUid !== uid) {
      return null;
    }

    return this.toView(reservation, snapshot.id);
  }

  async getReservationLogs(reservationId: string): Promise<ReservationLogDoc[]> {
    try {
      const logsQuery = query(
        collection(this.firestore, 'reservationLogs'),
        where('reservationId', '==', reservationId),
      );
      const snapshot = await getDocs(logsQuery);

      return snapshot.docs
        .map((document) => ({
          ...(document.data() as ReservationLogDoc),
          id: document.id,
        }))
        .sort(
          (first, second) =>
            (this.toDate(first.createdAt)?.getTime() ?? 0) -
            (this.toDate(second.createdAt)?.getTime() ?? 0),
        );
    } catch {
      return [];
    }
  }

  async getProtocolUrl(file: ProtocolFile): Promise<string> {
    const uid = await this.getCurrentUid();

    if (file.uploadedByUid !== uid) {
      throw new Error('El protocolo no pertenece al usuario autenticado.');
    }

    return getDownloadURL(ref(this.storage, file.storagePath));
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

  formatTimeRange(reservation: MyReservationView): string {
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

  private async getCurrentUid(): Promise<string> {
    const user = await firstValueFrom(this.authService.authState$.pipe(take(1)));

    if (!user) {
      throw new Error('Debe iniciar sesion.');
    }

    return user.uid;
  }

  private toView(
    reservation: ReservationDoc,
    documentId?: string,
  ): MyReservationView {
    return {
      ...reservation,
      id: reservation.id || documentId || '',
      protocolFiles: reservation.protocolFiles ?? [],
      startDate: this.toDate(reservation.startAt),
      endDate: this.toDate(reservation.endAt),
      requiresManualReview:
        reservation.risky === true ||
        reservation.externalParticipants === true ||
        reservation.status === 'PENDIENTE_VALIDACION',
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

    return null;
  }

  private isSerializedAdminTimestamp(
    value: unknown,
  ): value is { _seconds: number; _nanoseconds?: number } {
    return (
      typeof value === 'object' &&
      value !== null &&
      '_seconds' in value &&
      typeof (value as { _seconds?: unknown })._seconds === 'number'
    );
  }
}
