import {Firestore} from "firebase-admin/firestore";

import {NotificationDoc} from "../../shared/models";
import {ReservationLogRepository} from "../logs/reservation-log.repository";
import {GmailService} from "./gmail.service";
import {NotificationRepository} from "./notification.repository";

export interface NotificationDeliveryResult {
  notificationId: string;
  status: "SENT" | "FAILED";
  error?: string;
}

/**
 * Sends notification documents and updates delivery status.
 */
export class NotificationDeliveryService {
  private readonly notificationRepository: NotificationRepository;
  private readonly logRepository: ReservationLogRepository;

  /**
   * Creates a delivery service.
   *
   * @param {Firestore} db Firestore database.
   * @param {GmailService} gmailService Gmail API service.
   */
  constructor(
      db: Firestore,
      private readonly gmailService = new GmailService(),
  ) {
    this.notificationRepository = new NotificationRepository(db);
    this.logRepository = new ReservationLogRepository(db);
  }

  /**
   * Sends a notification and records SENT or FAILED.
   *
   * @param {NotificationDoc} notification Notification document.
   * @return {Promise<NotificationDeliveryResult>} Delivery result.
   */
  async sendNotification(
      notification: NotificationDoc,
  ): Promise<NotificationDeliveryResult> {
    if (!notification.to.length) {
      return this.markFailed(
          notification,
          "La notificacion no tiene destinatarios configurados.",
      );
    }

    try {
      const messageId = await this.gmailService.sendEmail({
        to: notification.to,
        cc: notification.cc,
        subject: notification.subject,
        body: notification.body,
        htmlBody: notification.htmlBody,
      });
      await this.notificationRepository.markSent(
          notification.id,
          messageId,
      );
      await this.createEmailLog(notification, "EMAIL_SENT", undefined, {
        providerMessageId: messageId,
      });

      return {
        notificationId: notification.id,
        status: "SENT",
      };
    } catch (error) {
      return this.markFailed(notification, toSafeEmailError(error));
    }
  }

  /**
   * Marks a notification failed and writes EMAIL_ERROR.
   *
   * @param {NotificationDoc} notification Notification document.
   * @param {string} error Failure reason.
   * @return {Promise<NotificationDeliveryResult>} Delivery result.
   */
  private async markFailed(
      notification: NotificationDoc,
      error: string,
  ): Promise<NotificationDeliveryResult> {
    await this.notificationRepository.markFailed(notification.id, error);
    await this.createEmailLog(notification, "EMAIL_ERROR", error);

    return {
      notificationId: notification.id,
      status: "FAILED",
      error,
    };
  }

  /**
   * Creates a reservation email log when a reservation id exists.
   *
   * @param {NotificationDoc} notification Notification document.
   * @param {"EMAIL_SENT" | "EMAIL_ERROR"} action Log action.
   * @param {string | undefined} note Optional note.
   * @param {Record<string, unknown> | undefined} metadata Optional metadata.
   */
  private async createEmailLog(
      notification: NotificationDoc,
      action: "EMAIL_SENT" | "EMAIL_ERROR",
      note?: string,
      metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!notification.reservationId) {
      return;
    }

    await this.logRepository.createLogDocument({
      reservationId: notification.reservationId,
      action,
      note,
      metadata: {
        notificationId: notification.id,
        notificationType: notification.type,
        ...metadata,
      },
    });
  }
}

/**
 * Converts Gmail errors to a safe, non-secret message.
 *
 * @param {unknown} error Error object.
 * @return {string} Safe error text.
 */
function toSafeEmailError(error: unknown): string {
  const record = error as {
    message?: unknown;
    code?: unknown;
    status?: unknown;
    response?: {
      status?: unknown;
      data?: {
        error?: unknown;
        error_description?: unknown;
        message?: unknown;
      };
    };
  };

  const message = typeof record.message === "string" ?
    record.message :
    undefined;
  const googleMessage = typeof record.response?.data?.message === "string" ?
    record.response.data.message :
    undefined;
  const googleError = typeof record.response?.data?.error === "string" ?
    record.response.data.error :
    undefined;
  const code = record.code ?? record.status ?? record.response?.status;

  return [
    "No fue posible enviar el correo por Gmail API.",
    code ? `Codigo: ${String(code)}.` : undefined,
    googleError ? `Error: ${googleError}.` : undefined,
    googleMessage ?? message,
  ].filter((part): part is string => Boolean(part)).join(" ");
}
