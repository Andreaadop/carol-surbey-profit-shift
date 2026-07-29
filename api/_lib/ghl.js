// GoHighLevel client for lead capture + report emails. All calls are
// best-effort from the caller's perspective: generate.js wraps the whole flow
// in try/catch and the site never depends on GHL being up.
const BASE = "https://services.leadconnectorhq.com";
const CALL_TIMEOUT_MS = 6000;

export function ghlEnabled() {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

async function ghl(path, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`GHL ${path} -> ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Upsert the contact, then ADD tags via the additive endpoint so an existing
// contact's tags are never replaced.
export async function upsertContact(email, toolId) {
  const data = await ghl("/contacts/upsert", {
    locationId: process.env.GHL_LOCATION_ID,
    email,
    source: "CEO Profit Shift tools site",
  });
  const contactId = data.contact?.id ?? data.id;
  if (contactId) {
    await ghl(`/contacts/${contactId}/tags`, { tags: ["ceo-profit-shift", toolId] });
  }
  return contactId;
}

export async function sendEmail({ contactId, subject, html }) {
  const body = { type: "Email", contactId, subject, html };
  if (process.env.GHL_EMAIL_FROM) body.emailFrom = process.env.GHL_EMAIL_FROM;
  return ghl("/conversations/messages", body);
}
