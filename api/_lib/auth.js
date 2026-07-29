// Magic-link session helpers. Sessions live in KV under msess:{id} with a
// 30-day TTL; membership is lazily re-verified every 24h so a cancelled
// subscription locks out within a day.
import { randomUUID } from "node:crypto";
import { isMember } from "./membership.js";

export const SESSION_COOKIE = "psf_m";
const SESSION_TTL_SECONDS = 30 * 86400;
const REVERIFY_AFTER_MS = 24 * 3600 * 1000;

// Pure — unit-testable.
export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Pure — unit-testable. `secure` false only for local `vercel dev` over http.
export function buildSessionCookie(sessionId, { secure = true } = {}) {
  return [
    `${SESSION_COOKIE}=${sessionId}`,
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function maskEmail(email) {
  const [user, domain] = String(email ?? "").split("@");
  if (!domain) return "";
  const head = user.length <= 2 ? user[0] ?? "" : user.slice(0, 2);
  return `${head}…@${domain}`;
}

export async function createSession(kv, email) {
  const sessionId = randomUUID();
  await kv.set(`msess:${sessionId}`, { email, verifiedAt: Date.now() }, { ex: SESSION_TTL_SECONDS });
  return sessionId;
}

// Resolve the request's member session. Re-verifies against GHL when the
// last check is older than 24h; kills the session if membership lapsed.
export async function requireMember(req, kv) {
  const sessionId = parseCookies(req.headers?.cookie)[SESSION_COOKIE];
  if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) return { member: false };
  const key = `msess:${sessionId}`;
  const sess = await kv.get(key);
  if (!sess?.email) return { member: false };
  if (Date.now() - (sess.verifiedAt ?? 0) > REVERIFY_AFTER_MS) {
    let check;
    try {
      check = await isMember(sess.email);
    } catch (err) {
      // GHL unreachable — keep the session alive rather than locking out members.
      console.error("[auth] re-verify failed, keeping session:", err?.message);
      return { member: true, email: sess.email };
    }
    if (!check.member) {
      await kv.del(key);
      return { member: false };
    }
    await kv.set(key, { email: sess.email, verifiedAt: Date.now() }, { ex: SESSION_TTL_SECONDS });
  }
  return { member: true, email: sess.email };
}
