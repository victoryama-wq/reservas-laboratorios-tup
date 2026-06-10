import { inject, Injectable } from '@angular/core';
import {
  collection,
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
          .map((document) => document.data() as LabDoc)
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
        return document ? (document.data() as LabDoc) : null;
      }),
    );
  }

  getLabById(id: string): Observable<LabDoc | null> {
    const labRef = doc(this.firestore, 'labs', id);

    return from(getDoc(labRef)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }

        const lab = snapshot.data() as LabDoc;
        return lab.active && lab.visibleInCatalog ? lab : null;
      }),
    );
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
