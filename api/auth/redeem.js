import { getKV } from "../_lib/kv.js";
import { underLimit } from "../_lib/ratelimit.js";
import { clientIp } from "../_lib/registry.js";
import { createSession, buildSessionCookie } from "../_lib/auth.js";

// POST-only: sign-in tokens are consumed from auth.html via POST so that
// corporate email link scanners (which prefetch GETs) can't burn them.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  // JSON only — a cross-site urlencoded <form> POST must not reach the token
  // logic (login-CSRF hardening); auth.html always sends JSON.
  if (!String(req.headers["content-type"] ?? "").includes("application/json")) {
    return res.status(415).json({ ok: false });
  }

  const kv = getKV();
  const hour = new Date().toISOString().slice(0, 13);
  if (!(await underLimit(kv, `rl:redeem:${clientIp(req)}:${hour}`, 10, 3600))) {
    return res.status(429).json({ ok: false });
  }

  const token = String(req.body?.token ?? "");
  if (!/^[a-f0-9-]{36}$/i.test(token)) return res.status(200).json({ ok: false });

  const key = `auth:${token}`;
  // Atomic single-use where the store supports it.
  const record = typeof kv.getdel === "function"
    ? await kv.getdel(key)
    : await kv.get(key).then(async (r) => { await kv.del(key); return r; });
  if (!record?.email) return res.status(200).json({ ok: false });

  const sessionId = await createSession(kv, record.email);
  const secure = process.env.NOW_REGION !== "dev1";
  res.setHeader("Set-Cookie", buildSessionCookie(sessionId, { secure }));
  return res.status(200).json({ ok: true });
}
