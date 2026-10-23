import { escape, icon } from "./dom";
const LOG_LIMIT = 20;
let cachedLog = null;
const title = (change) => change.description.split("\n")[0] || "(no description)";
const bookmarks = (change) => change.bookmarks.map((name) => `<span class="jj-bookmark">${escape(name)}</span>`).join(" ");
function jjChip(status) {
  if (!status?.isRepo || !status.change) return "";
  const change = status.change;
  return `<span class="jj-chip" title="${escape(`Jujutsu change ${change.changeId}: ${title(change)}`)}">jj ${escape(change.changeId.slice(0, 8))}${change.conflict ? " \xB7 conflict" : ""}</span>`;
}
function jjPanelHtml(status, log, busy = false) {
  const change = status.change;
  const files = status.files.map((file) => `<div class="change-row"><button class="change-file" data-jj="diff" data-path="${escape(file.path)}">${icon("file")}<span><strong>${escape(file.path.split("/").pop())}</strong><small>${escape(file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "root")}</small></span><span class="file-status ${file.status === "A" ? "new" : ""}">${escape(file.status)}</span></button></div>`).join("");
  const rows = (log ?? []).map((item) => `<div class="change-row jj-log-row${item.current ? " current" : ""}"><span class="change-file"><span><strong>${escape(title(item))}</strong><small>${escape(item.changeId.slice(0, 8))} \xB7 ${escape(item.author || "unknown")} \xB7 ${escape(item.when)}${item.conflict ? " \xB7 conflict" : ""}</small></span>${bookmarks(item)}</span></div>`).join("");
  const disabled = busy ? "disabled" : "";
  return `<div class="jj-panel" aria-busy="${busy}">
<div class="branch-card"><span>${icon("branch")}<span><code>${escape(change?.changeId.slice(0, 8) ?? "")}</code> ${escape(change ? title(change) : "No working-copy change")}</span></span>${change ? bookmarks(change) : ""}</div>
${change?.conflict ? `<p class="inspector-hint" role="alert">${icon("alert")}This change has conflicts. Resolve them with <code>jj resolve</code>.</p>` : ""}
<div class="change-summary"><span>${status.files.length ? status.files.length + " changed files" : "No changes in this change"}</span>${status.files.length ? "" : icon("check")}</div>
${files ? `<section class="change-group"><div class="change-group-title"><span>Changes <small>${status.files.length}</small></span></div>${files}</section>` : ""}
<form class="commit-form jj-form"><label for="jj-message">Description</label><textarea id="jj-message" rows="3" placeholder="Describe this change\u2026" aria-label="Change description">${escape(change?.description ?? "")}</textarea>
<div class="jj-actions"><button type="button" class="secondary-button" data-jj="describe" ${disabled}>Describe</button><button type="button" class="secondary-button" data-jj="new" ${disabled}>${icon("plus")}New</button><button class="commit-button" data-jj="commit" ${disabled}>${icon("check")}Commit</button></div></form>
<section class="change-group jj-log"><div class="change-group-title"><span>Log${log ? ` <small>${log.length}</small>` : ""}</span></div>${log ? rows || '<p class="inspector-hint">No changes yet.</p>' : '<p class="inspector-hint" role="status">Loading log\u2026</p>'}</section>
</div>`;
}
function showJjPanel(container, initial, callbacks) {
  const target = document.createElement("div");
  container.replaceChildren(target);
  const context = callbacks.context();
  const keyOf = (s) => `${context.projectId}\0${context.sessionId ?? ""}\0${s.change?.commitId ?? ""}`;
  let status = initial, busy = false;
  let log = cachedLog?.key === keyOf(initial) ? cachedLog.log : null;
  const draw = () => {
    const typed = target.querySelector("#jj-message")?.value;
    target.innerHTML = jjPanelHtml(status, log, busy);
    if (typed !== void 0 && !busy) target.querySelector("#jj-message").value = typed;
  };
  const loadLog = async () => {
    const key = keyOf(status);
    try {
      log = await callbacks.call("jj_log", { ...context, limit: LOG_LIMIT });
      cachedLog = { key, log };
    } catch (error) {
      log = [];
      callbacks.notify(text(error));
    }
    if (target.isConnected) draw();
  };
  const act = async (command, message) => {
    busy = true;
    draw();
    try {
      status = await callbacks.call(command, message === void 0 ? context : { ...context, message });
      busy = false;
      log = null;
      target.innerHTML = jjPanelHtml(status, log);
      callbacks.changed?.(status);
      void loadLog();
    } catch (error) {
      busy = false;
      draw();
      callbacks.notify(text(error));
    }
  };
  target.onclick = (event) => {
    const button = event.target.closest("[data-jj]");
    if (!button || busy) return;
    event.preventDefault();
    const message = target.querySelector("#jj-message")?.value ?? "";
    switch (button.dataset.jj) {
      case "describe":
        void act("jj_describe", message);
        break;
      case "new":
        void act("jj_new");
        break;
      case "commit":
        if (!message.trim()) {
          callbacks.notify("Write a description before committing.");
          return;
        }
        void act("jj_commit", message);
        break;
      case "diff": {
        const path = button.dataset.path ?? "";
        callbacks.call("jj_diff", { ...context, path }).then((patch) => callbacks.openDiff(path, patch), (error) => callbacks.notify(text(error)));
        break;
      }
    }
  };
  target.onsubmit = (event) => event.preventDefault();
  draw();
  if (!log) void loadLog();
}
function text(error) {
  return error instanceof Error ? error.message : String(error);
}
export {
  jjChip,
  jjPanelHtml,
  showJjPanel
};
