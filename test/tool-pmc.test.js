import test from "node:test";
import assert from "node:assert/strict";
import * as pmc from "../api/_lib/tools/profit-margin-check.js";

test("pmc parse: valid input", () => {
  const r = pmc.parse({ revenue: "120000", cogs: "40000", opex: "50000", ownerSalary: "15000" });
  assert.deepEqual(r, { data: { revenue: 120000, cogs: 40000, opex: 50000, ownerSalary: 15000 } });
});

test("pmc parse: rejects negatives, non-numbers, missing revenue", () => {
  assert.ok(pmc.parse({ revenue: "-5", cogs: "0", opex: "0", ownerSalary: "0" }).errors.revenue);
  assert.ok(pmc.parse({ revenue: "abc", cogs: "0", opex: "0", ownerSalary: "0" }).errors.revenue);
  assert.ok(pmc.parse({ cogs: "0", opex: "0", ownerSalary: "0" }).errors.revenue);
  assert.ok(pmc.parse({ revenue: "0", cogs: "0", opex: "0", ownerSalary: "0" }).errors.revenue);
});

test("pmc compute + prompt contain the real numbers", () => {
  const { data } = pmc.parse({ revenue: "100000", cogs: "30000", opex: "40000", ownerSalary: "15000" });
  const metrics = pmc.compute(data);
  assert.equal(metrics.margin, 15);
  const { system, user } = pmc.buildPrompt(data, metrics);
  assert.match(system, /Banned words/);
  assert.match(user, /100000|100,000/);
  assert.match(user, /15\.0?%|margin.*15/i);
});

test("pmc outputSchema is strict", () => {
  assert.equal(pmc.outputSchema.additionalProperties, false);
  assert.deepEqual(
    [...pmc.outputSchema.required].sort(),
    ["closing", "diagnosis", "next_step", "root_cause"]
  );
});
