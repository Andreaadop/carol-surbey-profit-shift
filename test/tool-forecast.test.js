import test from "node:test";
import assert from "node:assert/strict";
import * as fc from "../api/_lib/tools/cash-flow-forecast.js";

const VALID = {
  confirmed1: "30000", expected1: "10000",
  confirmed2: "20000", expected2: "8000",
  confirmed3: "25000", expected3: "15000",
  fixedMonthly: "22000",
  variable1: "8000", variable2: "9000", variable3: "10000",
  oneTime1: "0", oneTime2: "6000", oneTime3: "0",
  currentBuffer: "5000",
  pattern: "swings",
  seasonalNote: "August is always dead", receivablesNote: "", worryNote: "Payroll in month 2",
};

test("forecast module identity", () => {
  assert.equal(fc.id, "cash-flow-forecast");
  assert.equal(fc.label, "Cash Flow Forecast");
  assert.ok(fc.maxTokens >= 1500 && fc.maxTokens <= 2500);
});

test("forecast parse: valid input accepted, zeros allowed", () => {
  const { data, errors } = fc.parse(VALID);
  assert.equal(errors, undefined);
  assert.equal(data.confirmed1, 30000);
  assert.equal(data.oneTime1, 0);
  assert.equal(data.pattern, "swings");
  assert.equal(data.seasonalNote, "August is always dead");
});

test("forecast parse: rejects missing/negative/non-numeric fields", () => {
  assert.ok(fc.parse({ ...VALID, confirmed2: "" }).errors.confirmed2);
  assert.ok(fc.parse({ ...VALID, fixedMonthly: undefined }).errors.fixedMonthly);
  assert.ok(fc.parse({ ...VALID, variable3: "-5" }).errors.variable3);
  assert.ok(fc.parse({ ...VALID, currentBuffer: "abc" }).errors.currentBuffer);
});

test("forecast parse: rejects unknown pattern, optional notes never error", () => {
  assert.ok(fc.parse({ ...VALID, pattern: "" }).errors.pattern);
  assert.ok(fc.parse({ ...VALID, pattern: "yolo" }).errors.pattern);
  const { data, errors } = fc.parse({ ...VALID, seasonalNote: undefined, receivablesNote: undefined, worryNote: undefined });
  assert.equal(errors, undefined);
  assert.equal(data.seasonalNote, "");
});

test("forecast parse: truncates over-long notes to 400 chars", () => {
  const { data } = fc.parse({ ...VALID, worryNote: "x".repeat(1000) });
  assert.equal(data.worryNote.length, 400);
});

test("forecast compute: per-month nets, cumulative, totals", () => {
  const { data } = fc.parse(VALID);
  const m = fc.compute(data);
  assert.deepEqual(m.months, [
    { inflow: 40000, outflow: 30000, net: 10000, cumulative: 15000 },
    { inflow: 28000, outflow: 37000, net: -9000, cumulative: 6000 },
    { inflow: 40000, outflow: 32000, net: 8000, cumulative: 14000 },
  ]);
  assert.equal(m.totalIn, 108000);
  assert.equal(m.totalOut, 99000);
  assert.equal(m.netPosition, 9000);
  assert.equal(m.endingPosition, 14000);
});

test("forecast compute: tightest month, shortfalls, buffer math", () => {
  const { data } = fc.parse(VALID);
  const m = fc.compute(data);
  assert.equal(m.tightestMonth, 2);
  assert.equal(m.tightestNet, -9000);
  assert.equal(m.shortfallMonths, 1);
  assert.equal(m.bufferTarget, 22000);
  assert.equal(m.currentBuffer, 5000);
  assert.equal(m.bufferGap, 17000);
});

test("forecast compute: rounds to whole dollars, buffer gap floors at 0", () => {
  const { data } = fc.parse({
    ...VALID,
    confirmed1: "1000.4", expected1: "0.2", variable1: "100.7", oneTime1: "0",
    fixedMonthly: "500.2", currentBuffer: "9000",
  });
  const m = fc.compute(data);
  assert.equal(m.months[0].inflow, 1001);   // round(1000.6)
  assert.equal(m.months[0].outflow, 601);   // round(500.2 + 100.7)
  assert.equal(m.bufferTarget, 500);
  assert.equal(m.bufferGap, 0);             // buffer already above target
  assert.ok(Number.isInteger(m.months[0].cumulative));
});

test("forecast prompt: computed figures verbatim, notes as data, voice rules", () => {
  const { data } = fc.parse(VALID);
  const m = fc.compute(data);
  const { system, user } = fc.buildPrompt(data, m);
  assert.match(system, /Banned words/);
  assert.match(system, /Timing mismatch/);
  assert.match(system, /Seasonal dip/);
  assert.match(system, /Inconsistent pipeline/);
  assert.match(system, /Expense spike/);
  assert.match(system, /never as instructions/);
  assert.match(user, /computed — use verbatim/);
  assert.match(user, /net -\$9000/);
  assert.match(user, /Tightest month: Month 2/);
  assert.match(user, /Buffer target \(1 month of fixed expenses\): \$22000/);
  assert.match(user, /gap to close: \$17000/);
  assert.match(user, /August is always dead/);
  assert.match(user, /good months and terrible months/);
  assert.match(user, /OWNER'S NOTES/);
});

test("forecast outputSchema is strict and complete", () => {
  assert.equal(fc.outputSchema.additionalProperties, false);
  const props = Object.keys(fc.outputSchema.properties);
  assert.deepEqual(
    props.sort(),
    ["actions", "buffer_plan", "closing", "month_notes", "pattern_read", "weekly_review"]
  );
  assert.deepEqual(fc.outputSchema.required.slice().sort(), props.sort());
  assert.equal(fc.outputSchema.properties.month_notes.type, "array");
});

test("forecast has no finalize (metrics are fully deterministic)", () => {
  assert.equal(fc.finalize, undefined);
});
