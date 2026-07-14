import { getKV } from "./_lib/kv.js";
import { answerFollowup } from "./_lib/claude.js";
import { TOOLS } from "./_lib/registry.js";
import { VOICE_RULES } from "./_lib/voice.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const { sessionId, message } = req.body ?? {};
  const question = String(message ?? "").trim().slice(0, 500);
  if (!sessionId || !question) return res.status(400).json({ error: "invalid_input" });

  const kv = getKV();
  const sess = await kv.get(`sess:${sessionId}`);
  if (!sess) return res.status(410).json({ error: "session_expired" });
  if (sess.remaining <= 0) return res.status(403).json({ error: "quota_exhausted" });

  const toolLabel = TOOLS[sess.toolId]?.label ?? "CEO Profit Shift tool";
  const system = `You answer follow-up questions about a report the user just received from the ${toolLabel}, a CEO Profit Shift tool by Carol Surbey (The Scalable CEO).

THE USER'S REPORT (JSON):
${JSON.stringify({ metrics: sess.metrics, report: sess.report })}

RULES
- Only answer questions about this report, its numbers, the frameworks behind it, or how to carry out its recommended actions.
- If the question is unrelated to the report or the user's business finances, decline in one sentence and steer back to the report. You are not a general-purpose assistant.
- Keep answers under 150 words. Never invent numbers — use only figures from the report JSON.
${VOICE_RULES}`;

  let answer;
  try {
    answer = await answerFollowup({ system, question });
  } catch (err) {
    console.error("[followup] failed:", err?.message ?? err);
    return res.status(502).json({ error: "generation_failed", retryable: true });
  }

  const remaining = sess.remaining - 1;
  await kv.set(`sess:${sessionId}`, { ...sess, remaining }, { ex: 86400 });
  return res.status(200).json({ answer, remaining });
}
