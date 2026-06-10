import { Timestamp } from 'firebase/firestore';
import { ReservationStatus } from './reservation-status.model';

export type ReservationLogAction =
  | 'CREATED'
  | 'AUTO_CONFIRMED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CALENDAR_EVENT_CREATED'
  | 'CALENDAR_EVENT_CANCELLED'
  | 'CALENDAR_ERROR'
  | 'EMAIL_SENT'
  | 'EMAIL_ERROR'
  | 'STATUS_CHANGED';

export interface ReservationLogDoc {
  id: string;
  reservationId: string;
  action: ReservationLogAction;
  actorUid?: string;
  actorEmail?: string;
  previousStatus?: ReservationStatus;
  newStatus?: ReservationStatus;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}
