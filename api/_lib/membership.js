// Membership truth: an email is a member when its GHL contact has the comp
// tag OR an active/trialing subscription (optionally narrowed to the Profit
// Shift product via GHL_PRODUCT_ID). Subscription status is checked live, so
// cancellations end access without any GHL workflow.
import { findOrCreateContact, listSubscriptions } from "./ghl.js";

export const COMP_TAG = "profit-shift-comp";
const ACTIVE_STATUSES = new Set(["active", "trialing", "live"]);

// Pure decision — unit-testable without network.
export function decideMembership(tags, subscriptions, productId) {
  if ((tags ?? []).some((t) => String(t).toLowerCase() === COMP_TAG)) {
    return { member: true, via: "comp" };
  }
  const activeSub = (subscriptions ?? []).find((s) => {
    if (!ACTIVE_STATUSES.has(String(s?.status ?? "").toLowerCase())) return false;
    if (!productId) return true;
    const ids = [s.productId, s.product?._id, s.product?.id,
      ...(Array.isArray(s.lineItems) ? s.lineItems.map((li) => li?.productId ?? li?.product?._id) : [])];
    return ids.some((id) => id && String(id) === String(productId));
  });
  return activeSub ? { member: true, via: "subscription" } : { member: false };
}

export async function isMember(email) {
  const contact = await findOrCreateContact(email);
  if (!contact.id) return { member: false };
  if (decideMembership(contact.tags, [], null).member) {
    return { member: true, via: "comp", contactId: contact.id };
  }
  const subs = await listSubscriptions(contact.id);
  const decision = decideMembership([], subs, process.env.GHL_PRODUCT_ID || null);
  return { ...decision, contactId: contact.id };
}
