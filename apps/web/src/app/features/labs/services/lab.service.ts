import { inject, Injectable } from '@angular/core';
import {
  collection,
  DocumentData,
  doc,
  Firestore,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { from, map, Observable } from 'rxjs';

import { FIREBASE_FIRESTORE } from '../../../core/firebase/firebase.providers';
import { LabDoc, WeeklySchedule } from '../../../shared/models';

@Injectable({
  providedIn: 'root',
})
export class LabService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly labsCollection = collection(this.firestore, 'labs');

  listActiveVisibleLabs(): Observable<LabDoc[]> {
    const labsQuery = query(
      this.labsCollection,
      where('active', '==', true),
      where('visibleInCatalog', '==', true),
    );

    return from(getDocs(labsQuery)).pipe(
      map((snapshot) =>
        snapshot.docs
          .map((document) => this.normalizeLab(document.id, document.data()))
          .sort((first, second) => first.name.localeCompare(second.name)),
      ),
    );
  }

  getLabBySlug(slug: string): Observable<LabDoc | null> {
    const labsQuery = query(
      this.labsCollection,
      where('slug', '==', slug),
      where('active', '==', true),
      where('visibleInCatalog', '==', true),
      limit(1),
    );

    return from(getDocs(labsQuery)).pipe(
      map((snapshot) => {
        const document = snapshot.docs.at(0);
        return document
          ? this.normalizeLab(document.id, document.data())
          : null;
      }),
    );
  }

  getLabById(id: string): Observable<LabDoc | null> {
    return from(this.findLabByIdOrSlug(id));
  }

  private async findLabByIdOrSlug(id: string): Promise<LabDoc | null> {
    const labRef = doc(this.firestore, 'labs', id);
    const directSnapshot = await getDoc(labRef);

    if (directSnapshot.exists()) {
      return this.ensureCatalogVisible(
        this.normalizeLab(directSnapshot.id, directSnapshot.data()),
      );
    }

    const byFieldId = await getDocs(
      query(this.labsCollection, where('id', '==', id), limit(1)),
    );
    const fieldIdDocument = byFieldId.docs.at(0);

    if (fieldIdDocument) {
      return this.ensureCatalogVisible(
        this.normalizeLab(fieldIdDocument.id, fieldIdDocument.data()),
      );
    }

    const bySlug = await getDocs(
      query(this.labsCollection, where('slug', '==', id), limit(1)),
    );
    const slugDocument = bySlug.docs.at(0);

    if (slugDocument) {
      return this.ensureCatalogVisible(
        this.normalizeLab(slugDocument.id, slugDocument.data()),
      );
    }

    return null;
  }

  private normalizeLab(documentId: string, data: DocumentData): LabDoc {
    return {
      ...(data as LabDoc),
      id: documentId,
    };
  }

  private ensureCatalogVisible(lab: LabDoc): LabDoc | null {
    return lab.active && lab.visibleInCatalog ? lab : null;
  }

  getWeeklyScheduleSummary(schedule: WeeklySchedule): string {
    const weekday = schedule.monday;
    const saturday = schedule.saturday;

    const weekdayText = weekday?.enabled
      ? `Lun a vie ${weekday.start} - ${weekday.end}`
      : 'Lun a vie sin horario';
    const saturdayText = saturday?.enabled
      ? `Sab ${saturday.start} - ${saturday.end}`
      : 'Sab sin horario';

    return `${weekdayText}. ${saturdayText}. Domingo cerrado.`;
  }
}
