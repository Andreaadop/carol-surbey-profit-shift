import test from "node:test";
import assert from "node:assert/strict";
import * as dash from "../api/_lib/tools/monthly-dashboard.js";

const VALID = {
  businessType: "water damage restoration", employees: "6", month: "June 2026",
  revenue: "80000", outstanding: "20000", uninvoiced: "5000",
  materialsSubsDisposal: "15000", fieldLabour: "20000", equipmentCompliance: "3000",
  fixedOverhead: "18000", adminPayroll: "7000", ownerDraw: "8000", cardCharges: "0",
  cashBalance: "90000", upcomingBills: "12000", overdueAR: "6000",
  openingPosition: "", cashFeel: "Payroll felt tight in week 3", unusualOutflows: "",
};

test("dashboard parse: valid input derives directCosts and overhead", () => {
  const { data } = dash.parse(VALID);
  assert.equal(data.directCosts, 38000);
  assert.equal(data.overhead, 25000);
  assert.equal(data.businessType, "water damage restoration");
});

test("dashboard parse: rejects missing businessType/month and bad numbers", () => {
  assert.ok(dash.parse({ ...VALID, businessType: "" }).errors.businessType);
  assert.ok(dash.parse({ ...VALID, month: "" }).errors.month);
  assert.ok(dash.parse({ ...VALID, revenue: "-1" }).errors.revenue);
  assert.ok(dash.parse({ ...VALID, cashBalance: "xyz" }).errors.cashBalance);
});

test("dashboard parse: truncates over-long free text", () => {
  const { data } = dash.parse({ ...VALID, cashFeel: "x".repeat(1000) });
  assert.equal(data.cashFeel.length, 400);
});

test("dashboard compute rounds and includes status", () => {
  const { data } = dash.parse(VALID);
  const m = dash.compute(data);
  assert.equal(m.grossMargin, 52.5);
  assert.equal(m.status.grossMargin, "healthy");
});

test("dashboard prompt embeds metrics and probing answers as data", () => {
  const { data } = dash.parse(VALID);
  const m = dash.compute(data);
  const { system, user } = dash.buildPrompt(data, m);
  assert.match(system, /Banned words/);
  assert.match(user, /52\.5/);
  assert.match(user, /week 3/);
  assert.match(user, /OWNER'S CONTEXT/);
});

test("dashboard outputSchema is strict", () => {
  assert.equal(dash.outputSchema.additionalProperties, false);
  assert.ok(dash.outputSchema.properties.flags);
  assert.ok(dash.outputSchema.properties.watch_items);
});
