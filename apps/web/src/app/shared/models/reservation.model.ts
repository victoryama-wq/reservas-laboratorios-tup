import { Timestamp } from 'firebase/firestore';
import { ProtocolFile } from './protocol-file.model';
import { ReservationStatus } from './reservation-status.model';

export type ReservationSource = 'web' | 'qr' | 'admin';

export interface ReservationDoc {
  id: string;
  folio: string;
  labId: string;
  labName: string;
  teacherUid: string;
  teacherName: string;
  teacherEmail: string;
  subject: string;
  group: string;
  practiceName: string;
  objective: string;
  materialRequired: string;
  practiceType: string;
  practiceTypeOther?: string;
  risky: boolean;
  externalParticipants: boolean;
  protocolRequired: boolean;
  protocolFiles: ProtocolFile[];
  startAt: Timestamp;
  endAt: Timestamp;
  status: ReservationStatus;
  statusReason?: string;
  calendarEventId?: string | null;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  cancelledBy?: string;
  cancelledAt?: Timestamp;
  cancellationReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  source: ReservationSource;
}
