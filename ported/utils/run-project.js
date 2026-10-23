var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
var __publicField = (obj, key2, value) => __defNormalProp(obj, typeof key2 !== "symbol" ? key2 + "" : key2, value);
import { call } from "./bridge";
import { icon } from "./dom";
const key = (context) => `${context.projectId}:${context.sessionId ?? ""}`;
class ProjectRunner {
  constructor(options) {
    __publicField(this, "options", options);
    __publicField(this, "scripts", /* @__PURE__ */ new Map());
    __publicField(this, "revisions", /* @__PURE__ */ new Map());
    __publicField(this, "starting", /* @__PURE__ */ new Set());
    __publicField(this, "previewRevisions", /* @__PURE__ */ new Map());
  }
  available(context = this.options.context()) {
    return Boolean(context && this.scripts.get(key(context)));
  }
  paint() {
    const context = this.options.context(), available = this.available(context);
    const busy = Boolean(context && this.starting.has(key(context)));
    document.querySelectorAll('[data-action="run-project"]').forEach((button) => {
      button.hidden = !available || Boolean(button.dataset.sessionId && button.dataset.sessionId !== context?.sessionId);
      button.disabled = busy;
      button.setAttribute("aria-busy", String(busy));
      const label = busy ? "Starting\u2026" : "Run";
      if (button.dataset.label !== label) {
        button.innerHTML = `${icon("play")}<span>${label}</span>`;
        button.dataset.label = label;
      }
    });
  }
  async refresh(context = this.options.context()) {
    if (!context) {
      this.paint();
      return;
    }
    const id = key(context), revision = (this.revisions.get(id) ?? 0) + 1;
    this.revisions.set(id, revision);
    const script = await call("get_run_script", { ...context }).catch(() => null);
    if (this.revisions.get(id) !== revision) return;
    this.scripts.set(id, script);
    this.paint();
  }
  async run(requestId, active) {
    const context = this.options.context();
    if (!context) throw new Error("Open a project to run it.");
    const id = key(context);
    if (this.starting.has(id)) return { started: false, previewPending: true };
    this.starting.add(id);
    this.paint();
    try {
      const script = await call("get_run_script", { ...context });
      if (!script) throw new Error("Add pandacode-run.sh to this checkout to run the project.");
      this.scripts.set(id, script);
      await active?.();
      if (key(this.options.context() ?? { projectId: "" }) !== id) throw new Error("Task changed before the script could start.");
      const exited = await this.options.start(requestId);
      const revision = (this.previewRevisions.get(id) ?? 0) + 1;
      this.previewRevisions.set(id, revision);
      const hasPreview = Boolean(script.previewUrl || script.previewPath);
      if (hasPreview) void this.openWhenReady(context, revision, exited);
      return { started: true, previewPending: hasPreview };
    } finally {
      this.starting.delete(id);
      this.paint();
    }
  }
  async openWhenReady(context, revision, exited) {
    const id = key(context);
    const current = () => this.previewRevisions.get(id) === revision && key(this.options.context() ?? { projectId: "" }) === id;
    for (let attempt = 0; attempt < 30 && current(); attempt++) {
      let url;
      try {
        url = await call("get_run_script_preview", { ...context });
      } catch (error) {
        if (current()) this.options.notify(String(error));
        return;
      }
      if (!current()) return;
      if (url) {
        try {
          await this.options.navigate(url, context);
        } catch (error) {
          if (current()) this.options.notify(String(error));
        }
        return;
      }
      if (exited()) {
        this.options.notify("The script exited before its preview was available. Check the Run terminal.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(250 + attempt * 100, 1e3)));
    }
    if (current()) this.options.notify("The script is running. Preview is not ready yet; click Run to check again.");
  }
}
export {
  ProjectRunner
};
