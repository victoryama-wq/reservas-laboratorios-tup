import { Timestamp } from 'firebase/firestore';

export interface PreauthorizedUserDoc {
  email: string;
  displayName?: string;
  role: 'responsable_laboratorio' | 'admin_sistemas';
  labsAssigned: string[];
  active: boolean;
  claimedByUid?: string;
  claimedAt?: Timestamp;
  revokedBy?: string;
  revokedAt?: Timestamp;
  revocationReason?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
