const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  buildApprovalReasonTransition,
  buildCancellationReasonTransition,
} = require(
    "../lib/modules/reservations/reservation-transition-reasons.utils",
);

test("approval note remains in the approval channels", () => {
  const transition = buildApprovalReasonTransition("  Aprobada con nota  ");

  assert.equal(transition.note, "Aprobada con nota");
  assert.deepEqual(transition.fieldsToDelete, ["statusReason"]);
  assert.equal(Object.hasOwn(transition, "statusReason"), false);
});

test("approval without note still clears a prior generic reason", () => {
  const transition = buildApprovalReasonTransition();

  assert.equal(transition.note, undefined);
  assert.deepEqual(transition.fieldsToDelete, ["statusReason"]);
});

test("cancellation with reason uses only cancellationReason", () => {
  const transition = buildCancellationReasonTransition("  Cambio de fecha  ");

  assert.equal(transition.cancellationReason, "Cambio de fecha");
  assert.equal(transition.notificationReason, "Cambio de fecha");
  assert.equal(transition.logNote, "Cambio de fecha");
  assert.deepEqual(transition.fieldsToDelete, ["statusReason"]);
});

test("cancellation without reason clears inherited reasons", () => {
  const transition = buildCancellationReasonTransition();

  assert.equal(transition.cancellationReason, undefined);
  assert.equal(transition.notificationReason, undefined);
  assert.equal(
      transition.logNote,
      "Reserva cancelada sin motivo especificado.",
  );
  assert.deepEqual(
      transition.fieldsToDelete,
      ["statusReason", "cancellationReason"],
  );
});
