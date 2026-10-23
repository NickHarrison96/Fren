import "./token-saver.css";
import { escape, icon } from "./dom";
import { hidePopover, showPopover } from "./popover-motion";
import { LEVELS, PACKS, contextFor, defaults, estimate, setDefaults, threadSaver, updateThread } from "./token-saver";
function createTokenSaver(host) {
  let tools = { rtk: false, rtkVersion: "", rtkInstall: "brew install rtk" };
  let loading;
  let panel, panelSession = "", cleanup;
  let installing = false;
  const available = () => ({ rtk: tools.rtk });
  function loadTools(force = false) {
    if (!loading || force) loading = host.call("token_saver_tools").then((value) => {
      tools = value;
    }).catch(() => {
    });
    return loading;
  }
  function button(sessionId) {
    const saver = threadSaver(sessionId), on = saver.packs.filter((id) => id !== "rtk" || tools.rtk);
    const label = on.length ? `Token saver: ${on.length} on, about ${estimate(saver.packs, saver.level, available())}% fewer tokens` : "Token saver: off";
    return `<button type="button" class="composer-saver-button" data-action="token-saver" aria-haspopup="dialog" aria-expanded="${panel && panelSession === sessionId ? "true" : "false"}" aria-pressed="${on.length > 0}" aria-label="${escape(label)}" title="${escape(label)}">${icon("leaf")}<span>Saver</span>${on.length ? `<b>${on.length}</b>` : ""}</button>`;
  }
  function render(sessionId) {
    if (!panel) return;
    const saver = threadSaver(sessionId), saving = estimate(saver.packs, saver.level, available()), on = new Set(saver.packs);
    const preset = defaults();
    const sameAsDefault = Boolean(preset) && preset.level === saver.level && preset.packs.join() === saver.packs.join();
    const row = (id) => {
      const pack = PACKS.find((item) => item.id === id), missing = pack.needs === "rtk" && !tools.rtk, active = on.has(id) && !missing;
      const about = `${pack.summary} Saves ${pack.saves}.${missing ? ` Not installed yet: turning it on installs it (${tools.rtkInstall}).` : id === "rtk" && tools.rtkVersion ? ` rtk ${tools.rtkVersion} installed.` : ""}`;
      const levels = id === "caveman" && active ? `<div class="saver-levels" role="radiogroup" aria-label="Caveman intensity">${LEVELS.map((level) => `<button type="button" role="radio" aria-checked="${saver.level === level.id}" data-level="${level.id}" title="${escape(level.hint)}">${level.label}</button>`).join("")}</div>` : "";
      const install = missing && installing ? '<span class="saver-installing" role="status">Installing\u2026</span>' : "";
      return `<li class="saver-row ${missing ? "saver-missing" : ""}"><span class="saver-name" id="saver-${id}" data-tip="${escape(about)}">${pack.title}</span><span class="sr-only" id="saver-${id}-about">${escape(about)}</span>${install}<button type="button" role="switch" class="saver-switch" data-pack="${id}" aria-labelledby="saver-${id}" aria-describedby="saver-${id}-about" aria-checked="${active}" ${missing ? 'data-install="rtk"' : ""} ${missing && installing ? 'aria-busy="true" aria-disabled="true"' : ""}></button></li>${levels ? `<li class="saver-levels-row">${levels}</li>` : ""}`;
    };
    panel.innerHTML = `<header class="saver-head"><strong id="saver-title" data-tip="Applies to this thread. Guidance rides along folded with your next message, then every few messages. Savings are estimates from each project's benchmarks.">Token saver</strong><span class="saver-total" aria-label="${saving ? `About ${saving}% fewer tokens` : "Off"}">${saving ? `\u2212${saving}%` : "Off"}</span></header>
      <ul class="saver-list">${PACKS.map((pack) => row(pack.id)).join("")}</ul>
      <footer class="saver-foot"><label class="saver-default"><input type="checkbox" ${sameAsDefault ? "checked" : ""} ${saver.packs.length ? "" : "disabled"}><span>Start new threads like this</span></label><button type="button" class="saver-off" ${saver.packs.length ? "" : "disabled"}>Turn all off</button></footer>`;
  }
  function place(anchor) {
    if (!panel) return;
    const rect = anchor.getBoundingClientRect(), width = Math.min(272, window.innerWidth - 24);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2))}px`;
    panel.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 10)}px`;
    panel.dataset.placement = "above";
  }
  function close() {
    if (!panel) return;
    const closing = panel, session = panelSession;
    panel = void 0;
    panelSession = "";
    cleanup?.();
    cleanup = void 0;
    hidePopover(closing);
    host.changed(session);
  }
  function open(anchor, sessionId) {
    if (panel && panelSession === sessionId) {
      close();
      return;
    }
    close();
    panel = document.createElement("div");
    panel.className = "floating-menu saver-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "saver-title");
    panelSession = sessionId;
    document.body.append(panel);
    render(sessionId);
    place(anchor);
    showPopover(panel, anchor);
    anchor.setAttribute("aria-expanded", "true");
    panel.querySelector(".saver-switch")?.focus({ preventScroll: true });
    void loadTools(true).then(() => {
      if (panelSession === sessionId) render(sessionId);
    });
    const update = (patch) => {
      const next = updateThread(sessionId, patch);
      if (panel?.querySelector(".saver-default input")?.checked) setDefaults(next.packs.length ? next : null);
      render(sessionId);
      host.changed(sessionId);
    };
    const onClick = (event) => {
      const target = event.target;
      const toggle = target.closest("[data-pack]");
      if (toggle?.dataset.install) {
        if (!installing) void install(toggle.dataset.pack);
        return;
      }
      if (toggle && toggle.getAttribute("aria-disabled") !== "true") {
        const id = toggle.dataset.pack, packs = threadSaver(sessionId).packs;
        update({ packs: packs.includes(id) ? packs.filter((pack) => pack !== id) : [...packs, id] });
        panel?.querySelector(`[data-pack="${id}"]`)?.focus({ preventScroll: true });
        return;
      }
      const level = target.closest("[data-level]");
      if (level) {
        update({ level: level.dataset.level });
        panel?.querySelector(`[data-level="${level.dataset.level}"]`)?.focus();
        return;
      }
      if (target.closest(".saver-off")) update({ packs: [] });
    };
    const install = async (id) => {
      installing = true;
      render(sessionId);
      host.notify("Installing RTK with Homebrew\u2026");
      try {
        tools = await host.call("token_saver_install", { tool: "rtk" });
        loading = Promise.resolve();
        installing = false;
        const packs = threadSaver(sessionId).packs;
        if (tools.rtk) update({ packs: packs.includes(id) ? packs : [...packs, id] });
        host.notify(tools.rtk ? `RTK ${tools.rtkVersion} installed and on` : "RTK is still not available");
      } catch (error) {
        installing = false;
        host.notify(error instanceof Error ? error.message : String(error));
      }
      if (panelSession === sessionId) render(sessionId);
    };
    const onChange = (event) => {
      const input = event.target;
      if (!input.closest(".saver-default")) return;
      const saver = threadSaver(sessionId);
      setDefaults(input.checked ? saver : null);
      host.notify(input.checked ? "New threads start with these savers" : "New threads start with savers off");
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        anchor.isConnected && anchor.focus();
      }
    };
    const onOutside = (event) => {
      const target = event.target;
      if (panel && !panel.contains(target) && !target.closest('[data-action="token-saver"]')) close();
    };
    panel.addEventListener("click", onClick);
    panel.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onOutside, true);
    cleanup = () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onOutside, true);
    };
  }
  return {
    button,
    open,
    close,
    loadTools,
    /** The folded guidance block for an outgoing message, if one is due. */
    contextFor: (sessionId) => contextFor(sessionId, available())
  };
}
export {
  createTokenSaver
};
