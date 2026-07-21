const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  buildReservationCalendarEventId,
  CalendarEventConsistencyError,
  GoogleCalendarService,
} = require("../lib/modules/calendar/google-calendar.service");

const START = new Date("2026-07-22T14:00:00.000Z");
const END = new Date("2026-07-22T15:00:00.000Z");

function timestamp(date) {
  return {toDate: () => date};
}

function reservation(overrides = {}) {
  return {
    id: "reservation-123",
    folio: "RES-20260722-TEST",
    labId: "lab-1",
    labName: "Laboratorio de prueba",
    teacherUid: "teacher-1",
    teacherName: "Docente Prueba",
    teacherEmail: "docente@tecplayacar.edu.mx",
    subject: "Pruebas",
    group: "A",
    practiceName: "Idempotencia",
    objective: "Validar Calendar",
    materialRequired: "Ninguno",
    practiceType: "Taller",
    risky: false,
    externalParticipants: false,
    protocolRequired: false,
    protocolFiles: [],
    startAt: timestamp(START),
    endAt: timestamp(END),
    status: "CONFIRMADA",
    source: "web",
    calendarEventId: null,
    ...overrides,
  };
}

function lab() {
  return {
    id: "lab-1",
    calendarId: "calendar@group.calendar.google.com",
  };
}

function eventFor(value, eventId, overrides = {}) {
  return {
    id: eventId,
    status: "confirmed",
    start: {dateTime: value.startAt.toDate().toISOString()},
    end: {dateTime: value.endAt.toDate().toISOString()},
    extendedProperties: {
      private: {
        reservationId: value.id,
        sourceSystem: "reservas-laboratorios-tup",
        idempotencyVersion: "1",
      },
    },
    ...overrides,
  };
}

function missingError(status = 404) {
  return Object.assign(new Error("missing"), {code: status});
}

function fakeClient(handlers = {}) {
  return {
    events: {
      get: handlers.get || (async () => {
        throw missingError();
      }),
      list: handlers.list || (async () => ({data: {items: []}})),
      insert: handlers.insert || (async ({requestBody}) => ({
        data: {id: requestBody.id},
      })),
      delete: handlers.delete || (async () => ({data: {}})),
    },
  };
}

function service(client) {
  return new GoogleCalendarService(async () => client);
}

test("buildReservationCalendarEventId is stable and Calendar-compatible", () => {
  const first = buildReservationCalendarEventId("reservation-123");
  const second = buildReservationCalendarEventId("reservation-123");
  assert.equal(first, second);
  assert.match(first, /^tup[0-9a-f]{64}$/);
  assert.notEqual(first, buildReservationCalendarEventId("reservation-124"));
});

test("get 404 followed by insert creates deterministic event", async () => {
  let insertedBody;
  const client = fakeClient({
    insert: async ({requestBody}) => {
      insertedBody = requestBody;
      return {data: {id: requestBody.id}};
    },
  });
  const value = reservation();
  const result = await service(client).ensureReservationEvent({
    lab: lab(), reservation: value,
  });

  assert.equal(result.outcome, "CREATED");
  assert.equal(result.eventId, buildReservationCalendarEventId(value.id));
  assert.equal(insertedBody.extendedProperties.private.reservationId, value.id);
  assert.equal(insertedBody.attendees[0].email, value.teacherEmail);
});

test("existing deterministic event is reused", async () => {
  const value = reservation();
  const eventId = buildReservationCalendarEventId(value.id);
  const client = fakeClient({
    get: async () => ({data: eventFor(value, eventId)}),
  });

  const result = await service(client).ensureReservationEvent({
    lab: lab(), reservation: value,
  });
  assert.deepEqual(result, {eventId, outcome: "REUSED"});
});

test("availability ignores the idempotent event of the same reservation", async () => {
  const value = reservation();
  const eventId = buildReservationCalendarEventId(value.id);
  const client = fakeClient({
    list: async () => ({data: {items: [eventFor(value, eventId)]}}),
  });

  const result = await service(client).findConflicts({
    calendarId: lab().calendarId,
    startAt: START,
    endAt: END,
    excludeReservationId: value.id,
  });
  assert.equal(result.eventCount, 0);
});

test("availability still counts an event from another reservation", async () => {
  const value = reservation();
  const other = reservation({id: "reservation-other"});
  const client = fakeClient({
    list: async () => ({data: {items: [
      eventFor(other, buildReservationCalendarEventId(other.id)),
    ]}}),
  });

  const result = await service(client).findConflicts({
    calendarId: lab().calendarId,
    startAt: START,
    endAt: END,
    excludeReservationId: value.id,
  });
  assert.equal(result.eventCount, 1);
});

test("insert 409 reconciles deterministic event", async () => {
  const value = reservation();
  const eventId = buildReservationCalendarEventId(value.id);
  let getCalls = 0;
  const client = fakeClient({
    get: async () => {
      getCalls += 1;
      if (getCalls === 1) throw missingError();
      return {data: eventFor(value, eventId)};
    },
    insert: async () => {
      throw Object.assign(new Error("already exists"), {code: 409});
    },
  });

  const result = await service(client).ensureReservationEvent({
    lab: lab(), reservation: value,
  });
  assert.deepEqual(result, {eventId, outcome: "REUSED"});
});

