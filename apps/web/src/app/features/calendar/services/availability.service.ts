import { Injectable, inject } from '@angular/core';
import { EventInput } from '@fullcalendar/core';
import { Functions, httpsCallable } from 'firebase/functions';
import { catchError, from, map, Observable, of } from 'rxjs';

import { FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.providers';
import {
  PublicLab,
} from '../../../shared/models';

export interface AvailabilityCalendarState {
  events: EventInput[];
  hasReadLimit: boolean;
}

type AvailabilityBlockKind =
  | 'reservation'
  | 'blockedPeriod'
  | 'specialRule'
  | 'weeklySchedule';

type AvailabilityBlockStatus = 'busy' | 'pending' | 'blocked';

interface AvailabilityBusyBlock {
  id: string;
  startAt: string;
  endAt: string;
  label: 'Ocupado' | 'Pendiente de validacion' | 'No disponible';
  kind: AvailabilityBlockKind;
  status: AvailabilityBlockStatus;
}

interface GetLabAvailabilityInput {
  labId: string;
  from: string;
  to: string;
}

interface GetLabAvailabilityOutput {
  labId: string;
  from: string;
  to: string;
  busyBlocks: AvailabilityBusyBlock[];
  blockedPeriods: AvailabilityBusyBlock[];
}

@Injectable({
  providedIn: 'root',
})
export class AvailabilityService {
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  getAvailabilityEvents(
    lab: PublicLab,
    rangeFrom: Date,
    rangeTo: Date,
  ): Observable<AvailabilityCalendarState> {
    const callable = httpsCallable<
      GetLabAvailabilityInput,
      GetLabAvailabilityOutput
    >(this.functions, 'getLabAvailability');

    return from(
      callable({
        labId: lab.id,
        from: rangeFrom.toISOString(),
        to: rangeTo.toISOString(),
      }),
    ).pipe(
      map((result) => ({
        events: [
          ...result.data.busyBlocks.map((block) => this.toAvailabilityEvent(block)),
          ...result.data.blockedPeriods.map((block) => this.toAvailabilityEvent(block)),
        ],
        hasReadLimit: false,
      })),
      catchError(() => of({ events: [], hasReadLimit: true })),
    );
  }

  private toAvailabilityEvent(block: AvailabilityBusyBlock): EventInput {
    return {
      id: block.id,
      title: block.label,
      start: block.startAt,
      end: block.endAt,
      backgroundColor:
        block.status === 'pending' ? '#888887' : '#252a86',
      borderColor:
        block.status === 'blocked' ? '#271e5d' : '#252a86',
      extendedProps: {
        source: block.kind,
        status:
          block.status === 'pending'
            ? 'PENDIENTE_VALIDACION'
            : block.status,
      },
    };
  }
}
