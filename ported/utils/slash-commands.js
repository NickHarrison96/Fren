import "./slash-commands.css";
import { icon } from "./dom";
import { providerLogo } from "./provider-logos";
import { hidePopover, showPopover } from "./popover-motion";
const cacheLifetime = 3e4;
let nextPickerId = 0;
function mountSlashCommands(textarea, options) {
  const panel = document.createElement("section");
  panel.className = "slash-menu floating-menu";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Slash commands");
  panel.innerHTML = `<header class="slash-menu-header"><span class="slash-menu-logo"></span><strong>Commands</strong><button type="button" class="icon-button" aria-label="Refresh commands" title="Refresh commands">${icon("refresh")}</button></header><div class="slash-menu-list" id="slash-commands-${++nextPickerId}" role="listbox" aria-label="Available commands"></div><p class="slash-menu-status" role="status" aria-live="polite"></p><p class="slash-menu-warning"></p><footer class="slash-menu-footer"><span>\u2191 \u2193 navigate</span><span>Tab or \u21B5 insert</span></footer>`;
  const list = panel.querySelector(".slash-menu-list");
  const status = panel.querySelector(".slash-menu-status");
  const warning = panel.querySelector(".slash-menu-warning");
  const refreshButton = panel.querySelector("button");
  const attributes = new Map(["role", "aria-autocomplete", "aria-haspopup", "aria-controls", "aria-expanded", "aria-activedescendant"].map((name) => [name, textarea.getAttribute(name)]));
  const rows = /* @__PURE__ */ new Map();
  let commands = [], warnings = [], visibleCommands = [];
  let context = options.contextKey(), loadedAt = 0, loading = false, slow = false, loadError = "";
  let active = "", opened = false, disposed = false, composing = false, dismissed = "", generation = 0, positionFrame = 0;
  function token() {
    if (textarea.disabled || textarea.readOnly || composing || document.activeElement !== textarea) return;
    const match = /^(\s*)(\/[^\s]*)/.exec(textarea.value);
    if (!match) return;
    const start = match[1].length, end = start + match[2].length;
    if (textarea.selectionStart < start + 1 || textarea.selectionEnd > end) return;
    return { start, end, query: match[2].slice(1).toLocaleLowerCase() };
  }
  function restoreAttributes() {
    for (const [name, value] of attributes) {
      if (value === null) textarea.removeAttribute(name);
      else textarea.setAttribute(name, value);
    }
  }
  function close(suppress = false) {
    if (suppress) dismissed = textarea.value;
    if (!opened) return;
    opened = false;
    cancelAnimationFrame(positionFrame);
    positionFrame = 0;
    restoreAttributes();
    hidePopover(panel);
  }
  function position() {
    positionFrame = 0;
    if (!opened || disposed) return;
    if (!textarea.isConnected) {
      close();
      return;
    }
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 12, topEdge = (viewport?.offsetTop ?? 0) + 12;
    const width = Math.max(0, (viewport?.width ?? innerWidth) - 24), height = Math.max(0, (viewport?.height ?? innerHeight) - 24);
    const composer = textarea.closest(".composer") ?? textarea;
    const rect = composer.getBoundingClientRect();
    const above = rect.top - topEdge - 8;
    panel.style.width = `${Math.min(420, width)}px`;
    panel.style.maxHeight = `${Math.min(420, above >= 140 ? above : height)}px`;
    panel.style.left = `${Math.max(leftEdge, Math.min(rect.left, leftEdge + width - panel.offsetWidth))}px`;
    panel.style.top = `${Math.max(topEdge, Math.min(rect.top - panel.offsetHeight - 8, topEdge + height - panel.offsetHeight))}px`;
    panel.dataset.placement = "above";
  }
  function schedulePosition(event) {
    if (event?.target instanceof Node && panel.contains(event.target)) return;
    if (opened && !positionFrame) positionFrame = requestAnimationFrame(position);
  }
  function setActive(id, scroll = false) {
    active = id;
    for (const [key, row2] of rows) row2.setAttribute("aria-selected", String(key === id && !row2.hidden));
    const row = rows.get(id);
    if (row && !row.hidden) {
      textarea.setAttribute("aria-activedescendant", row.id);
      if (scroll) row.scrollIntoView({ block: "nearest" });
    } else textarea.removeAttribute("aria-activedescendant");
  }
  function render() {
    if (!opened) return;
    const query = token()?.query ?? "";
    const matches = commands.filter((command) => command.name.slice(1).toLocaleLowerCase().startsWith(query));
    visibleCommands = matches.slice(0, 80);
    const visible = new Set(visibleCommands.map((command) => command.id));
    for (const [id, row] of rows) row.hidden = !visible.has(id);
    let previous = null;
    for (const command of visibleCommands) {
      let row = rows.get(command.id);
      if (!row) {
        row = document.createElement("button");
        row.type = "button";
        row.tabIndex = -1;
        row.className = "slash-menu-option";
        row.id = `${list.id}-option-${rows.size}`;
        row.dataset.commandId = command.id;
        row.setAttribute("role", "option");
        const copy = document.createElement("span");
        copy.className = "slash-menu-copy";
        const title = document.createElement("span");
        title.className = "slash-menu-title";
        const name = document.createElement("strong");
        name.textContent = command.name;
        title.append(name);
        if (command.argumentHint) {
          const hint = document.createElement("span");
          hint.textContent = command.argumentHint;
          title.append(hint);
        }
        const description = document.createElement("small");
        description.textContent = command.kind === "unsupported" ? command.reason || "This command is not available in the app yet." : command.description;
        copy.append(title, description);
        const source = document.createElement("span");
        source.className = "slash-menu-source";
        source.textContent = command.source;
        source.title = command.source;
        row.append(copy, source);
        row.disabled = command.kind === "unsupported";
        row.setAttribute("aria-disabled", String(row.disabled));
        rows.set(command.id, row);
      }
      row.hidden = false;
      const next = previous ? previous.nextSibling : list.firstChild;
      if (next !== row) list.insertBefore(row, next);
      previous = row;
    }
    const enabled = visibleCommands.filter((command) => command.kind !== "unsupported");
    setActive(enabled.some((command) => command.id === active) ? active : enabled[0]?.id ?? "");
    refreshButton.disabled = loading;
    refreshButton.setAttribute("aria-label", loadError ? "Retry commands" : "Refresh commands");
    refreshButton.title = loadError ? "Retry commands" : "Refresh commands";
    list.setAttribute("aria-busy", String(loading && !commands.length));
    status.textContent = loading ? `${slow ? "Waiting for the harness to start\u2026" : "Loading commands\u2026"}${commands.length ? " Available commands can be used now." : ""}` : loadError || (!matches.length ? query ? `Unknown command /${query}. Refresh commands or edit the name.` : "No commands are available for this agent." : `${visibleCommands.length}${matches.length > visibleCommands.length ? ` of ${matches.length}` : ""} command${matches.length === 1 ? "" : "s"}`);
    warning.hidden = !warnings.length;
    warning.textContent = warnings.slice(0, 3).join("\n");
    position();
  }
  async function load(force = false) {
    if (disposed || loading || !force && loadedAt && Date.now() - loadedAt < cacheLifetime) return;
    const ticket = ++generation, key = context;
    loading = true;
    slow = false;
    loadError = "";
    render();
    const current = () => !disposed && ticket === generation && key === options.contextKey();
    const accept = (result) => {
      const seen = /* @__PURE__ */ new Set();
      commands = result.commands.filter((command) => {
        if (!command.id || seen.has(command.id) || !/^\/[^\s/]+$/.test(command.name)) return false;
        seen.add(command.id);
        return true;
      }).slice(0, 1e3);
      warnings = result.warnings;
      rows.clear();
      list.replaceChildren();
    };
    const slowTimer = window.setTimeout(() => {
      if (current()) {
        slow = true;
        render();
      }
    }, 4e3);
    let timeoutTimer = 0;
    try {
      const discovery = async () => {
        if (!loadedAt && options.snapshot) {
          try {
            const snapshot = await options.snapshot();
            if (current() && loading) {
              accept(snapshot);
              render();
            }
          } catch {
          }
        }
        if (!current() || !loading) return { commands: [], warnings: [] };
        return options.load(force);
      };
      const result = await Promise.race([discovery(), new Promise((_, reject) => {
        timeoutTimer = window.setTimeout(() => reject(new Error("Command discovery took too long. Retry to load harness commands.")), 75e3);
      })]);
      if (!current()) return;
      accept(result);
      loadedAt = Date.now();
    } catch (error) {
      if (!current()) return;
      loadError = error instanceof Error ? error.message : String(error);
      loadedAt = Date.now();
    } finally {
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeoutTimer);
      if (current()) {
        loading = false;
        render();
      }
    }
  }
  function refresh(force = false) {
    if (disposed) return;
    if (force) {
      generation++;
      loadedAt = 0;
      loading = false;
    }
    const key = options.contextKey();
    if (key !== context) {
      context = key;
      generation++;
      loadedAt = 0;
      loading = false;
      loadError = "";
      active = "";
      commands = [];
      warnings = [];
      rows.clear();
      list.replaceChildren();
      dismissed = "";
      panel.querySelector(".slash-menu-logo").innerHTML = options.provider ? providerLogo(options.provider()) : icon("command");
    }
    const current = token();
    if (!current || dismissed === textarea.value) {
      close();
      return;
    }
    if (!opened) {
      opened = true;
      textarea.setAttribute("role", "combobox");
      textarea.setAttribute("aria-autocomplete", "list");
      textarea.setAttribute("aria-haspopup", "listbox");
      textarea.setAttribute("aria-expanded", "true");
      textarea.setAttribute("aria-controls", list.id);
      panel.querySelector(".slash-menu-logo").innerHTML = options.provider ? providerLogo(options.provider()) : icon("command");
      (textarea.closest("dialog[open]") ?? document.body).append(panel);
      render();
      showPopover(panel, textarea);
    } else render();
    void load();
  }
  function choose(command) {
    const current = token();
    if (!current || command.kind === "unsupported" || options.contextKey() !== context) return;
    const rest = textarea.value.slice(current.end).replace(/^\s+/, "");
    const prefix = textarea.value.slice(0, current.start) + command.name + " ";
    textarea.value = prefix + rest;
    textarea.setSelectionRange(prefix.length, prefix.length);
    close();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    options.select(command);
  }
  function keydown(event) {
    if (event.isComposing || composing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.defaultPrevented) return;
    if (!opened) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    const enabled = visibleCommands.filter((command) => command.kind !== "unsupported");
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const current = enabled.findIndex((command) => command.id === active);
      if (enabled.length) setActive(enabled[(current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length].id, true);
    } else if (event.key === "Enter" || event.key === "Tab") {
      if (event.key === "Tab" && !enabled.length) {
        close(true);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const selected = enabled.find((command) => command.id === active);
      if (selected) choose(selected);
      else if (!loading) status.textContent = visibleCommands[0]?.reason || "Choose an available command or edit the name before sending.";
    }
  }
  function outside(event) {
    if (event.target instanceof Node && event.target !== textarea && !panel.contains(event.target)) close(true);
  }
  function blur(event) {
    if (!(event.relatedTarget instanceof Node && panel.contains(event.relatedTarget))) close();
  }
  function input() {
    dismissed = "";
    refresh();
  }
  function focus() {
    dismissed = "";
    refresh();
  }
  function compositionStart() {
    composing = true;
    close();
  }
  function compositionEnd() {
    composing = false;
    input();
  }
  function refreshEvent() {
    refresh();
  }
  function click(event) {
    const target = event.target.closest("[data-command-id]");
    const command = commands.find((command2) => command2.id === target?.dataset.commandId);
    if (command) choose(command);
  }
  panel.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) event.preventDefault();
  });
  panel.addEventListener("click", click);
  refreshButton.addEventListener("click", () => {
    void load(true);
  });
  textarea.addEventListener("input", input);
  textarea.addEventListener("focus", focus);
  textarea.addEventListener("blur", blur);
  textarea.addEventListener("keydown", keydown);
  textarea.addEventListener("click", refreshEvent);
  textarea.addEventListener("keyup", refreshEvent);
  textarea.addEventListener("compositionstart", compositionStart);
  textarea.addEventListener("compositionend", compositionEnd);
  document.addEventListener("selectionchange", refreshEvent);
  document.addEventListener("pointerdown", outside, true);
  window.addEventListener("resize", schedulePosition);
  window.addEventListener("scroll", schedulePosition, true);
  window.visualViewport?.addEventListener("resize", schedulePosition);
  window.visualViewport?.addEventListener("scroll", schedulePosition);
  const resize = new ResizeObserver(() => schedulePosition());
  resize.observe(textarea.closest(".composer") ?? textarea);
  refresh();
  return { refresh, dispose() {
    if (disposed) return;
    disposed = true;
    generation++;
    close();
    resize.disconnect();
    textarea.removeEventListener("input", input);
    textarea.removeEventListener("focus", focus);
    textarea.removeEventListener("blur", blur);
    textarea.removeEventListener("keydown", keydown);
    textarea.removeEventListener("click", refreshEvent);
    textarea.removeEventListener("keyup", refreshEvent);
    textarea.removeEventListener("compositionstart", compositionStart);
    textarea.removeEventListener("compositionend", compositionEnd);
    document.removeEventListener("selectionchange", refreshEvent);
    document.removeEventListener("pointerdown", outside, true);
    window.removeEventListener("resize", schedulePosition);
    window.removeEventListener("scroll", schedulePosition, true);
    window.visualViewport?.removeEventListener("resize", schedulePosition);
    window.visualViewport?.removeEventListener("scroll", schedulePosition);
    rows.clear();
    commands = [];
    warnings = [];
  } };
}
export {
  mountSlashCommands
};
