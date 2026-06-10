import {getFirestore} from "firebase-admin/firestore";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {GOOGLE_WORKSPACE_SECRETS} from
  "../google-workspace/google-workspace-auth.service";
import {ReservationRepository} from "../reservations/reservation.repository";
import {NotificationDeliveryService} from
  "./notification-delivery.service";
import {NotificationRepository} from "./notification.repository";

const REGION = "us-central1";
const DEFAULT_LIMIT = 20;

export interface SendPendingNotificationsOutput {
  processed: number;
  sent: number;
  failed: number;
}

/**
 * Sends pending Gmail notifications. Admin/Sistemas only.
 */
export const sendPendingNotifications = onCall(
    {
      region: REGION,
      invoker: "public",
      secrets: GOOGLE_WORKSPACE_SECRETS,
    },
    async (
        request: CallableRequest<unknown>,
    ): Promise<SendPendingNotificationsOutput> => {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new HttpsError(
            "unauthenticated",
            "Debe iniciar sesion para enviar notificaciones.",
        );
      }

      const db = getFirestore();
      const reservationRepository = new ReservationRepository(db);
      const profile = await reservationRepository.getUserProfile(uid);

      if (!profile?.active || profile.role !== "admin_sistemas") {
        throw new HttpsError(
            "permission-denied",
            "Solo Admin/Sistemas puede enviar notificaciones pendientes.",
        );
      }

      const notificationRepository = new NotificationRepository(db);
      const deliveryService = new NotificationDeliveryService(db);
      const notifications = await notificationRepository
          .listPendingNotifications(DEFAULT_LIMIT);
      const results = await Promise.all(
          notifications.map((notification) =>
            deliveryService.sendNotification(notification),
          ),
      );

      return {
        processed: results.length,
        sent: results.filter((result) => result.status === "SENT").length,
        failed: results.filter((result) => result.status === "FAILED").length,
      };
    },
);
