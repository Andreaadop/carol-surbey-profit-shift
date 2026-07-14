import * as pmc from "./tools/profit-margin-check.js";
import * as dashboard from "./tools/monthly-dashboard.js";
import * as cashleak from "./tools/cash-leak-audit.js";

export const TOOLS = Object.fromEntries([pmc, dashboard, cashleak].map((t) => [t.id, t]));

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Trusting x-forwarded-for[0] is safe on Vercel only: the edge strips client-supplied values. Revisit if a proxy/CDN is ever put in front.
export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (typeof fwd === "string" ? fwd.split(",")[0].trim() : "") || "unknown";
}
