import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from 'firebase/functions';

import { FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.providers';

export interface CancelReservationInput {
  reservationId: string;
  reason?: string;
}

export interface CancelReservationOutput {
  reservationId: string;
  folio: string;
  status: 'CANCELADA';
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class CancelReservationService {
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  async cancelReservation(
    input: CancelReservationInput,
  ): Promise<CancelReservationOutput> {
    const callable = httpsCallable<
      CancelReservationInput,
      CancelReservationOutput
    >(this.functions, 'cancelReservation');
    const result = await callable(input);
    return result.data;
  }
}
