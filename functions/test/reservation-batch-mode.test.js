const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  parseCreateReservationInput,
  validateReservationModeForProfile,
} = require("../lib/modules/reservations/reservation.validators");

function isoInDays(days, hour = 14) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
}

function academicInput(overrides = {}) {
  return {
    labId: "lab-1",
    subject: "Anatomia",
    group: "A",
    practiceName: "Practica de prueba",
    objective: "Validar el flujo",
    materialRequired: "Ninguno",
    practiceType: "Taller",
    risky: false,
    externalParticipants: false,
    startAt: isoInDays(1),
    endAt: isoInDays(1, 15),
    source: "web",
    ...overrides,
  };
}

test("accepts up to 20 unique occurrences inside the 90-day range", () => {
  const occurrences = Array.from({length: 20}, (_, index) => ({
    startAt: isoInDays(index + 1),
    endAt: isoInDays(index + 1, 15),
  }));

  const result = parseCreateReservationInput(academicInput({occurrences}));

  assert.equal(result.occurrences.length, 20);
  assert.equal(result.reservationMode, "academic");
});

test("rejects a batch larger than 20 occurrences", () => {
  const occurrences = Array.from({length: 21}, (_, index) => ({
    startAt: isoInDays(index + 1),
    endAt: isoInDays(index + 1, 15),
  }));

  assert.throws(
      () => parseCreateReservationInput(academicInput({occurrences})),
      /maximo 20 fechas/,
  );
});

test("rejects occurrences outside the next 90 calendar days", () => {
  assert.throws(
      () => parseCreateReservationInput(academicInput({
        occurrences: [{
          startAt: isoInDays(91),
          endAt: isoInDays(91, 15),
        }],
      })),
      /proximos 90 dias/,
  );
});

test("normalizes the responsible direct form without academic risk fields", () => {
  const result = parseCreateReservationInput({
    ...academicInput(),
    reservationMode: "responsible_direct",
    guestTeacherEmail: "DOCENTE@tecplayacar.edu.mx",
    description: "Reunion de preparacion",
    practiceNumber: "  4  ",
  });

  assert.equal(result.reservationMode, "responsible_direct");
  assert.equal(result.subject, "");
  assert.equal(result.risky, false);
  assert.equal(result.externalParticipants, false);
  assert.equal(result.practiceTypeOther, "Reserva operativa");
  assert.equal(result.practiceNumber, "4");
  assert.equal(result.guestTeacherEmail, "docente@tecplayacar.edu.mx");
});

test("normalizes the administrative form with safety conditions", () => {
  const result = parseCreateReservationInput({
    ...academicInput(),
    reservationMode: "administrative",
    subject: "",
    group: "",
    objective: "",
    practiceType: "",
    risky: true,
    externalParticipants: false,
    description: "Actividad institucional",
  });

  assert.equal(result.reservationMode, "administrative");
  assert.equal(result.subject, "");
  assert.equal(result.practiceTypeOther, "Actividad administrativa");
  assert.equal(result.risky, true);
  assert.equal(result.description, "Actividad institucional");
});

test("allows administrative mode only for administrative requesters", () => {
  const input = parseCreateReservationInput({
    ...academicInput(),
    reservationMode: "administrative",
  });
  const administrativeProfile = {
    uid: "administrative-1",
    displayName: "Personal administrativo",
    email: "nombre.apellido@tecplayacar.edu.mx",
    role: "docente",
    requesterType: "administrativo",
    labsAssigned: [],
    active: true,
  };

  assert.doesNotThrow(() =>
    validateReservationModeForProfile(
        input,
        administrativeProfile,
        {id: "lab-1"},
    ),
  );
  assert.throws(
      () => validateReservationModeForProfile(
          parseCreateReservationInput(academicInput()),
          administrativeProfile,
          {id: "lab-1"},
      ),
      /formulario adaptado/,
  );
});

test("prevents a teacher from using administrative mode", () => {
  const input = parseCreateReservationInput({
    ...academicInput(),
    reservationMode: "administrative",
  });
  const teacherProfile = {
    uid: "teacher-1",
    displayName: "Docente",
    email: "tup-d1@tecplayacar.edu.mx",
    role: "docente",
    requesterType: "docente",
    labsAssigned: [],
    active: true,
  };

  assert.throws(
      () => validateReservationModeForProfile(
          input,
          teacherProfile,
          {id: "lab-1"},
      ),
      /formulario academico/,
  );
});

test("allows responsible direct mode only for an assigned lab", () => {
  const input = parseCreateReservationInput({
    ...academicInput(),
    reservationMode: "responsible_direct",
  });
  const profile = {
    uid: "responsible-1",
    displayName: "Responsable",
    email: "responsable@tecplayacar.edu.mx",
    role: "responsable_laboratorio",
    labsAssigned: ["lab-1"],
    active: true,
  };
  const lab = {id: "lab-1"};

  assert.doesNotThrow(() =>
    validateReservationModeForProfile(input, profile, lab),
  );
  assert.throws(
      () => validateReservationModeForProfile(
          input,
          {...profile, labsAssigned: []},
          lab,
      ),
      /laboratorios asignados/,
  );
});

test("prevents a responsible from bypassing the simplified mode", () => {
  const input = parseCreateReservationInput(academicInput());
  const profile = {
    uid: "responsible-1",
    displayName: "Responsable",
    email: "responsable@tecplayacar.edu.mx",
    role: "responsable_laboratorio",
    labsAssigned: ["lab-1"],
    active: true,
  };

  assert.throws(
      () => validateReservationModeForProfile(input, profile, {id: "lab-1"}),
      /formulario simplificado/,
  );
});

test("allows admin direct mode for any laboratory", () => {
  const input = parseCreateReservationInput({
    ...academicInput(),
    reservationMode: "responsible_direct",
  });
  const profile = {
    uid: "admin-1",
    displayName: "Admin",
    email: "admin@tecplayacar.edu.mx",
    role: "admin_sistemas",
    labsAssigned: [],
    active: true,
  };

  assert.doesNotThrow(() =>
    validateReservationModeForProfile(input, profile, {id: "lab-1"}),
  );
});

test("prevents admin from bypassing the simplified mode", () => {
  const input = parseCreateReservationInput(academicInput());
  const profile = {
    uid: "admin-1",
    displayName: "Admin",
    email: "admin@tecplayacar.edu.mx",
    role: "admin_sistemas",
    labsAssigned: [],
    active: true,
  };

  assert.throws(
      () => validateReservationModeForProfile(input, profile, {id: "lab-1"}),
      /formulario simplificado/,
  );
});

test("rejects direct mode for a teacher", () => {
  const input = parseCreateReservationInput({
    ...academicInput(),
    reservationMode: "responsible_direct",
  });
  const profile = {
    uid: "teacher-1",
    displayName: "Docente",
    email: "tup-d1@tecplayacar.edu.mx",
    role: "docente",
    labsAssigned: [],
    active: true,
  };

  assert.throws(
      () => validateReservationModeForProfile(input, profile, {id: "lab-1"}),
      /formulario academico/,
  );
});

test("rejects a non-institutional invited teacher address", () => {
  assert.throws(
      () => parseCreateReservationInput(academicInput({
        reservationMode: "responsible_direct",
        guestTeacherEmail: "persona@example.com",
      })),
      /correo invitado debe ser institucional/,
  );
});
