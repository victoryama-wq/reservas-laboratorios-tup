import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from 'firebase/functions';
import { from, map, Observable } from 'rxjs';

import { FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.providers';
import { PublicLab, WeeklySchedule } from '../../../shared/models';

interface GetPublicLabsOutput {
  labs: PublicLab[];
}

interface GetPublicLabDetailInput {
  labId?: string;
  slug?: string;
}

interface GetPublicLabDetailOutput {
  lab: PublicLab;
}

@Injectable({
  providedIn: 'root',
})
export class LabService {
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  listActiveVisibleLabs(): Observable<PublicLab[]> {
    const callable = httpsCallable<unknown, GetPublicLabsOutput>(
      this.functions,
      'getPublicLabs',
    );

    return from(callable({})).pipe(
      map((result) =>
        result.data.labs.sort((first, second) =>
          first.name.localeCompare(second.name, 'es'),
        ),
      ),
    );
  }

  getLabBySlug(slug: string): Observable<PublicLab | null> {
    return this.getPublicLabDetail({ slug });
  }

  getLabById(id: string): Observable<PublicLab | null> {
    return this.getPublicLabDetail({ labId: id });
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

  private getPublicLabDetail(
    input: GetPublicLabDetailInput,
  ): Observable<PublicLab | null> {
    const callable = httpsCallable<
      GetPublicLabDetailInput,
      GetPublicLabDetailOutput
    >(this.functions, 'getPublicLabDetail');

    return from(callable(input)).pipe(map((result) => result.data.lab ?? null));
  }
}
