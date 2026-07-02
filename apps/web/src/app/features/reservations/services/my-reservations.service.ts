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
import {
  ProtocolFile,
  ReservationDoc,
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

export type MyReservationTimelineSeverity =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export interface MyReservationTimelineItem {
  id: string;
  action: string;
  title: string;
  description: string;
  severity: MyReservationTimelineSeverity;
  createdAt: string;
}

interface GetMyReservationLogsResult {
  reservationId: string;
  items: MyReservationTimelineItem[];
}

@Injectable({
  providedIn: 'root',
})
export class MyReservationsService {
  private readonly firestore = inject<Firestore>(FIREBASE_FIRESTORE);
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);
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

  async getReservationLogs(
    reservationId: string,
  ): Promise<MyReservationTimelineItem[]> {
    const callable = httpsCallable<
      { reservationId: string },
      GetMyReservationLogsResult
    >(this.functions, 'getMyReservationLogs');

    try {
      const result = await callable({ reservationId });
      return result.data.items ?? [];
    } catch (error) {
      throw new Error(this.toReservationLogsErrorMessage(error));
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

  private toReservationLogsErrorMessage(error: unknown): string {
    const record = error as { code?: unknown; message?: unknown };
    const code = typeof record.code === 'string' ? record.code : '';

    if (code.includes('permission-denied')) {
      return 'No tienes permiso para consultar la bitacora de esta reserva.';
    }

    if (code.includes('not-found')) {
      return 'No se encontro la reserva solicitada.';
    }

    return 'No fue posible cargar la bitacora. Intenta nuevamente.';
  }
}
