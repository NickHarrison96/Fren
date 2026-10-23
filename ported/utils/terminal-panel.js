var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { escape, icon } from "./dom";
import { showPopover, hidePopover } from "./popover-motion";
import "./terminal-panel.css";
class TerminalPanel {
  constructor(drawer, host, report) {
    __publicField(this, "drawer", drawer);
    __publicField(this, "host", host);
    __publicField(this, "report", report);
    __publicField(this, "groups", /* @__PURE__ */ new Map());
    __publicField(this, "key", "");
    __publicField(this, "context");
    __publicField(this, "label", "");
    __publicField(this, "epoch", 0);
    __publicField(this, "closing", /* @__PURE__ */ new Set());
    __publicField(this, "dismiss");
    __publicField(this, "tabs");
    __publicField(this, "tabsMarkup", "");
    this.tabs = drawer.querySelector('[role="tablist"]');
    drawer.addEventListener("click", (event) => {
      const target = event.target.closest("[data-terminal-action]");
      if (!target) return;
      const action = target.dataset.terminalAction;
      if (action === "minimize") this.minimize();
      else if (action === "new") void this.add().catch(report);
      else if (action === "select") {
        const group = this.group();
        if (!group) return;
        this.cancelClose();
        group.active = target.dataset.tab;
        this.paint();
        this.focus();
      } else if (action === "close") void this.requestClose(target, target.dataset.tab).catch(report);
    });
    this.tabs.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !event.target.matches('[role="tab"]')) return;
      const group = this.group();
      if (!group?.tabs.length) return;
      const index = group.tabs.findIndex((tab) => tab.id === group.active);
      const next = event.key === "Home" ? 0 : event.key === "End" ? group.tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + group.tabs.length) % group.tabs.length;
      event.preventDefault();
      this.cancelClose();
      group.active = group.tabs[next].id;
      this.paint();
      this.tabs.querySelector('[aria-selected="true"]')?.focus();
    });
  }
  get open() {
    return Boolean(this.group()?.open && this.group()?.tabs.length);
  }
  group() {
    return this.groups.get(this.key);
  }
  active() {
    const group = this.group();
    return group?.tabs.find((tab) => tab.id === group.active);
  }
  select(context, label) {
    const key = context ? context.sessionId ?? `project:${context.projectId}` : "";
    this.context = context;
    this.label = label;
    if (key === this.key) return;
    this.cancelClose();
    this.key = key;
    this.paint();
  }
  async toggle() {
    if (this.open) {
      this.minimize();
      return;
    }
    const group = this.group();
    if (group?.tabs.length) {
      group.open = true;
      this.paint();
      this.focus();
    } else await this.add();
  }
  minimize() {
    this.cancelClose();
    const group = this.group();
    if (group) group.open = false;
    this.paint();
    document.querySelector("#terminal-toggle")?.focus({ preventScroll: true });
  }
  async runScript(requestId) {
    const groupKey = this.key;
    await this.add(void 0, true, requestId);
    const tab = this.groups.get(groupKey)?.tabs.find((tab2) => tab2.context.runScript);
    if (!tab?.controller) throw new Error("Run terminal could not be started.");
    return () => tab.removed || Boolean(tab.controller?.exited);
  }
  async add(harness, runScript = false, requestId) {
    if (!this.context) throw new Error("Open a project before starting a terminal.");
    this.cancelClose();
    const key = this.key;
    let group = this.group();
    if (!group) {
      group = { tabs: [], open: true, sequence: 0 };
      this.groups.set(key, group);
    }
    const existing = runScript ? group.tabs.find((tab2) => tab2.context.runScript) : harness && group.tabs.find((tab2) => tab2.context.harness?.provider === harness.provider);
    if (existing) {
      group.active = existing.id;
      group.open = true;
      this.paint();
      await existing.ready;
      if (existing.removed || !existing.controller) return;
      if (existing.controller.exited) {
        if (this.key !== key || group.active !== existing.id || !group.open) return;
        const closing = this.remove(group, existing), epoch = this.epoch;
        await closing;
        if (this.key === key && this.group() === group && epoch === this.epoch) await this.add(harness, runScript, requestId);
        return;
      }
      existing.controller.offerCommand(harness?.command);
      if (this.key === key && group.active === existing.id && group.open) existing.controller.focus();
      return;
    }
    const host = document.createElement("div");
    host.className = "terminal-tab-surface";
    const id = `terminal-tab-${crypto.randomUUID()}`;
    host.id = id;
    host.setAttribute("role", "tabpanel");
    host.setAttribute("aria-labelledby", `${id}-label`);
    host.textContent = "Starting terminal\u2026";
    this.host.append(host);
    const tab = {
      id,
      title: runScript ? "Run" : harness ? `${harness.provider} console` : `Terminal ${++group.sequence}`,
      label: this.label,
      context: { ...this.context, ...harness ? { harness } : {}, ...runScript ? { runScript: true, runRequestId: requestId } : {} },
      host,
      removed: false,
      ready: Promise.resolve()
    };
    group.tabs.push(tab);
    group.active = id;
    group.open = true;
    this.paint();
    const owner = group;
    tab.ready = (async () => {
      try {
        const { mountTerminal } = await import("./terminal");
        if (tab.removed) return;
        host.replaceChildren();
        const controller = await mountTerminal(host, tab.context, this.report);
        if (tab.removed) {
          await controller.dispose();
          return;
        }
        tab.controller = controller;
        if (this.key === key) {
          this.paint();
          if (owner.active === id && owner.open) controller.focus();
        }
      } catch (error) {
        if (tab.removed) return;
        await this.remove(owner, tab);
        if (runScript) throw error;
        if (this.key === key) this.report(error);
      }
    })();
    await tab.ready;
  }
  focus() {
    this.active()?.controller?.focus();
  }
  cancelClose() {
    ++this.epoch;
    this.dismiss?.();
    this.dismiss = void 0;
  }
  async requestClose(anchor, id = this.group()?.active) {
    const group = this.group(), tab = group?.tabs.find((tab2) => tab2.id === id), key = this.key;
    if (!group || !tab || this.closing.has(tab.id)) return;
    this.cancelClose();
    const epoch = this.epoch;
    this.closing.add(tab.id);
    anchor.setAttribute("aria-busy", "true");
    try {
      await tab.ready;
      if (tab.removed) return;
      const activity = await tab.controller?.activity().catch(() => ({ running: false, processNames: [], uncertain: true }));
      if (epoch !== this.epoch || key !== this.key || tab.removed || !this.open) return;
      if (!activity || !activity.running && !activity.uncertain) {
        await this.remove(group, tab);
        return;
      }
      const trigger = anchor.isConnected ? anchor : this.tabs.querySelector(`[data-terminal-action="close"][data-tab="${CSS.escape(tab.id)}"]`);
      if (!trigger) return;
      this.dismiss = closePopover(trigger, activity, (choice) => {
        this.dismiss = void 0;
        if (epoch !== this.epoch || key !== this.key || tab.removed) return;
        if (choice === "minimize") this.minimize();
        else if (choice === "close") void this.remove(group, tab).catch(this.report);
      });
    } finally {
      this.closing.delete(tab.id);
      anchor.removeAttribute("aria-busy");
    }
  }
  async remove(group, tab) {
    if (tab.removed) return;
    tab.removed = true;
    const index = group.tabs.indexOf(tab);
    group.tabs = group.tabs.filter((item) => item !== tab);
    if (group.active === tab.id) group.active = group.tabs[Math.min(index, group.tabs.length - 1)]?.id;
    if (!group.tabs.length) group.open = false;
    tab.host.remove();
    this.paint();
    await tab.controller?.dispose();
  }
  forget(sessionIds) {
    for (const id of sessionIds) {
      const group = this.groups.get(id);
      if (!group) continue;
      for (const tab of [...group.tabs]) void this.remove(group, tab).catch(this.report);
      this.groups.delete(id);
    }
    this.paint();
  }
  paint() {
    const group = this.group(), active = this.active();
    this.drawer.hidden = !this.open;
    for (const owner of this.groups.values()) for (const tab of owner.tabs) tab.host.hidden = owner !== group || tab !== active;
    const label = this.drawer.querySelector("#terminal-project");
    label.textContent = active?.label ?? this.label;
    label.title = active?.host.dataset.terminalSettings ? `Appearance from ${active.host.dataset.terminalSettings}` : "";
    const markup = (group?.tabs ?? []).map((tab) => `<div class="terminal-tab${tab === active ? " selected" : ""}"><button role="tab" id="${tab.id}-label" aria-controls="${tab.id}" aria-selected="${tab === active}" tabindex="${tab === active ? 0 : -1}" data-terminal-action="select" data-tab="${tab.id}">${escape(tab.title)}</button><button class="icon-button" aria-label="Close ${escape(tab.title)}" data-terminal-action="close" data-tab="${tab.id}">${icon("close")}</button></div>`).join("");
    if (markup !== this.tabsMarkup) {
      this.cancelClose();
      this.tabsMarkup = markup;
      this.tabs.innerHTML = markup;
    }
    const toggle = document.querySelector("#terminal-toggle");
    toggle?.setAttribute("aria-expanded", String(this.open));
    toggle?.classList.toggle("active", this.open);
    toggle?.classList.toggle("has-terminals", Boolean(group?.tabs.length));
  }
}
function closePopover(anchor, activity, choose) {
  const panel = document.createElement("section");
  panel.className = "floating-menu terminal-close-popover";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Close terminal?");
  panel.tabIndex = -1;
  const title = activity.uncertain ? "Keep this terminal running?" : "Processes are still running";
  panel.innerHTML = `<strong>${title}</strong><p>Closing may stop ${activity.processNames.length ? escape(activity.processNames.slice(0, 3).join(", ")) : "running processes"}. Minimize to keep them running.</p><div><button class="primary-button" data-choice="minimize">Minimize instead</button><button class="secondary-button" data-choice="close">Close terminal</button></div>`;
  let closed = false;
  const position = () => {
    if (!anchor.isConnected) {
      close(false);
      return;
    }
    const viewport = window.visualViewport, width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0, rect = anchor.getBoundingClientRect();
    panel.style.width = `${Math.min(340, width - 24)}px`;
    panel.style.maxHeight = `${height - 24}px`;
    panel.style.left = `${Math.max(left + 12, Math.min(rect.right - panel.offsetWidth, left + width - panel.offsetWidth - 12))}px`;
    panel.style.top = `${Math.max(top + 12, Math.min(rect.top - panel.offsetHeight - 8, top + height - panel.offsetHeight - 12))}px`;
    panel.dataset.placement = "above";
  };
  const close = (focus = true) => {
    if (closed) return;
    closed = true;
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", keydown, true);
    window.removeEventListener("resize", position);
    window.visualViewport?.removeEventListener("resize", position);
    anchor.setAttribute("aria-expanded", "false");
    hidePopover(panel);
    if (focus && anchor.isConnected) anchor.focus({ preventScroll: true });
  };
  const outside = (event) => {
    if (event.target instanceof Node && !panel.contains(event.target) && !anchor.contains(event.target)) close(false);
  };
  const keydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab" && panel.contains(document.activeElement)) {
      const buttons = [...panel.querySelectorAll("button")];
      const index = buttons.indexOf(document.activeElement);
      event.preventDefault();
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
    }
  };
  panel.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-choice]")?.dataset.choice;
    if (choice === "minimize" || choice === "close") {
      close(false);
      choose(choice);
    }
  });
  anchor.setAttribute("aria-expanded", "true");
  document.body.append(panel);
  position();
  if (closed) return () => {
  };
  showPopover(panel, anchor);
  panel.querySelector("button")?.focus({ preventScroll: true });
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", keydown, true);
  window.addEventListener("resize", position);
  window.visualViewport?.addEventListener("resize", position);
  return () => close(false);
}
export {
  TerminalPanel
};
