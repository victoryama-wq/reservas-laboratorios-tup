const assert = require("node:assert/strict");
const {test} = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {createRequire} = require("node:module");
const {institutionalDateTime: at} = require("../lib/shared/utils/institutional-time.utils");
const {validateReservationTiming, validateReservationReviewTiming} =
  require("../lib/modules/reservations/reservation.validators");

const lab = (overrides = {}) => ({id: "test-lab", minNoticeHours: 0,
  blockSundayRequestsForMondayMorning: true, specialRules: [],
  weeklySchedule: Object.fromEntries([
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ].map((day) => [day, {enabled: true, start: "00:00", end: "23:59"}])),
  ...overrides});
const sunday = at("2026-10-25", "06:00");
const decision = (hour, config = lab(), now = sunday, day = "2026-10-26") =>
  validateReservationTiming({}, config, at(day, hour), at(day, "14:00"), now);

test("domingo rechaza lunes antes de las 12 aunque cumpla 24 horas", () => {
  for (const hour of ["00:00", "08:00", "11:59"]) {
    const result = decision(hour, lab({minNoticeHours: hour === "00:00" ? 0 : 24}));
    assert.equal(result.status, "RECHAZADA_REGLA_HORARIO");
    assert.match(result.reason, /domingo.*lunes inmediato.*12:00.*Cancún/);
  }
});

test("permite exactamente las 12, otros días y el lunes de la semana siguiente", () => {
  assert.equal(decision("12:00"), null);
  assert.equal(decision("13:00"), null);
  assert.equal(decision("08:00", lab(), sunday, "2026-10-27"), null);
  assert.equal(decision("08:00", lab(), sunday, "2026-11-02"), null);
  assert.equal(decision("08:00", lab(), at("2026-10-24", "23:59")), null);
  assert.equal(decision("08:00", lab(), at("2026-10-26", "00:00")), null);
});

test("desactivada o ausente conserva compatibilidad y anticipación mínima", () => {
  for (const value of [false, undefined]) {
    assert.equal(decision("08:00", lab({blockSundayRequestsForMondayMorning: value})), null);
  }
  assert.equal(decision("12:00", lab({minNoticeHours: 48})).status,
      "RECHAZADA_MIN_ANTICIPACION");
  assert.equal(decision("08:00", lab({minNoticeHours: 48,
    blockSundayRequestsForMondayMorning: false})).status, "RECHAZADA_MIN_ANTICIPACION");
});

test("usa Cancún al inicio y fin del domingo, aunque UTC indique otro día", () => {
  for (const [instant, blocked] of [
    ["2026-10-25T04:59:59Z", false], ["2026-10-25T05:00:00Z", true],
    ["2026-10-26T04:59:59Z", true], ["2026-10-26T05:00:00Z", false],
  ]) {
    assert.equal(Boolean(decision("08:00", lab(), new Date(instant))), blocked);
  }
});

test("lote mixto evalúa cada fecha y la aprobación no reevalúa el día de envío", () => {
  const results = [["2026-10-26", "08:00"], ["2026-10-26", "12:00"],
    ["2026-10-27", "08:00"]].map(([day, hour]) => decision(hour, lab(), sunday, day));
  assert.deepEqual(results.map(Boolean), [true, false, false]);
  assert.doesNotThrow(() => validateReservationReviewTiming(lab(),
      at("2026-10-26", "08:00"), at("2026-10-26", "09:00"), sunday));
});

test("el horario de apertura del domingo sigue siendo independiente", () => {
  const config = lab();
  const check = () => validateReservationTiming({}, config,
      at("2026-10-25", "12:00"), at("2026-10-25", "13:00"), sunday);
  assert.equal(check(), null);
  config.weeklySchedule.sunday.enabled = false;
  assert.equal(check().status, "RECHAZADA_REGLA_HORARIO");
});

// Acceso a validadores puros sin llamadas a Firestore ni nuevos exports públicos.
function internals(relative, names) {
  const filename = path.resolve(__dirname, "../lib", relative);
  const module = {exports: {}};
  vm.runInNewContext(fs.readFileSync(filename, "utf8") +
    `\nmodule.exports.testing = {${names.join(",")}};`,
  {module, exports: module.exports, require: createRequire(filename), Date, Set, Map, console});
  return module.exports.testing;
}

test("administración admite activar/desactivar, conserva ausentes y rechaza tipos inválidos", () => {
  const admin = internals("modules/admin/admin-lab.function.js",
      ["parseCreateInput", "parseUpdateInput", "buildLabPatch"]);
  const base = {name: "Prueba", slug: "prueba", description: "Prueba",
    calendarId: "test-calendar", active: true, visibleInCatalog: true,
    minNoticeHours: 24, weeklySchedule: lab().weeklySchedule};
  assert.equal(admin.parseCreateInput(base).blockSundayRequestsForMondayMorning, false);
  for (const enabled of [true, false]) {
    assert.equal(admin.parseCreateInput({...base,
      blockSundayRequestsForMondayMorning: enabled}).blockSundayRequestsForMondayMorning, enabled);
    const input = admin.parseUpdateInput({labId: "test-lab",
      blockSundayRequestsForMondayMorning: enabled});
    assert.equal(admin.buildLabPatch(input).blockSundayRequestsForMondayMorning, enabled);
  }
  const patch = admin.buildLabPatch(admin.parseUpdateInput({labId: "test-lab", name: "Nuevo"}));
  assert.equal(Object.hasOwn(patch, "blockSundayRequestsForMondayMorning"), false);
  for (const invalid of ["true", 1, null]) {
    assert.throws(() => admin.parseUpdateInput({labId: "test-lab",
      blockSundayRequestsForMondayMorning: invalid}), /booleano/);
  }
});
