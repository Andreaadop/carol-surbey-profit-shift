import { getKV } from "./_lib/kv.js";

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.query.key !== secret) return res.status(401).json({ error: "unauthorized" });
  const items = await getKV().lrange("leads", 0, -1);
  const leads = items.map((i) => (typeof i === "string" ? JSON.parse(i) : i));
  return res.status(200).json(leads);
}
