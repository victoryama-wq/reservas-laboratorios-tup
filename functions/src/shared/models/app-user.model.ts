import {Timestamp} from "firebase-admin/firestore";
import {UserRole} from "./user-role.model";

export type UserRequesterType = "docente" | "administrativo";

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  requesterType?: UserRequesterType;
  labsAssigned: string[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
