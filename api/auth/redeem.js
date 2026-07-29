import { getKV } from "../_lib/kv.js";
import { createSession, buildSessionCookie } from "../_lib/auth.js";

export default async function handler(req, res) {
  const token = String(req.query?.token ?? "");
  const dest = "/monthly-dashboard.html";
  if (!/^[a-f0-9-]{36}$/i.test(token)) {
    return res.redirect(302, `${dest}?auth=expired`);
  }
  const kv = getKV();
  const key = `auth:${token}`;
  const record = await kv.get(key);
  await kv.del(key); // single-use, even on failure paths
  if (!record?.email) {
    return res.redirect(302, `${dest}?auth=expired`);
  }
  const sessionId = await createSession(kv, record.email);
  const secure = process.env.NOW_REGION !== "dev1";
  res.setHeader("Set-Cookie", buildSessionCookie(sessionId, { secure }));
  return res.redirect(302, `${dest}?auth=ok`);
}
