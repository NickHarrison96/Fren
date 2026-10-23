var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import "./subagents.css";
import { call } from "./bridge";
import { icon } from "./dom";
import { showPopover, hidePopover } from "./popover-motion";
import { streamMarkdown } from "./streaming-markdown";
import { bindFileLinkContext, refreshFileLinks } from "./file-links";
import { renderToolActivity } from "./tool-activity";
import { bindMessageActions, messageActionsHtml } from "./message-actions";
const active = (agent) => agent.status === "running" || agent.status === "waiting";
const statusName = (agent) => ({ running: "Working", waiting: "Waiting", completed: "Completed", failed: "Failed", stopped: "Stopped" })[agent.status];
function agentName(entry) {
  const name = entry.value.name.trim();
  return name && !/[\\/]/.test(name) && !/^(?:subagent|agent)$/i.test(name) ? name : `#${entry.number}`;
}
function decode(value) {
  if (!value || typeof value !== "object") return;
  const a = value;
  if (typeof a.id !== "string" || !a.id || typeof a.name !== "string" || typeof a.response !== "string" || !["running", "waiting", "completed", "failed", "stopped"].includes(a.status)) return;
  return {
    id: a.id.slice(0, 512),
    parentId: typeof a.parentId === "string" ? a.parentId.slice(0, 512) : null,
    name: a.name.slice(0, 256),
    prompt: String(a.prompt ?? "").slice(0, 4096),
    status: a.status,
    response: a.response.slice(0, 65536),
    startedAt: Number(a.startedAt) || 0,
    updatedAt: Number(a.updatedAt) || 0,
    tools: (Array.isArray(a.tools) ? a.tools : []).slice(-16).filter((t) => t && typeof t.id === "string" && typeof t.name === "string" && ["running", "completed", "failed"].includes(t.status)).map((t) => ({ id: t.id.slice(0, 1024), name: t.name.slice(0, 256), status: t.status, input: String(t.input ?? "").slice(0, 4096), output: String(t.output ?? "").slice(0, 8192) }))
  };
}
class Subagents {
  constructor(host, panelId = "subagents-panel", fileContext) {
    __publicField(this, "host", host);
    __publicField(this, "panelId", panelId);
    __publicField(this, "fileContext", fileContext);
    __publicField(this, "tasks", /* @__PURE__ */ new Map());
    __publicField(this, "sessionId", "");
    __publicField(this, "revision", 0);
    __publicField(this, "frame", 0);
    __publicField(this, "panel");
    __publicField(this, "selected", "");
    __publicField(this, "visible", true);
    __publicField(this, "trigger");
    __publicField(this, "rows", /* @__PURE__ */ new Map());
    __publicField(this, "renderedTools", "");
    __publicField(this, "resize");
    host.innerHTML = `<button type="button" class="subagents-trigger" aria-label="Subagents" aria-expanded="false" aria-controls="subagents-panel" title="View subagent work" hidden>${icon("branch")}<span></span>${icon("chevron")}</button>`;
    this.trigger = host.querySelector("button");
    this.trigger.setAttribute("aria-controls", panelId);
    this.trigger.addEventListener("click", () => this.panel ? this.close() : this.open());
    bindMessageActions(host, {
      content: (sessionId, key) => {
        const separator = key.indexOf(":");
        const agent = this.tasks.get(sessionId)?.agents.get(key.slice(separator + 1))?.value;
        return key.startsWith("prompt:") ? agent?.prompt : agent?.response;
      },
      report: (error) => {
        const notice = this.panel?.querySelector(".subagent-action-notice");
        if (notice) {
          notice.textContent = error instanceof Error ? error.message : String(error);
          notice.hidden = false;
        }
      }
    });
    document.addEventListener("keydown", (event) => {
      if (!this.panel || event.key !== "Escape" || event.defaultPrevented || document.querySelector('dialog[open], .floating-menu[role="dialog"]:not([aria-hidden="true"])')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close();
    }, true);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.schedule();
    });
    window.addEventListener("resize", () => this.fitPanel());
  }
  task(id) {
    let task = this.tasks.get(id);
    if (!task) {
      task = { agents: /* @__PURE__ */ new Map(), loading: false, error: false, request: 0, nextNumber: 1 };
      this.tasks.set(id, task);
    }
    return task;
  }
  setTask(id, visible) {
    this.visible = visible;
    this.host.hidden = !visible || !id;
    if (!visible) this.close(false);
    if (id !== this.sessionId) {
      this.close(false);
      this.sessionId = id;
      this.render();
      if (id) void this.load(id);
      this.prune();
    } else this.schedule();
  }
  receive(sessionId, value) {
    const agent = decode(value);
    if (!agent) return;
    const task = this.task(sessionId);
    const previous = task.agents.get(agent.id)?.value;
    if (previous && active(previous) && !active(agent)) {
      const context = this.fileContext?.(sessionId);
      if (context) refreshFileLinks(context);
    }
    this.upsert(task, agent, ++this.revision);
    if (sessionId === this.sessionId) this.schedule();
    this.prune();
  }
  forget(id) {
    const task = this.tasks.get(id);
    if (task) task.request++;
    this.tasks.delete(id);
    if (id === this.sessionId) this.setTask("", this.visible);
  }
  upsert(task, value, revision) {
    if (!task.agents.has(value.id) && task.agents.size >= 64) {
      const old = [...task.agents].find(([, entry]) => !active(entry.value));
      if (!old) return;
      task.agents.delete(old[0]);
    }
    const number = task.agents.get(value.id)?.number ?? task.nextNumber++;
    task.agents.set(value.id, { value, revision, number });
  }
  prune() {
    for (const [id, task] of this.tasks) {
      if (this.tasks.size <= 8) break;
      if (id !== this.sessionId && !task.loading && ![...task.agents.values()].some((entry) => active(entry.value))) this.tasks.delete(id);
    }
  }
  async load(id) {
    const task = this.task(id), request = ++task.request, revision = this.revision;
    task.loading = true;
    task.error = false;
    try {
      const snapshots = await call("list_subagents", { sessionId: id });
      if (task.request !== request) return;
      const saved = (Array.isArray(snapshots) ? snapshots : []).map(decode).filter((agent) => Boolean(agent));
      saved.sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
      for (const agent of saved) {
        if ((task.agents.get(agent.id)?.revision ?? -1) <= revision) this.upsert(task, agent, revision);
      }
    } catch {
      if (task.request === request) task.error = true;
    } finally {
      if (task.request === request) task.loading = false;
      if (id === this.sessionId) this.schedule();
      this.prune();
    }
  }
  schedule() {
    if (this.frame || document.hidden || !this.visible) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }
  async showAgent(agentId) {
    const taskId = this.sessionId;
    if (!taskId || !this.visible) return;
    await this.load(taskId);
    if (taskId !== this.sessionId || !this.visible) return;
    if (!this.task(taskId).agents.has(agentId)) throw new Error("This subagent is no longer available.");
    this.open();
    this.selected = agentId;
    this.render();
    this.panel?.querySelector(".subagents-back")?.focus();
  }
  open() {
    if (this.panel || !this.sessionId) return;
    this.selected = "";
    this.rows.clear();
    const panel = document.createElement("section");
    panel.id = this.panelId;
    panel.className = "subagents-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Subagents");
    panel.innerHTML = `<header class="subagents-heading"><button type="button" class="icon-button subagents-back" aria-label="Back to Subagents" hidden>${icon("back")}</button><strong>Subagents</strong><span class="subagents-summary"></span><button type="button" class="icon-button subagents-close" aria-label="Close subagents">${icon("close")}</button></header><div class="subagents-body"><div class="subagents-list"></div><p class="subagents-notice" role="status" hidden></p><button class="secondary-button subagents-retry" hidden>Retry loading subagents</button><div class="subagent-detail" hidden><div class="subagent-detail-meta"><span class="subagent-state"></span><h3 class="subagent-detail-name"></h3><span class="subagent-detail-status"></span></div><p class="subagent-parent" hidden></p><details class="subagent-assignment"><summary>Assignment</summary><p></p></details><div class="subagent-response"></div><p class="subagent-empty muted"></p><div class="subagent-tools"></div></div></div>`;
    this.host.append(panel);
    this.panel = panel;
    panel.querySelector(".subagent-assignment").insertAdjacentHTML("beforeend", '<div class="subagent-assignment-actions"></div>');
    panel.querySelector(".subagent-response").insertAdjacentHTML("afterend", '<div class="subagent-response-actions"></div><p class="subagent-action-notice" role="status" hidden></p>');
    panel.querySelector(".subagents-close").addEventListener("click", () => this.close());
    panel.querySelector(".subagents-back").addEventListener("click", () => {
      const id = this.selected;
      this.selected = "";
      this.render();
      this.rows.get(id)?.focus();
    });
    panel.querySelector(".subagents-retry").addEventListener("click", () => {
      void this.load(this.sessionId);
      this.render();
    });
    this.trigger.setAttribute("aria-expanded", "true");
    this.render();
    this.fitPanel();
    showPopover(panel, this.trigger);
    this.resize = new ResizeObserver(() => this.fitPanel());
    this.resize.observe(this.host.parentElement);
    const heading = this.host.previousElementSibling;
    if (heading) this.resize.observe(heading);
    (panel.querySelector("[data-subagent-id]") ?? panel.querySelector(".subagents-close"))?.focus();
  }
  close(focus = true) {
    if (!this.panel) return;
    this.resize?.disconnect();
    this.resize = void 0;
    hidePopover(this.panel);
    this.panel = void 0;
    this.selected = "";
    this.rows.clear();
    this.trigger.setAttribute("aria-expanded", "false");
    if (focus) this.trigger.focus({ preventScroll: true });
  }
  fitPanel() {
    if (!this.panel) return;
    const bottom = this.host.closest(".work-area")?.getBoundingClientRect().bottom ?? window.innerHeight;
    this.panel.style.maxHeight = `${Math.max(80, Math.min(540, bottom - this.host.getBoundingClientRect().bottom - 16))}px`;
  }
  render() {
    const task = this.tasks.get(this.sessionId);
    const agents = [...task?.agents.values() ?? []].map((entry) => ({ ...entry.value, name: agentName(entry) }));
    const running = agents.filter(active).length;
    this.trigger.hidden = !agents.length && !task?.error;
    const label = running ? `${running} running` : agents.length ? `${agents.length} subagent${agents.length === 1 ? "" : "s"}` : "Subagents";
    const text = this.trigger.querySelector("span");
    if (text.textContent !== label) text.textContent = label;
    this.trigger.classList.toggle("has-running", running > 0);
    this.trigger.title = running ? agents.filter(active).map((a) => a.name).join("\n") : "View subagent work";
    const panel = this.panel;
    if (!panel) return;
    const summary = panel.querySelector(".subagents-summary");
    if (summary.textContent !== label) summary.textContent = label;
    const detail = panel.querySelector(".subagent-detail"), list = panel.querySelector(".subagents-list");
    const selected = agents.find((a) => a.id === this.selected);
    list.hidden = Boolean(selected);
    detail.hidden = !selected;
    panel.querySelector(".subagents-back").hidden = !selected;
    const notice = panel.querySelector(".subagents-notice");
    notice.hidden = Boolean(selected) || !task?.error && Boolean(agents.length);
    const note = task?.error ? "Couldn\u2019t load saved subagents. Live work will still appear here." : task?.loading ? "Loading subagents\u2026" : "No subagents in this task yet.";
    if (notice.textContent !== note) notice.textContent = note;
    panel.querySelector(".subagents-retry").hidden = !task?.error || Boolean(selected);
    if (!selected) {
      const ids = new Set(agents.map((a) => a.id));
      for (const [id, row] of this.rows) if (!ids.has(id)) {
        row.remove();
        this.rows.delete(id);
      }
      for (const agent of agents) {
        let row = this.rows.get(agent.id);
        if (!row) {
          row = document.createElement("button");
          row.type = "button";
          row.className = "subagent-row";
          row.dataset.subagentId = agent.id;
          row.innerHTML = `<span class="subagent-state"></span><span class="subagent-row-copy"><strong></strong><small></small></span><span class="subagent-row-status"></span>${icon("chevron")}`;
          row.addEventListener("click", () => {
            this.selected = agent.id;
            this.renderedTools = "";
            const output2 = detail.querySelector(".subagent-response");
            if (this.fileContext) bindFileLinkContext(output2, this.fileContext(this.sessionId));
            streamMarkdown(output2, "");
            detail.querySelector(".subagent-tools").replaceChildren();
            panel.querySelector(".subagents-body").scrollTop = 0;
            this.render();
            panel.querySelector(".subagents-back").focus();
          });
          this.rows.set(agent.id, row);
          list.append(row);
        }
        row.dataset.status = agent.status;
        const parent2 = agents.find((a) => a.id === agent.parentId);
        const info = parent2 ? `From ${parent2.name}` : "";
        const name = row.querySelector("strong"), description = row.querySelector("small"), status = row.querySelector(".subagent-row-status");
        if (name.textContent !== agent.name) name.textContent = agent.name;
        if (description.textContent !== info) description.textContent = info;
        description.hidden = !info;
        if (status.textContent !== statusName(agent)) status.textContent = statusName(agent);
      }
      return;
    }
    detail.dataset.status = selected.status;
    if (detail.dataset.agentId !== selected.id) {
      detail.dataset.agentId = selected.id;
      detail.querySelector(".subagent-assignment-actions").innerHTML = messageActionsHtml(this.sessionId, `prompt:${selected.id}`, false);
      detail.querySelector(".subagent-response-actions").innerHTML = messageActionsHtml(this.sessionId, `response:${selected.id}`, false);
      detail.querySelector(".subagent-action-notice").hidden = true;
    }
    const setText = (selector, text2) => {
      const target = detail.querySelector(selector);
      if (target.textContent !== text2) target.textContent = text2;
    };
    setText(".subagent-detail-name", selected.name);
    setText(".subagent-detail-status", statusName(selected));
    setText(".subagent-assignment p", selected.prompt);
    detail.querySelector(".subagent-assignment").hidden = !selected.prompt;
    const parent = agents.find((a) => a.id === selected.parentId);
    setText(".subagent-parent", parent ? `From ${parent.name}` : "");
    detail.querySelector(".subagent-parent").hidden = !parent;
    const output = detail.querySelector(".subagent-response");
    if (this.fileContext) bindFileLinkContext(output, this.fileContext(this.sessionId));
    streamMarkdown(output, selected.response, panel.querySelector(".subagents-body"));
    detail.querySelector(".subagent-response-actions").hidden = !selected.response;
    setText(".subagent-empty", selected.response ? "" : active(selected) ? "Waiting for the first update\u2026" : "This harness did not provide a response for this agent.");
    const serializedTools = JSON.stringify(selected.tools);
    if (this.renderedTools !== serializedTools) {
      const target = detail.querySelector(".subagent-tools");
      const existing = new Map([...target.querySelectorAll("[data-tool-key]")].map((el) => [el.dataset.toolKey, el]));
      for (const tool of selected.tools) {
        const key = "subagent-tool:" + tool.id, old = existing.get(key), html = renderToolActivity(tool, key);
        if (old?.dataset.snapshot !== JSON.stringify(tool)) {
          const template = document.createElement("template");
          template.innerHTML = html;
          const next = template.content.firstElementChild;
          next.dataset.snapshot = JSON.stringify(tool);
          next.open = old?.open ?? false;
          const raw = next.querySelector(".tool-trace-raw");
          if (raw) raw.open = Boolean(old?.querySelector(".tool-trace-raw")?.open);
          const focusedIndex = old ? [...old.querySelectorAll("summary, pre")].findIndex((control) => control === document.activeElement) : -1;
          const positions = old ? [...old.querySelectorAll("pre")].map((pre) => ({ top: pre.scrollTop, left: pre.scrollLeft })) : [];
          if (old) old.replaceWith(next);
          else target.append(next);
          next.querySelectorAll("pre").forEach((pre, i) => {
            pre.scrollTop = positions[i]?.top ?? 0;
            pre.scrollLeft = positions[i]?.left ?? 0;
          });
          if (focusedIndex >= 0) (next.querySelectorAll("summary, pre")[focusedIndex] ?? next.querySelector("summary"))?.focus({ preventScroll: true });
        }
        existing.delete(key);
      }
      for (const old of existing.values()) old.remove();
      this.renderedTools = serializedTools;
    }
  }
}
export {
  Subagents
};
