// Email-safe HTML renderings of the three tool reports. Table layout, inline
// styles only, no external images (a text wordmark instead of the SVG logo —
// email clients are unreliable with SVG). Every dynamic value is escaped.
const NAVY = "#1A3759";
const TEAL = "#3C7D96";
const MINT = "#E9F8F7";
const LIGHT = "#D1E4E2";
const GREY = "#444444";
const GREY_LIGHT = "#6b7280";
const STATUS_COLOR = { healthy: "#3e7d4f", watch: "#b07d2a", critical: "#b03a3a" };
const STATUS_WORD = { healthy: "Healthy", watch: "Watch", critical: "Critical" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

const section = (title, inner) => `
  <tr><td style="padding: 18px 28px 0;">
    <h2 style="margin:0 0 8px; font-family: Georgia, serif; font-size: 19px; color: ${NAVY};">${esc(title)}</h2>
    ${inner}
  </td></tr>`;

const para = (text) => `<p style="margin:0; font-size: 15px; line-height: 1.65; color: ${GREY};">${esc(text)}</p>`;

const bigNumber = (label, value, color) => `
  <tr><td align="center" style="padding: 26px 28px 4px;">
    <div style="font-size: 13px; color: ${GREY_LIGHT};">${esc(label)}</div>
    <div style="font-family: Georgia, serif; font-size: 44px; line-height: 1.1; color: ${color};">${esc(value)}</div>
  </td></tr>`;

const metricRow = (label, value, status) => `
  <tr>
    <td style="padding: 8px 10px; border-bottom: 1px solid ${LIGHT}; font-size: 14px; color: ${GREY};">${esc(label)}</td>
    <td style="padding: 8px 10px; border-bottom: 1px solid ${LIGHT}; font-size: 14px; font-weight: bold; color: ${NAVY}; white-space: nowrap;">${esc(value)}</td>
    ${status ? `<td style="padding: 8px 10px; border-bottom: 1px solid ${LIGHT}; font-size: 13px; font-weight: bold; color: ${STATUS_COLOR[status]}; white-space: nowrap;">${STATUS_WORD[status]}</td>` : ""}
  </tr>`;

const table = (rows) => `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 6px;">${rows}</table>`;

const list = (items) => `<ul style="margin: 6px 0 0; padding-left: 20px;">${items.map((i) =>
  `<li style="font-size: 15px; line-height: 1.6; color: ${GREY}; margin-bottom: 6px;">${esc(i)}</li>`).join("")}</ul>`;

function wrap(bodyRows) {
  return `<!DOCTYPE html>
<html><body style="margin:0; padding:0; background:${MINT};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${MINT}; padding: 24px 8px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 14px; border: 1px solid ${LIGHT}; font-family: Arial, Helvetica, sans-serif;">
  <tr><td align="center" style="padding: 26px 28px 0;">
    <img src="https://assets.cdn.filesafe.space/GzqTMEz873YL4qtc5zto/media/140d4f5c-d535-493c-9f5f-d87a6c64f025.png" width="123" height="44" alt="Carol Surbey — Coaching &amp; Consulting" style="display: block; margin: 0 auto; border: 0;">
    <div style="font-size: 11px; letter-spacing: .22em; color: ${TEAL}; text-transform: uppercase; margin-top: 8px;">The CEO Profit Shift</div>
  </td></tr>
  ${bodyRows}
  <tr><td align="center" style="padding: 26px 28px 8px;">
    <a href="https://carolsurbey.com" style="display: inline-block; background: ${NAVY}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: bold; padding: 12px 30px; border-radius: 999px;">Talk to Carol</a>
  </td></tr>
  <tr><td align="center" style="padding: 8px 28px 26px;">
    <p style="margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: ${GREY_LIGHT};">
      The CEO Profit Shift is a program by Carol Surbey, professionally trained business coach and founder of The Scalable CEO · <a href="https://carolsurbey.com" style="color:${TEAL};">carolsurbey.com</a><br>
      You're receiving this because you requested a report at profit-shift-site.vercel.app.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const bandColor = (margin) =>
  margin >= 20 ? STATUS_COLOR.healthy : margin >= 10 ? STATUS_COLOR.watch : STATUS_COLOR.critical;

function pmcBody(data, m, r) {
  return [
    bigNumber("Your true profit margin", `${m.margin}%`, bandColor(m.margin)),
    section("Your numbers", table(
      metricRow("True net profit (3 months)", money(m.trueNetProfit)) +
      (m.corrected
        ? metricRow(`Corrected — with a market-rate salary of ${money(m.corrected.estimatedQuarterlySalary)}/quarter`, `${m.corrected.margin}%`)
        : "")
    )),
    section("The read", para(r.diagnosis)),
    section("Why it's what it is", para(r.root_cause)),
    section("Your next step", para(r.next_step)),
    section("", `<p style="margin:0; font-family: Georgia, serif; font-size: 17px; font-style: italic; color: ${NAVY};">${esc(r.closing)}</p>`),
  ].join("");
}

function dashboardBody(data, m, r) {
  return [
    `<tr><td align="center" style="padding: 20px 28px 0;">
      <div style="font-size: 13px; color: ${GREY_LIGHT};">${esc(data.businessType)} · ${esc(data.month)}</div>
    </td></tr>`,
    section("Your numbers this month", table(
      metricRow("Gross margin — what's left after paying for the job itself", `${m.grossMargin}%`, m.status.grossMargin) +
      metricRow("Net operating margin — after job costs AND overhead", `${m.netOperatingMargin}%`, m.status.netOperatingMargin) +
      metricRow("Owner pay — share of revenue you paid yourself", `${m.ownerCompPct}%`, m.status.ownerCompPct) +
      metricRow("Days sales outstanding — how long you wait to get paid", `${m.dso} days`, m.status.dso) +
      metricRow("Cash runway — months your cash covers overhead", `${m.cashRunway} months`, m.status.cashRunway)
    )),
    section("What the numbers are telling you", para(r.story)),
    section("3 flags", r.flags.map((f) => `
      <div style="border-left: 4px solid ${STATUS_COLOR.watch}; background: #fdf9f0; border-radius: 8px; padding: 10px 14px; margin: 8px 0;">
        <div style="font-size: 15px; font-weight: bold; color: ${NAVY};">🚩 ${esc(f.title)}</div>
        <p style="margin: 4px 0 0; font-size: 14px; line-height: 1.6; color: ${GREY};">${esc(f.body)}</p>
      </div>`).join("")),
    section("3 priority actions", `<ol style="margin: 6px 0 0; padding-left: 20px;">${r.actions.map((a) =>
      `<li style="font-size: 15px; line-height: 1.6; color: ${GREY}; margin-bottom: 8px;"><strong style="color:${NAVY};">${esc(a.title)}</strong> — ${esc(a.instruction)}</li>`).join("")}</ol>`),
    section("One question to sit with", `<p style="margin:0; font-family: Georgia, serif; font-size: 17px; font-style: italic; color: ${NAVY};">${esc(r.question)}</p>`),
  ].join("");
}

function cashLeakBody(data, m, r) {
  return [
    bigNumber("Leaking every month", `${money(m.totalMonthlyLeak)}`, STATUS_COLOR.critical),
    `<tr><td align="center" style="padding: 0 28px;">
      <div style="font-size: 14px; color: ${GREY};">That's <strong style="color:${STATUS_COLOR.critical};">${money(m.annualizedLeak)} a year</strong> leaving without working for you.</div>
    </td></tr>`,
    section("Your monthly spend, sorted", table(
      metricRow("Essential", `${money(m.essentialTotal)}/mo`) +
      metricRow("Optimizable (est. savings " + money(m.optimizableSavings) + "/mo)", `${money(m.optimizableTotal)}/mo`) +
      metricRow("Eliminatable", `${money(m.eliminatableTotal)}/mo`) +
      metricRow("Scope creep — unbilled work", `${money(m.scopeCreepLeak)}/mo`)
    )),
    section("What the audit revealed", para(r.observation)),
    section("Every expense, sorted", table(r.classifications.map((c) =>
      metricRow(c.name, c.bucket) ).join(""))),
    section("⚡ This week — quick wins", list(r.actions_week)),
    section("📞 This month — needs a conversation", list(r.actions_month)),
    section("🗓️ This quarter — bigger decisions", list(r.actions_quarter)),
    r.scope_creep_note ? section("About that unbilled work", para(r.scope_creep_note)) : "",
    section("", `<p style="margin:0; font-family: Georgia, serif; font-size: 17px; font-style: italic; color: ${NAVY};">${esc(r.closing)}</p>`),
  ].join("");
}

function leverBody(data, m, r) {
  return [
    bigNumber("Your highest-impact lever", m.recommendedLever, NAVY),
    `<tr><td align="center" style="padding: 0 28px;">
      <div style="font-size: 14px; color: ${GREY};">Worth an estimated <strong style="color:${STATUS_COLOR.healthy};">${money(m.recommendedImpact)}/mo</strong> — ${money(m.annualizedImpact)} a year.</div>
    </td></tr>`,
    section("All four levers, rated", table(r.levers.map((l) =>
      metricRow(`${l.lever} — ${l.opportunity} opportunity`, `${money(l.monthlyImpact)}/mo`)).join(""))),
    section("Why this lever", para(r.reason)),
    section("Your 30-day plan", `<ol style="margin: 6px 0 0; padding-left: 20px;">${r.plan_30day.map((a) =>
      `<li style="font-size: 15px; line-height: 1.6; color: ${GREY}; margin-bottom: 8px;">${esc(a)}</li>`).join("")}</ol>`),
    section("Your 30-day target", para(r.target)),
    section("", `<p style="margin:0; font-family: Georgia, serif; font-size: 17px; font-style: italic; color: ${NAVY};">${esc(r.closing)}</p>`),
  ].join("");
}

function profitFirstBody(data, m, r) {
  return [
    bigNumber("Profit + taxes set aside every month", money(m.setAsideMonthly), STATUS_COLOR.healthy),
    `<tr><td align="center" style="padding: 0 28px;">
      <div style="font-size: 14px; color: ${GREY};">Your pay, benchmarked: <strong style="color:${NAVY};">${money(m.ownerPayTarget)}/mo</strong> — a predictable draw, not leftovers.</div>
    </td></tr>`,
    section("Your monthly allocation plan", table(
      metricRow("Monthly revenue", money(data.monthlyRevenue)) +
      metricRow(`Less COGS — direct job costs (${m.cogsPct}% of revenue)`, "−" + money(data.cogs), m.cogsFlag ? "watch" : undefined) +
      metricRow("Available to allocate", money(m.revenueAfterCogs)) +
      metricRow(`Taxes (${m.taxesPct}%)`, money(m.taxesAmt) + "/mo") +
      metricRow(`Profit (${m.profitPct}%)`, money(m.profitAmt) + "/mo") +
      metricRow("Owner's Pay (benchmark)", money(m.ownerPayTarget) + "/mo") +
      metricRow("Operating Expenses (remainder)", money(m.opexTarget) + "/mo")
    )),
    section("Your allocation, read against reality", para(r.readout)),
    section("Your starting point", para(r.phase_plan)),
    section("Set up the accounts", `<ol style="margin: 6px 0 0; padding-left: 20px;">${r.account_steps.map((s) =>
      `<li style="font-size: 15px; line-height: 1.6; color: ${GREY}; margin-bottom: 8px;">${esc(s)}</li>`).join("")}</ol>`),
    section("The transfer habit", para(r.transfer_habit)),
    section("First milestone", para(r.first_milestone)),
    section("", `<p style="margin:0; font-family: Georgia, serif; font-size: 17px; font-style: italic; color: ${NAVY};">${esc(r.closing)}</p>`),
  ].join("");
}

function forecastBody(data, m, r) {
  const signed = (n) => (n < 0 ? "−" + money(Math.abs(n)) : "+" + money(n));
  const netStatus = (n) => (n < 0 ? "critical" : "healthy");
  return [
    bigNumber("90-day net position", signed(m.netPosition), STATUS_COLOR[netStatus(m.netPosition)]),
    `<tr><td align="center" style="padding: 0 28px;">
      <div style="font-size: 14px; color: ${STATUS_COLOR[netStatus(m.tightestNet)]};">
        Tightest month: <strong>Month ${esc(m.tightestMonth)} · ${esc(signed(m.tightestNet))}</strong>
      </div>
    </td></tr>`,
    section("Your 90-day map", table(
      m.months.map((mo, i) =>
        metricRow(`Month ${i + 1} — in ${money(mo.inflow)}, out ${money(mo.outflow)}`, `net ${signed(mo.net)}`, netStatus(mo.net))
      ).join("") +
      metricRow(`Total — in ${money(m.totalIn)}, out ${money(m.totalOut)}`, `net ${signed(m.netPosition)}`, netStatus(m.netPosition))
    )),
    section("The pattern", para(r.pattern_read)),
    section("Month by month", list(r.month_notes)),
    section("Your cash buffer", table(
      metricRow("Buffer target (1 month of fixed expenses)", money(m.bufferTarget)) +
      metricRow("What you have set aside", money(m.currentBuffer)) +
      metricRow("Gap to close", money(m.bufferGap), m.bufferGap > 0 ? "watch" : "healthy")
    ) + para(r.buffer_plan)),
    section("Stabilize it", list(r.actions)),
    section("The weekly 5-minute check", para(r.weekly_review)),
    section("", `<p style="margin:0; font-family: Georgia, serif; font-size: 17px; font-style: italic; color: ${NAVY};">${esc(r.closing)}</p>`),
  ].join("");
}

function weeklyBody(data, m, r) {
  const status = m.net < 0 ? "critical" : m.margin < 10 ? "watch" : "healthy";
  return [
    bigNumber("Net this week", money(m.net), STATUS_COLOR[status]),
    `<tr><td align="center" style="padding: 0 28px;">
      <div style="font-size: 13px; color: ${GREY_LIGHT};">${esc(data.period)} · running margin ${esc(m.margin)}%</div>
    </td></tr>`,
    section("The three numbers", table(
      metricRow("Revenue in", money(data.revenueIn)) +
      metricRow("Expenses out", money(data.expensesOut)) +
      metricRow("Net this week", money(m.net), status) +
      metricRow("Running margin", `${m.margin}%`, status)
    )),
    m.twoWeek ? section("Two-week average (payroll weeks read compressed)", table(
      metricRow("Combined revenue", money(m.twoWeek.revenue)) +
      metricRow("Combined expenses", money(m.twoWeek.expenses)) +
      metricRow("Combined net", money(m.twoWeek.net), m.twoWeek.net < 0 ? "critical" : "healthy") +
      metricRow("Combined margin", `${m.twoWeek.margin}%`)
    )) : "",
    section("The read", para(r.read)),
    section("🚩 The flag", para(r.flag)),
    section("🎯 One action", para(r.one_action)),
    section("Your weekly benchmarks", table(
      metricRow("Target weekly revenue", r.benchmarks.target_revenue) +
      metricRow("Maximum weekly expenses", r.benchmarks.max_expenses) +
      metricRow("Minimum weekly margin", r.benchmarks.min_margin)
    )),
    section("📅 Your weekly habit", para(r.habit_setup)),
    section("", `<p style="margin:0; font-family: Georgia, serif; font-size: 17px; font-style: italic; color: ${NAVY};">${esc(r.closing)}</p>`),
  ].join("");
}

function challengeBody(data, m, r) {
  const VERDICT_COLOR = {
    strong: STATUS_COLOR.healthy,
    solid: STATUS_COLOR.healthy,
    functional: STATUS_COLOR.watch,
    challenging: STATUS_COLOR.critical,
    difficult: STATUS_COLOR.critical,
  };
  const comparison = m.prior
    ? section("Quarter over quarter", table(
        metricRow("Prior quarter — net profit", money(m.prior.priorNet)) +
        metricRow("Prior quarter — margin", `${m.prior.priorMargin}%`) +
        metricRow("This quarter — net profit", money(m.netProfit)) +
        metricRow("This quarter — margin", `${m.margin}%`) +
        metricRow("Revenue change", `${m.prior.revenueChangePct >= 0 ? "+" : ""}${m.prior.revenueChangePct}%`) +
        metricRow("Margin change", `${m.prior.marginChangePts >= 0 ? "+" : ""}${m.prior.marginChangePts} pts`)
      ))
    : section("Your baseline", para("No prior quarter to compare — this quarter becomes your baseline going forward."));
  return [
    bigNumber("Last quarter's margin", `${m.margin}%`, VERDICT_COLOR[m.verdict] ?? NAVY),
    section("The quarter, read honestly", para(r.verdict_read)),
    comparison,
    section("The one goal", `<p style="margin:0; font-family: Georgia, serif; font-size: 17px; font-style: italic; color: ${NAVY};">${esc(r.goal)}</p>`),
    section("Your three profit levers", r.levers.map((l, i) => `
      <div style="border-left: 4px solid ${NAVY}; background: #f2f7f6; border-radius: 8px; padding: 10px 14px; margin: 8px 0;">
        <div style="font-size: 15px; font-weight: bold; color: ${NAVY};">⚙️ Lever ${i + 1}: ${esc(l.name)}</div>
        ${para(`Action — ${l.action}`)}
        ${para(`Target — ${l.target}`)}
        ${para(`Month 1 — ${l.month1}`)}
      </div>`).join("")),
    section("The cadence", para(r.cadence) + list([
      `Every ${data.checkDay}: 5-minute CEO Profit Check`,
      `At 45 days (${m.midDate}): mid-quarter P&L review — on track or course-correct`,
      `At 90 days (${m.endDate}): run this review again`,
    ])),
    section("The obstacle, pre-decided", para(r.contingency)),
    section("", `<p style="margin:0; font-family: Georgia, serif; font-size: 17px; font-style: italic; color: ${NAVY};">${esc(r.closing)}</p>`),
  ].join("");
}

const BODIES = {
  "profit-margin-check": pmcBody,
  "monthly-dashboard": dashboardBody,
  "cash-leak-audit": cashLeakBody,
  "profit-lever-optimizer": leverBody,
  "profit-first-setup": profitFirstBody,
  "cash-flow-forecast": forecastBody,
  "ceo-weekly-profit-check": weeklyBody,
  "90-day-profit-challenge": challengeBody,
};

export function renderReportEmail(toolId, data, metrics, report) {
  return wrap((BODIES[toolId] ?? cashLeakBody)(data, metrics, report));
}

// Subjects reach header-like fields — strip control characters from any
// user-typed text so nothing header-breaking can pass through to GHL.
const headerSafe = (s) => [...String(s ?? "")].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch)).join("").trim();

export const MAGIC_LINK_SUBJECT = "Your CEO Profit Shift sign-in link";

export function renderMagicLinkEmail(link) {
  const safe = esc(link);
  return wrap(`
  <tr><td align="center" style="padding: 26px 28px 4px;">
    <h2 style="margin:0; font-family: Georgia, serif; font-size: 22px; color: ${NAVY};">Sign in to your tools</h2>
    <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.65; color: ${GREY};">Click the button below to open the CEO Profit Shift tools on this device. The link works once and expires in 15 minutes.</p>
  </td></tr>
  <tr><td align="center" style="padding: 20px 28px 4px;">
    <a href="${safe}" style="display: inline-block; background: ${NAVY}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 14px 34px; border-radius: 999px;">Open my tools</a>
  </td></tr>
  <tr><td align="center" style="padding: 8px 28px 0;">
    <p style="margin:0; font-size: 12px; color: ${GREY_LIGHT};">Didn't request this? You can safely ignore this email.</p>
  </td></tr>`);
}

export function emailSubject(toolId, data, metrics) {
  if (toolId === "profit-margin-check") return `Your Profit Margin Check: ${metrics.margin}%`;
  if (toolId === "monthly-dashboard") return `Your Monthly Dashboard — ${headerSafe(data.month)}`;
  if (toolId === "profit-lever-optimizer") return `Your Profit Lever: ${metrics.recommendedLever} — ${money(metrics.recommendedImpact)}/mo`;
  if (toolId === "profit-first-setup") return `Your Profit First Setup: ${money(metrics.setAsideMonthly)}/mo to profit + taxes`;
  if (toolId === "cash-flow-forecast") {
    return metrics.shortfallMonths > 0
      ? `Your 90-Day Cash Flow Forecast: Month ${metrics.tightestMonth} needs a plan`
      : `Your 90-Day Cash Flow Forecast: ${money(metrics.netPosition)} ahead`;
  }
  if (toolId === "ceo-weekly-profit-check") return `Your Weekly Profit Check: ${money(metrics.net)} net, ${metrics.margin}% margin`;
  if (toolId === "90-day-profit-challenge") return `Your 90-Day Profit Plan: ${metrics.margin}% margin quarter, reviewed`;
  return `Your Cash Leak Audit: ${money(metrics.totalMonthlyLeak)}/mo found`;
}
