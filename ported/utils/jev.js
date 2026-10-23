import "./jev.css";
import { call, preview, subscribe } from "./bridge";
import { escape, icon } from "./dom";
import { hidePopover, showPopover } from "./popover-motion";
const views = /* @__PURE__ */ new WeakMap();
const running = (report) => report.status === "starting" || report.status === "running";
const statuses = { starting: "Starting browser", running: "Testing", done: "Agent finished", blocked: "Blocked", failed: "Run failed", cancelled: "Cancelled", limit: "Limit reached" };
const verificationLabels = { passed: "Checks passed", failed: "Checks failed", not_checked: "Not checked" };
const duration = (ms) => ms < 6e4 ? `${Math.max(0, Math.round(ms / 1e3))}s` : `${Math.floor(ms / 6e4)}m ${Math.round(ms % 6e4 / 1e3)}s`;
const errorText = (error) => error instanceof Error ? error.message : String(error);
function showJevTestPopover(anchor, context) {
  const panel = document.createElement("section");
  panel.className = "jev-popover floating-menu";
  panel.id = "jev-test-popover";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Test with Jev");
  panel.innerHTML = `<div class="jev-view"><div class="dialog-heading"><div class="jev-heading"><h2>Test with Jev</h2>${testInfoButton("jev-test-help", "About Jev browser tests")}</div><button type="button" class="icon-button" data-jev-close aria-label="Close Test with Jev">${icon("close")}</button></div></div>`;
  const host = panel.firstElementChild;
  const cleanups = [];
  const expanded = anchor.getAttribute("aria-expanded"), controls = anchor.getAttribute("aria-controls");
  let closed = false, frame = 0;
  const view = {
    host,
    close,
    alive: () => !closed && panel.isConnected,
    cleanup(callback) {
      if (closed) callback();
      else cleanups.push(callback);
    }
  };
  function close(restoreFocus = true) {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    removed.disconnect();
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", keyboard, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    window.visualViewport?.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("scroll", schedule);
    for (const cleanup of cleanups) cleanup();
    for (const [name, value] of [["aria-expanded", expanded], ["aria-controls", controls]]) {
      if (value === null) anchor.removeAttribute(name);
      else anchor.setAttribute(name, value);
    }
    hidePopover(panel);
    if (restoreFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
    context.onClose?.();
  }
  function position() {
    frame = 0;
    if (closed) return;
    if (!anchor.isConnected) {
      close(false);
      return;
    }
    const viewport = window.visualViewport, x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
    const rect = anchor.getBoundingClientRect(), gap = 8, inset = 12;
    panel.style.width = `${Math.min(420, Math.max(0, width - inset * 2))}px`;
    const below = y + height - rect.bottom - gap - inset, above = rect.top - y - gap - inset;
    const opensBelow = below >= Math.min(450, height * 0.6) || below >= above;
    const available = opensBelow ? below : above;
    const besideAnchor = available >= Math.min(260, height - inset * 2);
    panel.style.maxHeight = `${Math.max(0, besideAnchor ? available : height - inset * 2)}px`;
    panel.style.left = `${Math.max(x + inset, Math.min(rect.right - panel.offsetWidth, x + width - panel.offsetWidth - inset))}px`;
    panel.style.top = `${besideAnchor ? Math.max(y + inset, Math.min(opensBelow ? rect.bottom + gap : rect.top - panel.offsetHeight - gap, y + height - panel.offsetHeight - inset)) : y + inset}px`;
    panel.dataset.placement = opensBelow ? "below" : "above";
  }
  function schedule() {
    if (!closed && !frame) frame = requestAnimationFrame(position);
  }
  function outside(event) {
    if (!panel.contains(event.target) && !anchor.contains(event.target)) close(false);
  }
  function keyboard(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }
  const resize = new ResizeObserver(schedule);
  const removed = new MutationObserver(() => {
    if (!anchor.isConnected || !panel.isConnected) close(false);
  });
  host.querySelector("[data-jev-close]").addEventListener("click", () => close());
  panel.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && !panel.contains(event.relatedTarget) && !anchor.contains(event.relatedTarget)) close(false);
  });
  document.body.append(panel);
  anchor.setAttribute("aria-expanded", "true");
  anchor.setAttribute("aria-controls", panel.id);
  void mountTests(view, context, true);
  position();
  showPopover(panel, anchor);
  resize.observe(host);
  removed.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", keyboard, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  host.querySelector(context.url ? "#jev-test-goal" : "#jev-test-url")?.focus({ preventScroll: true });
  return close;
}
function createView(dialog, title, variant) {
  views.get(dialog)?.();
  const host = document.createElement("div");
  host.className = "jev-view";
  host.innerHTML = `<div class="dialog-heading"><div class="jev-heading"><span class="jev-mark">${icon("globe")}</span><h2>${title}</h2><span class="jev-preview-badge">Preview</span></div><button type="button" class="icon-button" data-jev-close aria-label="Close ${title}">${icon("close")}</button></div>`;
  dialog.className = `settings-dialog jev-dialog ${variant}`;
  dialog.replaceChildren(host);
  let disposed = false;
  const cleanups = [];
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    dialog.removeEventListener("close", dispose);
    for (const cleanup of cleanups) cleanup();
    for (const input of host.querySelectorAll('input[type="password"]')) input.value = "";
    if (views.get(dialog) === dispose) views.delete(dialog);
  };
  const observer = new MutationObserver(() => {
    if (!dialog.open || !host.isConnected || !dialog.contains(host)) dispose();
  });
  observer.observe(dialog, { childList: true, attributes: true, attributeFilter: ["open"] });
  dialog.addEventListener("close", dispose, { once: true });
  views.set(dialog, dispose);
  const close = () => {
    dispose();
    dialog.close();
  };
  host.querySelector("[data-jev-close]").addEventListener("click", close);
  if (!dialog.open) dialog.showModal();
  return { host, close, alive: () => !disposed && host.isConnected, cleanup: (callback) => {
    if (disposed) callback();
    else cleanups.push(callback);
  } };
}
async function showJevSettings(dialog) {
  const view = createView(dialog, "Jev add-on", "jev-settings-dialog");
  const { host } = view;
  host.insertAdjacentHTML("beforeend", `<form class="jev-settings-form">
    <fieldset class="jev-fields" disabled>
      <label class="jev-enable-row" for="jev-enabled"><span><strong>Let your agents test their apps</strong><small>Available to your architect and workers when enabled.</small></span><input class="jev-switch" type="checkbox" id="jev-enabled" role="switch"></label>
      <label class="jev-enable-row" for="jev-decisions-enabled"><span><strong>Decision assistance</strong><small>Optional reviews, project rules, context search, and worker suggestions.</small></span><input class="jev-switch" type="checkbox" id="jev-decisions-enabled" role="switch"></label>
      <p class="jev-privacy">Browser tests send your goal and visible page text to TypeSafe and your text model provider, using a separate Chrome profile. Decision assistance sends selected task text and diffs to TypeSafe. Reports stay on this device.</p>
      <section class="jev-section"><div class="jev-section-heading"><h3>Connections</h3><span>Usage is billed by your providers</span></div>
        ${keyField("typesafe", "TypeSafe API key")}${keyField("text", "Text model API key")}
        <p class="jev-hint">PandaCode works without Jev or a TypeSafe key. Optional decision assistance only needs the TypeSafe key. Keys are saved privately on this device, outside the keychain. Leave a field empty to keep its saved key.</p>
      </section>
      <details class="jev-section jev-advanced" data-jev-browser-runtime><summary>Browser runtime <span class="jev-runtime-badge" role="status">Checking setup\u2026</span>${icon("down")}</summary>
        <p class="jev-hint">Only browser tests need Python 3.12+, Chrome, and a text model key. Decision assistance works without the browser runtime. Jev is installed separately and only runs when testing.</p>
        <div class="jev-runtime-actions"><button type="button" class="secondary-button" data-jev-install>${icon("plus")}Install Jev runtime</button><button type="button" class="secondary-button" data-jev-doctor>${icon("refresh")}Check setup</button></div>
        <progress class="jev-install-progress" aria-label="Installing Jev runtime" hidden></progress><div class="jev-doctor-details"></div>
      </details>
      <details class="jev-advanced"><summary>Advanced ${icon("down")}</summary><div class="jev-field-grid">
        <label>Text model<input id="jev-text-model" autocomplete="off" spellcheck="false" maxlength="256" placeholder="inception/mercury-2.5"></label>
        <label>OpenAI-compatible base URL<input id="jev-text-base" type="url" autocomplete="off" spellcheck="false" maxlength="2048" placeholder="https://openrouter.ai/api/v1"></label>
        <label>Python executable<input id="jev-python-path" autocomplete="off" spellcheck="false" maxlength="4096" placeholder="Find automatically"></label>
        <label>Chrome executable<input id="jev-chrome-path" autocomplete="off" spellcheck="false" maxlength="4096" placeholder="Find automatically"></label>
      </div><p class="jev-hint">Save changed paths before installing or checking the runtime. Custom providers must support the text model API.</p></details>
    </fieldset>
    ${preview ? '<p class="jev-hint">Jev runs in the desktop app. This browser preview does not save keys or contact model providers.</p>' : ""}
    <p class="jev-feedback" role="status">Loading settings\u2026</p>
    <div class="dialog-footer"><button class="secondary-button" type="button" data-jev-settings-close>Close</button><button class="primary-button" type="submit" data-jev-save disabled>Save settings</button></div>
  </form>`);
  const query = (selector) => host.querySelector(selector);
  const input = (name) => query(`#jev-${name}`);
  const feedback = query(".jev-feedback");
  let config, pending = false, installing = false, doctorRevision = 0;
  const removed = /* @__PURE__ */ new Set();
  function tell(text, error = false) {
    if (!view.alive()) return;
    feedback.textContent = text;
    feedback.classList.toggle("error", error);
  }
  function controls() {
    query(".jev-fields").disabled = pending || !config;
    query("[data-jev-save]").disabled = pending || !config;
    host.setAttribute("aria-busy", String(pending));
    if (preview) for (const key of host.querySelectorAll('input[type="password"]')) key.disabled = true;
  }
  function renderKeys() {
    for (const name of ["typesafe", "text"]) {
      const saved = name === "typesafe" ? config?.typesafeKeySaved : config?.textKeySaved;
      query(`[data-jev-key-status="${name}"]`).textContent = removed.has(name) ? "Will be removed on save" : saved ? "Key saved" : "No saved key";
      query(`[data-jev-remove-key="${name}"]`).hidden = !saved || removed.has(name);
      input(`${name}-key`).placeholder = saved && !removed.has(name) ? "Replace saved key" : "Enter API key";
    }
  }
  function renderDoctor(doctor) {
    if (!view.alive()) return;
    const badge = query(".jev-runtime-badge");
    badge.textContent = doctor.ready ? "Ready" : "Setup needed";
    badge.dataset.ready = String(doctor.ready);
    query(".jev-doctor-details").innerHTML = `${doctor.issues.length ? `<ul>${doctor.issues.map((issue) => `<li>${escape(issue)}</li>`).join("")}</ul>` : ""}<p class="jev-hint">${[doctor.pythonVersion, doctor.jevVersion && `Jev ${doctor.jevVersion}`].filter(Boolean).map(escape).join(" \xB7 ")}</p>`;
  }
  async function checkDoctor(command) {
    const ticket = ++doctorRevision;
    try {
      const doctor = await call(command);
      if (view.alive() && ticket === doctorRevision) renderDoctor(doctor);
    } catch (error) {
      if (view.alive() && ticket === doctorRevision) throw error;
    }
  }
  async function operate(action) {
    if (pending || !view.alive()) return;
    pending = true;
    controls();
    tell("");
    try {
      await action();
    } catch (error) {
      tell(errorText(error), true);
    } finally {
      pending = false;
      installing = false;
      if (view.alive()) {
        controls();
        query(".jev-install-progress").hidden = true;
      }
    }
  }
  query("form").addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!config) return;
    const settings = { enabled: input("enabled").checked, decisionsEnabled: input("decisions-enabled").checked, pythonPath: input("python-path").value.trim(), chromePath: input("chrome-path").value.trim(), textModel: input("text-model").value.trim(), textBaseUrl: input("text-base").value.trim() };
    const args = { settings };
    if (!preview) for (const [name, field] of [["typesafe", "typesafeKey"], ["text", "textKey"]]) {
      const value = input(`${name}-key`).value.trim();
      if (value || removed.has(name)) args[field] = value;
      input(`${name}-key`).value = "";
    }
    void operate(async () => {
      const saved = await call("jev_save_configuration", args);
      window.dispatchEvent(new CustomEvent("pandacode:jev-settings", { detail: saved }));
      if (!view.alive()) return;
      config = saved;
      removed.clear();
      renderKeys();
      tell(saved.enabled || saved.decisionsEnabled ? "Saved. Your enabled Jev features are available for new runs." : "Saved. Jev features are disabled.");
      await checkDoctor("jev_doctor");
    });
  });
  query("[data-jev-settings-close]").addEventListener("click", view.close);
  input("enabled").addEventListener("change", () => {
    query("[data-jev-browser-runtime]").open = input("enabled").checked;
  });
  host.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-jev-remove-key]");
    if (remove) {
      removed.add(remove.dataset.jevRemoveKey);
      input(`${remove.dataset.jevRemoveKey}-key`).value = "";
      renderKeys();
    }
  });
  query("[data-jev-install]").addEventListener("click", () => {
    void operate(async () => {
      installing = true;
      query(".jev-install-progress").hidden = false;
      tell("Installing the pinned Jev runtime\u2026 You can close this panel while it installs.");
      await checkDoctor("jev_install_runtime");
      tell("Runtime installation finished. Check the setup status above.");
    });
  });
  query("[data-jev-doctor]").addEventListener("click", () => {
    void operate(async () => {
      await checkDoctor("jev_doctor");
      tell("Setup checked.");
    });
  });
  void subscribe("jev-install", (event) => {
    if (view.alive() && installing) tell(event.message);
  }).then(view.cleanup).catch(() => {
  });
  await Promise.allSettled([
    call("jev_configuration").then((configuration) => {
      if (!view.alive()) return;
      config = configuration;
      input("enabled").checked = config.enabled;
      input("decisions-enabled").checked = config.decisionsEnabled ?? false;
      query("[data-jev-browser-runtime]").open = config.enabled;
      for (const [id, value] of [["python-path", config.pythonPath], ["chrome-path", config.chromePath], ["text-model", config.textModel], ["text-base", config.textBaseUrl]]) input(id).value = value ?? "";
      renderKeys();
      tell("");
      controls();
    }).catch((error) => tell(errorText(error), true)),
    checkDoctor("jev_doctor").catch((error) => {
      if (!view.alive()) return;
      query(".jev-runtime-badge").textContent = "Could not check setup";
      tell(errorText(error), true);
    })
  ]);
}
function keyField(id, label) {
  return `<div class="jev-key-field"><label for="jev-${id}-key">${label}<span data-jev-key-status="${id}"></span></label><div><input id="jev-${id}-key" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" maxlength="4096" placeholder="Enter API key"><button class="jev-text-button" type="button" data-jev-remove-key="${id}" hidden aria-label="Remove saved ${label}">Remove</button></div></div>`;
}
const presets = {
  smoke: { label: "Smoke test", goal: "Check that this app loads and its main controls work. Try the primary interaction and report any broken or confusing behavior. Do not make purchases or submit real personal data.", viewport: "desktop" },
  journey: { label: "User journey", goal: "Explore the primary user journey from start to finish using test data. Try navigation, inputs, validation, and recovery from mistakes. Report what you actually observed. Do not make purchases or change real account data.", viewport: "desktop" },
  mobile: { label: "Mobile check", goal: "Test the main user journey in a narrow mobile viewport. Check that navigation, inputs, and primary controls are visible and usable. Report any clipping or inaccessible controls. Do not make purchases or submit real personal data.", viewport: "mobile" }
};
async function showJevTests(dialog, context) {
  const view = createView(dialog, "Test with Jev", "jev-tests-dialog");
  await mountTests(view, { ...context, settings: context.settings ?? (() => {
    void showJevSettings(dialog);
  }) });
}
function testInfoButton(id, label) {
  return `<button type="button" class="jev-info-button" data-jev-help="${id}" aria-controls="${id}" aria-expanded="false" aria-label="${label}" title="${label}">${icon("info")}</button>`;
}
async function mountTests(view, context, compact = false) {
  const { host } = view;
  host.insertAdjacentHTML("beforeend", `<div class="jev-testing-body"><section class="jev-test-setup">
    ${compact ? `<p id="jev-test-help" class="jev-help-text" hidden>Give Jev a goal and watch its actions in the sidebar. Tests use a separate Chrome profile and save reports locally. ${preview ? "This web preview does not run model API calls." : "Your configured providers handle model requests."}</p>` : '<p class="jev-intro">Give the browser a goal. Watch it explore your app.</p>'}
    <div class="jev-setup-notice" role="status" hidden><span></span><button type="button" class="jev-text-button" data-jev-open-settings>Set up Jev ${icon("forward")}</button></div>
    <form class="jev-test-form"><label for="jev-test-url">App URL</label><input id="jev-test-url" type="text" inputmode="url" placeholder="http://localhost:3000" autocomplete="off" spellcheck="false" maxlength="2048" required>
      ${compact ? `<details class="jev-local-options" hidden><summary>Local servers ${icon("down")}</summary>` : ""}<div class="jev-local-servers" aria-label="Available local servers"></div>${compact ? "</details>" : ""}
      <div class="jev-presets" aria-label="Test presets">${Object.entries(presets).map(([id, preset]) => `<button type="button" data-jev-preset="${id}" aria-pressed="${id === "smoke"}">${escape(preset.label)}</button>`).join("")}</div>
      <label for="jev-test-goal">${compact ? "Test goal" : "What should it test?"}</label><textarea id="jev-test-goal" rows="3" maxlength="8192" required>${presets.smoke.goal}</textarea>
      <details class="jev-advanced jev-test-checks"><summary>Verify the result ${compact ? testInfoButton("jev-check-help", "About result checks") : "<span>Optional checks</span>"}${icon("down")}</summary><p ${compact ? 'id="jev-check-help" class="jev-help-text" hidden' : 'class="jev-hint"'}>Checked independently on the final page. An agent saying it finished is not a verified pass.</p><div class="jev-field-grid">
        <label>Page contains text<input id="jev-expected-text" placeholder="e.g. Game over" maxlength="2000"></label><label>Title contains<input id="jev-expected-title" placeholder="e.g. Minesweeper" maxlength="500"></label><label>Final URL equals<input id="jev-expected-url" type="url" placeholder="http://localhost:3000/success" maxlength="4096" spellcheck="false"></label>
      </div></details>
      <details class="jev-advanced"><summary>Run options ${icon("down")}</summary><div class="jev-field-grid jev-run-options"><label>Viewport<select id="jev-viewport"><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></label><label>Maximum steps<input id="jev-max-steps" type="number" min="1" max="60" value="20" required></label><label>Time limit (seconds)<input id="jev-time-limit" type="number" min="30" max="600" value="180" required></label></div></details>
      <div class="jev-run-row">${compact ? "" : '<span class="jev-hint">Separate Chrome profile \xB7 local report</span>'}<button type="submit" class="primary-button" data-jev-run disabled>${icon("play")}Run test</button></div>
    </form>
    <p class="jev-feedback" role="status" hidden></p>
    ${preview && !compact ? '<p class="jev-hint">Browser testing runs in the desktop app. No model API calls are made by this preview.</p>' : ""}
  </section><${compact ? "details" : "section"} class="jev-results-section">${compact ? `<summary>Recent tests ${icon("down")}</summary>` : ""}<div class="jev-section-heading"><h3>Test runs</h3><button type="button" class="jev-text-button" data-jev-refresh>${icon("refresh")}Refresh</button></div><div class="jev-run-list" aria-label="Test runs for this task"></div><div class="jev-report" hidden></div><p class="jev-empty">No tests yet. Run a quick check before handing work back to your agent.</p></${compact ? "details" : "section"}></div>`);
  const query = (selector) => host.querySelector(selector);
  const reports = /* @__PURE__ */ new Map();
  const reportButtons = /* @__PURE__ */ new Map();
  const localServers = query(".jev-local-servers"), form = query(".jev-test-form");
  const resultHost = query(".jev-report"), feedback = query(".jev-feedback");
  if (compact) query(".jev-results-section").hidden = true;
  const urlInput = query("#jev-test-url"), goalInput = query("#jev-test-goal");
  const runButton = query("[data-jev-run]");
  if (compact) {
    form.id = "jev-popover-form";
    runButton.setAttribute("form", form.id);
    const footer = query(".jev-run-row");
    footer.classList.add("jev-popover-footer");
    footer.prepend(feedback);
    host.append(footer);
  }
  for (const button of host.querySelectorAll("[data-jev-help]")) {
    const help = query(`#${button.dataset.jevHelp}`), details = help.closest("details");
    details?.addEventListener("toggle", () => {
      if (!details.open) {
        help.hidden = true;
        button.setAttribute("aria-expanded", "false");
      }
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const opening = help.hidden || Boolean(details && !details.open);
      help.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
      if (opening) {
        if (details) details.open = true;
        help.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  }
  urlInput.value = context.url || "";
  let selected, detailId, enabled = false, starting = false, cancelPending = false, renderedEvents = 0, readRevision = 0, refreshRevision = 0;
  const eventVersions = /* @__PURE__ */ new Map();
  function tell(text, error = false) {
    if (!view.alive()) return;
    feedback.textContent = text;
    feedback.hidden = !text;
    feedback.classList.toggle("error", error);
  }
  function setConfig(configuration) {
    enabled = configuration.enabled;
    runButton.disabled = !enabled || starting;
    const notice = query(".jev-setup-notice");
    notice.hidden = enabled;
    notice.querySelector("span").textContent = "Enable Jev and connect your providers to run browser tests.";
  }
  function updateReport(report, fromEvent = false) {
    if (!view.alive() || report.sessionId !== context.sessionId) return;
    if (fromEvent) eventVersions.set(report.id, (eventVersions.get(report.id) || 0) + 1);
    const previous = reports.get(report.id);
    if (previous && (!running(previous) && running(report) || running(previous) && running(report) && (report.durationMs < previous.durationMs || report.events.length < previous.events.length || previous.status === "running" && report.status === "starting"))) {
      selectReport();
      return;
    }
    if (previous?.screenshot && !report.screenshot) report = { ...report, screenshot: previous.screenshot };
    reports.set(report.id, report);
    query(".jev-results-section").hidden = false;
    if (!selected) selected = report.id;
    let button = reportButtons.get(report.id);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "jev-run-item";
      button.innerHTML = '<span class="jev-run-state"></span><span class="jev-run-title"></span><small></small>';
      button.addEventListener("click", () => {
        selected = report.id;
        selectReport();
        void readReport(report.id);
      });
      reportButtons.set(report.id, button);
    }
    button.querySelector(".jev-run-title").textContent = report.goal;
    button.querySelector("small").textContent = `${statuses[report.status]} \xB7 ${duration(report.durationMs)}`;
    button.querySelector(".jev-run-state").dataset.status = report.status;
    button.title = `${report.url}
${report.goal}`;
    button.setAttribute("aria-label", `${report.goal}, ${statuses[report.status]}`);
    const list = query(".jev-run-list");
    const order = [...reports.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
    order.forEach((item, index) => {
      const node = reportButtons.get(item.id);
      if (list.children[index] !== node) list.insertBefore(node, list.children[index] || null);
    });
    while (list.children.length > order.length) list.lastElementChild.remove();
    query(".jev-empty").hidden = reports.size > 0;
    selectReport();
  }
  function selectReport() {
    for (const [id, button] of reportButtons) button.setAttribute("aria-pressed", String(id === selected));
    const report = selected && reports.get(selected);
    if (!report) return;
    resultHost.hidden = false;
    if (detailId !== selected) {
      detailId = selected;
      renderedEvents = 0;
      resultHost.innerHTML = `<div class="jev-report-heading"><strong class="jev-report-status" role="status"></strong><span class="jev-report-meta"></span><button type="button" class="secondary-button" data-jev-cancel>${icon("stop")}Stop</button></div><p class="jev-report-url"></p><p class="jev-report-summary"></p><div class="jev-verification"><span class="jev-check-badge"></span><ul></ul></div><details class="jev-events"><summary>Browser actions <span></span>${icon("down")}</summary><ol></ol></details><figure class="jev-screenshot" hidden><img alt="Final browser screenshot from this Jev test" loading="lazy"><figcaption>Final browser view</figcaption></figure>${context.watch ? `<button type="button" class="secondary-button" data-jev-watch>${icon("globe")}Watch in browser</button>` : ""}${context.attach ? '<button type="button" class="secondary-button jev-attach-report">' + icon("attach") + "Use report in prompt</button>" : ""}`;
      resultHost.querySelector("[data-jev-cancel]").addEventListener("click", () => {
        void cancelSelected();
      });
      resultHost.querySelector("[data-jev-watch]")?.addEventListener("click", () => {
        if (selected) {
          const id = selected;
          view.close();
          context.watch?.(id);
        }
      });
      resultHost.querySelector(".jev-attach-report")?.addEventListener("click", () => {
        const latest = selected && reports.get(selected);
        if (!latest || !context.attach) return;
        try {
          context.attach(reportText(latest));
          view.close();
        } catch (error) {
          tell(errorText(error), true);
        }
      });
    }
    const target = (selector) => resultHost.querySelector(selector);
    target(".jev-report-status").textContent = statuses[report.status];
    target(".jev-report-status").dataset.status = report.status;
    target(".jev-report-meta").textContent = `${report.steps} ${report.steps === 1 ? "step" : "steps"} \xB7 ${duration(report.durationMs)} \xB7 ${report.viewport}`;
    target(".jev-report-url").textContent = report.url;
    target(".jev-report-summary").textContent = report.summary || (running(report) ? "The browser is working through your goal." : "No summary was returned.");
    const cancel = target("[data-jev-cancel]");
    cancel.hidden = !running(report);
    cancel.disabled = cancelPending;
    const badge = target(".jev-check-badge");
    badge.textContent = running(report) ? "Checks pending" : verificationLabels[report.verification];
    badge.dataset.verification = running(report) ? "not_checked" : report.verification;
    target(".jev-verification ul").innerHTML = report.checks.map((check) => `<li>${icon(check.passed ? "check" : "close")}<span>${escape(check.name)}<small>${escape(check.expected)}</small></span><span>${check.passed ? "Passed" : "Failed"}</span></li>`).join("");
    target(".jev-events summary span").textContent = String(report.events.length);
    const events = target(".jev-events ol");
    const nearBottom = events.scrollTop + events.clientHeight >= events.scrollHeight - 32;
    if (report.events.length < renderedEvents) {
      events.replaceChildren();
      renderedEvents = 0;
    }
    for (const event of report.events.slice(renderedEvents)) {
      const item = document.createElement("li");
      item.innerHTML = `<span class="jev-step-number">${escape(event.step)}</span><span><strong>${escape(operationLabel(event.operation))}</strong><small>${escape(event.target || event.url)}</small></span><time>${duration(event.elapsedMs)}</time>`;
      events.append(item);
    }
    renderedEvents = report.events.length;
    if (nearBottom) events.scrollTop = events.scrollHeight;
    const screenshot = typeof report.screenshot === "string" && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(report.screenshot) ? report.screenshot : "";
    const image = target(".jev-screenshot img");
    target(".jev-screenshot").hidden = !screenshot;
    if (screenshot && image.getAttribute("src") !== screenshot) image.src = screenshot;
  }
  async function readReport(id) {
    const ticket = ++readRevision, eventVersion = eventVersions.get(id) || 0;
    try {
      const report = await call("jev_read_run", { sessionId: context.sessionId, runId: id });
      if (!view.alive() || ticket !== readRevision || selected !== id || eventVersion !== (eventVersions.get(id) || 0)) return;
      updateReport(report);
    } catch (error) {
      if (view.alive() && ticket === readRevision) tell(errorText(error), true);
    }
  }
  async function cancelSelected() {
    if (!selected || cancelPending) return;
    const id = selected;
    cancelPending = true;
    selectReport();
    try {
      await call("jev_cancel", { sessionId: context.sessionId, runId: id });
      if (view.alive()) {
        tell("Stopping the browser test\u2026");
        await readReport(id);
      }
    } catch (error) {
      tell(errorText(error), true);
    } finally {
      cancelPending = false;
      if (view.alive()) selectReport();
    }
  }
  async function refresh() {
    const ticket = ++refreshRevision, versions = new Map(eventVersions);
    query("[data-jev-refresh]").disabled = true;
    const results = await Promise.allSettled([call("jev_configuration"), call("jev_list_runs", { sessionId: context.sessionId }), call("list_local_servers")]);
    if (!view.alive() || ticket !== refreshRevision) return;
    query("[data-jev-refresh]").disabled = false;
    if (results[0].status === "fulfilled") setConfig(results[0].value);
    else {
      enabled = false;
      runButton.disabled = true;
      tell(errorText(results[0].reason), true);
    }
    if (results[1].status === "fulfilled") {
      for (const report of results[1].value.sort((a, b) => b.createdAt - a.createdAt)) if ((versions.get(report.id) || 0) === (eventVersions.get(report.id) || 0)) updateReport(report);
      if (selected) void readReport(selected);
    } else tell(errorText(results[1].reason), true);
    if (results[2].status === "fulfilled") {
      localServers.replaceChildren();
      for (const server of results[2].value.slice(0, 12)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "jev-server-chip";
        if (compact) button.innerHTML = `<span class="jev-server-process">${escape(server.process || "localhost")}</span><span class="jev-server-port">:${escape(server.port)}</span>`;
        else button.textContent = `${server.process || "localhost"} :${server.port}`;
        button.title = `${server.process || "localhost"} \xB7 ${server.url}`;
        button.addEventListener("click", () => {
          urlInput.value = server.url;
          urlInput.focus();
        });
        localServers.append(button);
      }
      const serverOptions = host.querySelector(".jev-local-options");
      if (serverOptions) serverOptions.hidden = !localServers.childElementCount;
    }
  }
  host.querySelector("[data-jev-open-settings]").addEventListener("click", () => {
    view.close();
    context.settings?.();
  });
  host.querySelector("[data-jev-refresh]").addEventListener("click", () => {
    void refresh();
  });
  for (const button of host.querySelectorAll("[data-jev-preset]")) button.addEventListener("click", () => {
    const id = button.dataset.jevPreset;
    goalInput.value = presets[id].goal;
    query("#jev-viewport").value = presets[id].viewport;
    for (const item of host.querySelectorAll("[data-jev-preset]")) item.setAttribute("aria-pressed", String(item === button));
  });
  goalInput.addEventListener("input", () => {
    for (const button of host.querySelectorAll("[data-jev-preset]")) button.setAttribute("aria-pressed", "false");
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!enabled || starting) return;
    let url;
    try {
      const entered = urlInput.value.trim();
      url = new URL(/^\d{2,5}$/.test(entered) ? `http://localhost:${entered}` : /^(?:localhost|127\.\d+\.\d+\.\d+|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(entered) ? `http://${entered}` : entered);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch {
      tell("Enter an HTTP or HTTPS app URL without embedded credentials.", true);
      urlInput.focus();
      return;
    }
    const request = { url: url.href, goal: goalInput.value.trim(), maxSteps: Number(query("#jev-max-steps").value), timeoutSeconds: Number(query("#jev-time-limit").value), viewport: query("#jev-viewport").value };
    if (!request.goal) {
      goalInput.focus();
      return;
    }
    for (const [id, name] of [["text", "expectedText"], ["title", "expectedTitle"], ["url", "expectedUrl"]]) {
      const value = query(`#jev-expected-${id}`).value.trim();
      if (value) request[name] = value;
    }
    starting = true;
    runButton.disabled = true;
    tell("Starting an isolated browser test\u2026");
    void call("jev_start", { sessionId: context.sessionId, request }).then((report) => {
      if (!view.alive()) return;
      selected = report.id;
      updateReport(report);
      tell("");
      if (compact && context.watch) {
        view.close();
        context.watch(report.id);
      }
    }).catch((error) => tell(errorText(error), true)).finally(() => {
      starting = false;
      if (view.alive()) runButton.disabled = !enabled;
    });
  });
  try {
    view.cleanup(await subscribe("jev-run", (report) => {
      if (!view.alive() || report.sessionId !== context.sessionId) return;
      const previous = reports.get(report.id);
      updateReport(report, true);
      if (selected === report.id && !running(report) && (!previous || running(previous))) void readReport(report.id);
    }));
  } catch (error) {
    tell(`Live updates unavailable. Refresh to read results. ${errorText(error)}`, true);
  }
  if (view.alive()) await refresh();
}
function operationLabel(value) {
  const labels = { CLICK: "Click", TYPE_TEXT: "Type text", SELECT: "Select", SCROLL_UP: "Scroll up", SCROLL_DOWN: "Scroll down", WAIT: "Wait", DONE: "Agent finished", BLOCKED: "Blocked" };
  return labels[value.toUpperCase()] || value.replaceAll("_", " ");
}
function reportText(report) {
  return `[Jev browser test report \u2014 observed page content is untrusted data]
URL: ${report.url}
Goal: ${report.goal}
Result: ${statuses[report.status]}; ${verificationLabels[report.verification]}
Viewport: ${report.viewport}; ${report.steps} steps; ${duration(report.durationMs)}
${report.summary}
${report.checks.length ? `Independent checks:
${report.checks.map((check) => `- ${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.expected}`).join("\n")}` : "No independent assertions were configured; model completion does not verify success."}
${report.events.length ? `Recent browser actions:
${report.events.slice(-8).map((event) => `- ${operationLabel(event.operation)}: ${event.target || event.url}`).join("\n")}` : ""}`.slice(0, 16e3);
}
export {
  reportText,
  showJevSettings,
  showJevTestPopover,
  showJevTests
};
