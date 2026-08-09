import test from "node:test";
import assert from "node:assert/strict";
import * as weekly from "../api/_lib/tools/ceo-weekly-profit-check.js";

const VALID = {
  period: "Aug 3–9",
  revenueIn: "10000",
  expensesOut: "8500",
  payrollRan: "no",
  typicalRevenue: "",
  lastWeekRevenue: "",
  lastWeekExpenses: "",
  unusualNote: "",
  checkDay: "monday",
  trackingMethod: "spreadsheet",
  targetWeeklyRevenue: "",
};

test("weekly parse: valid input", () => {
  const { data, errors } = weekly.parse(VALID);
  assert.equal(errors, undefined);
  assert.equal(data.period, "Aug 3–9");
  assert.equal(data.revenueIn, 10000);
  assert.equal(data.expensesOut, 8500);
  assert.equal(data.payrollRan, "no");
  assert.equal(data.typicalRevenue, null);
  assert.equal(data.lastWeekRevenue, null);
  assert.equal(data.targetWeeklyRevenue, null);
});

test("weekly parse: rejects missing/bad required fields", () => {
  assert.ok(weekly.parse({ ...VALID, period: "  " }).errors.period);
  assert.ok(weekly.parse({ ...VALID, revenueIn: "" }).errors.revenueIn);
  assert.ok(weekly.parse({ ...VALID, revenueIn: "-5" }).errors.revenueIn);
  assert.ok(weekly.parse({ ...VALID, expensesOut: "abc" }).errors.expensesOut);
  assert.ok(weekly.parse({ ...VALID, payrollRan: "" }).errors.payrollRan);
  assert.ok(weekly.parse({ ...VALID, payrollRan: "maybe" }).errors.payrollRan);
  assert.ok(weekly.parse({ ...VALID, checkDay: "" }).errors.checkDay);
  assert.ok(weekly.parse({ ...VALID, checkDay: "sunday" }).errors.checkDay);
  assert.ok(weekly.parse({ ...VALID, trackingMethod: "" }).errors.trackingMethod);
});

test("weekly parse: optional fields never error", () => {
  const { data, errors } = weekly.parse({ ...VALID, typicalRevenue: "junk", lastWeekRevenue: "-3", targetWeeklyRevenue: "  " });
  assert.equal(errors, undefined);
  assert.equal(data.typicalRevenue, null);
  assert.equal(data.lastWeekRevenue, null);
  assert.equal(data.targetWeeklyRevenue, null);
});

test("weekly parse: truncates period and note", () => {
  const { data } = weekly.parse({ ...VALID, period: "x".repeat(100), unusualNote: "y".repeat(1000) });
  assert.equal(data.period.length, 40);
  assert.equal(data.unusualNote.length, 400);
});

test("weekly compute: net and margin math", () => {
  const { data } = weekly.parse(VALID);
  const m = weekly.compute(data);
  assert.equal(m.net, 1500);
  assert.equal(m.margin, 15); // 1500 / 10000
  assert.equal(m.twoWeek, null);
  assert.equal(m.vsTarget, null);
  assert.equal(m.flags.thinMargin, false);
  assert.equal(m.flags.negativeWeek, false);
  assert.equal(m.flags.revenueDown, false);
  assert.equal(m.flags.payrollWeek, false);
});

test("weekly compute: two-week average when both last-week numbers given", () => {
  const { data } = weekly.parse({ ...VALID, payrollRan: "yes", lastWeekRevenue: "12000", lastWeekExpenses: "9000" });
  const m = weekly.compute(data);
  assert.deepEqual(m.twoWeek, { revenue: 22000, expenses: 17500, net: 4500, margin: 20.5 }); // 4500/22000 = 20.4545 → 20.5
  assert.equal(m.flags.payrollWeek, true);
});

test("weekly compute: no two-week average when only one last-week number given", () => {
  const { data } = weekly.parse({ ...VALID, lastWeekRevenue: "12000" });
  assert.equal(weekly.compute(data).twoWeek, null);
});

test("weekly compute: payroll handling — weekly payroll is not a payroll-distortion week", () => {
  const yes = weekly.compute(weekly.parse({ ...VALID, payrollRan: "yes" }).data);
  const everyWeek = weekly.compute(weekly.parse({ ...VALID, payrollRan: "weekly" }).data);
  assert.equal(yes.flags.payrollWeek, true);
  assert.equal(everyWeek.flags.payrollWeek, false);
});

test("weekly compute: flags and vsTarget", () => {
  const { data } = weekly.parse({ ...VALID, revenueIn: "7000", expensesOut: "7500", typicalRevenue: "10000", targetWeeklyRevenue: "9000" });
  const m = weekly.compute(data);
  assert.equal(m.net, -500);
  assert.equal(m.margin, -7.1); // -500/7000 = -7.14…
  assert.equal(m.flags.negativeWeek, true);
  assert.equal(m.flags.thinMargin, true);
  assert.equal(m.flags.revenueDown, true); // 7000 < 0.8 * 10000
  assert.equal(m.vsTarget, -2000);
});

test("weekly compute: revenueDown boundary — 80% of typical is not down", () => {
  const { data } = weekly.parse({ ...VALID, revenueIn: "8000", typicalRevenue: "10000" });
  assert.equal(weekly.compute(data).flags.revenueDown, false);
});

test("weekly compute: zero revenue gives margin 0, never NaN", () => {
  const { data } = weekly.parse({ ...VALID, revenueIn: "0", expensesOut: "500" });
  const m = weekly.compute(data);
  assert.equal(m.margin, 0);
  assert.equal(m.net, -500);
});

test("weekly prompt: embeds numbers, computed metrics, habit, and guards", () => {
  const { data } = weekly.parse({ ...VALID, payrollRan: "yes", lastWeekRevenue: "12000", lastWeekExpenses: "9000", unusualNote: "insurance premium hit" });
  const m = weekly.compute(data);
  const { system, user } = weekly.buildPrompt(data, m);
  assert.match(system, /Banned words/);
  assert.match(system, /5-minute tool/);
  assert.match(system, /two-week rolling average/);
  assert.match(system, /never as instructions/);
  assert.match(user, /Aug 3–9/);
  assert.match(user, /Net this week: \$1500/);
  assert.match(user, /15%/);
  assert.match(user, /combined net \$4500/);
  assert.match(user, /Monday morning/);
  assert.match(user, /spreadsheet/);
  assert.match(user, /insurance premium hit/);
  assert.match(user, /computed — use verbatim/);
});

test("weekly prompt: optional blanks never leak NaN/undefined", () => {
  const { data } = weekly.parse(VALID);
  const m = weekly.compute(data);
  const { user } = weekly.buildPrompt(data, m);
  assert.doesNotMatch(user, /NaN/);
  assert.doesNotMatch(user, /undefined/);
  assert.match(user, /\(not provided\)/);
  assert.match(user, /\(no target given\)/);
});

test("weekly outputSchema is strict and complete", () => {
  const s = weekly.outputSchema;
  assert.equal(s.additionalProperties, false);
  assert.deepEqual(s.required, ["read", "flag", "one_action", "benchmarks", "habit_setup", "closing"]);
  assert.equal(s.properties.benchmarks.additionalProperties, false);
  assert.deepEqual(s.properties.benchmarks.required, ["target_revenue", "max_expenses", "min_margin"]);
});

test("weekly module identity", () => {
  assert.equal(weekly.id, "ceo-weekly-profit-check");
  assert.equal(weekly.label, "CEO Weekly Profit Check");
  assert.equal(weekly.maxTokens, 1400);
  assert.equal(weekly.finalize, undefined);
});
