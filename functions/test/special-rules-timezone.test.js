const assert = require("node:assert/strict");
const {test} = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {createRequire} = require("node:module");
const {Firestore, Timestamp} = require("firebase-admin/firestore");
const time = require("../lib/shared/utils/institutional-time.utils");
const validators = require("../lib/modules/reservations/reservation.validators");

// Acceso local a funciones puras, sin ampliar la API desplegada.
function internals(relative, names, firestore) {
  const filename = path.resolve(__dirname, "../lib", relative);
  const localRequire = createRequire(filename);
  const module = {exports: {}};
  const code = fs.readFileSync(filename, "utf8") +
    `\nmodule.exports.testing = {${names.join(",")}};`;
  vm.runInNewContext(code, {module, exports: module.exports,
    require: (name) => name === "firebase-admin/firestore" && firestore ?
      {...localRequire(name), getFirestore: () => firestore} : localRequire(name),
    Date, Set, Map, console});
  return module.exports;
}
const availability = internals(
    "modules/reservations/get-lab-availability.function.js",
    ["toSpecialRuleBlocks"],
).testing;
const admin = internals("modules/admin/admin-rules.function.js", [
  "parseCreateSpecialRuleInput", "parseUpdateSpecialRuleInput",
  "parseCreateBlockedPeriodInput", "buildSpecialRulePatch",
]).testing;
const day = "2026-09-08";
const at = (hour, date = day) => time.institutionalDateTime(date, hour);
const rule = (overrides = {}) => ({id: "r1", name: "Regla de prueba",
  active: true, daysOfWeek: [2], blockedStart: "08:00", blockedEnd: "13:00",
  fullDayBlocked: false, reason: "Motivo privado de administración", ...overrides});
const lab = (rules = [rule()]) => ({id: "lab-1", minNoticeHours: 0,
  weeklySchedule: Object.fromEntries([
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ].map((key) => [key, {enabled: true, start: "00:00", end: "23:59"}])),
  specialRules: rules});

test("Cancún produce el mismo instante en UTC, Los Ángeles y Tokio", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = zone;
      assert.equal(at("08:00").toISOString(), "2026-09-08T13:00:00.000Z");
      assert.equal(time.institutionalDateKey(new Date("2026-09-09T04:59:00Z")), day);
      assert.equal(time.institutionalWeekday(day), 2);
      assert.throws(() => time.institutionalDateTime("2026-02-30"));
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("calendario y validador coinciden en 08–13 y sus límites exclusivos", () => {
  const blocks = availability.toSpecialRuleBlocks(lab(), at("00:00"), at("23:59"));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].startAt, at("08:00").toISOString());
  assert.equal(blocks[0].endAt, at("13:00").toISOString());
  for (const [start, end, rejected] of [
    ["07:00", "08:00", false], ["08:00", "09:00", true],
    ["12:59", "13:30", true], ["13:00", "14:00", false],
  ]) {
    const decision = validators.validateReservationTiming(
        {}, lab(), at(start), at(end), at("00:00"));
    assert.equal(Boolean(decision), rejected);
    if (decision) {
      assert.equal(decision.status, "RECHAZADA_REGLA_HORARIO");
      assert.match(decision.reason, /otra fecha u horario/);
      assert.ok(!decision.reason.includes("privado"));
    }
  }
  assert.ok(!JSON.stringify(blocks).includes("privado"));
});

test("una consulta intradía incluye reglas y excluye las inactivas", () => {
  assert.equal(availability.toSpecialRuleBlocks(lab(), at("09:00"), at("10:00")).length, 1);
  assert.equal(availability.toSpecialRuleBlocks(lab([rule({active: false})]), at("00:00"), at("23:59")).length, 0);
  assert.equal(availability.toSpecialRuleBlocks(lab([]), at("00:00"), at("23:59")).length, 0);
});

test("vigencia inclusiva y todos los días sin selección", () => {
  const config = lab([rule({daysOfWeek: [], termStart: day, termEnd: day,
    fullDayBlocked: true})]);
  const blocks = availability.toSpecialRuleBlocks(config,
      at("00:00", "2026-09-07"), at("00:00", "2026-09-10"));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].startAt, "2026-09-08T05:00:00.000Z");
  assert.equal(blocks[0].endAt, "2026-09-09T05:00:00.000Z");
  assert.throws(() => validators.validateReservationReviewTiming(
      config, at("15:00"), at("16:00"), at("00:00")), /bloqueado/);
});

test("día completo normaliza medianoches sin extender dos veces", () => {
  const range = time.normalizeBlockedRange(at("09:00"), at("10:00"), true);
  assert.equal(range.startAt.toISOString(), "2026-09-08T05:00:00.000Z");
  assert.equal(range.endAt.toISOString(), "2026-09-09T05:00:00.000Z");
  assert.deepEqual(time.normalizeBlockedRange(range.startAt, range.endAt, true), range);
  const payload = {name: "Bloqueo", reason: "Interno", scope: "global", labIds: [],
    fullDay: true, active: true, startAt: at("10:00").toISOString(),
    endAt: at("09:00").toISOString()};
  assert.throws(() => admin.parseCreateBlockedPeriodInput(payload), /mayor/);
});

