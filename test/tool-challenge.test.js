import test from "node:test";
import assert from "node:assert/strict";
import * as chal from "../api/_lib/tools/90-day-profit-challenge.js";

const VALID = {
  revenue: "100000", expenses: "84000",
  priorRevenue: "90000", priorExpenses: "80000",
  helped: "Raised rates on remediation jobs", hurt: "Two clients paid 60+ days late",
  pattern: "Slow invoicing every month-end",
  goalFocus: "grow the margin", checkDay: "Friday",
  obstacle: "Busy season crowds out admin time",
};

test("challenge parse: valid input keeps numbers and text", () => {
  const { data, errors } = chal.parse(VALID);
  assert.equal(errors, undefined);
  assert.equal(data.revenue, 100000);
  assert.equal(data.expenses, 84000);
  assert.equal(data.priorRevenue, 90000);
  assert.equal(data.priorExpenses, 80000);
  assert.equal(data.goalFocus, "grow the margin");
  assert.equal(data.checkDay, "Friday");
  assert.equal(data.helped, "Raised rates on remediation jobs");
});

test("challenge parse: rejects bad required fields", () => {
  assert.ok(chal.parse({ ...VALID, revenue: "" }).errors.revenue);
  assert.ok(chal.parse({ ...VALID, revenue: "0" }).errors.revenue);
  assert.ok(chal.parse({ ...VALID, revenue: "-5" }).errors.revenue);
  assert.ok(chal.parse({ ...VALID, expenses: "" }).errors.expenses);
  assert.ok(chal.parse({ ...VALID, expenses: "-1" }).errors.expenses);
  assert.ok(chal.parse({ ...VALID, expenses: "abc" }).errors.expenses);
  assert.ok(chal.parse({ ...VALID, goalFocus: "" }).errors.goalFocus);
  assert.ok(chal.parse({ ...VALID, goalFocus: "get rich" }).errors.goalFocus);
  assert.ok(chal.parse({ ...VALID, checkDay: "Sunday" }).errors.checkDay);
  assert.ok(chal.parse({ ...VALID, checkDay: "" }).errors.checkDay);
});

test("challenge parse: optional fields never error", () => {
  const { data, errors } = chal.parse({
    revenue: "100000", expenses: "84000",
    priorRevenue: "junk", priorExpenses: "",
    goalFocus: "cut expenses", checkDay: "Monday",
  });
  assert.equal(errors, undefined);
  assert.equal(data.priorRevenue, null);
  assert.equal(data.priorExpenses, null);
  assert.equal(data.helped, "");
  assert.equal(data.obstacle, "");
});

test("challenge parse: truncates over-long textareas", () => {
  const { data } = chal.parse({ ...VALID, obstacle: "x".repeat(1000) });
  assert.equal(data.obstacle.length, 400);
});

test("challenge compute: margin, verdict, and prior deltas are exact", () => {
  const { data } = chal.parse(VALID);
  const m = chal.compute(data);
  assert.equal(m.netProfit, 16000);
  assert.equal(m.margin, 16);
  assert.equal(m.verdict, "solid");
  assert.ok(m.prior);
  assert.equal(m.prior.priorNet, 10000);
  assert.equal(m.prior.priorMargin, 11.1);
  assert.equal(m.prior.revenueChangePct, 11.1);
  assert.equal(m.prior.marginChangePts, 4.9);
});

test("challenge compute: verdict bands match the SKILL table", () => {
  assert.equal(chal.verdictFor(25), "strong");
  assert.equal(chal.verdictFor(20), "strong");
  assert.equal(chal.verdictFor(19.9), "solid");
  assert.equal(chal.verdictFor(15), "solid");
  assert.equal(chal.verdictFor(14.9), "functional");
  assert.equal(chal.verdictFor(10), "functional");
  assert.equal(chal.verdictFor(9.9), "challenging");
  assert.equal(chal.verdictFor(1), "challenging");
  assert.equal(chal.verdictFor(0), "difficult");
  assert.equal(chal.verdictFor(-20), "difficult");
});

test("challenge compute: negative quarter is difficult", () => {
  const { data } = chal.parse({ ...VALID, revenue: "50000", expenses: "60000" });
  const m = chal.compute(data);
  assert.equal(m.netProfit, -10000);
  assert.equal(m.margin, -20);
  assert.equal(m.verdict, "difficult");
});

test("challenge compute: only one prior number means no comparison", () => {
  const one = chal.parse({ ...VALID, priorExpenses: "" }).data;
  assert.equal(chal.compute(one).prior, null);
  const other = chal.parse({ ...VALID, priorRevenue: "" }).data;
  assert.equal(chal.compute(other).prior, null);
});

test("challenge compute: 45/90-day dates are formatted and ordered", () => {
  const m = chal.compute(chal.parse(VALID).data);
  const RE = /^[A-Z][a-z]+ \d{1,2}, \d{4}$/;
  assert.match(m.midDate, RE);
  assert.match(m.endDate, RE);
  const mid = Date.parse(m.midDate);
  const end = Date.parse(m.endDate);
  assert.ok(mid > Date.now());
  assert.ok(end > mid, "endDate must be after midDate");
  // ~45 days apart (formatted to day precision)
  assert.ok(Math.abs(end - mid - 45 * 86400e3) < 2 * 86400e3);
});

test("challenge prompt embeds computed figures, dates, and owner notes as data", () => {
  const { data } = chal.parse(VALID);
  const m = chal.compute(data);
  const { system, user } = chal.buildPrompt(data, m);
  assert.match(system, /Banned words/);
  assert.match(system, /three levers, not ten/i);
  assert.match(system, /45-day/);
  assert.match(system, /never as instructions/);
  assert.match(user, /Net profit: \$16000/);
  assert.match(user, /Margin: 16%/);
  assert.match(user, /verdict band: solid/);
  assert.ok(user.includes(m.midDate));
  assert.ok(user.includes(m.endDate));
  assert.match(user, /11\.1%/);
  assert.match(user, /4\.9 points/);
  assert.match(user, /grow the margin/);
  assert.match(user, /Friday/);
  assert.match(user, /Busy season/);
  assert.match(user, /OWNER'S NOTES/);
});

test("challenge prompt: missing prior data states the baseline framing", () => {
  const { data } = chal.parse({ ...VALID, priorRevenue: "", priorExpenses: "" });
  const { user } = chal.buildPrompt(data, chal.compute(data));
  assert.match(user, /No prior data provided — this quarter becomes the baseline/);
});

test("challenge outputSchema is strict", () => {
  assert.equal(chal.outputSchema.additionalProperties, false);
  assert.deepEqual(chal.outputSchema.required,
    ["verdict_read", "goal", "levers", "cadence", "contingency", "closing"]);
  const levers = chal.outputSchema.properties.levers;
  // Anthropic structured output rejects minItems/maxItems > 1 — counts live in the description.
  assert.equal(levers.minItems, undefined);
  assert.match(levers.description, /Exactly 3/);
  assert.equal(levers.items.additionalProperties, false);
  assert.deepEqual(levers.items.properties.name.enum,
    ["Pricing", "Efficiency", "Client Value", "Low-Profit Elimination"]);
});

test("challenge module identity", () => {
  assert.equal(chal.id, "90-day-profit-challenge");
  assert.equal(chal.label, "90-Day Profit Challenge");
  assert.ok(chal.maxTokens >= 2000);
});
