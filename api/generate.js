import { getKV } from "./_lib/kv.js";
import { underLimit } from "./_lib/ratelimit.js";
import { generateStructured } from "./_lib/claude.js";
import { TOOLS, EMAIL_RE, clientIp } from "./_lib/registry.js";
import { randomUUID } from "node:crypto";

const GENERATIONS_PER_EMAIL_PER_DAY = 3;
const GENERATIONS_PER_IP_PER_DAY = 10;
const FOLLOWUPS_PER_SESSION = 4;
const SESSION_TTL_SECONDS = 86400;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const { toolId, email, formData } = req.body ?? {};

  const tool = TOOLS[toolId];
  if (!tool) return res.status(400).json({ error: "unknown_tool" });
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
    return res.status(400).json({ error: "invalid_email" });
  }
  const parsed = tool.parse(formData);
  if (parsed.errors) return res.status(400).json({ error: "invalid_input", errors: parsed.errors });

  const kv = getKV();
  const day = new Date().toISOString().slice(0, 10);
  if (!(await underLimit(kv, `rl:email:${cleanEmail}:${day}`, GENERATIONS_PER_EMAIL_PER_DAY))) {
    return res.status(429).json({ error: "rate_limited" });
  }
  if (!(await underLimit(kv, `rl:ip:${clientIp(req)}:${day}`, GENERATIONS_PER_IP_PER_DAY))) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const metrics = tool.compute(parsed.data);
  const { system, user } = tool.buildPrompt(parsed.data, metrics);

  let report;
  try {
    report = await generateStructured({ system, user, schema: tool.outputSchema, maxTokens: tool.maxTokens });
  } catch (err) {
    console.error(`[generate] ${toolId} failed:`, err?.message ?? err);
    if (err?.message === "output_truncated") {
      return res.status(422).json({ error: "report_too_long" });
    }
    return res.status(502).json({ error: "generation_failed", retryable: true });
  }

  const finalMetrics = tool.finalize ? tool.finalize(parsed.data, report, metrics) : metrics;
  const sessionId = randomUUID();
  await kv.set(
    `sess:${sessionId}`,
    { toolId, email: cleanEmail, metrics: finalMetrics, report, remaining: FOLLOWUPS_PER_SESSION },
    { ex: SESSION_TTL_SECONDS }
  );
  await kv.lpush("leads", { email: cleanEmail, toolId, ts: new Date().toISOString() });

  return res.status(200).json({ sessionId, metrics: finalMetrics, report, followupsRemaining: FOLLOWUPS_PER_SESSION });
}