test("creación real guarda opcionales limpios y bitácora sin enviar escrituras", async () => {
  const sdk = new Firestore({projectId: "local-test-only"});
  let captured;
  let audit = false;
  const db = {collection: (name) => ({doc: (id = "new-id") => ({id,
    get: async () => ({exists: true, data: () => ({active: true, role: "admin_sistemas"})}),
    collectionName: name})}),
  runTransaction: async (work) => work({
    get: async () => ({exists: true, data: () => ({specialRules: []})}),
    update: (ref, data) => {
      captured = data;
      // El SDK valida el objeto; nunca se llama commit.
      sdk.batch().update(sdk.doc("labs/lab-1"), data);
    },
    create: () => { audit = true; },
  })};
  const loaded = internals("modules/admin/admin-rules.function.js", [], db);
  for (const fullDayBlocked of [false, true]) {
    const payload = {labId: "lab-1", name: "Regla", reason: "Interno",
      active: true, daysOfWeek: [], termStart: null, termEnd: null,
      fullDayBlocked, blockedStart: fullDayBlocked ? null : "08:00",
      blockedEnd: fullDayBlocked ? null : "13:00"};
    await loaded.adminCreateSpecialRule.run({auth: {uid: "admin-test", token: {email: "qa@tecplayacar.edu.mx"}}, data: payload});
    assert.equal(captured.specialRules.length, 1);
    assert.ok(!Object.values(captured.specialRules[0]).includes(undefined));
    assert.ok(audit);
  }
  await assert.rejects(loaded.adminCreateSpecialRule.run({data: {}}), /iniciar sesion/);
  await sdk.terminate();
});

test("repositorio respeta alcance y día completo legado sin mutar documentos", async () => {
  const {ReservationRepository} = require("../lib/modules/reservations/reservation.repository");
  const make = (id, scope, labIds) => ({id, active: true, scope, labIds,
    fullDay: true, startAt: Timestamp.fromDate(at("09:00")),
    endAt: Timestamp.fromDate(at("10:00"))});
  const periods = [make("global", "global", []), make("local", "lab", ["lab-1"]),
    make("other", "lab", ["lab-2"])];
  const repository = Object.create(ReservationRepository.prototype);
  repository.db = {collection: () => ({where: () => ({get: async () => ({
    docs: periods.map((value) => ({data: () => value})),
  })})})};
  const found = await repository.findActiveBlockedPeriods("lab-1", at("11:00"), at("12:00"));
  assert.deepEqual(found.map((p) => p.id), ["global", "local"]);
  assert.equal(periods[0].startAt.toDate().toISOString(), at("09:00").toISOString());
  assert.equal((await repository.findActiveBlockedPeriods("lab-1",
      at("00:00", "2026-09-09"), at("01:00", "2026-09-09"))).length, 0);
});

test("horarios observados en Arquitectura y Juicios Orales coinciden con el rechazo", () => {
  const configurations = [
    ["Juicios Orales", "2026-09-08", 2, "11:30", "13:00", "2026-12-05"],
    ["Juicios Orales", "2026-09-11", 5, "11:30", "15:00", "2026-12-05"],
    ["Arquitectura", "2026-09-08", 2, "11:00", "13:00", "2026-12-05"],
    ["Arquitectura", "2026-09-11", 5, "11:00", "15:00", "2026-12-05"],
    ["Arquitectura", "2026-09-12", 6, "13:00", "15:00", "2026-12-12"],
  ];
  for (const [name, date, weekday, start, end, termEnd] of configurations) {
    const config = lab([rule({daysOfWeek: [weekday], blockedStart: start,
      blockedEnd: end, termStart: date, termEnd})]);
    const begin = at(start, date);
    const finish = at(end, date);
    const blocks = availability.toSpecialRuleBlocks(config,
        at("00:00", date), at("23:59", date));
    assert.equal(blocks[0].startAt, begin.toISOString(), name);
    assert.equal(blocks[0].endAt, finish.toISOString(), name);
    assert.equal(validators.validateReservationTiming({}, config,
        new Date(begin.getTime() - 30 * 60000), begin, at("00:00", date)), null);
    assert.ok(validators.validateReservationTiming({}, config,
        begin, new Date(begin.getTime() + 30 * 60000), at("00:00", date)));
    assert.equal(validators.validateReservationTiming({}, config,
        finish, new Date(finish.getTime() + 30 * 60000), at("00:00", date)), null);
  }
});

test("editar permite borrar vigencia y pasar a día completo sin perder campos", () => {
  const original = rule({termStart: day, termEnd: "2026-12-05"});
  const patch = admin.parseUpdateSpecialRuleInput({labId: "lab-1", ruleId: "r1",
    termStart: null, termEnd: null, blockedStart: null, blockedEnd: null,
    daysOfWeek: [], fullDayBlocked: true});
  const edited = admin.buildSpecialRulePatch(original, patch);
  assert.equal(edited.name, original.name);
  assert.equal(edited.reason, original.reason);
  assert.ok(!("termStart" in edited));
  assert.ok(!("termEnd" in edited));
  assert.ok(!("blockedStart" in edited));
  assert.ok(!("blockedEnd" in edited));
  assert.equal(edited.daysOfWeek.length, 0);
  assert.equal(original.termStart, day);
});
