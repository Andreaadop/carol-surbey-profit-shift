import { getKV } from "../_lib/kv.js";
import { underLimit } from "../_lib/ratelimit.js";
import { EMAIL_RE, clientIp } from "../_lib/registry.js";
import { isMember } from "../_lib/membership.js";
import { ghlEnabled, sendEmail } from "../_lib/ghl.js";
import { renderMagicLinkEmail, MAGIC_LINK_SUBJECT } from "../_lib/email-templates.js";
import { randomUUID } from "node:crypto";

const TOKEN_TTL_SECONDS = 15 * 60;

// Always answers 200 {sent:true} for valid input — never a membership oracle.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: "invalid_email" });
  }
  if (!ghlEnabled()) return res.status(200).json({ sent: true });

  const kv = getKV();
  const hour = new Date().toISOString().slice(0, 13);
  const underEmail = await underLimit(kv, `rl:auth:${email}:${hour}`, 3, 3600);
  const underIp = await underLimit(kv, `rl:authip:${clientIp(req)}:${hour}`, 10, 3600);
  if (!underEmail || !underIp) return res.status(200).json({ sent: true }); // silent throttle

  try {
    const check = await isMember(email);
    if (check.member && check.contactId) {
      const token = randomUUID();
      await kv.set(`auth:${token}`, { email }, { ex: TOKEN_TTL_SECONDS });
      const base = process.env.NOW_REGION === "dev1"
        ? "http://localhost:3111"
        : "https://profit-shift-site.vercel.app";
      await sendEmail({
        contactId: check.contactId,
        subject: MAGIC_LINK_SUBJECT,
        html: renderMagicLinkEmail(`${base}/auth.html?token=${token}`),
      });
    }
  } catch (err) {
    console.error("[auth] request-link failed:", err?.message ?? err);
  }
  return res.status(200).json({ sent: true });
}
