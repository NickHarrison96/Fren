var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import "./team-messages.css";
import { call } from "./bridge";
class TeamMessages {
  constructor(team) {
    __publicField(this, "host", document.createElement("details"));
    __publicField(this, "list", document.createElement("ol"));
    __publicField(this, "status", document.createElement("p"));
    __publicField(this, "more", document.createElement("button"));
    __publicField(this, "team");
    __publicField(this, "cursor", 0);
    __publicField(this, "loadedRevision", -1);
    __publicField(this, "busy", false);
    __publicField(this, "hasMore", false);
    __publicField(this, "failed", false);
    __publicField(this, "disposed", false);
    this.team = team;
    this.host.className = "team-messages";
    const summary = document.createElement("summary");
    summary.textContent = "Team messages";
    this.list.setAttribute("aria-label", "Messages between teammates");
    this.status.className = "team-messages-status";
    this.status.setAttribute("role", "status");
    this.more.type = "button";
    this.more.className = "secondary-button";
    this.more.hidden = true;
    this.host.append(summary, this.list, this.status, this.more);
    this.host.addEventListener("toggle", () => {
      if (this.host.open) void this.load();
    });
    this.more.addEventListener("click", () => {
      void this.load(true);
    });
  }
  update(team) {
    if (this.disposed || team.sessionId !== this.team.sessionId) return;
    this.team = team;
    if (this.host.open && !this.hasMore && !this.failed) void this.load();
  }
  destroy() {
    this.disposed = true;
  }
  name(id) {
    if (id === "architect") return "Architect";
    const index = this.team.workers.findIndex((worker) => worker.id === id);
    return index < 0 ? "Worker" : this.team.workers[index].name || `Worker ${index + 1}`;
  }
  async load(force = false) {
    if (this.disposed || this.busy || !force && (this.hasMore || this.loadedRevision >= this.team.revision)) return;
    this.busy = true;
    this.failed = false;
    this.more.disabled = true;
    const revision = this.team.revision;
    this.status.textContent = this.cursor ? "" : "Loading team messages\u2026";
    try {
      const page = await call("architect_team_messages", { sessionId: this.team.sessionId, afterId: this.cursor, limit: 50 });
      if (this.disposed) return;
      const fragment = document.createDocumentFragment();
      for (const message of page.messages) {
        if (message.id <= this.cursor) continue;
        const row = document.createElement("li");
        row.dataset.teamMessageId = String(message.id);
        const heading = document.createElement("div");
        heading.className = "team-message-heading";
        const route = document.createElement("strong");
        route.textContent = `${this.name(message.sender)} \u2192 ${this.name(message.recipient)}`;
        const time = document.createElement("time");
        time.dateTime = new Date(message.createdAt).toISOString();
        time.textContent = new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        const body = document.createElement("p");
        body.textContent = message.message;
        heading.append(route, time);
        row.append(heading, body);
        fragment.append(row);
      }
      this.list.append(fragment);
      this.cursor = page.nextCursor;
      this.hasMore = page.hasMore;
      this.loadedRevision = revision;
      this.status.textContent = this.cursor ? "" : "No messages yet. Teammates can share questions and handoffs here.";
      this.more.hidden = !this.hasMore;
      this.more.textContent = "More messages";
    } catch {
      if (this.disposed) return;
      this.failed = true;
      this.status.textContent = "Couldn\u2019t load team messages.";
      this.more.textContent = "Retry";
      this.more.hidden = false;
    } finally {
      this.busy = false;
      this.more.disabled = false;
      if (!this.disposed && this.host.open && !this.failed && !this.hasMore && this.team.revision > revision) void this.load();
    }
  }
}
export {
  TeamMessages
};
