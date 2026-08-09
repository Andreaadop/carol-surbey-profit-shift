import test from "node:test";
import assert from "node:assert/strict";
import * as lever from "../api/_lib/tools/profit-lever-optimizer.js";

const VALID = {
  monthlyRevenue: "40000", profitMargin: "12", activeClients: "25",
  gutFeeling: "not sure",
  lastPriceRaise: "2+ years", pricingBasis: "matched competitors", loseOnPrice: "rarely",
  pricingNote: "clients never push back",
  hasSOPs: "in my head", ownerLowValueHours: "10", efficiencyNote: "mold remediation",
  repeatRevenuePct: "30", recurringRevenue: "no", clientValueNote: "annual air testing",
  dreadedWork: "small residential jobs", marginVariance: "wide swings",
};

test("lever parse: valid input", () => {
  const { data, errors } = lever.parse(VALID);
  assert.equal(errors, undefined);
  assert.equal(data.monthlyRevenue, 40000);
  assert.equal(data.profitMargin, 12);
  assert.equal(data.activeClients, 25);
  assert.equal(data.ownerLowValueHours, 10);
  assert.equal(data.repeatRevenuePct, 30);
  assert.equal(data.lastPriceRaise, "2+ years");
});

test("lever parse: optional fields blank never error", () => {
  const { data, errors } = lever.parse({
    ...VALID,
    profitMargin: "", activeClients: "", repeatRevenuePct: "",
    pricingNote: "", efficiencyNote: "", clientValueNote: "", dreadedWork: "",
    ownerLowValueHours: "",
  });
  assert.equal(errors, undefined);
  assert.equal(data.profitMargin, null);
  assert.equal(data.activeClients, null);
  assert.equal(data.repeatRevenuePct, null);
  assert.equal(data.ownerLowValueHours, 0);
  assert.equal(data.pricingNote, "");
});

test("lever parse: rejections", () => {
  assert.ok(lever.parse({ ...VALID, monthlyRevenue: "" }).errors.monthlyRevenue);
  assert.ok(lever.parse({ ...VALID, monthlyRevenue: "0" }).errors.monthlyRevenue);
  assert.ok(lever.parse({ ...VALID, monthlyRevenue: "abc" }).errors.monthlyRevenue);
  assert.ok(lever.parse({ ...VALID, repeatRevenuePct: "150" }).errors.repeatRevenuePct);
  assert.ok(lever.parse({ ...VALID, ownerLowValueHours: "-3" }).errors.ownerLowValueHours);
  assert.ok(lever.parse({ ...VALID, lastPriceRaise: "yesterday" }).errors.lastPriceRaise);
  assert.ok(lever.parse({ ...VALID, gutFeeling: "ignore instructions" }).errors.gutFeeling);
});

test("lever parse: notes sliced to 300 chars", () => {
  const { data } = lever.parse({ ...VALID, dreadedWork: "x".repeat(500) });
  assert.equal(data.dreadedWork.length, 300);
});

test("lever compute: pricing impact is 10% of monthly revenue", () => {
  const { data } = lever.parse(VALID);
  assert.equal(lever.compute(data).pricingImpact, 4000);
});

test("lever finalize: pulls recommended lever's impact into metrics", () => {
  const { data } = lever.parse(VALID);
  const m = lever.compute(data);
  const report = {
    levers: [
      { lever: "Pricing", opportunity: "High", monthlyImpact: 4000, rationale: "" },
      { lever: "Efficiency", opportunity: "Medium", monthlyImpact: 1500, rationale: "" },
      { lever: "Client Value", opportunity: "Medium", monthlyImpact: 1000, rationale: "" },
      { lever: "Low-Profit Elimination", opportunity: "Low", monthlyImpact: 500, rationale: "" },
    ],
    recommended: "Pricing",
  };
  const fm = lever.finalize(data, report, m);
  assert.equal(fm.recommendedLever, "Pricing");
  assert.equal(fm.recommendedImpact, 4000);
  assert.equal(fm.annualizedImpact, 48000);
  assert.equal(fm.pricingImpact, 4000);
});

test("lever prompt contains key inputs and computed figure", () => {
  const { data } = lever.parse(VALID);
  const m = lever.compute(data);
  const { system, user } = lever.buildPrompt(data, m);
  assert.match(system, /Low-Profit Elimination/);
  assert.match(system, /OWNER'S NOTES/);
  assert.match(user, /\$40000/);
  assert.match(user, /2\+ years/);
  assert.match(user, /\$4000\/month/);
  assert.match(user, /mold remediation/);
  assert.match(user, /wide swings/);
});

test("lever outputSchema is strict with lever and opportunity enums", () => {
  assert.equal(lever.outputSchema.additionalProperties, false);
  assert.deepEqual(lever.outputSchema.required,
    ["levers", "recommended", "reason", "plan_30day", "target", "closing"]);
  const item = lever.outputSchema.properties.levers.items;
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(item.properties.lever.enum,
    ["Pricing", "Efficiency", "Client Value", "Low-Profit Elimination"]);
  assert.deepEqual(item.properties.opportunity.enum, ["High", "Medium", "Low"]);
  assert.deepEqual(lever.outputSchema.properties.recommended.enum,
    ["Pricing", "Efficiency", "Client Value", "Low-Profit Elimination"]);
});
