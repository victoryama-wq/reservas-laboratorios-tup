import {Timestamp} from "firebase-admin/firestore";
import {UserRequesterType} from "./app-user.model";
import {EvidenceFile} from "./evidence-file.model";
import {ProtocolFile} from "./protocol-file.model";
import {ReservationStatus} from "./reservation-status.model";

export type ReservationSource = "web" | "qr" | "admin";
export type ReservationMode =
  | "academic"
  | "administrative"
  | "responsible_direct";

export interface ReservationDoc {
  id: string;
  folio: string;
  labId: string;
  labName: string;
  teacherUid: string;
  teacherName: string;
  teacherEmail: string;
  requestedByRole?: "docente" | "responsable_laboratorio" | "admin_sistemas";
  requesterType?: UserRequesterType;
  guestTeacherEmail?: string;
  reservationMode?: ReservationMode;
  reservationGroupId?: string;
  reservationGroupSize?: number;
  reservationGroupIndex?: number;
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
  protocolRequired: boolean;
  protocolFiles: ProtocolFile[];
  evidenceFiles?: EvidenceFile[];
  evidenceCleanupAt?: Timestamp;
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
