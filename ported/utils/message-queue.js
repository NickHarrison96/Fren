// Ported from PandaCode message-queue.ts (adapted to AnythingLLM frontend, JS).
// Queue panel markup for messages typed while an agent is working.

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const ICONS = {
  attach: '<path d="m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2m-5 11 7-7"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  arrow: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
function icon(name) {
  const path = ICONS[name] ?? "";
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export const HOLD_LABEL = {
  restart: "Paused after restart",
  failed: "Paused after the run failed",
  stopped: "Paused after you stopped the run",
  limited: "Paused until the usage limit resets",
};

const SPINNER = '<span class="support-spinner" aria-hidden="true"></span>';

function attachmentLabel(entry) {
  const count = entry.attachments.length;
  return count
    ? `<span class="queue-attachments" title="${count} ${count === 1 ? "attachment" : "attachments"}">${icon("attach")}${count}</span>`
    : "";
}

function row(entry, index, view) {
  const last = index === view.entries.length - 1;
  if (entry.id === view.editingId) {
    return `<li class="queue-row editing" data-queue-id="${escape(entry.id)}"><textarea class="queue-edit" aria-label="Edit queued message" rows="2">${escape(entry.text)}</textarea>
      <div class="queue-edit-actions"><button type="button" class="secondary-button" data-action="queue-cancel">Cancel</button><button type="button" class="primary-button" data-action="queue-save">Save</button></div></li>`;
  }
  const preview = escape(entry.text.slice(0, 60));
  if (view.steering.has(entry.id)) {
    return `<li class="queue-row steering" data-queue-id="${escape(entry.id)}" aria-busy="true"><span class="queue-index" aria-hidden="true">${index + 1}</span>
    <span class="queue-text" title="${escape(entry.text)}">${escape(entry.text.split("\n")[0] || "(attachments only)")}</span><span class="queue-status" role="status">${SPINNER}Steering…</span></li>`;
  }
  const steer =
    view.running && view.steerable && !view.busy && !entry.attachments.length
      ? `<button type="button" class="queue-now" data-action="queue-steer" title="Send into the running turn" aria-label="Steer now: ${preview}">${icon("spark")}<span>Steer</span></button>`
      : "";
  const sendNow = view.sendable && !view.busy
    ? `<button type="button" class="queue-now" data-action="queue-send-now" title="${!view.running ? "Send this now" : view.steerable && !entry.attachments.length ? "Send into the running turn" : "Stop the run and send this next"}" aria-label="Send now: ${preview}">${icon("arrow")}<span>Send now</span></button>`
    : "";
  return `<li class="queue-row" data-queue-id="${escape(entry.id)}"><span class="queue-index" aria-hidden="true">${index + 1}</span>
    <span class="queue-text" title="${escape(entry.text)}">${escape(entry.text.split("\n")[0] || "(attachments only)")}</span>${attachmentLabel(entry)}
    <span class="queue-actions">${steer}${sendNow}<button type="button" class="icon-button" data-action="queue-edit" aria-label="Edit queued message ${index + 1}" title="Edit" ${view.busy ? "disabled" : ""}>${icon("edit")}</button><button type="button" class="icon-button" data-action="queue-up" aria-label="Move queued message ${index + 1} up" title="Move up" ${index === 0 || view.busy ? "disabled" : ""}>${icon("arrow")}</button><button type="button" class="icon-button queue-down" data-action="queue-down" aria-label="Move queued message ${index + 1} down" title="Move down" ${last || view.busy ? "disabled" : ""}>${icon("arrow")}</button><button type="button" class="icon-button" data-action="queue-remove" aria-label="Remove queued message ${index + 1}" title="Remove" ${view.busy ? "disabled" : ""}>${icon("close")}</button></span></li>`;
}

export function queuePanel(view) {
  if (!view.entries.length) return "";
  const count = view.entries.length;
  const resume =
    view.hold === "limited"
      ? ""
      : `<button type="button" class="queue-resume" data-action="queue-resume" ${view.busy ? "disabled" : ""}>${view.running ? "Resume after this run" : "Resume"}</button>`;
  const status = view.hold
    ? `<span class="queue-hold">${HOLD_LABEL[view.hold]}</span>${resume}`
    : `<span class="queue-next">${view.running ? "Sends when the agent finishes" : `${SPINNER}Sending next…`}</span>`;
  return `<section class="queue-panel" aria-label="Queued messages"><header class="queue-heading"><strong>Queued</strong><span class="queue-count">${count}</span>${status}</header><ol class="queue-list">${view.entries.map((entry, index) => row(entry, index, view)).join("")}</ol></section>`;
}

export function moved(entries, id, step) {
  const ids = entries.map((entry) => entry.id);
  const index = ids.indexOf(id);
  const target = index + step;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}
