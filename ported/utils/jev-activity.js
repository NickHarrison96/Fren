var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import "./jev-activity.css";
import { call, subscribe } from "./bridge";
import { icon } from "./dom";
class JevActivity {
  constructor() {
    __publicField(this, "task", "");
    __publicField(this, "revision", 0);
    __publicField(this, "report");
    __publicField(this, "host", document.createElement("div"));
    this.host.className = "jev-activity";
    this.host.hidden = true;
    this.host.innerHTML = `<button type="button" class="secondary-button" data-action="jev-tests" aria-label="Open Jev browser test reports">${icon("spark")}<span></span>${icon("chevron")}</button>`;
    void subscribe("jev-run", (report) => {
      if (report.sessionId !== this.task) return;
      this.revision++;
      this.accept(report);
    }).catch(() => {
    });
  }
  setTask(task) {
    if (task === this.task) return;
    this.task = task;
    this.report = void 0;
    this.host.hidden = true;
    const revision = ++this.revision;
    if (!task) return;
    void call("jev_list_runs", { sessionId: task }).then((reports) => {
      if (revision !== this.revision || !reports.length) return;
      this.accept(reports[0]);
    }).catch(() => {
    });
  }
  accept(report) {
    if (this.report && report.createdAt < this.report.createdAt) return;
    this.report = { id: report.id, createdAt: report.createdAt, status: report.status, verification: report.verification };
    const working = report.status === "starting" || report.status === "running";
    const label = working ? "Testing app\u2026" : report.verification === "failed" ? "Checks failed" : report.verification === "passed" ? "Checks passed" : report.status === "done" ? "Agent finished" : report.status === "cancelled" ? "Test stopped" : "Test needs attention";
    this.host.querySelector("span").textContent = `Jev \xB7 ${label}`;
    this.host.dataset.working = String(working);
    this.host.hidden = false;
  }
}
export {
  JevActivity
};
