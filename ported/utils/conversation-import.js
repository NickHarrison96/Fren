import "./conversation-import.css";
import { escape, icon } from "./dom";
import { trackSegment } from "./motion";
import { providerLogo } from "./provider-logos";
const SOURCES = [{ id: "claude", label: "Claude Code" }, { id: "codex", label: "Codex" }];
const relative = new Intl.RelativeTimeFormat(void 0, { numeric: "auto", style: "short" });
const MAX_SELECTION = 50;
function age(at, now = Date.now()) {
  if (!at) return "";
  const minutes = Math.round((at - now) / 6e4);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  if (Math.abs(minutes) < 1440) return relative.format(Math.round(minutes / 60), "hour");
  if (Math.abs(minutes) < 43200) return relative.format(Math.round(minutes / 1440), "day");
  return new Date(at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
function folderName(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}
function mountConversationImport(host, options) {
  let source = options.installed.includes("claude") || !options.installed.includes("codex") ? "claude" : "codex";
  let items = [], cursor = null, note = null;
  let loading = false, importing = false, disposed = false, request = 0, searchTimer = 0;
  const selected = /* @__PURE__ */ new Set();
  host.classList.add("conversation-import");
  host.innerHTML = `<p class="dialog-description">Bring conversations you started in Claude Code or Codex into PandaCode. Each continues its own session, in the project for its folder.</p>
    <div class="import-controls"><div class="import-sources" role="group" aria-label="Import from">${SOURCES.map((item) => `<button type="button" data-source="${item.id}" aria-pressed="${item.id === source}">${providerLogo(item.id)}<span>${item.label}</span></button>`).join("")}</div>
      <label class="import-search">${icon("search")}<input type="search" placeholder="Search conversations" aria-label="Search conversations" autocomplete="off"></label></div>
    <div class="import-bar"><label class="import-all"><input type="checkbox" aria-label="Select all shown conversations"><span>Select all</span></label><span class="import-count" role="status"></span></div>
    <div class="import-list" role="group" aria-label="Conversations"></div>
    <p class="import-error" role="alert" hidden></p>
    <div class="dialog-footer"><button type="button" class="secondary-button" data-action="close-dialog">Cancel</button><button type="button" class="primary-button import-commit" disabled>Import</button></div>`;
  const sources = host.querySelector(".import-sources");
  const search = host.querySelector("input[type=search]");
  const list = host.querySelector(".import-list");
  const all = host.querySelector(".import-all input");
  const count = host.querySelector(".import-count");
  const error = host.querySelector(".import-error");
  const commit = host.querySelector(".import-commit");
  const selectable = () => items.filter((item) => !item.importedTaskId && !item.unavailable);
  function sync() {
    const choices = selectable();
    const chosen = choices.filter((item) => selected.has(item.id)).length;
    all.checked = chosen > 0 && chosen === choices.length;
    all.indeterminate = chosen > 0 && chosen < choices.length;
    all.disabled = !choices.length || importing;
    commit.disabled = !selected.size || importing;
    commit.textContent = importing ? "Importing\u2026" : selected.size ? `Import ${selected.size} ${selected.size === 1 ? "conversation" : "conversations"}` : "Import";
    count.textContent = loading ? "Loading\u2026" : items.length ? `${items.length}${cursor ? "+" : ""} found${selected.size ? ` \xB7 ${selected.size} selected` : ""}` : "";
  }
  function row(item) {
    const meta = [escape(folderName(item.folder) || "Unknown folder"), item.messages ? `${item.messages} messages` : "", age(item.updatedAt)].filter(Boolean).join(" \xB7 ");
    const state = item.importedTaskId ? `<button type="button" class="import-open" data-open="${escape(item.importedTaskId)}">In PandaCode${icon("forward")}</button>` : item.unavailable ? `<span class="import-unavailable" title="${escape(item.unavailable)}">Unavailable</span>` : "";
    const disabled = Boolean(item.importedTaskId || item.unavailable);
    return `<label class="import-row ${disabled ? "disabled" : ""}" data-id="${escape(item.id)}" title="${escape(item.folder)}"><input type="checkbox" value="${escape(item.id)}" ${selected.has(item.id) ? "checked" : ""} ${disabled || importing ? "disabled" : ""}>
      <span class="import-copy"><strong>${escape(item.title)}</strong><small>${meta}${item.unavailable ? ` \xB7 ${escape(item.unavailable)}` : ""}</small></span>${state}</label>`;
  }
  function render() {
    const installed = options.installed.includes(source);
    list.innerHTML = loading && !items.length ? '<p class="import-empty">Reading conversations\u2026</p>' : items.length ? items.map(row).join("") + (cursor ? '<button type="button" class="secondary-button import-more">Load more</button>' : "") : `<p class="import-empty">${escape(note ?? (installed ? "No conversations match." : `${SOURCES.find((item) => item.id === source).label} is not installed on this computer.`))}</p>`;
    sync();
  }
  async function load(more = false) {
    const ticket = ++request;
    loading = true;
    error.hidden = true;
    if (!more) {
      items = [];
      cursor = null;
      note = null;
    }
    render();
    try {
      const page = await options.call("list_importable_conversations", { provider: source, search: search.value.trim() || null, cursor: more ? cursor : null });
      if (disposed || ticket !== request) return;
      const known = new Set(items.map((item) => item.id));
      items = [...items, ...page.items.filter((item) => !known.has(item.id))];
      cursor = page.cursor;
      note = page.note;
    } catch (cause) {
      if (disposed || ticket !== request) return;
      error.textContent = cause instanceof Error ? cause.message : String(cause);
      error.hidden = false;
    } finally {
      if (!disposed && ticket === request) {
        loading = false;
        render();
      }
    }
  }
  async function importSelected() {
    if (!selected.size || importing) return;
    importing = true;
    error.hidden = true;
    render();
    try {
      const result = await options.call("import_conversations", { provider: source, ids: [...selected], model: options.defaultModel(source) });
      if (disposed) return;
      const failed = new Set(result.failed.map((item) => item.id));
      for (const id of [...selected]) if (!failed.has(id)) selected.delete(id);
      if (result.failed.length) {
        error.textContent = result.failed.length === 1 ? result.failed[0].message : `${result.failed.length} conversations could not be imported: ${result.failed[0].message}`;
        error.hidden = false;
      }
      options.onImported(result);
    } catch (cause) {
      if (disposed) return;
      error.textContent = cause instanceof Error ? cause.message : String(cause);
      error.hidden = false;
    } finally {
      if (!disposed) {
        importing = false;
        await load();
      }
    }
  }
  function change(event) {
    const input = event.target;
    if (input === all) {
      const choices = selectable();
      if (all.checked) for (const item of choices.slice(0, MAX_SELECTION)) selected.add(item.id);
      else for (const item of choices) selected.delete(item.id);
      render();
      return;
    }
    if (input.type === "checkbox" && input.value) {
      if (input.checked && selected.size >= MAX_SELECTION) {
        input.checked = false;
        error.textContent = `Import up to ${MAX_SELECTION} conversations at a time.`;
        error.hidden = false;
        return;
      }
      if (input.checked) selected.add(input.value);
      else selected.delete(input.value);
      sync();
    }
  }
  function click(event) {
    const target = event.target instanceof Element ? event.target : null;
    const sourceButton = target?.closest("[data-source]");
    if (sourceButton && sourceButton.dataset.source !== source && !importing) {
      source = sourceButton.dataset.source;
      selected.clear();
      sources.querySelectorAll("[data-source]").forEach((button) => button.setAttribute("aria-pressed", String(button === sourceButton)));
      trackSegment(sources, sourceButton);
      void load();
      return;
    }
    const open = target?.closest("[data-open]");
    if (open) {
      event.preventDefault();
      options.openTask(open.dataset.open);
      return;
    }
    if (target?.closest(".import-more")) {
      void load(true);
      return;
    }
    if (target?.closest(".import-commit")) void importSelected();
  }
  const typed = () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      selected.clear();
      void load();
    }, 250);
  };
  host.addEventListener("change", change);
  host.addEventListener("click", click);
  search.addEventListener("input", typed);
  trackSegment(sources, sources.querySelector('[aria-pressed="true"]'));
  void load();
  search.focus({ preventScroll: true });
  return () => {
    disposed = true;
    window.clearTimeout(searchTimer);
    host.removeEventListener("change", change);
    host.removeEventListener("click", click);
    search.removeEventListener("input", typed);
  };
}
export {
  mountConversationImport
};
