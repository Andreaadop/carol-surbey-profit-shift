export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function money(n) {
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Animate a number from 0 to `value` inside `el`. Keeps one decimal if the
// target has one; always ends on the exact final string.
export function countUp(el, value, { suffix = "", duration = 800 } = {}) {
  const target = Number(value);
  const decimals = Number.isInteger(target) ? 0 : 1;
  const done = () => { el.textContent = target.toFixed(decimals) + suffix; };
  if (reducedMotion() || !Number.isFinite(target)) return done();
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (target * eased).toFixed(decimals) + suffix;
    if (t < 1) requestAnimationFrame(tick); else done();
  };
  requestAnimationFrame(tick);
}

// Thin stacked bar splitting a total into labeled segments.
// segments: [{label, value, cls}] — values must be >= 0; returns "" when the
// data can't be shown honestly (zero/negative total or a negative segment).
export function flowBar(title, segments) {
  if (segments.some((s) => s.value < 0)) return "";
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (!(total > 0)) return "";
  const parts = segments.filter((s) => s.value > 0);
  const track = parts.map((s) =>
    `<span class="flow-seg ${s.cls}" style="width:${((s.value / total) * 100).toFixed(2)}%"></span>`).join("");
  const legend = parts.map((s) =>
    `<span class="flow-key"><i class="${s.cls}"></i>${esc(s.label)} · ${money(s.value)} <em>${Math.round((s.value / total) * 100)}%</em></span>`).join("");
  return `<div class="flow">
    <div class="flow-title">${esc(title)}</div>
    <div class="flow-track">${track}</div>
    <div class="flow-legend">${legend}</div>
  </div>`;
}

