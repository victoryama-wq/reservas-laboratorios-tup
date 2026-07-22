import {ReservationDoc} from "../../shared/models";

export interface ApprovalReasonTransition {
  note?: string;
  fieldsToDelete: Array<keyof ReservationDoc>;
}

export interface CancellationReasonTransition {
  cancellationReason?: string;
  logNote: string;
  notificationReason?: string;
  fieldsToDelete: Array<keyof ReservationDoc>;
}

/**
 * Keeps an approval note in its log/notification channels, never as a generic
 * reservation status reason.
 *
 * @param {string | undefined} note Optional approval note.
 * @return {ApprovalReasonTransition} Approval reason transition.
 */
export function buildApprovalReasonTransition(
    note?: string,
): ApprovalReasonTransition {
  const normalizedNote = normalizeOptionalReason(note);

  return {
    note: normalizedNote,
    fieldsToDelete: ["statusReason"],
  };
}

/**
 * Keeps cancellation reasons in their dedicated field and removes any generic
 * reason inherited from a previous reservation status.
 *
 * @param {string | undefined} reason Optional cancellation reason.
 * @return {CancellationReasonTransition} Cancellation reason transition.
 */
export function buildCancellationReasonTransition(
    reason?: string,
): CancellationReasonTransition {
  const normalizedReason = normalizeOptionalReason(reason);

  return {
    cancellationReason: normalizedReason,
    logNote: normalizedReason ?? "Reserva cancelada sin motivo especificado.",
    notificationReason: normalizedReason,
    fieldsToDelete: normalizedReason ?
      ["statusReason"] :
      ["statusReason", "cancellationReason"],
  };
}

/**
 * Normalizes optional human-entered reasons.
 *
 * @param {string | undefined} value Optional text.
 * @return {string | undefined} Normalized text.
 */
function normalizeOptionalReason(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
