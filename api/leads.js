import { getKV } from "./_lib/kv.js";
import { timingSafeEqual } from "node:crypto";

function isAuthorized(req, secret) {
  if (!secret) return false;
  const authHeader = req.headers?.authorization ?? "";
  const bearerMatch = /^Bearer (.+)$/.exec(authHeader);
  const provided = bearerMatch ? bearerMatch[1] : req.query?.key;
  if (!provided) return false;
  const providedBuf = Buffer.from(String(provided));
  const secretBuf = Buffer.from(secret);
  if (providedBuf.length !== secretBuf.length) return false;
  return timingSafeEqual(providedBuf, secretBuf);
}

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!isAuthorized(req, secret)) return res.status(401).json({ error: "unauthorized" });
  const items = await getKV().lrange("leads", 0, -1);
  const leads = items.map((i) => (typeof i === "string" ? JSON.parse(i) : i));
  return res.status(200).json(leads);
}