// Semicircle gauge for the profit-margin bands: below 10% critical, 10–20%
// watch, 20%+ healthy. Scale runs -5%..35%; the dot marks the actual value.
export function gaugeSVG(value) {
  const min = -5, max = 35, r = 80, cx = 100, cy = 100, sw = 16;
  const pt = (v) => {
    const a = ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * Math.PI;
    return [cx - r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const band = (v1, v2, cls) => {
    const [x1, y1] = pt(v1), [x2, y2] = pt(v2);
    return `<path class="${cls}" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
  };
  const [dx, dy] = pt(Number(value) || 0);
  return `<svg class="gauge" viewBox="0 0 200 112" role="img" aria-label="Profit margin gauge: below 10% needs attention, 10 to 20% thin, above 20% healthy">
    ${band(min, 9.4, "g-critical")}${band(10.6, 19.4, "g-watch")}${band(20.6, max, "g-healthy")}
    <circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="9" class="g-dot"/>
  </svg>`;
}

function saveForm(toolId, form) {
  const data = {};
  for (const el of form.querySelectorAll("[name]")) data[el.name] = el.value;
  try { localStorage.setItem(`psf:${toolId}`, JSON.stringify(data)); } catch {}
}

function restoreForm(toolId, form) {
  try {
    const data = JSON.parse(localStorage.getItem(`psf:${toolId}`) ?? "{}");
    for (const el of form.querySelectorAll("[name]")) {
      if (data[el.name] !== undefined && el.type !== "email") el.value = data[el.name];
    }
  } catch {}
}

function showError(container, message) {
  container.innerHTML = `<div class="api-error">${esc(message)}</div>`;
  container.hidden = false;
}

// Sticky progress bar: sections are the form's fieldsets that contain
// required fields; one is complete when every required field inside is
// non-empty and valid. Optional-only fieldsets don't count toward progress
// (otherwise a fully-filled form could never reach 100%), and the bar only
// appears when there are at least two countable sections.
function initProgress(form) {
  const mount = document.getElementById("form-progress");
  if (!mount) return { hide() {} };
  const sections = [...form.querySelectorAll("fieldset")]
    .map((fs) => ({ fs, required: [...fs.querySelectorAll("[required]")] }))
    .filter((s) => s.required.length > 0);
  if (sections.length < 2) { mount.hidden = true; return { hide() {} }; }
  mount.innerHTML = `
    <div class="progress-bar"><span></span></div>
    <span class="progress-label"></span>`;
  const fill = mount.querySelector(".progress-bar span");
  const label = mount.querySelector(".progress-label");
  const update = () => {
    let complete = 0;
    for (const { fs, required } of sections) {
      const ok = required.every((el) => el.value.trim() !== "" && el.checkValidity());
      fs.classList.toggle("complete", ok);
      if (ok) complete++;
    }
    fill.style.width = `${Math.round((complete / sections.length) * 100)}%`;
    label.textContent = `${complete} of ${sections.length} sections complete`;
  };
  form.addEventListener("input", update);
  update(); // account for restored values
  return { hide() { mount.classList.add("done"); } };
}

const LOADING_LINES = [
  "Reading your numbers…",
  "Checking them against industry benchmarks…",
  "Writing your report in plain language…",
];

function startLoading(form, btn) {
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "Running your numbers…";
  const card = document.createElement("div");
  card.className = "loading-card";
  card.innerHTML = `<div class="msg"></div><div class="track"></div>`;
  form.insertAdjacentElement("afterend", card);
  const msg = card.querySelector(".msg");
  let i = 0;
  msg.textContent = LOADING_LINES[0];
  const timer = reducedMotion() ? null : setInterval(() => {
    i = (i + 1) % LOADING_LINES.length;
    msg.textContent = LOADING_LINES[i];
  }, 3200);
  return () => { if (timer) clearInterval(timer); card.remove(); };
}

export function initTool({ toolId, collect, renderMetrics, renderReport, onReady }) {
  const form = document.getElementById("tool-form");
  const errorBox = document.getElementById("form-error");
  const reportSection = document.getElementById("report");
  restoreForm(toolId, form);
  const progress = initProgress(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const btn = form.querySelector("button[type=submit]");
    const stopLoading = startLoading(form, btn);
    saveForm(toolId, form);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toolId,
          email: form.querySelector("[name=email]").value.trim(),
          formData: collect(form),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        showError(errorBox, "You've reached today's limit for this tool — come back tomorrow.");
        return;
      }
      if (res.status === 422) {
        showError(errorBox, "That's more than this report can cover in one run — trim the list to the biggest items and run it again.");
        return;
      }
      if (res.status === 400 && body.errors) {
        showError(errorBox, "Check your inputs: " + Object.values(body.errors)[0]);
        return;
      }
      if (!res.ok) {
        showError(errorBox, "Your report couldn't be generated — your numbers are saved. Try again in a minute.");
        return;
      }
      form.hidden = true;
      progress.hide();
      document.getElementById("metrics").innerHTML =
        (body.emailed ? `<div class="card email-note">📬 A copy of this report is on its way to your inbox.</div>` : "") +
        renderMetrics(body.metrics);
      document.getElementById("report-body").innerHTML = renderReport(body.report, body.metrics);
      reportSection.classList.add("reveal");
      reportSection.hidden = false;
      initFollowup(body.sessionId, body.followupsRemaining);
      if (onReady) onReady(body.report, body.metrics);
      reportSection.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
    } catch {
      showError(errorBox, "Network problem — your numbers are saved. Try again in a minute.");
    } finally {
      stopLoading();
      btn.disabled = false;
      btn.classList.remove("loading");
      btn.textContent = btn.dataset.label ?? "Get my report";
    }
  });
}

function initFollowup(sessionId, remaining) {
  const input = document.getElementById("fu-input");
  const send = document.getElementById("fu-send");
  const thread = document.getElementById("fu-thread");
  const counter = document.getElementById("fu-counter");

  const update = () => {
    counter.textContent = `${remaining} question${remaining === 1 ? "" : "s"} left`;
    if (remaining <= 0) {
      input.disabled = true;
      send.disabled = true;
      counter.innerHTML =
        `That's the last question for this report. Want to go deeper? ` +
        `<a href="https://carolsurbey.com" target="_blank" rel="noopener">Talk to Carol at carolsurbey.com</a>.`;
      counter.className = "fu-done";
    }
  };
  update();

  send.addEventListener("click", async () => {
    const q = input.value.trim();
    if (!q || remaining <= 0) return;
    input.value = "";
    send.disabled = true;
    thread.insertAdjacentHTML("beforeend", `<div class="chat-q">${esc(q)}</div>`);
    thread.insertAdjacentHTML("beforeend", `<div class="chat-a typing"><i></i><i></i><i></i></div>`);
    const typing = thread.lastElementChild;
    typing.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: q }),
      });
      const body = await res.json().catch(() => ({}));
      typing.remove();
      if (res.status === 410) {
        thread.insertAdjacentHTML("beforeend", `<div class="chat-a">This report session has expired — run the tool again.</div>`);
        remaining = 0;
      } else if (!res.ok) {
        thread.insertAdjacentHTML("beforeend", `<div class="chat-a">Couldn't answer that one — try again in a minute.</div>`);
      } else {
        thread.insertAdjacentHTML("beforeend", `<div class="chat-a">${esc(body.answer)}</div>`);
        remaining = body.remaining;
      }
    } catch {
      typing.remove();
      thread.insertAdjacentHTML("beforeend", `<div class="chat-a">Network problem — try again in a minute.</div>`);
    } finally {
      send.disabled = remaining <= 0;
      update();
      thread.lastElementChild?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
    }
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send.click(); });
}
