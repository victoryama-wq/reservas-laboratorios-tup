import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from 'firebase/functions';

import { FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.providers';
import { ReservationStatus } from '../../../shared/models';
import { ProtocolUploadMetadata } from './protocol-upload.service';

export interface CreateReservationInput {
  labId?: string;
  labSlug?: string;
  subject: string;
  group: string;
  practiceName: string;
  practiceNumber?: string;
  description?: string;
  objective: string;
  materialRequired: string;
  practiceType: string;
  practiceTypeOther?: string;
  risky: boolean;
  externalParticipants: boolean;
  reservationMode?: 'academic' | 'administrative' | 'responsible_direct';
  guestTeacherEmail?: string;
  startAt: string;
  endAt: string;
  occurrences?: Array<{ startAt: string; endAt: string }>;
  protocolFiles?: ProtocolUploadMetadata[];
  source: 'web' | 'qr' | 'admin';
}

export interface CreateReservationOutput {
  reservationId: string;
  folio: string;
  status: ReservationStatus;
  message: string;
  reservationGroupId?: string;
  results?: Array<{
    reservationId: string;
    folio: string;
    startAt: string;
    endAt: string;
    status: ReservationStatus;
    message: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  async createReservation(
    input: CreateReservationInput,
  ): Promise<CreateReservationOutput> {
    const callable = httpsCallable<
      CreateReservationInput,
      CreateReservationOutput
    >(this.functions, 'createReservation');
    const result = await callable(input);
    return result.data;
  }
}
