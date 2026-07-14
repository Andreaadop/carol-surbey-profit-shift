import test from "node:test";
import assert from "node:assert/strict";
import {
  computeProfitMarginCheck,
  computeDashboardMetrics,
  computeCashLeakTotals,
  round1,
} from "../assets/js/metrics.js";

test("round1 rounds to one decimal", () => {
  assert.equal(round1(14.249), 14.2);
  assert.equal(round1(-0.05), -0.1);
});

test("profit margin check: healthy margin", () => {
  const r = computeProfitMarginCheck({ revenue: 100000, cogs: 30000, opex: 40000, ownerSalary: 15000 });
  assert.equal(r.trueNetProfit, 15000);
  assert.equal(round1(r.margin), 15);
  assert.equal(r.corrected, null);
});

test("profit margin check: negative margin", () => {
  const r = computeProfitMarginCheck({ revenue: 50000, cogs: 20000, opex: 35000, ownerSalary: 0 });
  assert.equal(r.trueNetProfit, -5000);
  assert.equal(round1(r.margin), -10);
  // ownerSalary 0 → corrected margin using market-rate quarterly salary
  // annualized revenue 200k < 400k → $15,000/quarter
  assert.equal(r.corrected.estimatedQuarterlySalary, 15000);
  assert.equal(r.corrected.trueNetProfit, -20000);
  assert.equal(round1(r.corrected.margin), -40);
});

test("profit margin check: corrected salary bands", () => {
  // annualized 600k → 21,250/qtr; annualized 1.2M → 25,000/qtr
  assert.equal(computeProfitMarginCheck({ revenue: 150000, cogs: 0, opex: 0, ownerSalary: 0 }).corrected.estimatedQuarterlySalary, 21250);
  assert.equal(computeProfitMarginCheck({ revenue: 300000, cogs: 0, opex: 0, ownerSalary: 0 }).corrected.estimatedQuarterlySalary, 25000);
});

test("profit margin check: zero revenue does not divide by zero", () => {
  const r = computeProfitMarginCheck({ revenue: 0, cogs: 0, opex: 100, ownerSalary: 0 });
  assert.equal(r.margin, 0);
  assert.equal(r.corrected, null);
});

test("dashboard metrics: healthy business", () => {
  const m = computeDashboardMetrics({
    revenue: 80000, outstanding: 20000, directCosts: 38000,
    overhead: 25000, ownerDraw: 8000, cashBalance: 90000,
  });
  assert.equal(round1(m.grossMargin), 52.5);
  assert.equal(round1(m.netOperatingMargin), 21.3);
  assert.equal(round1(m.ownerCompPct), 10);
  assert.equal(round1(m.dso), 7.5);
  assert.equal(round1(m.cashRunway), 3.6);
  assert.deepEqual(m.status, {
    grossMargin: "healthy", netOperatingMargin: "healthy",
    ownerCompPct: "healthy", dso: "healthy", cashRunway: "healthy",
  });
});

test("dashboard metrics: distressed business statuses", () => {
  const m = computeDashboardMetrics({
    revenue: 60000, outstanding: 130000, directCosts: 42000,
    overhead: 20000, ownerDraw: 1000, cashBalance: 15000,
  });
  assert.equal(m.status.grossMargin, "critical");        // 30% < 35
  assert.equal(m.status.netOperatingMargin, "critical"); // -3.3% < 5
  assert.equal(m.status.ownerCompPct, "watch");          // 1.7% < 5
  assert.equal(m.status.dso, "critical");                // 65 days > 60
  assert.equal(m.status.cashRunway, "critical");         // 0.75 months < 1
});

test("dashboard metrics: runway below one month is critical", () => {
  const m = computeDashboardMetrics({
    revenue: 60000, outstanding: 0, directCosts: 30000,
    overhead: 20000, ownerDraw: 5000, cashBalance: 10000,
  });
  assert.equal(m.status.cashRunway, "critical"); // 0.5 months
});

test("cash leak totals", () => {
  const expenses = [
    { name: "CRM subscription", monthlyCost: 300 },
    { name: "Truck insurance", monthlyCost: 900 },
    { name: "Old storage unit", monthlyCost: 250 },
    { name: "Mystery software", monthlyCost: 80 },
  ];
  const classifications = [
    { name: "CRM subscription", bucket: "Optimizable" },
    { name: "Truck insurance", bucket: "Essential" },
    { name: "Old storage unit", bucket: "Eliminatable" },
    // "Mystery software" missing → defaults to Optimizable
  ];
  const t = computeCashLeakTotals(expenses, classifications, 10, 100);
  assert.equal(t.essentialTotal, 900);
  assert.equal(t.optimizableTotal, 380);
  assert.equal(t.eliminatableTotal, 250);
  assert.equal(t.optimizableSavings, 95);   // 25% of optimizable
  assert.equal(t.scopeCreepLeak, 1000);     // 10h × $100
  assert.equal(t.totalMonthlyLeak, 1345);   // 250 + 95 + 1000
  assert.equal(t.annualizedLeak, 16140);
});
