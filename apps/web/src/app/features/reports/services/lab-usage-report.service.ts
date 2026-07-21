import { inject, Injectable } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import { Functions, httpsCallable } from 'firebase/functions';

import { FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.providers';
import {
  GetLabUsageReportInput,
  GetLabUsageReportOutput,
} from '../models/lab-usage-report.model';

@Injectable({ providedIn: 'root' })
export class LabUsageReportService {
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  async getUsageReport(
    input: GetLabUsageReportInput,
  ): Promise<GetLabUsageReportOutput> {
    const callable = httpsCallable<
      GetLabUsageReportInput,
      GetLabUsageReportOutput
    >(this.functions, 'getLabUsageReport');

    try {
      const result = await callable(input);
      return result.data;
    } catch (error) {
      throw new Error(this.toUserMessage(error));
    }
  }

  private toUserMessage(error: unknown): string {
    if (!(error instanceof FirebaseError)) {
      return 'No fue posible generar el reporte. Intente nuevamente.';
    }

    const messages: Record<string, string> = {
      'functions/unauthenticated':
        'La sesion no esta disponible. Inicie sesion nuevamente.',
      'functions/permission-denied':
        'No tiene permiso para consultar el laboratorio solicitado.',
      'functions/invalid-argument':
        'Revise el periodo y los laboratorios seleccionados.',
      'functions/unavailable':
        'El servicio de reportes no esta disponible temporalmente.',
    };

    return (
      messages[error.code] ??
      'No fue posible generar el reporte. Intente nuevamente.'
    );
  }
}
