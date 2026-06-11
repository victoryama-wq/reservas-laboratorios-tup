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
import { BlockedPeriodDoc, BlockedPeriodScope, LabSpecialRule } from '../../../shared/models';
import { AdminLabView, AdminLabsService } from './admin-labs.service';

export interface AdminSpecialRuleView extends LabSpecialRule {
  labId: string;
  labName: string;
}

export interface AdminBlockedPeriodView extends BlockedPeriodDoc {
  startDate: Date | null;
  endDate: Date | null;
  labNames: string[];
}

export interface AdminRulesState {
  labs: AdminLabView[];
  specialRules: AdminSpecialRuleView[];
  blockedPeriods: AdminBlockedPeriodView[];
}

export interface AdminCreateSpecialRuleInput {
  labId: string;
  name: string;
  active: boolean;
  termStart?: string;
  termEnd?: string;
  daysOfWeek?: number[];
  blockedStart?: string;
  blockedEnd?: string;
  fullDayBlocked: boolean;
  reason: string;
}

export interface AdminUpdateSpecialRuleInput extends Partial<AdminCreateSpecialRuleInput> {
  labId: string;
  ruleId: string;
}

export interface AdminCreateBlockedPeriodInput {
  name: string;
  description?: string;
  reason: string;
  scope: BlockedPeriodScope;
  labIds?: string[];
  startAt: string;
  endAt: string;
  fullDay: boolean;
  active: boolean;
}

export interface AdminUpdateBlockedPeriodInput extends Partial<AdminCreateBlockedPeriodInput> {
  blockedPeriodId: string;
}

interface AdminCallableOutput {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminRulesService {
  private readonly firestore = inject<Firestore>(FIREBASE_FIRESTORE);
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);
  private readonly labsService = inject(AdminLabsService);

  async loadState(): Promise<AdminRulesState> {
    const [labs, blockedPeriods] = await Promise.all([
      this.labsService.listLabs(),
      this.listBlockedPeriods(),
    ]);
    const labNameById = new Map(labs.map((lab) => [lab.id, lab.name]));

    return {
      labs,
      specialRules: labs.flatMap((lab) =>
        (lab.specialRules ?? []).map((rule) => ({
          ...rule,
          labId: lab.id,
          labName: lab.name,
        })),
      ),
      blockedPeriods: blockedPeriods.map((period) => ({
        ...period,
        labNames: (period.labIds ?? [])
          .map((labId) => labNameById.get(labId) ?? labId),
      })),
    };
  }

  async createSpecialRule(input: AdminCreateSpecialRuleInput): Promise<string> {
    const callable = httpsCallable<AdminCreateSpecialRuleInput, AdminCallableOutput>(
      this.functions,
      'adminCreateSpecialRule',
    );
    const result = await callable(input);
    return result.data.message;
  }

  async updateSpecialRule(input: AdminUpdateSpecialRuleInput): Promise<string> {
    const callable = httpsCallable<AdminUpdateSpecialRuleInput, AdminCallableOutput>(
      this.functions,
      'adminUpdateSpecialRule',
    );
    const result = await callable(input);
    return result.data.message;
  }

  async createBlockedPeriod(input: AdminCreateBlockedPeriodInput): Promise<string> {
    const callable = httpsCallable<AdminCreateBlockedPeriodInput, AdminCallableOutput>(
      this.functions,
      'adminCreateBlockedPeriod',
    );
    const result = await callable(input);
    return result.data.message;
  }

  async updateBlockedPeriod(input: AdminUpdateBlockedPeriodInput): Promise<string> {
    const callable = httpsCallable<AdminUpdateBlockedPeriodInput, AdminCallableOutput>(
      this.functions,
      'adminUpdateBlockedPeriod',
    );
    const result = await callable(input);
    return result.data.message;
  }

  formatDateTime(value: Date | null): string {
    if (!value) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  }

  formatRuleDate(value?: string): string {
    return value || 'Sin limite';
  }

  private async listBlockedPeriods(): Promise<AdminBlockedPeriodView[]> {
    const periodsQuery = query(collection(this.firestore, 'blockedPeriods'));
    const snapshot = await getDocs(periodsQuery);

    return snapshot.docs
      .map((document) => {
        const period = document.data() as BlockedPeriodDoc;
        const view: AdminBlockedPeriodView = {
          ...period,
          id: period.id || document.id,
          labIds: period.labIds ?? [],
          startDate: this.toDate(period.startAt),
          endDate: this.toDate(period.endAt),
          labNames: [],
        };
        return view;
      })
      .sort((first, second) =>
        (second.startDate?.getTime() ?? 0) - (first.startDate?.getTime() ?? 0),
      );
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
