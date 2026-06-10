import {ReservationSource} from "../../shared/models/reservation.model";
import {ReservationStatus} from "../../shared/models/reservation-status.model";

export interface ProtocolFileInput {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUid: string;
  uploadedAt: string;
}

export interface CreateReservationInput {
  labId?: string;
  labSlug?: string;
  subject: string;
  group: string;
  practiceName: string;
  objective: string;
  materialRequired: string;
  practiceType: string;
  practiceTypeOther?: string;
  risky: boolean;
  externalParticipants: boolean;
  startAt: string;
  endAt: string;
  protocolFiles?: ProtocolFileInput[];
  source: ReservationSource;
}

export interface CreateReservationOutput {
  reservationId: string;
  folio: string;
  status: ReservationStatus;
  message: string;
}

export interface ReservationValidationContext {
  uid: string;
  email: string;
  displayName: string;
}

export interface RejectionDecision {
  status: Extract<
    ReservationStatus,
    | "RECHAZADA_CONFLICTO"
    | "RECHAZADA_REGLA_HORARIO"
    | "RECHAZADA_MIN_ANTICIPACION"
  >;
  reason: string;
}
