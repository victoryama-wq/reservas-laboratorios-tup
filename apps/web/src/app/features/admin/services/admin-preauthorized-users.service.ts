import { inject, Injectable } from '@angular/core';
import {
  collection,
  Firestore,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { Functions, httpsCallable } from 'firebase/functions';

import {
  FIREBASE_FIRESTORE,
  FIREBASE_FUNCTIONS,
} from '../../../core/firebase/firebase.providers';

export type PreauthorizedRole = 'responsable_laboratorio' | 'admin_sistemas';

export interface PreauthorizedUserView {
  email: string;
  displayName?: string;
  role: PreauthorizedRole;
  labsAssigned: string[];
  active: boolean;
  claimedByUid?: string;
  claimedDate: Date | null;
  revokedBy?: string;
  revokedDate: Date | null;
  revocationReason?: string;
  createdBy: string;
  createdDate: Date | null;
  updatedDate: Date | null;
}

interface PreauthorizedUserDoc {
  email?: string;
  displayName?: string;
  role?: PreauthorizedRole;
  labsAssigned?: string[];
  active?: boolean;
  claimedByUid?: string;
  claimedAt?: unknown;
  revokedBy?: string;
  revokedAt?: unknown;
  revocationReason?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminPreauthorizeUserInput {
  email: string;
  displayName?: string;
  role: PreauthorizedRole;
  active: boolean;
  labsAssigned?: string[];
}

export interface AdminPreauthorizeUserOutput {
  email: string;
  created: boolean;
  updated: boolean;
  message: string;
}

export interface AdminRevokePreauthorizedUserInput {
  email: string;
  reason?: string;
}

export interface AdminRevokePreauthorizedUserOutput {
  email: string;
  revoked: true;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminPreauthorizedUsersService {
  private readonly firestore = inject<Firestore>(FIREBASE_FIRESTORE);
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  async listPreauthorizations(): Promise<PreauthorizedUserView[]> {
    const snapshot = await getDocs(collection(this.firestore, 'preauthorizedUsers'));

    return snapshot.docs
      .map((document) =>
        this.toView(document.data() as PreauthorizedUserDoc, document.id),
      )
      .sort((first, second) =>
        first.email.localeCompare(second.email, 'es-MX'),
      );
  }

  async listPendingPreauthorizations(): Promise<PreauthorizedUserView[]> {
    const preauthorizations = await this.listPreauthorizations();
    return preauthorizations
      .filter((preauth) => !preauth.claimedByUid)
      .sort((first, second) =>
        first.email.localeCompare(second.email, 'es-MX'),
      );
  }

  async preauthorizeUser(
    input: AdminPreauthorizeUserInput,
  ): Promise<AdminPreauthorizeUserOutput> {
    const callable = httpsCallable<
      AdminPreauthorizeUserInput,
      AdminPreauthorizeUserOutput
    >(this.functions, 'adminPreauthorizeUser');
    const result = await callable(input);
    return result.data;
  }

  async revokePreauthorizedUser(
    input: AdminRevokePreauthorizedUserInput,
  ): Promise<AdminRevokePreauthorizedUserOutput> {
    const callable = httpsCallable<
      AdminRevokePreauthorizedUserInput,
      AdminRevokePreauthorizedUserOutput
    >(this.functions, 'adminRevokePreauthorizedUser');
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

  private toView(
    preauth: PreauthorizedUserDoc,
    documentId: string,
  ): PreauthorizedUserView {
    return {
      email: preauth.email ?? documentId,
      displayName: preauth.displayName ?? '',
      role: preauth.role ?? 'responsable_laboratorio',
      labsAssigned: preauth.labsAssigned ?? [],
      active: preauth.active === true,
      claimedByUid: preauth.claimedByUid,
      claimedDate: this.toDate(preauth.claimedAt),
      revokedBy: preauth.revokedBy,
      revokedDate: this.toDate(preauth.revokedAt),
      revocationReason: preauth.revocationReason,
      createdBy: preauth.createdBy ?? '',
      createdDate: this.toDate(preauth.createdAt),
      updatedDate: this.toDate(preauth.updatedAt),
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
