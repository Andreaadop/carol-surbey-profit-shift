import test from "node:test";
import assert from "node:assert/strict";
import { renderReportEmail, emailSubject } from "../api/_lib/email-templates.js";

const BANNED = ["level up", "crush it", "game changer", "empower", "journey", "transformation"];

const PMC = {
  data: { revenue: 185000, cogs: 78000, opex: 62000, ownerSalary: 18000 },
  metrics: { trueNetProfit: 27000, margin: 14.6, corrected: null },
  report: {
    diagnosis: "Margin is 14.6% — thin but real.",
    root_cause: "COGS at 42% and OpEx at 34%.",
    next_step: "Work the profit levers before allocating.",
    closing: "Protect it before you grow it.",
  },
};

const DASH = {
  data: { businessType: "restoration", month: "June 2026" },
  metrics: {
    grossMargin: 50.6, netOperatingMargin: 21, ownerCompPct: 9.1, dso: 8.8, cashRunway: 1.6,
    status: { grossMargin: "healthy", netOperatingMargin: "healthy", ownerCompPct: "healthy", dso: "healthy", cashRunway: "watch" },
  },
  report: {
    story: "Strong margins, thin cash.",
    flags: [{ title: "Runway", body: "1.6 months." }, { title: "Overdue AR", body: "$9,500 stuck." }, { title: "Unbilled", body: "$5,000 idle." }],
    actions: [{ title: "Collect", instruction: "Call every overdue account." }],
    question: "Would you know which bills to delay?",
    watch_items: ["a", "b", "c"],
  },
};

const LEAK = {
  data: {},
  metrics: { totalMonthlyLeak: 1568, annualizedLeak: 18816, essentialTotal: 1345, optimizableTotal: 1039, eliminatableTotal: 240, optimizableSavings: 260, scopeCreepLeak: 1140 },
  report: {
    classifications: [{ name: "CRM software", bucket: "Optimizable", reason: "x" }],
    observation: "The ads are the gut-check winner.",
    actions_week: ["Cancel the storage unit — saves $240/month"],
    actions_month: ["Renegotiate insurance"],
    actions_quarter: ["Evaluate ads ROI"],
    scope_creep_note: "Unbilled work is an undisclosed discount.",
    closing: "Now it stays.",
  },
};

test("pmc email contains key numbers and sections", () => {
  const html = renderReportEmail("profit-margin-check", PMC.data, PMC.metrics, PMC.report);
  for (const s of ["14.6%", "$27,000", "The read", "Your next step", "Talk to Carol", "carolsurbey.com"]) {
    assert.ok(html.includes(s), `missing: ${s}`);
  }
  assert.equal(emailSubject("profit-margin-check", PMC.data, PMC.metrics), "Your Profit Margin Check: 14.6%");
});

test("dashboard email contains metrics with status words and flags", () => {
  const html = renderReportEmail("monthly-dashboard", DASH.data, DASH.metrics, DASH.report);
  for (const s of ["June 2026", "50.6%", "1.6 months", "Watch", "🚩", "3 priority actions", "One question"]) {
    assert.ok(html.includes(s), `missing: ${s}`);
  }
  assert.equal(emailSubject("monthly-dashboard", DASH.data, DASH.metrics), "Your Monthly Dashboard — June 2026");
});

test("cash leak email contains leak totals and action lists", () => {
  const html = renderReportEmail("cash-leak-audit", LEAK.data, LEAK.metrics, LEAK.report);
  for (const s of ["$1,568", "$18,816", "This week", "CRM software", "Optimizable"]) {
    assert.ok(html.includes(s), `missing: ${s}`);
  }
  assert.equal(emailSubject("cash-leak-audit", LEAK.data, LEAK.metrics), "Your Cash Leak Audit: $1,568/mo found");
});

test("report text is escaped — injected markup cannot reach the email DOM", () => {
  const report = { ...PMC.report, diagnosis: `<script>alert(1)</script> & "quotes"` };
  const html = renderReportEmail("profit-margin-check", PMC.data, PMC.metrics, report);
  assert.ok(!html.includes("<script>alert"), "raw script tag leaked");
  assert.ok(html.includes("&lt;script&gt;"), "escaping not applied");
});

test("no banned words in template chrome", () => {
  const html = (
    renderReportEmail("profit-margin-check", PMC.data, PMC.metrics, PMC.report) +
    renderReportEmail("monthly-dashboard", DASH.data, DASH.metrics, DASH.report) +
    renderReportEmail("cash-leak-audit", LEAK.data, LEAK.metrics, LEAK.report)
  ).toLowerCase();
  for (const w of BANNED) assert.ok(!html.includes(w), `banned word present: ${w}`);
});
