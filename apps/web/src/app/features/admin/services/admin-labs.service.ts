import { inject, Injectable } from '@angular/core';
import {
  collection,
  Firestore,
  getDocs,
  query,
} from 'firebase/firestore';

import { FIREBASE_FIRESTORE } from '../../../core/firebase/firebase.providers';
import { LabDoc } from '../../../shared/models';

export interface AdminLabView {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  visibleInCatalog: boolean;
  minNoticeHours: number;
  responsibleUids: string[];
  responsibleEmails: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AdminLabsService {
  private readonly firestore = inject<Firestore>(FIREBASE_FIRESTORE);

  async listLabs(): Promise<AdminLabView[]> {
    const labsQuery = query(collection(this.firestore, 'labs'));
    const snapshot = await getDocs(labsQuery);

    return snapshot.docs
      .map((document) => this.toView(document.data() as LabDoc, document.id))
      .sort((first, second) =>
        first.name.localeCompare(second.name, 'es-MX'),
      );
  }

  private toView(lab: LabDoc, documentId: string): AdminLabView {
    return {
      id: lab.id || documentId,
      name: lab.name,
      slug: lab.slug,
      active: lab.active,
      visibleInCatalog: lab.visibleInCatalog,
      minNoticeHours: lab.minNoticeHours,
      responsibleUids: lab.responsibleUids ?? [],
      responsibleEmails: lab.responsibleEmails ?? [],
    };
  }
}
