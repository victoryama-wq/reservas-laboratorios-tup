import {
  DocumentReference,
  DocumentData,
  Firestore,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";

import {
  ReservationLogAction,
  ReservationLogDoc,
  ReservationStatus,
} from "../../shared/models";
import {removeUndefinedValues} from "../shared/firestore.utils";

/**
 * Handles reservation log writes.
 */
export class ReservationLogRepository {
  /**
   * Creates a repository.
   *
   * @param {Firestore} db Firestore database.
   */
  constructor(private readonly db: Firestore) {}

  /**
   * Creates a reservation log inside a transaction.
   *
   * @param {Transaction} transaction Firestore transaction.
   * @param {object} params Log params.
   */
  createLog(
      transaction: Transaction,
      params: {
        reservationId: string;
        action: ReservationLogAction;
        actorUid?: string;
        actorEmail?: string;
        previousStatus?: ReservationStatus;
        newStatus?: ReservationStatus;
        note?: string;
        metadata?: Record<string, unknown>;
      },
  ): void {
    const ref = this.createLogRef();
    const log: ReservationLogDoc = {
      id: ref.id,
      reservationId: params.reservationId,
      action: params.action,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      note: params.note,
      metadata: params.metadata,
      createdAt: Timestamp.now(),
    };

    transaction.set(ref, removeUndefinedValues(log));
  }

  /**
   * Creates a reservation log outside a transaction.
   *
   * @param {object} params Log params.
   */
  async createLogDocument(
      params: {
        reservationId: string;
        action: ReservationLogAction;
        actorUid?: string;
        actorEmail?: string;
        previousStatus?: ReservationStatus;
        newStatus?: ReservationStatus;
        note?: string;
        metadata?: Record<string, unknown>;
      },
  ): Promise<void> {
    const ref = this.createLogRef();
    const log: ReservationLogDoc = {
      id: ref.id,
      reservationId: params.reservationId,
      action: params.action,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      note: params.note,
      metadata: params.metadata,
      createdAt: Timestamp.now(),
    };

    await ref.set(removeUndefinedValues(log) as DocumentData);
  }

  /**
   * Creates a log document reference.
   *
   * @return {DocumentReference} Log reference.
   */
  private createLogRef(): DocumentReference {
    return this.db.collection("reservationLogs").doc();
  }
}
