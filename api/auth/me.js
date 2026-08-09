import { getKV } from "../_lib/kv.js";
import { underLimit } from "../_lib/ratelimit.js";
import { clientIp } from "../_lib/registry.js";
import { requireMember, maskEmail } from "../_lib/auth.js";

export default async function handler(req, res) {
  const paywall = process.env.PAYWALL_DISABLED !== "1";
  const kv = getKV();
  const hour = new Date().toISOString().slice(0, 13);
  if (!(await underLimit(kv, `rl:me:${clientIp(req)}:${hour}`, 120, 3600))) {
    return res.status(200).json({ member: false, paywall });
  }
  const auth = await requireMember(req, kv);
  return res.status(200).json(
    auth.member ? { member: true, paywall, email: maskEmail(auth.email) } : { member: false, paywall }
  );
}
