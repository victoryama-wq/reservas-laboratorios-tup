import { Injectable, inject } from '@angular/core';
import { EventInput } from '@fullcalendar/core';
import {
  collection,
  Firestore,
  getDocs,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { catchError, forkJoin, from, map, Observable, of } from 'rxjs';

import { FIREBASE_FIRESTORE } from '../../../core/firebase/firebase.providers';
import {
  BlockedPeriodDoc,
  LabDoc,
  LabSpecialRule,
  ReservationDoc,
  ReservationStatus,
} from '../../../shared/models';

export interface AvailabilityCalendarState {
  events: EventInput[];
  hasReadLimit: boolean;
}

const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  'PENDIENTE_VALIDACION',
  'CONFIRMADA',
  'CONFIRMADA_TRAS_VALIDACION',
  'ERROR_CALENDAR',
];

@Injectable({
  providedIn: 'root',
})
export class AvailabilityService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);

  getAvailabilityEvents(lab: LabDoc): Observable<AvailabilityCalendarState> {
    return forkJoin({
      reservations: this.getReservationEvents(lab.id),
      blockedPeriods: this.getBlockedPeriodEvents(lab.id),
    }).pipe(
      map(({ reservations, blockedPeriods }) => ({
        events: [
          ...reservations.events,
          ...blockedPeriods.events,
          ...this.getSpecialRuleEvents(lab.specialRules),
        ],
        hasReadLimit: reservations.hasReadLimit || blockedPeriods.hasReadLimit,
      })),
    );
  }

  private getReservationEvents(
    labId: string,
  ): Observable<AvailabilityCalendarState> {
    const reservationsQuery = query(
      collection(this.firestore, 'reservations'),
      where('labId', '==', labId),
      where('status', 'in', BLOCKING_RESERVATION_STATUSES),
    );

    return from(getDocs(reservationsQuery)).pipe(
      map((snapshot) => ({
        events: snapshot.docs
          .map((document) =>
            this.toReservationEvent(document.data() as ReservationDoc),
          )
          .filter((event): event is EventInput => event !== null),
        hasReadLimit: false,
      })),
      catchError(() => of({ events: [], hasReadLimit: true })),
    );
  }

  private getBlockedPeriodEvents(
    labId: string,
  ): Observable<AvailabilityCalendarState> {
    const blockedPeriodsQuery = query(
      collection(this.firestore, 'blockedPeriods'),
      where('active', '==', true),
    );

    return from(getDocs(blockedPeriodsQuery)).pipe(
      map((snapshot) => ({
        events: snapshot.docs
          .map((document) => document.data() as BlockedPeriodDoc)
          .filter((blockedPeriod) => this.appliesToLab(blockedPeriod, labId))
          .map((blockedPeriod) => this.toBlockedPeriodEvent(blockedPeriod)),
        hasReadLimit: false,
      })),
      catchError(() => of({ events: [], hasReadLimit: true })),
    );
  }

  private getSpecialRuleEvents(specialRules: LabSpecialRule[]): EventInput[] {
    return specialRules
      .filter((rule) => rule.active && rule.fullDayBlocked && rule.termStart)
      .map((rule) => ({
        id: `special-rule-${rule.id}`,
        title: 'No disponible',
        start: rule.termStart,
        end: rule.termEnd,
        allDay: true,
        display: 'background',
        backgroundColor: '#888887',
        extendedProps: {
          source: 'specialRule',
          reason: rule.reason,
        },
      }));
  }

  private toReservationEvent(reservation: ReservationDoc): EventInput | null {
    const startAt = this.toDate(reservation.startAt);
    const endAt = this.toDate(reservation.endAt);

    if (!startAt || !endAt) {
      return null;
    }

    const title =
      reservation.status === 'PENDIENTE_VALIDACION'
        ? 'Pendiente de validacion'
        : 'Ocupado';

    return {
      id: reservation.id,
      title,
      start: startAt,
      end: endAt,
      backgroundColor:
        reservation.status === 'PENDIENTE_VALIDACION' ? '#888887' : '#252a86',
      borderColor:
        reservation.status === 'ERROR_CALENDAR' ? '#b3261e' : '#252a86',
      extendedProps: {
        source: 'reservation',
        status: reservation.status,
      },
    };
  }

  private toBlockedPeriodEvent(blockedPeriod: BlockedPeriodDoc): EventInput {
    const startAt = this.toDate(blockedPeriod.startAt);
    const endAt = this.toDate(blockedPeriod.endAt);

    return {
      id: blockedPeriod.id,
      title: 'No disponible',
      start: startAt ?? undefined,
      end: endAt ?? undefined,
      allDay: blockedPeriod.fullDay,
      backgroundColor: '#271e5d',
      borderColor: '#271e5d',
      extendedProps: {
        source: 'blockedPeriod',
        reason: blockedPeriod.reason,
      },
    };
  }

  private appliesToLab(blockedPeriod: BlockedPeriodDoc, labId: string): boolean {
    return blockedPeriod.scope === 'global' || blockedPeriod.labIds?.includes(labId) === true;
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
        value._seconds * 1000 + Math.floor((value._nanoseconds ?? 0) / 1_000_000),
      );
    }

    if (this.isSerializedClientTimestamp(value)) {
      return new Date(
        value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000),
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
}
