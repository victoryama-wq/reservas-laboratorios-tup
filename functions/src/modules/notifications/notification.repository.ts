import {
  DocumentReference,
  Firestore,
  QueryDocumentSnapshot,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";

import {
  NotificationDoc,
  NotificationType,
} from "../../shared/models";
import {removeUndefinedValues} from "../shared/firestore.utils";

export interface CreatedNotification {
  id: string;
  notification: NotificationDoc;
}

/**
 * Handles pending notification writes.
 */
export class NotificationRepository {
  /**
   * Creates a repository.
   *
   * @param {Firestore} db Firestore database.
   */
  constructor(private readonly db: Firestore) {}

  /**
   * Creates a pending notification document.
   *
   * @param {Transaction} transaction Firestore transaction.
   * @param {object} params Notification params.
   * @return {CreatedNotification} Created notification metadata.
   */
  createPendingNotification(
      transaction: Transaction,
      params: {
        reservationId: string;
        type: NotificationType;
        to: string[];
        cc?: string[];
        subject: string;
        body: string;
        htmlBody?: string;
      },
  ): CreatedNotification {
    const ref = this.createNotificationRef();
    const now = Timestamp.now();
    const notification: NotificationDoc = {
      id: ref.id,
      reservationId: params.reservationId,
      type: params.type,
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      body: params.body,
      htmlBody: params.htmlBody,
      status: "PENDING",
      provider: "gmail_api",
      createdAt: now,
      updatedAt: now,
    };

    transaction.set(ref, removeUndefinedValues(notification));
    return {
      id: ref.id,
      notification,
    };
  }

  /**
   * Lists pending notifications for controlled delivery.
   *
   * @param {number} limit Maximum documents to process.
   * @return {Promise<NotificationDoc[]>} Pending notifications.
   */
  async listPendingNotifications(limit: number): Promise<NotificationDoc[]> {
    const snapshot = await this.db
        .collection("notifications")
        .where("status", "==", "PENDING")
        .limit(limit)
        .get();

    return snapshot.docs.map((document) => this.toNotificationDoc(document));
  }

  /**
   * Marks a notification as sent.
   *
   * @param {string} notificationId Notification id.
   * @param {string} providerMessageId Gmail message id.
   */
  async markSent(
      notificationId: string,
      providerMessageId: string,
  ): Promise<void> {
    await this.db.collection("notifications").doc(notificationId).update({
      status: "SENT",
      sentAt: Timestamp.now(),
      providerMessageId,
      error: null,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Marks a notification as failed.
   *
   * @param {string} notificationId Notification id.
   * @param {string} error Failure reason.
   */
  async markFailed(notificationId: string, error: string): Promise<void> {
    await this.db.collection("notifications").doc(notificationId).update({
      status: "FAILED",
      error,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Converts a notification snapshot to model.
   *
   * @param {QueryDocumentSnapshot} document Firestore document.
   * @return {NotificationDoc} Notification document.
   */
  private toNotificationDoc(
      document: QueryDocumentSnapshot,
  ): NotificationDoc {
    return document.data() as NotificationDoc;
  }

  /**
   * Creates a notification document reference.
   *
   * @return {DocumentReference} Notification reference.
   */
  private createNotificationRef(): DocumentReference {
    return this.db.collection("notifications").doc();
  }
}
