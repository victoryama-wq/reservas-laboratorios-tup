import { Timestamp } from 'firebase/firestore';
import { UserRole } from './user-role.model';

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  labsAssigned: string[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