test("ambiguous timeout is reconciled when deterministic event exists", async () => {
  const value = reservation();
  const eventId = buildReservationCalendarEventId(value.id);
  let getCalls = 0;
  const client = fakeClient({
    get: async () => {
      getCalls += 1;
      if (getCalls === 1) throw missingError();
      return {data: eventFor(value, eventId)};
    },
    insert: async () => {
      throw new Error("timeout");
    },
  });

  const result = await service(client).ensureReservationEvent({
    lab: lab(), reservation: value,
  });
  assert.deepEqual(result, {eventId, outcome: "RECONCILED"});
});

test("ambiguous timeout remains an error when no event exists", async () => {
  const timeout = new Error("timeout");
  const client = fakeClient({insert: async () => {
    throw timeout;
  }});

  await assert.rejects(
      service(client).ensureReservationEvent({
        lab: lab(), reservation: reservation(),
      }),
      timeout,
  );
});

test("event with wrong private reservation property is rejected", async () => {
  const value = reservation();
  const eventId = buildReservationCalendarEventId(value.id);
  const client = fakeClient({
    get: async () => ({data: eventFor(value, eventId, {
      extendedProperties: {private: {
        reservationId: "another-reservation",
        sourceSystem: "reservas-laboratorios-tup",
        idempotencyVersion: "1",
      }},
    })}),
  });

  await assert.rejects(
      service(client).ensureReservationEvent({lab: lab(), reservation: value}),
      CalendarEventConsistencyError,
  );
});

test("cancelled deterministic event is a controlled inconsistency", async () => {
  const value = reservation();
  const eventId = buildReservationCalendarEventId(value.id);
  const client = fakeClient({
    get: async () => ({data: eventFor(value, eventId, {status: "cancelled"})}),
  });

  await assert.rejects(
      service(client).ensureReservationEvent({lab: lab(), reservation: value}),
      CalendarEventConsistencyError,
  );
});

test("private property search with one event reconciles it", async () => {
  const value = reservation();
  const foundId = "existing-property-event";
  const client = fakeClient({
    list: async () => ({data: {items: [eventFor(value, foundId)]}}),
  });

  const result = await service(client).ensureReservationEvent({
    lab: lab(), reservation: value,
  });
  assert.deepEqual(result, {eventId: foundId, outcome: "RECONCILED"});
});

test("private property search with multiple events fails safely", async () => {
  const value = reservation();
  const client = fakeClient({
    list: async () => ({data: {items: [
      eventFor(value, "event-one"),
      eventFor(value, "event-two"),
    ]}}),
  });

  await assert.rejects(
      service(client).ensureReservationEvent({lab: lab(), reservation: value}),
      CalendarEventConsistencyError,
  );
});

test("legacy linked calendarEventId remains compatible", async () => {
  const value = reservation({calendarEventId: "legacy-event"});
  const legacyEvent = eventFor(value, "legacy-event");
  delete legacyEvent.extendedProperties;
  const client = fakeClient({get: async () => ({data: legacyEvent})});

  const result = await service(client).ensureReservationEvent({
    lab: lab(), reservation: value,
  });
  assert.deepEqual(result, {eventId: "legacy-event", outcome: "REUSED"});
});

test("cancellation locates and deletes deterministic event", async () => {
  const value = reservation();
  const eventId = buildReservationCalendarEventId(value.id);
  let deleted;
  const client = fakeClient({
    get: async () => ({data: eventFor(value, eventId)}),
    delete: async ({eventId: deletedId, sendUpdates}) => {
      deleted = {eventId: deletedId, sendUpdates};
      return {data: {}};
    },
  });

  const result = await service(client).deleteReservationEvent({
    lab: lab(), reservation: value,
  });
  assert.deepEqual(result, {eventId, outcome: "DELETED"});
  assert.deepEqual(deleted, {eventId, sendUpdates: "all"});
});

test("cancellation uses linked legacy calendarEventId when it exists", async () => {
  const value = reservation({calendarEventId: "legacy-linked-event"});
  const legacyEvent = eventFor(value, "legacy-linked-event");
  delete legacyEvent.extendedProperties;
  let deletedId;
  const client = fakeClient({
    get: async () => ({data: legacyEvent}),
    delete: async ({eventId}) => {
      deletedId = eventId;
      return {data: {}};
    },
  });

  const result = await service(client).deleteReservationEvent({
    lab: lab(), reservation: value,
  });
  assert.deepEqual(result, {
    eventId: "legacy-linked-event", outcome: "DELETED",
  });
  assert.equal(deletedId, "legacy-linked-event");
});

test("cancellation never chooses between multiple property matches", async () => {
  const value = reservation();
  const client = fakeClient({
    list: async () => ({data: {items: [
      eventFor(value, "event-one"),
      eventFor(value, "event-two"),
    ]}}),
  });

  await assert.rejects(
      service(client).deleteReservationEvent({
        lab: lab(), reservation: value,
      }),
      CalendarEventConsistencyError,
  );
});

test("cancellation treats 410 during delete as already absent", async () => {
  const value = reservation();
  const eventId = buildReservationCalendarEventId(value.id);
  const client = fakeClient({
    get: async () => ({data: eventFor(value, eventId)}),
    delete: async () => {
      throw missingError(410);
    },
  });

  const result = await service(client).deleteReservationEvent({
    lab: lab(), reservation: value,
  });
  assert.deepEqual(result, {eventId, outcome: "ABSENT"});
});

test("cancellation treats missing event as absent", async () => {
  const result = await service(fakeClient()).deleteReservationEvent({
    lab: lab(), reservation: reservation(),
  });
  assert.deepEqual(result, {eventId: null, outcome: "ABSENT"});
});
