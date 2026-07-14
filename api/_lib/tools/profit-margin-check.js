import { computeProfitMarginCheck, round1 } from "../../../assets/js/metrics.js";
import { VOICE_RULES } from "../voice.js";

export const id = "profit-margin-check";
export const label = "Profit Margin Check";
export const maxTokens = 1000;

const FIELDS = ["revenue", "cogs", "opex", "ownerSalary"];

export function parse(formData = {}) {
  const errors = {};
  const data = {};
  for (const f of FIELDS) {
    const n = Number(formData[f]);
    if (formData[f] === undefined || formData[f] === "" || !Number.isFinite(n) || n < 0) {
      errors[f] = "Enter a number of 0 or more.";
    } else {
      data[f] = n;
    }
  }
  if (!errors.revenue && data.revenue <= 0) errors.revenue = "Revenue must be greater than 0.";
  return Object.keys(errors).length ? { errors } : { data };
}

export function compute(data) {
  const m = computeProfitMarginCheck(data);
  return {
    trueNetProfit: m.trueNetProfit,
    margin: round1(m.margin),
    corrected: m.corrected && {
      estimatedQuarterlySalary: m.corrected.estimatedQuarterlySalary,
      trueNetProfit: m.corrected.trueNetProfit,
      margin: round1(m.corrected.margin),
    },
  };
}

export const outputSchema = {
  type: "object",
  properties: {
    diagnosis: { type: "string", description: "3-5 sentences: the honest read of this margin, per the diagnosis bands. Name the margin number." },
    root_cause: { type: "string", description: "2-4 sentences: why the margin is what it is, based on the cost breakdown." },
    next_step: { type: "string", description: "One concrete next step matched to the margin band." },
    closing: { type: "string", description: "One grounding closing line. No motivational fluff." },
  },
  required: ["diagnosis", "root_cause", "next_step", "closing"],
  additionalProperties: false,
};

export function buildPrompt(data, metrics) {
  const system = `You write the Profit Margin Check report for the CEO Profit Shift program — a financial diagnostic for owners of specialized service businesses (restoration, hazmat, radon, inspection, cleaning contractors).

THE FRAMEWORK
True Net Profit = Revenue − COGS − Operating Expenses − Owner's Salary (3-month window).
Benchmark: a true net profit margin of 10–20% minimum.
Diagnosis bands: 20%+ healthy (room to grow); 10–19% functional but thin (one slow month erases the cushion); 1–9% fragile (pricing/costs need attention before scaling); 0% or negative (breaking even or losing money — address before any growth or hiring).
Next-step bands: 15%+ → set up the Smart Profit Allocation system; 5–14% → work the profit levers (pricing, efficiency, cutting low-margin work) before allocating; below 5% → find why costs outpace revenue first.
If the owner paid themselves $0, the corrected margin (using a market-rate salary) is their real number — say so plainly.
Industry OpEx benchmarks (% of revenue): cleaning/janitorial 55–65; water damage restoration 55–65; radon/inspection/compliance 35–50; biohazard/hazmat/asbestos 50–65; specialty contractors 45–60.

${VOICE_RULES}

All numbers below were computed deterministically — use them verbatim.`;

  const c = metrics.corrected;
  const user = `Last 3 months of financials:
- Revenue: $${data.revenue}
- COGS: $${data.cogs}
- Operating expenses: $${data.opex}
- Owner's salary/draws: $${data.ownerSalary}

Computed results:
- True net profit: $${metrics.trueNetProfit}
- True profit margin: ${metrics.margin}%${c ? `
- Owner paid themselves $0. Corrected with a market-rate salary of $${c.estimatedQuarterlySalary}/quarter: corrected net profit $${c.trueNetProfit}, corrected margin ${c.margin}%. The corrected number is their real number.` : ""}

Write the report fields now.`;

  return { system, user };
}
