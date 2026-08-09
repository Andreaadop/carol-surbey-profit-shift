// Client-side lock for members-only tool pages. UX only — /api/generate
// enforces membership server-side regardless of what this shows.
import { esc } from "./tool-ui.js";

export const CHECKOUT_URL = "https://link.feacreate.com/payment-link/6a6b660a7b99151a540415b4";

export async function initGate() {
  const form = document.getElementById("tool-form");
  const progress = document.getElementById("form-progress");
  const intro = document.querySelector(".intro");

  let me = { member: false };
  try {
    me = await (await fetch("/api/auth/me")).json();
  } catch {}

  // Paywall kill switch: server reports paywall:false → tools are open.
  if (me.paywall === false) return;

  if (me.member) {
    intro?.insertAdjacentHTML(
      "afterend",
      `<p class="signed-in">✓ Signed in as ${esc(me.email ?? "member")}</p>`
    );
    return;
  }

  form.hidden = true;
  if (progress) progress.hidden = true;

  const expired = new URLSearchParams(location.search).get("auth") === "expired";
  const lock = document.createElement("div");
  lock.className = "lock-card";
  lock.innerHTML = `
    <div class="lock-head">🔒 This is a members-only tool</div>
    <p>The CEO Profit Shift membership unlocks this tool and every tool in the program — <strong>$8/month, cancel anytime</strong>.</p>
    <a class="btn" href="${CHECKOUT_URL}">Become a member — $8/month</a>
    <div class="lock-divider">Already a member?</div>
    ${expired ? `<p class="lock-expired">That sign-in link expired or was already used — request a fresh one below.</p>` : ""}
    <div class="fu-row">
      <input id="gate-email" type="email" placeholder="you@company.com" autocomplete="email">
      <button id="gate-send" class="btn secondary" type="button">Email me a sign-in link</button>
    </div>
    <p id="gate-note" class="hint" hidden></p>`;
  form.insertAdjacentElement("beforebegin", lock);

  const note = lock.querySelector("#gate-note");
  lock.querySelector("#gate-send").addEventListener("click", async () => {
    const email = lock.querySelector("#gate-email").value.trim();
    if (!email) return;
    note.hidden = false;
    note.textContent = "Sending…";
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      note.textContent = res.ok
        ? "If that email belongs to a member, a sign-in link is on its way — check your inbox. The link expires in 15 minutes."
        : "That doesn't look like a valid email — check it and try again.";
    } catch {
      note.textContent = "Network problem — try again in a minute.";
    }
  });
}
