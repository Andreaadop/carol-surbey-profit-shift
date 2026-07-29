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
    <div style="font-family: Georgia, serif; font-size: 15px; letter-spacing: .16em; color: ${NAVY};">CAROL&nbsp;SURBEY</div>
    <div style="font-size: 11px; letter-spacing: .22em; color: ${TEAL}; text-transform: uppercase; margin-top: 2px;">The CEO Profit Shift</div>
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

export function renderReportEmail(toolId, data, metrics, report) {
  const body =
    toolId === "profit-margin-check" ? pmcBody(data, metrics, report) :
    toolId === "monthly-dashboard" ? dashboardBody(data, metrics, report) :
    cashLeakBody(data, metrics, report);
  return wrap(body);
}

export function emailSubject(toolId, data, metrics) {
  if (toolId === "profit-margin-check") return `Your Profit Margin Check: ${metrics.margin}%`;
  if (toolId === "monthly-dashboard") return `Your Monthly Dashboard — ${data.month}`;
  return `Your Cash Leak Audit: ${money(metrics.totalMonthlyLeak)}/mo found`;
}
