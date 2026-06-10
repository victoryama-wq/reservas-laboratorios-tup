import { Timestamp } from 'firebase/firestore';

export type NotificationType =
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_PENDING_APPROVAL'
  | 'RESERVATION_APPROVED'
  | 'RESERVATION_REJECTED'
  | 'RESERVATION_CANCELLED'
  | 'TECHNICAL_ERROR'
  | 'CALENDAR_ERROR'
  | 'EMAIL_ERROR';

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';
export type NotificationProvider = 'gmail_api';

export interface NotificationDoc {
  id: string;
  reservationId?: string;
  type: NotificationType;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  status: NotificationStatus;
  provider: NotificationProvider;
  providerMessageId?: string;
  sentAt?: Timestamp;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
