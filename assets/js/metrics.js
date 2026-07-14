// Deterministic math for all CEO Profit Shift tools. Runs in browser and in
// Vercel functions — the server-computed values are the source of truth.

export function round1(n) {
  if (n === 0) return 0;
  return Math.sign(n) * Math.round(Math.abs(n) * 10) / 10;
}

// Skill #1 benchmarks: market-rate owner salary by annualized revenue band,
// expressed per quarter (the tool collects 3 months of numbers).
function marketRateQuarterlySalary(quarterlyRevenue) {
  const annual = quarterlyRevenue * 4;
  if (annual < 400000) return 15000;
  if (annual < 750000) return 21250;
  return 25000;
}

export function computeProfitMarginCheck({ revenue, cogs, opex, ownerSalary }) {
  const trueNetProfit = revenue - cogs - opex - ownerSalary;
  const margin = revenue > 0 ? (trueNetProfit / revenue) * 100 : 0;
  let corrected = null;
  if (ownerSalary === 0 && revenue > 0) {
    const estimatedQuarterlySalary = marketRateQuarterlySalary(revenue);
    const correctedProfit = revenue - cogs - opex - estimatedQuarterlySalary;
    corrected = {
      estimatedQuarterlySalary,
      trueNetProfit: correctedProfit,
      margin: (correctedProfit / revenue) * 100,
    };
  }
  return { trueNetProfit, margin, corrected };
}

// Benchmarks from skills #2/#9 (specialized service contractors, monthly view).
const DASHBOARD_STATUS = {
  grossMargin: (v) => (v < 35 ? "critical" : v < 40 || v > 65 ? "watch" : "healthy"),
  netOperatingMargin: (v) => (v < 5 ? "critical" : v < 10 ? "watch" : "healthy"),
  ownerCompPct: (v) => (v < 5 || v > 30 ? "watch" : "healthy"),
  dso: (v) => (v > 60 ? "critical" : v > 45 ? "watch" : "healthy"),
  cashRunway: (v) => (v < 1 ? "critical" : v < 3 ? "watch" : "healthy"),
};

export function computeDashboardMetrics({ revenue, outstanding, directCosts, overhead, ownerDraw, cashBalance }) {
  const safeDiv = (a, b) => (b > 0 ? a / b : 0);
  const grossMargin = safeDiv(revenue - directCosts, revenue) * 100;
  const netOperatingMargin = safeDiv(revenue - directCosts - overhead, revenue) * 100;
  const ownerCompPct = safeDiv(ownerDraw, revenue) * 100;
  const dso = safeDiv(outstanding, revenue) * 30;
  const cashRunway = safeDiv(cashBalance, overhead);
  const values = { grossMargin, netOperatingMargin, ownerCompPct, dso, cashRunway };
  const status = Object.fromEntries(
    Object.entries(DASHBOARD_STATUS).map(([k, fn]) => [k, fn(values[k])])
  );
  return { ...values, status };
}

export function computeCashLeakTotals(expenses, classifications, unbilledHours, hourlyRate) {
  const bucketOf = new Map(classifications.map((c) => [c.name, c.bucket]));
  const totals = { Essential: 0, Optimizable: 0, Eliminatable: 0 };
  for (const e of expenses) {
    const bucket = bucketOf.get(e.name) ?? "Optimizable";
    totals[bucket in totals ? bucket : "Optimizable"] += e.monthlyCost;
  }
  const optimizableSavings = totals.Optimizable * 0.25; // skill #3: 20–30% estimated reduction
  const scopeCreepLeak = unbilledHours * hourlyRate;
  const totalMonthlyLeak = totals.Eliminatable + optimizableSavings + scopeCreepLeak;
  return {
    essentialTotal: totals.Essential,
    optimizableTotal: totals.Optimizable,
    eliminatableTotal: totals.Eliminatable,
    optimizableSavings,
    scopeCreepLeak,
    totalMonthlyLeak,
    annualizedLeak: totalMonthlyLeak * 12,
  };
}
