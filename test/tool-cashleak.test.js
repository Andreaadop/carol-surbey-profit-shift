import test from "node:test";
import assert from "node:assert/strict";
import * as leak from "../api/_lib/tools/cash-leak-audit.js";

const VALID = {
  expenses: [
    { name: "CRM subscription", monthlyCost: "300" },
    { name: "Old storage unit", monthlyCost: "250" },
  ],
  unbilledHours: "10", hourlyRate: "100",
  gutFeeling: "probably software", subscriptionsNote: "", vendorsNote: "",
  marketingNote: "", lateFeesNote: "", unusedAssetsNote: "",
};

test("cashleak parse: valid input", () => {
  const { data } = leak.parse(VALID);
  assert.equal(data.expenses.length, 2);
  assert.equal(data.expenses[0].monthlyCost, 300);
  assert.equal(data.unbilledHours, 10);
});

test("cashleak parse: rejects empty list, bad rows, >40 rows", () => {
  assert.ok(leak.parse({ ...VALID, expenses: [] }).errors.expenses);
  assert.ok(leak.parse({ ...VALID, expenses: [{ name: "", monthlyCost: "5" }] }).errors.expenses);
  assert.ok(leak.parse({ ...VALID, expenses: [{ name: "a", monthlyCost: "-5" }] }).errors.expenses);
  const many = Array.from({ length: 41 }, (_, i) => ({ name: `e${i}`, monthlyCost: "1" }));
  assert.ok(leak.parse({ ...VALID, expenses: many }).errors.expenses);
});

test("cashleak compute: pre-generation metrics only", () => {
  const { data } = leak.parse(VALID);
  const m = leak.compute(data);
  assert.equal(m.totalListedMonthly, 550);
  assert.equal(m.scopeCreepLeak, 1000);
});

test("cashleak finalize: totals from Claude classifications", () => {
  const { data } = leak.parse(VALID);
  const report = {
    classifications: [
      { name: "CRM subscription", bucket: "Optimizable", reason: "" },
      { name: "Old storage unit", bucket: "Eliminatable", reason: "" },
    ],
  };
  const m = leak.finalize(data, report);
  assert.equal(m.optimizableTotal, 300);
  assert.equal(m.eliminatableTotal, 250);
  assert.equal(m.totalMonthlyLeak, 250 + 75 + 1000);
  assert.equal(m.annualizedLeak, (250 + 75 + 1000) * 12);
});

test("cashleak prompt lists every expense and probe notes", () => {
  const { data } = leak.parse(VALID);
  const { system, user } = leak.buildPrompt(data, leak.compute(data));
  assert.match(system, /Essential/);
  assert.match(user, /CRM subscription/);
  assert.match(user, /probably software/);
});

test("cashleak outputSchema is strict with bucket enum", () => {
  assert.equal(leak.outputSchema.additionalProperties, false);
  const bucket = leak.outputSchema.properties.classifications.items.properties.bucket;
  assert.deepEqual(bucket.enum, ["Essential", "Optimizable", "Eliminatable"]);
});
