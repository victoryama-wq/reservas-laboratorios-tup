import { inject, Injectable } from '@angular/core';
import { doc, getDocFromServer } from 'firebase/firestore';
import { Functions, httpsCallable } from 'firebase/functions';

import {
  FIREBASE_FIRESTORE,
  FIREBASE_FUNCTIONS,
} from '../firebase/firebase.providers';
import {
  AppUser,
  UserRequesterType,
  UserRole,
} from '../../shared/models';

export type UserProfileStatus = 'active' | 'missing' | 'inactive' | 'invalid-role' | 'error';
export type EnsureUserProfileStatus =
  | 'EXISTING_PROFILE'
  | 'DOCENTE_PROFILE_CREATED'
  | 'ADMINISTRATIVE_PROFILE_CREATED'
  | 'PREAUTHORIZED_PROFILE_CREATED'
  | 'ACCESS_DENIED'
  | 'PENDING_ACCESS';

export interface UserProfileResult {
  status: UserProfileStatus;
  profile: AppUser | null;
  error?: unknown;
}

export interface EnsureUserProfileOutput {
  status: EnsureUserProfileStatus;
  uid: string;
  email: string;
  role?: UserRole;
  requesterType?: UserRequesterType;
  active?: boolean;
  message: string;
}

const VALID_ROLES: readonly UserRole[] = [
  'docente',
  'responsable_laboratorio',
  'admin_sistemas',
];

@Injectable({
  providedIn: 'root',
})
export class UserProfileService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  async getProfile(uid: string): Promise<UserProfileResult> {
    try {
      const profileRef = doc(this.firestore, 'users', uid);
      const snapshot = await getDocFromServer(profileRef);

      if (!snapshot.exists()) {
        return { status: 'missing', profile: null };
      }

      const profile = {
        ...(snapshot.data() as AppUser),
        uid,
      };

      if (!this.isValidRole(profile.role)) {
        return { status: 'invalid-role', profile: null };
      }

      if (!profile.active) {
        return { status: 'inactive', profile };
      }

      return { status: 'active', profile };
    } catch (error) {
      return { status: 'error', profile: null, error };
    }
  }

  isValidRole(role: unknown): role is UserRole {
    return VALID_ROLES.includes(role as UserRole);
  }

  async ensureUserProfile(): Promise<EnsureUserProfileOutput> {
    const callable = httpsCallable<void, EnsureUserProfileOutput>(
      this.functions,
      'ensureUserProfile',
    );
    const result = await callable();
    return result.data;
  }
}
