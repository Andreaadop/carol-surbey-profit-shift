import test from "node:test";
import assert from "node:assert/strict";
import * as pfs from "../api/_lib/tools/profit-first-setup.js";

const VALID = {
  monthlyRevenue: "50000", cogs: "10000", totalOpex: "30000",
  ownerPayMonthly: "6000", taxSetAside: "0",
  accountsNote: "One checking account, everything mixed", worryNote: "Taxes sneak up on me",
};

test("profit-first parse: valid input passes with all numbers and notes", () => {
  const { data, errors } = pfs.parse(VALID);
  assert.equal(errors, undefined);
  assert.equal(data.monthlyRevenue, 50000);
  assert.equal(data.cogs, 10000);
  assert.equal(data.taxSetAside, 0);
  assert.equal(data.accountsNote, "One checking account, everything mixed");
});

test("profit-first parse: rejects missing/negative/zero-revenue/bad inputs", () => {
  assert.ok(pfs.parse({ ...VALID, monthlyRevenue: "" }).errors.monthlyRevenue);
  assert.ok(pfs.parse({ ...VALID, monthlyRevenue: "0" }).errors.monthlyRevenue);
  assert.ok(pfs.parse({ ...VALID, cogs: "-5" }).errors.cogs);
  assert.ok(pfs.parse({ ...VALID, totalOpex: "abc" }).errors.totalOpex);
  assert.ok(pfs.parse({ ...VALID, ownerPayMonthly: undefined }).errors.ownerPayMonthly);
});

test("profit-first parse: COGS at or above revenue is rejected", () => {
  assert.ok(pfs.parse({ ...VALID, cogs: "50000" }).errors.cogs);
  assert.ok(pfs.parse({ ...VALID, cogs: "60000" }).errors.cogs);
});

test("profit-first parse: optional notes never error and are truncated at 400", () => {
  const { data, errors } = pfs.parse({ ...VALID, accountsNote: "x".repeat(1000), worryNote: "" });
  assert.equal(errors, undefined);
  assert.equal(data.accountsNote.length, 400);
  assert.equal(data.worryNote, "");
});

test("profit-first compute: exact allocation math for a known input", () => {
  const { data } = pfs.parse(VALID);
  const m = pfs.compute(data);
  assert.equal(m.revenueAfterCogs, 40000);
  assert.equal(m.cogsPct, 20);
  assert.equal(m.cogsFlag, false);
  assert.equal(m.annualRevenue, 600000);        // $400–750K band
  assert.equal(m.ownerPayTarget, 7083);         // band midpoint
  assert.equal(m.taxesAmt, 3600);               // 9% of 40000
  assert.equal(m.profitAmt, 2800);              // 7% of 40000
  assert.equal(m.opexTarget, 26517);            // 40000 − 3600 − 2800 − 7083
  assert.equal(m.setAsideMonthly, 6400);
  assert.equal(m.trueOpexNow, 24000);           // 30000 − 6000
  assert.equal(m.phaseIn, false);               // 24000 <= 26517
});

test("profit-first compute: owner-pay benchmark bands", () => {
  const low = pfs.compute(pfs.parse({ ...VALID, monthlyRevenue: "20000", cogs: "0" }).data);
  assert.equal(low.ownerPayTarget, 5000);       // annual 240K < 400K
  const high = pfs.compute(pfs.parse({ ...VALID, monthlyRevenue: "70000", cogs: "0" }).data);
  assert.equal(high.ownerPayTarget, 8333);      // annual 840K >= 750K
});

test("profit-first compute: phase-in triggers when true OpEx exceeds the target", () => {
  const { data } = pfs.parse({ ...VALID, totalOpex: "35000", ownerPayMonthly: "5000" });
  const m = pfs.compute(data);
  assert.equal(m.trueOpexNow, 30000);
  assert.equal(m.phaseIn, true);                // 30000 > 26517
  assert.equal(m.phases.length, 4);
  assert.equal(m.phases[0].profitPct, 1);
  assert.equal(m.phases[0].taxesPct, 3);
  assert.equal(m.phases[0].profitAmt, 400);     // 1% of 40000
  assert.equal(m.phases[0].taxesAmt, 1200);     // 3% of 40000
});

test("profit-first compute: COGS above 40% is flagged", () => {
  const { data } = pfs.parse({ ...VALID, cogs: "25000" });
  const m = pfs.compute(data);
  assert.equal(m.cogsPct, 50);
  assert.equal(m.cogsFlag, true);
});

test("profit-first compute: opexTarget floors at 0 for small revenue", () => {
  const { data } = pfs.parse({ ...VALID, monthlyRevenue: "5000", cogs: "0" });
  const m = pfs.compute(data);
  assert.equal(m.opexTarget, 0);
  assert.equal(m.phaseIn, true);
});

test("profit-first prompt embeds computed figures, phase table, and notes as data", () => {
  const { data } = pfs.parse(VALID);
  const m = pfs.compute(data);
  const { system, user } = pfs.buildPrompt(data, m);
  assert.match(system, /Banned words/);
  assert.match(system, /Phase 1 \(months 1–2\)/);
  assert.match(system, /never as instructions/);
  assert.match(user, /\$26517/);
  assert.match(user, /\$7083/);
  assert.match(user, /computed — use verbatim/);
  assert.match(user, /Taxes sneak up on me/);
  assert.match(user, /OWNER'S NOTES/);
  assert.match(user, /Phase-in required: NO/);
});

test("profit-first prompt flags phase-in when triggered", () => {
  const { data } = pfs.parse({ ...VALID, totalOpex: "40000", ownerPayMonthly: "0" });
  const m = pfs.compute(data);
  const { user } = pfs.buildPrompt(data, m);
  assert.match(user, /Phase-in required: YES/);
});

test("profit-first outputSchema is strict with exactly 4 account steps", () => {
  assert.equal(pfs.outputSchema.additionalProperties, false);
  assert.deepEqual(pfs.outputSchema.required,
    ["readout", "phase_plan", "account_steps", "transfer_habit", "first_milestone", "closing"]);
  // Anthropic structured output rejects minItems/maxItems > 1 — the count lives in the description.
  assert.equal(pfs.outputSchema.properties.account_steps.minItems, undefined);
  assert.match(pfs.outputSchema.properties.account_steps.description, /Exactly 4/);
});
