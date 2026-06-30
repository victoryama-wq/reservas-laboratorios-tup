import {initializeApp} from "firebase-admin/app";

initializeApp();

export {createReservation} from
  "./modules/reservations/create-reservation.function";
export {
  approveReservation,
  getReservationProtocolAccess,
  rejectReservation,
} from
  "./modules/reservations/review-reservation.function";
export {cancelReservation} from
  "./modules/reservations/cancel-reservation.function";
export {sendPendingNotifications} from
  "./modules/notifications/send-pending-notifications.function";
export {adminUpdateUser} from
  "./modules/admin/admin-update-user.function";
export {adminPreauthorizeUser} from
  "./modules/admin/admin-preauthorize-user.function";
export {adminRevokePreauthorizedUser} from
  "./modules/admin/admin-revoke-preauthorized-user.function";
export {
  adminCreateLab,
  adminUpdateLab,
  adminValidateLabCalendar,
} from "./modules/admin/admin-lab.function";
export {
  adminCreateSpecialRule,
  adminUpdateSpecialRule,
  adminCreateBlockedPeriod,
  adminUpdateBlockedPeriod,
} from "./modules/admin/admin-rules.function";
export {ensureUserProfile} from
  "./modules/users/ensure-user-profile.function";
