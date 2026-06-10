import {Timestamp} from "firebase-admin/firestore";

export type BlockedPeriodScope = "global" | "lab";

export interface BlockedPeriodDoc {
  id: string;
  name: string;
  description?: string;
  reason: string;
  scope: BlockedPeriodScope;
  labIds?: string[];
  startAt: Timestamp;
  endAt: Timestamp;
  fullDay: boolean;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
