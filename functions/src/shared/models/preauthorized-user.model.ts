import {Timestamp} from "firebase-admin/firestore";

export interface PreauthorizedUserDoc {
  email: string;
  displayName?: string;
  role: "responsable_laboratorio" | "admin_sistemas";
  labsAssigned: string[];
  active: boolean;
  claimedByUid?: string;
  claimedAt?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
