var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import "./architect.css";
import { renderTurnChanges, captureChangeCards, restoreChangeCards } from "./turn-changes";
import { call } from "./bridge";
import { escape, icon, markdown } from "./dom";
import { providerLogo } from "./provider-logos";
import { fallbackModel } from "./model-catalog";
import { openModelPicker } from "./model-picker";
import { showPopover, hidePopover } from "./popover-motion";
import { streamMarkdown } from "./streaming-markdown";
import { captureTranscriptAnchor, preserveTranscriptPosition } from "./transcript-scroll";
import { bindFileLinkContext, refreshFileLinks } from "./file-links";
import { createAgentInput } from "./agent-input";
import { decodeToolActivity, renderToolActivity } from "./tool-activity";
import { teamActive } from "./architect-types";
import { mountTeamProfiles } from "./team-profiles";
import { infoMark } from "./tooltip";
import { workerQueueReason } from "./worker-scheduling";
import { Subagents } from "./subagents";
import { TeamMessages } from "./team-messages";
import { renderCoordination } from "./coordination-message";
import { bindMessageActions, messageActionsHtml } from "./message-actions";
const MAX_ROUNDS = 20;
const statusNames = { ready: "Ready", running: "Working", waiting: "Waiting", paused: "Paused", completed: "Ready for review", failed: "Needs attention", interrupted: "Interrupted", queued: "Queued", stopped: "Stopped" };
const workerVerbs = { running: ["Working..", "accent"], waiting: ["Waiting", "accent"], queued: ["Queued", ""], completed: ["Done", "success"], failed: ["Failed", "danger"] };
const ring = (dash) => `<circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="${dash}"/>`;
const workerGlyphs = {
  running: `<svg viewBox="0 0 28 28" aria-hidden="true"><g class="architect-glyph-spin">${ring("2.5 4")}</g><circle cx="14" cy="14" r="3.5" fill="currentColor"/></svg>`,
  pending: `<svg viewBox="0 0 28 28" aria-hidden="true">${ring("2.5 4")}<g fill="currentColor"><circle cx="9.5" cy="14" r="1.6"/><circle cx="14" cy="14" r="1.6"/><circle cx="18.5" cy="14" r="1.6"/></g></svg>`,
  completed: `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="currentColor"/><path d="m8.5 14.5 3.6 3.5 7.4-8" fill="none" stroke="var(--panel)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  failed: `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="currentColor"/><path d="M14 7.5v8" stroke="var(--panel)" stroke-width="2.6" stroke-linecap="round"/><circle cx="14" cy="20" r="1.6" fill="var(--panel)"/></svg>`,
  idle: `<svg viewBox="0 0 28 28" aria-hidden="true">${ring("2.5 4")}</svg>`
};
const modelName = (selection, providers) => providers.find((p) => p.id === selection.provider)?.models.find((m) => m.id === selection.model)?.name ?? fallbackModel(selection.provider, selection.model || "default").name;
const modelMarkup = (selection, providers) => `<span class="provider-small ${escape(selection.provider)}">${providerLogo(selection.provider)}</span><span>${escape(modelName(selection, providers))}${selection.reasoningEffort ? `<small> \xB7 ${escape(selection.reasoningEffort)}</small>` : ""}</span>${icon("down")}`;
function openArchitectSetup(anchor, load, onClose) {
  const panel = document.createElement("section");
  panel.className = "architect-setup-popover floating-menu";
  panel.id = `team-setup-${crypto.randomUUID()}`;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Architect & workers");
  panel.tabIndex = -1;
  panel.innerHTML = `<header class="architect-setup-heading"><h2>Architect & workers</h2><button type="button" class="icon-button" aria-label="Close dialog">${icon("close")}</button></header><div class="architect-setup-scroll"><div id="architect-setup-host"><p class="architect-loading" role="status">Loading team setup\u2026</p></div></div>`;
  const host = panel.querySelector("#architect-setup-host");
  let closed = false, frame = 0, setup;
  const expanded = anchor.getAttribute("aria-expanded"), controls = anchor.getAttribute("aria-controls");
  function position() {
    frame = 0;
    if (closed) return;
    if (!anchor.isConnected) {
      close(false);
      return;
    }
    const view = window.visualViewport;
    const left = (view?.offsetLeft ?? 0) + 12, top = (view?.offsetTop ?? 0) + 12;
    const width = Math.max(0, (view?.width ?? innerWidth) - 24), height = Math.max(0, (view?.height ?? innerHeight) - 24);
    const rect = anchor.getBoundingClientRect();
    const scale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 14;
    panel.style.width = `${Math.min(410 * scale, width)}px`;
    panel.style.maxHeight = `${Math.min(680 * scale, height)}px`;
    const desired = panel.offsetHeight;
    const above = rect.top - top - 8, below = top + height - rect.bottom - 8;
    const placeBelow = below >= desired || below > above;
    const available = placeBelow ? below : above;
    panel.style.maxHeight = `${Math.min(680 * scale, available >= 240 ? available : height)}px`;
    const measured = panel.offsetHeight;
    panel.style.left = `${Math.max(left, Math.min(rect.left, left + width - panel.offsetWidth))}px`;
    panel.style.top = `${Math.max(top, Math.min(placeBelow ? rect.bottom + 8 : rect.top - measured - 8, top + height - measured))}px`;
    panel.dataset.placement = placeBelow ? "below" : "above";
  }
  function schedulePosition() {
    if (!closed && !frame) frame = requestAnimationFrame(position);
  }
  const observer = new ResizeObserver(schedulePosition);
  function close(restoreFocus = true) {
    if (closed) return;
    closed = true;
    setup?.();
    observer.disconnect();
    cancelAnimationFrame(frame);
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", escapeKey);
    document.removeEventListener("focusin", focusChanged);
    window.removeEventListener("resize", schedulePosition);
    window.removeEventListener("scroll", schedulePosition, true);
    window.visualViewport?.removeEventListener("resize", schedulePosition);
    window.visualViewport?.removeEventListener("scroll", schedulePosition);
    if (expanded === null) anchor.removeAttribute("aria-expanded");
    else anchor.setAttribute("aria-expanded", expanded);
    if (controls === null) anchor.removeAttribute("aria-controls");
    else anchor.setAttribute("aria-controls", controls);
    hidePopover(panel);
    onClose();
    if (restoreFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
  }
  function outside(event) {
    const target = event.target;
    if (panel.contains(target) || anchor.contains(target)) return;
    if (setup?.hasChildMenu() && target.closest(".floating-menu")) return;
    close(false);
  }
  function escapeKey(event) {
    if (event.key !== "Escape" || event.defaultPrevented || setup?.hasChildMenu()) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }
  function focusChanged() {
    queueMicrotask(() => {
      if (!closed && !setup?.hasChildMenu() && document.activeElement !== document.body && !panel.contains(document.activeElement) && !anchor.contains(document.activeElement)) close(false);
    });
  }
  panel.querySelector("button").addEventListener("click", () => close());
  panel.addEventListener("keydown", escapeKey);
  anchor.setAttribute("aria-expanded", "true");
  anchor.setAttribute("aria-controls", panel.id);
  document.body.append(panel);
  position();
  showPopover(panel, anchor);
  panel.focus({ preventScroll: true });
  observer.observe(host);
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", escapeKey);
  document.addEventListener("focusin", focusChanged);
  window.addEventListener("resize", schedulePosition);
  window.addEventListener("scroll", schedulePosition, true);
  window.visualViewport?.addEventListener("resize", schedulePosition);
  window.visualViewport?.addEventListener("scroll", schedulePosition);
  void load().then((options) => {
    if (closed || !anchor.isConnected) return;
    setup = mountArchitectSetup(host, options);
    position();
    if (document.activeElement === panel) panel.querySelector(".team-library-picker:not(:disabled), .architect-model:not(:disabled), .architect-setup-heading button")?.focus({ preventScroll: true });
  }).catch((cause) => {
    if (closed) return;
    host.innerHTML = '<p class="architect-setup-error" role="alert"></p>';
    host.firstElementChild.textContent = cause instanceof Error ? cause.message : String(cause);
    position();
  });
  return () => close();
}
function mountArchitectSetup(host, options) {
  const { task, team, library, providers } = options;
  const workerProvider = providers.find((p) => p.id === "kimi" && p.installed) ?? providers.find((p) => p.installed) ?? providers[0];
  const source = team?.pendingSetup?.config ?? team?.config ?? library.lastSetup?.config;
  const config = structuredClone(source && !source.auto ? source : { workers: [{ id: "worker-1", name: "Worker 1", provider: workerProvider?.id ?? task.provider, model: "", reasoningEffort: null }], maxParallel: 0, maxRounds: 8, maxAssignments: 24, workspace: "shared", summaryLimit: 3072 });
  const architect = team?.pendingSetup ? structuredClone(team.pendingSetup.architect) : !team && library.lastSetup && !task.resumeId ? structuredClone(library.lastSetup.architect) : { provider: task.provider, model: task.model, reasoningEffort: task.reasoningEffort ?? null };
  let disposed = false, pending = false, picker;
  const canDisable = Boolean(team) && !teamActive(team) && !team?.workers.length && !team?.round;
  const setupHelp = "Applies to the next architect turn. Existing workers keep their models.";
  const parallelHelp = "Maximum simultaneous assignments. The architect dispatches independent work; overlapping writes or dependencies may wait.";
  const guidanceHelp = "Extra instructions for the lead, added to the built-in architect rules and sent with them. Leave it empty to use the guidance from Settings \u2192 Agent teams, or the built-in rules alone when none is set.";
  host.innerHTML = `<form class="architect-setup"><section class="architect-config-section"><div class="architect-section-label"><h3>Architect</h3><span>Plans & reviews</span></div><button class="architect-model" type="button" aria-label="Choose architect model" aria-haspopup="dialog" aria-expanded="false">${modelMarkup(architect, providers)}</button><div class="architect-guidance"><label for="team-guidance">Lead guidance</label>${infoMark(guidanceHelp, "Lead guidance")}<span class="sr-only" id="team-guidance-help">${escape(guidanceHelp)}</span><textarea id="team-guidance" name="leadGuidance" rows="3" maxlength="2000" aria-describedby="team-guidance-help" placeholder="Extra instructions for the lead, on top of the built-in team rules.">${escape(config.leadGuidance ?? "")}</textarea><button type="button" class="secondary-button architect-guidance-reset">Reset to default</button></div></section><section class="architect-config-section"><div class="architect-section-label"><h3>Workers</h3><button type="button" class="architect-add" aria-label="Add worker profile">${icon("plus")} Add</button></div><div class="architect-profiles"></div></section><section class="architect-parallel"><div class="architect-parallel-controls"><label for="team-parallel">At once</label>${infoMark(parallelHelp, "How parallel workers run")}<span id="team-parallel-help" class="sr-only">${parallelHelp}</span></div><div class="architect-parallel-controls"><label><input id="team-unlimited" type="checkbox" aria-label="Unlimited workers" aria-describedby="team-parallel-help" ${config.maxParallel === 0 ? "checked" : ""}>Unlimited</label><input id="team-parallel" name="maxParallel" aria-label="Workers at once" aria-describedby="team-parallel-help" type="number" min="1" step="1" value="${config.maxParallel || 3}" ${config.maxParallel === 0 ? "hidden" : ""} ${config.maxParallel === 0 ? "disabled" : ""} required></div></section><details class="architect-limits"><summary>Run limits & context</summary><div class="architect-limit-fields"><label>Architect rounds<input type="number" name="maxRounds" min="1" max="20" value="${config.maxRounds}" required></label><label>Worker assignments<input type="number" name="maxAssignments" min="1" max="50" value="${config.maxAssignments}" required></label><label>Result summary limit<input type="number" name="summaryLimit" aria-label="Result summary limit" min="512" max="6000" value="${config.summaryLimit}" required><small>Bytes per worker result</small></label></div><p>Short summaries keep the architect's context focused. Full worker transcripts remain available.</p><p>Shared checkout \xB7 overlapping write scopes wait. Read-only assignments can run alongside writers. Scopes coordinate work; task permissions apply to every worker.</p></details>${task.resumeId && !team ? '<p class="architect-workspace-note">A fresh architect context enables delegation. Your saved conversation stays here.</p>' : ""}${team ? `<p class="architect-workspace-note">Next architect turn ${infoMark(setupHelp, "When team changes apply")}<span class="sr-only">${setupHelp}</span></p>` : ""}<p class="architect-setup-error" role="alert" hidden></p><div class="architect-setup-footer">${canDisable ? '<button class="secondary-button architect-disable" type="button">Use a single agent</button>' : "<span>Remembered for new tasks</span>"}<button class="primary-button" type="submit">${team && !canDisable ? "Apply setup" : "Save setup"}</button></div></form>`;
  const form = host.querySelector("form");
  const guidanceField = host.querySelector("#team-guidance");
  const profiles = host.querySelector(".architect-profiles");
  const error = host.querySelector(".architect-setup-error");
  const libraryHost = document.createElement("section");
  form.prepend(libraryHost);
  const disabledControls = /* @__PURE__ */ new Map();
  function setBusy(value) {
    pending = value;
    if (value) {
      picker?.();
      form.querySelectorAll("input,button,textarea").forEach((el) => {
        disabledControls.set(el, el.disabled);
        el.disabled = true;
      });
    } else {
      disabledControls.forEach((disabled, el) => {
        el.disabled = disabled;
      });
      disabledControls.clear();
    }
  }
  function readSetup() {
    for (const name of ["maxRounds", "maxAssignments", "summaryLimit"]) config[name] = Number(form.elements.namedItem(name).value);
    config.leadGuidance = guidanceField.value.trim() || null;
    return structuredClone({ architect, config });
  }
  const savedProfiles = mountTeamProfiles(libraryHost, {
    library,
    pendingSetup: team?.pendingSetup,
    read: readSetup,
    busy: setBusy,
    apply: (setup) => {
      if (!team && task.resumeId && setup.architect.provider !== task.provider) throw new Error("Use a new task to switch the architect harness.");
      picker?.();
      Object.assign(config, structuredClone(setup.config));
      Object.assign(architect, structuredClone(setup.architect));
      renderProfiles();
      refreshModelLabels();
      for (const name of ["maxRounds", "maxAssignments", "summaryLimit"]) form.elements.namedItem(name).value = String(config[name]);
      guidanceField.value = config.leadGuidance ?? "";
      parallel.value = String(config.maxParallel || 3);
      refreshParallel();
      error.hidden = true;
    }
  });
  form.addEventListener("input", () => savedProfiles.changed());
  host.querySelector(".architect-guidance-reset").addEventListener("click", () => {
    guidanceField.value = "";
    guidanceField.focus();
    savedProfiles.changed();
  });
  form.addEventListener("invalid", (event) => {
    event.target.closest("details")?.setAttribute("open", "");
  }, true);
  function choose(anchor, selection, canSwitchProvider) {
    picker?.();
    picker = openModelPicker({
      anchor,
      providers,
      current: { ...selection, model: selection.model || "default" },
      canSwitchProvider,
      loadModels: options.loadModels,
      onSelect: async (provider, model) => {
        selection.provider = provider;
        selection.model = model;
        selection.reasoningEffort = null;
        anchor.innerHTML = modelMarkup(selection, providers);
        savedProfiles.changed();
      },
      onEffortSelect: async (effort) => {
        selection.reasoningEffort = effort;
        anchor.innerHTML = modelMarkup(selection, providers);
        savedProfiles.changed();
      },
      onClose: () => {
        picker = void 0;
      }
    });
  }
  function renderProfiles() {
    profiles.innerHTML = config.workers.map((profile, index) => `<div class="architect-profile" data-profile-id="${escape(profile.id)}"><div class="architect-profile-heading"><span class="architect-profile-number">${index + 1}</span><input aria-label="Worker profile ${index + 1} name" maxlength="60" value="${escape(profile.name)}"><button type="button" class="icon-button" aria-label="Remove worker profile ${index + 1}" ${config.workers.length === 1 ? "disabled" : ""}>${icon("close")}</button></div><button type="button" class="architect-model" aria-label="Choose model for worker ${index + 1}" aria-haspopup="dialog" aria-expanded="false">${modelMarkup(profile, providers)}</button></div>`).join("");
    profiles.querySelectorAll(".architect-profile").forEach((row, index) => {
      row.querySelector("input").addEventListener("input", (event) => {
        config.workers[index].name = event.target.value;
      });
      row.querySelector(".icon-button").addEventListener("click", () => {
        picker?.();
        config.workers.splice(index, 1);
        renderProfiles();
        savedProfiles.changed();
      });
      row.querySelector(".architect-model").addEventListener("click", (event) => choose(event.currentTarget, config.workers[index], true));
    });
    host.querySelector(".architect-add").disabled = config.workers.length >= 6;
  }
  renderProfiles();
  function refreshModelLabels() {
    if (disposed) return;
    host.querySelector(".architect-model").innerHTML = modelMarkup(architect, providers);
    profiles.querySelectorAll(".architect-profile").forEach((row) => {
      const profile = config.workers.find((profile2) => profile2.id === row.dataset.profileId);
      if (profile) row.querySelector(".architect-model").innerHTML = modelMarkup(profile, providers);
    });
  }
  void Promise.allSettled([...new Set(providers.filter((p) => p.installed).map((p) => p.id))].map(options.loadModels)).then(refreshModelLabels);
  host.querySelector(".architect-model").addEventListener("click", (event) => choose(event.currentTarget, architect, Boolean(team) || !task.resumeId));
  host.querySelector(".architect-add").addEventListener("click", () => {
    picker?.();
    config.workers.push({ ...config.workers[config.workers.length - 1], id: crypto.randomUUID(), name: `Worker ${config.workers.length + 1}` });
    renderProfiles();
    savedProfiles.changed();
    profiles.lastElementChild?.querySelector("input")?.select();
  });
  const parallel = host.querySelector("#team-parallel");
  const unlimited = host.querySelector("#team-unlimited");
  function refreshParallel() {
    unlimited.checked = config.maxParallel === 0;
    parallel.hidden = unlimited.checked;
    parallel.disabled = unlimited.checked;
  }
  unlimited.addEventListener("change", () => {
    const count = parallel.valueAsNumber;
    config.maxParallel = unlimited.checked ? 0 : Number.isSafeInteger(count) && count > 0 ? count : 3;
    if (!unlimited.checked) parallel.value = String(config.maxParallel);
    refreshParallel();
    savedProfiles.changed();
    if (!unlimited.checked) parallel.focus();
  });
  parallel.addEventListener("input", () => {
    const count = parallel.valueAsNumber;
    config.maxParallel = Number.isSafeInteger(count) && count > 0 ? count : NaN;
  });
  async function save(disable = false) {
    if (disposed || pending || disable && !canDisable) return;
    if (!disable && !form.reportValidity()) return;
    error.hidden = true;
    for (const name of ["maxRounds", "maxAssignments", "summaryLimit"]) config[name] = Number(form.elements.namedItem(name).value);
    config.leadGuidance = guidanceField.value.trim() || null;
    if (!disable && !unlimited.checked && (!Number.isSafeInteger(config.maxParallel) || config.maxParallel < 1)) {
      error.textContent = "Choose a whole worker count or Unlimited.";
      error.hidden = false;
      return;
    }
    if (!disable && new TextEncoder().encode(config.leadGuidance ?? "").length > 2e3) {
      error.textContent = "Lead guidance must be under 2000 bytes.";
      error.hidden = false;
      guidanceField.focus();
      return;
    }
    if (!disable && config.workers.some((p) => !p.name.trim())) {
      error.textContent = "Give each worker profile a name.";
      error.hidden = false;
      return;
    }
    const profileId = disable ? null : savedProfiles.selectedId();
    setBusy(true);
    try {
      await options.save(disable ? null : config, architect, profileId);
    } catch (cause) {
      if (!disposed) {
        error.textContent = String(cause instanceof Error ? cause.message : cause);
        error.hidden = false;
      }
    } finally {
      if (!disposed) {
        setBusy(false);
        savedProfiles.changed();
      }
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void save();
  });
  host.querySelector(".architect-disable")?.addEventListener("click", () => {
    void save(true);
  });
  return Object.assign(() => {
    disposed = true;
    picker?.();
    savedProfiles.dispose();
  }, { hasChildMenu: () => Boolean(picker) || savedProfiles.hasMenu() });
}
class ArchitectView {
  constructor(options) {
    __publicField(this, "options", options);
    __publicField(this, "host", document.createElement("div"));
    __publicField(this, "trigger", document.createElement("button"));
    __publicField(this, "taskId", "");
    __publicField(this, "team", null);
    __publicField(this, "panel");
    __publicField(this, "selected", "");
    __publicField(this, "live", /* @__PURE__ */ new Map());
    __publicField(this, "rows", /* @__PURE__ */ new Map());
    __publicField(this, "paintedTools", /* @__PURE__ */ new Map());
    __publicField(this, "paintedWorker", "");
    __publicField(this, "frame", 0);
    __publicField(this, "request", 0);
    __publicField(this, "historyWorker", "");
    __publicField(this, "historyMessages", /* @__PURE__ */ new Map());
    __publicField(this, "historyPaints", /* @__PURE__ */ new WeakMap());
    __publicField(this, "historyHasOlder", false);
    __publicField(this, "historyLoading", false);
    __publicField(this, "historyRefreshQueued", false);
    __publicField(this, "busy", false);
    __publicField(this, "providers", []);
    __publicField(this, "assistEnabled", false);
    __publicField(this, "childAgents");
    __publicField(this, "teamMessages");
    this.host.className = "architect-host";
    this.host.hidden = true;
    this.trigger.className = "architect-trigger";
    this.trigger.type = "button";
    this.trigger.setAttribute("aria-label", "Open workers");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.addEventListener("click", () => this.panel ? this.close() : this.open());
    this.host.append(this.trigger);
    this.host.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.panel) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        this.trigger.focus();
      }
    });
    bindMessageActions(this.host, {
      content: (sessionId, key) => key === "live" ? this.live.get(sessionId)?.text : call("get_message_content", { sessionId, messageId: Number(key) }),
      onFork: options.onFork,
      report: options.report
    });
  }
  setAssistEnabled(enabled) {
    this.assistEnabled = enabled;
    this.paintAssist();
  }
  paintAssist() {
    const button = this.panel?.querySelector(".architect-assist");
    if (!button) return;
    button.hidden = !this.assistEnabled || !this.options.assist;
    button.textContent = this.selected ? "Review with Jev" : "Suggest worker";
  }
  setTask(taskId, team, providers) {
    if (taskId !== this.taskId) this.close();
    this.taskId = taskId;
    this.providers = providers;
    this.team = team;
    this.paint();
  }
  update(team) {
    if (team.sessionId === this.taskId && (!this.team || team.revision >= this.team.revision)) {
      this.team = team;
      this.paint();
    }
    for (const worker of team.workers) if (!["running", "waiting"].includes(worker.status) && worker.id !== this.selected) {
      const live = this.live.get(worker.sessionId);
      if (live?.ended && !live.approvals.size && !live.inputs.size) this.live.delete(worker.sessionId);
    }
  }
  receive(event) {
    if (event.kind === "subagent") {
      this.childAgents?.receive(event.sessionId, event.data);
      return;
    }
    if (event.kind === "turn_changes") {
      if (this.worker()?.sessionId === event.sessionId) void this.loadMessages();
      return;
    }
    if (!["message_start", "text", "tool", "approval", "approval_cancelled", "input_request", "input_cancelled", "done", "error"].includes(event.kind)) return;
    let live = this.live.get(event.sessionId);
    if (!live) {
      live = { text: "", tools: /* @__PURE__ */ new Map(), approvals: /* @__PURE__ */ new Map(), inputs: /* @__PURE__ */ new Map(), ended: false };
      this.live.set(event.sessionId, live);
    }
    if (event.kind === "message_start") {
      live.text = "";
      live.tools.clear();
      live.ended = false;
      if (this.worker()?.sessionId === event.sessionId) void this.loadMessages();
    }
    if (event.kind === "text") {
      live.text = (live.text + event.text).slice(-262144);
      live.ended = false;
    }
    if (event.kind === "tool" && event.tool) {
      const first = !live.tools.has(event.tool.id);
      live.tools.set(event.tool.id, event.tool);
      if (first && this.worker()?.sessionId === event.sessionId) void this.loadMessages();
      while (live.tools.size > 40) live.tools.delete(live.tools.keys().next().value);
    }
    if (event.kind === "approval" && event.requestId) live.approvals.set(event.requestId, event.text);
    if (event.kind === "approval_cancelled" && event.requestId) live.approvals.delete(event.requestId);
    if (event.kind === "input_request" && event.requestId && !live.inputs.has(event.requestId)) {
      const requestId = event.requestId, current = live;
      current.inputs.set(requestId, createAgentInput(event.sessionId, requestId, event.data, () => {
        current.inputs.get(requestId)?.dispose();
        current.inputs.delete(requestId);
        this.schedule();
      }));
    }
    if (event.kind === "input_cancelled" && event.requestId) {
      live.inputs.get(event.requestId)?.dispose();
      live.inputs.delete(event.requestId);
    }
    if (event.kind === "done") {
      const context = this.options.fileContext?.(event.sessionId);
      if (context) refreshFileLinks(context);
      live.ended = true;
      live.approvals.clear();
      for (const input of live.inputs.values()) input.dispose();
      live.inputs.clear();
      if (this.worker()?.sessionId === event.sessionId) void this.loadMessages();
      else this.live.delete(event.sessionId);
    }
    while (this.live.size > 8) {
      const entry = [...this.live].find(([, value]) => value.ended && !value.inputs.size && !value.approvals.size);
      if (!entry) break;
      this.live.delete(entry[0]);
    }
    if (["approval", "approval_cancelled", "input_request", "input_cancelled", "done"].includes(event.kind)) this.paint();
    if (event.sessionId === this.worker()?.sessionId) this.schedule();
  }
  /** A worker is asking for an approval or an answer the user has not given yet. */
  needsInput(sessionId) {
    const live = this.live.get(sessionId);
    return Boolean(live?.approvals.size || live?.inputs.size);
  }
  worker() {
    return this.team?.workers.find((w) => w.id === this.selected);
  }
  schedule() {
    if (this.frame || !this.panel) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.paintLive();
    });
  }
  open() {
    if (!this.team || this.panel) return;
    this.childAgents?.setTask("", false);
    const panel = document.createElement("section");
    panel.className = "architect-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Workers");
    panel.innerHTML = `<div class="architect-panel-heading"><button class="icon-button architect-back" aria-label="Back to workers" hidden>${icon("back")}</button><strong class="architect-panel-summary"></strong><small class="architect-panel-count"></small><span class="architect-panel-controls"><button class="icon-button" data-team-control="pause" aria-label="Pause team" title="Pause team">${icon("pause")}</button><button class="icon-button" data-team-control="resume" aria-label="Resume team" title="Resume team">${icon("play")}</button><button class="icon-button" data-team-control="stop" aria-label="Stop team" title="Stop team">${icon("stop")}</button><button class="icon-button architect-configure" aria-label="View team setup" title="Team setup">${icon("settings")}</button></span><button class="icon-button architect-close" aria-label="Close workers" title="Close">${icon("close")}</button></div><p class="architect-panel-error" role="status" hidden></p><div class="architect-panel-scroll"><div class="architect-worker-list"></div><div class="architect-worker-detail" hidden><div class="architect-worker-meta"></div><details class="architect-assignment"><summary>Assignment & file scope</summary><p></p><small></small></details><details class="architect-worker-checkpoint" hidden><summary>Latest checkpoint <time></time></summary><dl><div><dt>Progress</dt><dd data-checkpoint="summary"></dd></div><div><dt>Next</dt><dd data-checkpoint="nextSteps"></dd></div><div class="architect-checkpoint-blocker"><dt>Blocked</dt><dd data-checkpoint="blocker"></dd></div></dl></details><div class="architect-worker-history"></div><div class="architect-worker-live"></div><div class="architect-worker-tools"></div><div class="architect-worker-approvals"></div><div class="architect-worker-inputs"></div><p class="architect-worker-empty" role="status"></p><button class="secondary-button architect-history-retry" hidden>Retry loading worker</button></div></div>`;
    this.panel = panel;
    this.host.append(panel);
    const assist = document.createElement("button");
    assist.type = "button";
    assist.className = "architect-assist";
    assist.addEventListener("click", () => {
      const worker = this.worker(), target = worker?.sessionId ?? this.taskId;
      const kind = worker ? "review" : "route";
      this.close();
      this.options.assist?.(target, kind);
    });
    panel.querySelector(".architect-panel-controls").append(assist);
    this.paintAssist();
    this.teamMessages = new TeamMessages(this.team);
    panel.querySelector(".architect-worker-list").after(this.teamMessages.host);
    panel.querySelector(".architect-close").addEventListener("click", () => {
      this.close();
      this.trigger.focus();
    });
    panel.querySelector(".architect-back").addEventListener("click", () => {
      this.selected = "";
      this.historyWorker = "";
      this.historyLoading = false;
      this.historyRefreshQueued = false;
      ++this.request;
      this.paint();
    });
    panel.querySelector(".architect-configure").addEventListener("click", (event) => this.options.setup(event.currentTarget));
    panel.querySelectorAll("[data-team-control]").forEach((control) => control.addEventListener("click", () => {
      void this.control(control.dataset.teamControl);
    }));
    panel.querySelector(".architect-history-retry").addEventListener("click", () => {
      void this.loadMessages();
    });
    const scroll = panel.querySelector(".architect-panel-scroll");
    scroll.addEventListener("scroll", () => {
      if (scroll.scrollTop < 72) void this.loadMessages(true);
    }, { passive: true });
    scroll.addEventListener("wheel", (event) => {
      if (event.deltaY < 0 && scroll.scrollTop < 72) void this.loadMessages(true);
    }, { passive: true });
    void Promise.allSettled([...new Set(this.team.config.workers.map((worker) => worker.provider))].map(this.options.loadModels)).then(() => {
      if (this.panel === panel) this.paint();
    });
    this.trigger.setAttribute("aria-expanded", "true");
    this.paint();
    showPopover(panel, this.trigger);
    panel.querySelector(".architect-close").focus();
  }
  async openWorker(workerId, subagentId) {
    const worker = this.team?.workers.find((worker2) => worker2.id === workerId);
    if (!worker) throw new Error("This worker is no longer available.");
    if (subagentId) {
      this.close();
      if (!this.childAgents) {
        const host = document.createElement("div");
        host.className = "subagents-host";
        this.host.after(host);
        this.childAgents = new Subagents(host, "worker-subagents-panel", this.options.fileContext);
      }
      this.childAgents.setTask(worker.sessionId, true);
      await this.childAgents.showAgent(subagentId);
      return;
    }
    this.open();
    this.selected = workerId;
    this.paint();
    this.panel?.querySelector(".architect-back")?.focus();
    await this.loadMessages();
  }
  close() {
    this.teamMessages?.destroy();
    this.teamMessages = void 0;
    this.childAgents?.setTask("", false);
    if (this.panel) hidePopover(this.panel);
    this.panel = void 0;
    this.selected = "";
    this.rows.clear();
    this.paintedTools.clear();
    this.paintedWorker = "";
    this.historyWorker = "";
    this.historyMessages.clear();
    this.historyHasOlder = false;
    this.historyLoading = false;
    this.historyRefreshQueued = false;
    this.request++;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.trigger.setAttribute("aria-expanded", "false");
  }
  async control(action) {
    if (this.busy || !this.team) return;
    this.busy = true;
    this.paint();
    try {
      const team = await call("architect_control", { sessionId: this.taskId, action });
      this.options.updated(team);
    } catch (error) {
      this.options.report(error);
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  paint() {
    const team = this.team;
    this.host.hidden = !team;
    if (!team) {
      this.close();
      return;
    }
    const done = team.workers.filter((w) => w.status === "completed" || w.abandoned).length;
    const asking = team.workers.some((w) => this.needsInput(w.sessionId));
    const progress = asking ? "Needs input" : team.workers.length ? `${done}/${team.workers.length}` : "Ready";
    const trigger = `${icon("worktree")}<span>Architect & workers</span><small>${progress}</small>${icon("chevron")}`;
    if (this.trigger.dataset.painted !== trigger) {
      this.trigger.innerHTML = trigger;
      this.trigger.dataset.painted = trigger;
    }
    this.trigger.dataset.status = asking ? "waiting" : team.status;
    if (!this.panel) return;
    const panel = this.panel, worker = this.worker();
    this.paintAssist();
    panel.querySelector(".architect-configure").hidden = Boolean(team.config.auto);
    panel.querySelector(".architect-panel-summary").textContent = teamActive(team) ? "Architect is working\u2026" : statusNames[team.status];
    const count = panel.querySelector(".architect-panel-count");
    count.textContent = `${team.workers.length} ${team.workers.length === 1 ? "task" : "tasks"}`;
    count.title = `Round ${team.round}/${team.config.maxRounds}`;
    panel.querySelector("[data-team-control=pause]").hidden = !teamActive(team);
    panel.querySelector("[data-team-control=stop]").hidden = !teamActive(team) && team.status !== "paused";
    panel.querySelector("[data-team-control=resume]").hidden = !["paused", "failed", "interrupted"].includes(team.status) || team.round >= MAX_ROUNDS;
    panel.querySelectorAll("[data-team-control]").forEach((button) => {
      button.disabled = this.busy;
    });
    const error = panel.querySelector(".architect-panel-error");
    error.textContent = team.error ?? "";
    error.hidden = !team.error;
    error.classList.toggle("is-notice", team.status === "paused" && /^Team (paused|stopped)\./.test(team.error ?? ""));
    panel.querySelector(".architect-back").hidden = !worker;
    panel.querySelector(".architect-worker-list").hidden = Boolean(worker);
    panel.querySelector(".architect-worker-detail").hidden = !worker;
    if (this.teamMessages) {
      this.teamMessages.host.hidden = Boolean(worker);
      if (!worker) this.teamMessages.update(team);
    }
    if (worker) {
      const meta = panel.querySelector(".architect-worker-meta");
      const queueReason = workerQueueReason(worker, team.workers, team.config.maxParallel);
      meta.innerHTML = `${providerLogo(worker.provider)}<div class="architect-worker-copy"><strong>${escape(worker.name)}</strong><small>${escape(modelName(worker, this.providers))} \xB7 ${escape(statusNames[worker.status])}${worker.readOnly ? " \xB7 Read only" : ""}</small>${queueReason ? `<small class="architect-worker-queue" role="status" data-tip="${escape(queueReason)}">${escape(queueReason)}</small>` : ""}${worker.error ? `<small class="architect-worker-error" role="status">${escape(worker.error)}</small>` : ""}</div>`;
      panel.querySelector(".architect-assignment p").textContent = worker.assignment;
      panel.querySelector(".architect-assignment small").textContent = worker.readOnly ? "Read only \xB7 no writes" : worker.files.length ? `Write scope: ${worker.files.join(", ")}` : "Write scope: shared checkout";
      const checkpoint = panel.querySelector(".architect-worker-checkpoint");
      checkpoint.hidden = !worker.checkpoint;
      if (checkpoint.dataset.workerId !== worker.id) {
        checkpoint.open = false;
        checkpoint.dataset.workerId = worker.id;
      }
      if (worker.checkpoint) {
        for (const name of ["summary", "nextSteps", "blocker"]) {
          const value = worker.checkpoint[name] ?? "";
          const field = checkpoint.querySelector(`[data-checkpoint="${name}"]`);
          if (field.textContent !== value) field.textContent = value;
          field.parentElement.hidden = !value;
        }
        const time = checkpoint.querySelector("time");
        const updated = new Date(worker.checkpoint.updatedAt);
        time.dateTime = updated.toISOString();
        time.textContent = updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
      panel.querySelector(".architect-panel-scroll").classList.remove("is-overflowing");
      this.paintLive();
      return;
    }
    const list = panel.querySelector(".architect-worker-list");
    if (!team.workers.length) {
      list.textContent = team.status === "ready" ? "Send a task to let the architect delegate the work." : "The architect is planning its first assignments.";
      return;
    }
    if (!this.rows.size) list.replaceChildren();
    for (const worker2 of team.workers) {
      let row = this.rows.get(worker2.id);
      if (!row) {
        row = document.createElement("button");
        row.className = "architect-worker-row";
        row.type = "button";
        row.dataset.workerId = worker2.id;
        row.addEventListener("click", () => {
          this.selected = worker2.id;
          this.paint();
          void this.loadMessages();
        });
        this.rows.set(worker2.id, row);
        list.append(row);
      }
      const live = this.live.get(worker2.sessionId);
      const needsInput = Boolean(live?.approvals.size || live?.inputs.size);
      row.dataset.status = needsInput ? "waiting" : worker2.status;
      const queueReason = workerQueueReason(worker2, team.workers, team.config.maxParallel);
      const [verb, tone] = worker2.abandoned ? ["Resolved", ""] : needsInput ? ["Needs input", "accent"] : workerVerbs[worker2.status] ?? [statusNames[worker2.status] ?? worker2.status, ""];
      const glyph = worker2.abandoned ? "idle" : needsInput || worker2.status === "queued" || worker2.status === "waiting" ? "pending" : workerGlyphs[worker2.status] ? worker2.status : "idle";
      const markup = `<span class="architect-worker-glyph" data-glyph="${glyph}">${workerGlyphs[glyph]}<span class="architect-worker-logo">${providerLogo(worker2.provider)}</span></span><span class="architect-worker-copy"><strong>${escape(worker2.name)}</strong><small${queueReason ? ` data-tip="${escape(queueReason)}"` : ""}><span class="architect-worker-state"${tone ? ` data-tone="${tone}"` : ""}>${escape(verb)}</span> ${escape(queueReason ?? modelName(worker2, this.providers))}</small></span>${icon("chevron")}`;
      if (row.dataset.painted !== markup) {
        row.innerHTML = markup;
        row.dataset.painted = markup;
      }
    }
    const scroll = panel.querySelector(".architect-panel-scroll");
    scroll.classList.toggle("is-overflowing", scroll.scrollHeight > scroll.clientHeight + 1);
  }
  async loadMessages(older = false) {
    const worker = this.worker(), panel = this.panel;
    if (!worker || !panel) return;
    const history = panel.querySelector(".architect-worker-history"), scroll = panel.querySelector(".architect-panel-scroll");
    if (this.historyWorker !== worker.sessionId) {
      if (older) return;
      this.request++;
      this.historyWorker = worker.sessionId;
      this.historyMessages.clear();
      this.historyHasOlder = false;
      this.historyLoading = false;
      this.historyRefreshQueued = false;
      history.replaceChildren();
      scroll.scrollTop = 0;
    }
    if (this.historyLoading) {
      if (!older) this.historyRefreshQueued = true;
      return;
    }
    if (older && !this.historyHasOlder) return;
    const beforeId = older ? Math.min(...this.historyMessages.keys()) : void 0;
    if (older && !Number.isFinite(beforeId)) return;
    const initial = this.historyMessages.size === 0, request = this.request, taskId = this.taskId;
    const current = () => this.request === request && this.panel === panel && this.worker()?.sessionId === worker.sessionId;
    const fileContext = this.options.fileContext?.(worker.sessionId);
    const liveAtRequest = this.live.get(worker.sessionId), textAtRequest = liveAtRequest?.text;
    const empty = panel.querySelector(".architect-worker-empty"), retry = panel.querySelector(".architect-history-retry");
    if (initial) empty.textContent = "Loading worker\u2026";
    retry.hidden = true;
    this.historyLoading = true;
    let loaded = false;
    try {
      const page = await call("architect_worker_messages", { sessionId: taskId, workerId: worker.id, ...beforeId ? { beforeId } : {} });
      if (!current()) return;
      const newest = this.historyMessages.size ? Math.max(...this.historyMessages.keys()) : void 0;
      let first = page.messages[0]?.id;
      while (!older && newest !== void 0 && first !== void 0 && first > newest && page.hasOlder) {
        const gap = await call("architect_worker_messages", { sessionId: taskId, workerId: worker.id, beforeId: first });
        if (!current()) return;
        if (!gap.messages.length || gap.messages[0].id >= first) break;
        page.messages = [...gap.messages, ...page.messages];
        page.hasOlder = gap.hasOlder;
        first = page.messages[0].id;
      }
      const previousFirst = this.historyMessages.size ? Math.min(...this.historyMessages.keys()) : void 0;
      const incoming = older ? page.messages.filter((message) => message.id < beforeId) : page.messages;
      for (const message of incoming) this.historyMessages.set(message.id, message);
      if (older) this.historyHasOlder = page.hasOlder && incoming.length > 0;
      else if (previousFirst === void 0 || first !== void 0 && first <= previousFirst) this.historyHasOlder = page.hasOlder;
      const restore = older ? captureTranscriptAnchor(scroll) : preserveTranscriptPosition(scroll);
      const changeViews = captureChangeCards(history);
      const openedTools = new Set([...history.querySelectorAll("details[data-tool-key][open]")].map((tool) => tool.dataset.toolKey));
      const fragment = document.createDocumentFragment();
      const existing = new Map([...history.querySelectorAll(":scope > [data-message-id]")].map((article) => [Number(article.dataset.messageId), article]));
      let pendingChanges;
      const appendChanges = (changes) => {
        const container = document.createElement("div");
        container.innerHTML = renderTurnChanges(worker.sessionId, changes);
        fragment.append(...container.childNodes);
      };
      for (const message of [...this.historyMessages.values()].sort((a, b) => a.id - b.id)) {
        if (message.role === "user" || message.role === "coordination") {
          if (pendingChanges) appendChanges(pendingChanges);
          pendingChanges = message.turnChanges;
        }
        const previous = existing.get(message.id), painted = previous && this.historyPaints.get(previous);
        if (previous && painted?.content === message.content && painted.role === message.role) {
          fragment.append(previous);
          if (message.role === "changes") {
            if (message.turnChanges) appendChanges(message.turnChanges);
            pendingChanges = void 0;
          }
          continue;
        }
        const article = document.createElement("article");
        article.className = "architect-worker-message";
        article.dataset.messageId = String(message.id);
        this.historyPaints.set(article, message);
        if (message.role === "changes") {
          article.hidden = true;
          fragment.append(article);
          if (message.turnChanges) appendChanges(message.turnChanges);
          pendingChanges = void 0;
          continue;
        }
        if (message.role === "coordination") article.innerHTML = renderCoordination(message);
        else if (message.role === "tool") {
          const tool = decodeToolActivity(message.content);
          if (tool) {
            const current2 = this.live.get(worker.sessionId);
            if (tool.status !== "running" && current2?.tools.get(tool.id)?.status === "running") current2.tools.set(tool.id, tool);
            article.dataset.savedToolId = tool.id;
            article.innerHTML = renderToolActivity(tool, "tool:" + tool.id);
          } else article.textContent = message.content;
        } else {
          const label = document.createElement("small");
          label.textContent = message.role === "assistant" ? worker.name : message.role === "user" ? "Assignment" : "Activity";
          const body = document.createElement("div");
          article.append(label, body);
          bindFileLinkContext(body, fileContext);
          void markdown(body, message.content, scroll);
          if (message.role === "user" || message.role === "assistant") {
            article.insertAdjacentHTML("beforeend", messageActionsHtml(worker.sessionId, message.id, Boolean(this.options.onFork) && message.id > 0));
          }
        }
        fragment.append(article);
      }
      if (pendingChanges) appendChanges(pendingChanges);
      history.replaceChildren(fragment);
      restoreChangeCards(history, changeViews);
      history.querySelectorAll("details[data-tool-key]").forEach((tool) => {
        tool.open = openedTools.has(tool.dataset.toolKey);
      });
      const live = this.live.get(worker.sessionId);
      if (!older && live && live === liveAtRequest && live.text === textAtRequest) {
        if (live.ended) {
          live.text = "";
          live.tools.clear();
        } else if (page.messages.some((message) => message.role === "assistant" && message.content === live.text)) live.text = "";
      }
      empty.textContent = !this.historyMessages.size && !live?.text ? worker.error || worker.summary || (worker.status === "queued" ? "" : "Waiting for the worker\u2019s first response.") : "";
      this.paintLive();
      if (initial) scroll.scrollTop = scroll.scrollHeight;
      else restore();
      loaded = true;
    } catch (error) {
      if (current()) {
        empty.textContent = String(error instanceof Error ? error.message : error);
        retry.hidden = false;
      }
    } finally {
      if (current()) {
        this.historyLoading = false;
        if (this.historyRefreshQueued) {
          this.historyRefreshQueued = false;
          void this.loadMessages();
        } else if (loaded && scroll.scrollHeight <= scroll.clientHeight + 80) void this.loadMessages(true);
      }
    }
  }
  paintLive() {
    const worker = this.worker(), panel = this.panel;
    if (!worker || !panel) return;
    const live = this.live.get(worker.sessionId);
    const output = panel.querySelector(".architect-worker-live");
    bindFileLinkContext(output, this.options.fileContext?.(worker.sessionId));
    streamMarkdown(output, live?.text ?? "", panel.querySelector(".architect-panel-scroll"));
    let actions = panel.querySelector(".architect-live-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "architect-live-actions";
      output.after(actions);
    }
    if (actions.dataset.sessionId !== worker.sessionId) {
      actions.innerHTML = messageActionsHtml(worker.sessionId, "live", false);
      actions.dataset.sessionId = worker.sessionId;
    }
    actions.hidden = !live?.text;
    if (live?.text) panel.querySelector(".architect-worker-empty").textContent = "";
    const tools = panel.querySelector(".architect-worker-tools");
    const history = panel.querySelector(".architect-worker-history");
    if (this.paintedWorker !== worker.id) {
      tools.replaceChildren();
      this.paintedTools.clear();
      this.paintedWorker = worker.id;
    }
    for (const element of [...tools.children]) {
      const id = element.dataset.toolSlot;
      if (!live?.tools.has(id)) {
        element.remove();
        this.paintedTools.delete(id);
      }
    }
    for (const tool of live?.tools.values() ?? []) {
      const saved = [...history.children].find((element) => element.dataset.savedToolId === tool.id);
      if (saved) {
        const open2 = saved.querySelector("details")?.open;
        if (this.paintedTools.get(tool.id) !== tool || saved.dataset.liveVersion !== "true") {
          saved.innerHTML = renderToolActivity(tool, "tool:" + tool.id);
          saved.dataset.liveVersion = "true";
          if (open2) saved.querySelector("details").open = true;
        }
        const duplicate = [...tools.children].find((element) => element.dataset.toolSlot === tool.id);
        duplicate?.remove();
        this.paintedTools.set(tool.id, tool);
        continue;
      }
      if (this.paintedTools.get(tool.id) === tool) continue;
      let slot = [...tools.children].find((element) => element.dataset.toolSlot === tool.id);
      const open = slot?.querySelector("details")?.open;
      if (!slot) {
        slot = document.createElement("div");
        slot.dataset.toolSlot = tool.id;
        tools.append(slot);
      }
      slot.innerHTML = renderToolActivity(tool, "tool:" + tool.id);
      if (open) slot.querySelector("details").open = true;
      this.paintedTools.set(tool.id, tool);
    }
    const approvals = panel.querySelector(".architect-worker-approvals");
    for (const element of [...approvals.children]) if (!live?.approvals.has(element.dataset.requestId)) element.remove();
    for (const [id, text] of live?.approvals ?? []) {
      if ([...approvals.children].some((el) => el.dataset.requestId === id)) continue;
      const card = document.createElement("div");
      card.className = "approval-card";
      card.dataset.requestId = id;
      card.innerHTML = `<strong>Worker needs approval</strong><p>${escape(text)}</p><div><button class="secondary-button" type="button">Deny</button><button class="primary-button" type="button">Approve</button></div><small role="alert"></small>`;
      card.querySelectorAll("button").forEach((button, index) => button.addEventListener("click", async () => {
        card.querySelectorAll("button").forEach((b) => {
          b.disabled = true;
        });
        try {
          await call("respond_approval", { sessionId: worker.sessionId, requestId: id, approved: index === 1 });
          live?.approvals.delete(id);
          card.remove();
        } catch (error) {
          card.querySelector("small").textContent = String(error);
          card.querySelectorAll("button").forEach((b) => {
            b.disabled = false;
          });
        }
      }));
      approvals.append(card);
    }
    const inputs = panel.querySelector(".architect-worker-inputs");
    for (const element of [...inputs.children]) if (![...live?.inputs.values() ?? []].some((input) => input.element === element)) element.remove();
    for (const input of live?.inputs.values() ?? []) if (input.element.parentElement !== inputs) inputs.append(input.element);
  }
}
export {
  ArchitectView,
  mountArchitectSetup,
  openArchitectSetup
};
