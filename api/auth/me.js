import { getKV } from "../_lib/kv.js";
import { requireMember, maskEmail } from "../_lib/auth.js";

export default async function handler(req, res) {
  const auth = await requireMember(req, getKV());
  return res.status(200).json(
    auth.member ? { member: true, email: maskEmail(auth.email) } : { member: false }
  );
}
