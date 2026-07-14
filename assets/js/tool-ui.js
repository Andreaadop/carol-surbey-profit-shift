export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function money(n) {
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
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

export function initTool({ toolId, collect, renderMetrics, renderReport, onReady }) {
  const form = document.getElementById("tool-form");
  const errorBox = document.getElementById("form-error");
  const reportSection = document.getElementById("report");
  restoreForm(toolId, form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Running your numbers…";
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
      if (res.status === 400 && body.errors) {
        showError(errorBox, "Check your inputs: " + Object.values(body.errors)[0]);
        return;
      }
      if (res.status === 422) {
        showError(errorBox, "That's more than this report can cover in one run — trim the list to the biggest items and run it again.");
        return;
      }
      if (!res.ok) {
        showError(errorBox, "Your report couldn't be generated — your numbers are saved. Try again in a minute.");
        return;
      }
      form.hidden = true;
      document.getElementById("metrics").innerHTML = renderMetrics(body.metrics);
      document.getElementById("report-body").innerHTML = renderReport(body.report, body.metrics);
      reportSection.hidden = false;
      initFollowup(body.sessionId, body.followupsRemaining);
      if (onReady) onReady(body.report, body.metrics);
      reportSection.scrollIntoView({ behavior: "smooth" });
    } catch {
      showError(errorBox, "Network problem — your numbers are saved. Try again in a minute.");
    } finally {
      btn.disabled = false;
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
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: q }),
      });
      const body = await res.json().catch(() => ({}));
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
      thread.insertAdjacentHTML("beforeend", `<div class="chat-a">Network problem — try again in a minute.</div>`);
    } finally {
      send.disabled = remaining <= 0;
      update();
      thread.lastElementChild?.scrollIntoView({ behavior: "smooth" });
    }
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send.click(); });
}
