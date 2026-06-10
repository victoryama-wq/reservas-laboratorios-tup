import { inject, Injectable } from '@angular/core';
import {
  collection,
  Firestore,
  getDocs,
  query,
  Timestamp,
} from 'firebase/firestore';
import { Functions, httpsCallable } from 'firebase/functions';

import {
  FIREBASE_FIRESTORE,
  FIREBASE_FUNCTIONS,
} from '../../../core/firebase/firebase.providers';
import { AppUser, UserRole } from '../../../shared/models';

export interface AdminUserView extends AppUser {
  updatedDate: Date | null;
  createdDate: Date | null;
}

export interface AdminUpdateUserInput {
  uid: string;
  role?: UserRole;
  active?: boolean;
  labsAssigned?: string[];
}

export interface AdminUpdateUserOutput {
  uid: string;
  updated: true;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminUsersService {
  private readonly firestore = inject<Firestore>(FIREBASE_FIRESTORE);
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  async listUsers(): Promise<AdminUserView[]> {
    const usersQuery = query(collection(this.firestore, 'users'));
    const snapshot = await getDocs(usersQuery);

    return snapshot.docs
      .map((document) => this.toView(document.data() as AppUser, document.id))
      .sort((first, second) =>
        first.email.localeCompare(second.email, 'es-MX'),
      );
  }

  async updateUser(
    input: AdminUpdateUserInput,
  ): Promise<AdminUpdateUserOutput> {
    const callable = httpsCallable<
      AdminUpdateUserInput,
      AdminUpdateUserOutput
    >(this.functions, 'adminUpdateUser');
    const result = await callable(input);
    return result.data;
  }

  formatDate(value: Date | null): string {
    if (!value) {
      return 'Sin registro';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  }

  private toView(user: AppUser, documentId: string): AdminUserView {
    return {
      ...user,
      uid: user.uid || documentId,
      labsAssigned: user.labsAssigned ?? [],
      createdDate: this.toDate(user.createdAt),
      updatedDate: this.toDate(user.updatedAt),
    };
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Timestamp) {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }
}
