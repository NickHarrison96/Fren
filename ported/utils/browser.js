import "./browser.css";
import { call, preview, subscribe } from "./bridge";
import { escape, icon } from "./dom";
import { mountJevLive } from "./jev-live";
import { pageZoom } from "./ui-size";
const emptyStatus = () => ({ url: "", title: "", loading: false, canGoBack: false, canGoForward: false, picking: false });
function normalizeUrl(input) {
  const value = input.trim();
  if (!value || value.length > 8192) throw new Error("Enter a website address or localhost port.");
  const candidate = /^\d{2,5}$/.test(value) ? `http://localhost:${value}` : /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(value) ? `http://${value}` : /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error("Use an HTTP or HTTPS address without embedded credentials.");
  return url.href;
}
async function mountBrowser(host, options) {
  let disposed = false, status = emptyStatus(), home = true, busy = false, request = 0, frame = 0;
  let pickTask, servers = [], lastBounds = "";
  let watching = false, jevAvailable = false, live;
  let operations = Promise.resolve();
  const enqueue = (work) => {
    const next = operations.then(work);
    operations = next.then(() => {
    }, () => {
    });
    return next;
  };
  const tool = (action, label, symbol) => `<button type="button" class="browser-tool" data-browser-action="${action}" aria-label="${label}" title="${label}">${icon(symbol)}</button>`;
  host.innerHTML = `<div class="browser-toolbar">
    ${tool("back", "Go back", "back")}${tool("forward", "Go forward", "forward")}${tool("reload", "Reload page", "refresh")}
    <form class="browser-address"><span>${icon("globe")}</span><input aria-label="Browser URL" placeholder="Enter URL or localhost port" autocomplete="off" spellcheck="false" inputmode="url"><button type="submit" aria-label="Open URL">${icon("arrow")}</button></form>
    ${tool("pick", "Attach an element", "select")}${tool("capture", "Attach screenshot", "camera")}
  </div><div class="browser-location"><button type="button" data-browser-action="home">${icon("server")}Local servers</button><span class="browser-page-title"></span><button type="button" class="browser-watch-jev" data-browser-action="watch-jev" hidden>${icon("spark")}Watch Jev</button>${options.test ? tool("test", "Test with Jev", "spark") : ""}${tool("close", "Close browser", "close")}</div>
  <div class="browser-notice" role="status" hidden></div><div class="browser-viewport"><section class="browser-home"><div class="browser-home-heading"><h2>Local servers</h2>${tool("refresh-ports", "Refresh local servers", "refresh")}</div><div class="browser-servers" aria-label="Local servers"></div><p class="browser-home-hint">Open a server, or enter any website above.</p></section><div class="browser-guest-placeholder" hidden></div></div>`;
  const query = (selector) => host.querySelector(selector);
  const address = query(".browser-address input"), viewport = query(".browser-viewport");
  const notice = query(".browser-notice"), placeholder = query(".browser-guest-placeholder");
  const button = (action) => query(`[data-browser-action="${action}"]`);
  function tell(message) {
    notice.textContent = message;
    notice.hidden = !message;
    scheduleBounds();
  }
  function fail(error) {
    if (!disposed) tell(error instanceof Error ? error.message : String(error));
  }
  function updateControls() {
    if (disposed) return;
    button("back").disabled = watching || home || !status.canGoBack || busy;
    button("forward").disabled = watching || home || !status.canGoForward || busy;
    button("reload").disabled = watching || home || busy;
    for (const action of ["pick", "capture"]) button(action).disabled = watching || home || status.loading || busy || !options.task();
    button("pick").setAttribute("aria-pressed", String(status.picking));
    query(".browser-page-title").textContent = watching || home ? "" : status.title || status.url;
    query(".browser-page-title").title = watching ? "" : status.url;
    query(".browser-home").hidden = watching || !home;
    placeholder.hidden = watching || home;
    query(".browser-toolbar").hidden = watching;
    button("watch-jev").hidden = watching || !jevAvailable;
    host.classList.toggle("browser-loading", !watching && status.loading);
    if (document.activeElement !== address) address.value = home ? "" : status.url;
    if (status.picking) tell("Click an element to attach it. Press Esc to cancel.");
    else if (notice.textContent?.startsWith("Click an element")) tell("");
  }
  function bounds() {
    const rect = viewport.getBoundingClientRect(), zoom = pageZoom();
    return { x: rect.x * zoom, y: rect.y * zoom, width: rect.width * zoom, height: rect.height * zoom };
  }
  function obscured(rect) {
    if (document.querySelector("dialog[open], #settings-page:not([hidden])")) return true;
    return [...document.querySelectorAll('.floating-menu:not([aria-hidden="true"])')].some((menu) => {
      const box = menu.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(menu).visibility !== "hidden" && box.left < rect.x + rect.width && box.right > rect.x && box.top < rect.y + rect.height && box.bottom > rect.y;
    });
  }
  function syncBounds(force = false) {
    if (disposed || home) return;
    const rect = bounds(), visible = !watching && !obscured(rect) && rect.width > 1 && rect.height > 1;
    const key = JSON.stringify({ ...rect, visible });
    if (!force && key === lastBounds) return;
    lastBounds = key;
    void enqueue(async () => {
      if (!disposed) await call("browser_bounds", { bounds: rect, visible });
    }).catch(fail);
  }
  function scheduleBounds() {
    if (disposed || frame) return;
    frame = window.setTimeout(() => {
      frame = 0;
      syncBounds();
    }, 16);
  }
  function renderServers() {
    query(".browser-servers").innerHTML = servers.length ? servers.map((server) => `<button class="browser-server" type="button" data-server-url="${escape(server.url)}"><span class="browser-server-icon">${icon("terminal")}</span><span><strong>${escape(server.process || "Local server")}</strong><small>${escape(new URL(server.url).host)}</small></span><span class="browser-server-dot" aria-label="Listening"></span>${icon("chevron")}</button>`).join("") : '<div class="browser-no-servers">No local servers found.<small>Start your app in the terminal, then refresh.</small></div>';
  }
  async function refreshServers() {
    const ticket = ++request;
    button("refresh-ports").disabled = true;
    try {
      const found = await call("list_local_servers");
      if (!disposed && ticket === request) {
        servers = found;
        renderServers();
      }
    } catch (error) {
      if (!disposed && ticket === request) {
        renderServers();
        fail(error);
      }
    } finally {
      if (!disposed && ticket === request) button("refresh-ports").disabled = false;
    }
  }
  async function navigate(input) {
    const url = normalizeUrl(input);
    options.navigated?.(url);
    live?.leave();
    busy = true;
    tell("");
    updateControls();
    try {
      const next = await enqueue(() => call("browser_open", { url, bounds: bounds() }));
      if (disposed) return;
      status = next;
      home = false;
      pickTask = void 0;
      lastBounds = "";
      options.navigated?.(status.url);
      address.blur();
      if (preview) showSamplePage();
    } finally {
      busy = false;
      updateControls();
      syncBounds(true);
    }
  }
  function showSamplePage() {
    placeholder.innerHTML = `<div class="browser-preview-label">Browser preview \xB7 sample page</div><div class="browser-sample"><span class="browser-sample-kicker">LOCAL PREVIEW</span><h2>Your app, right here.</h2><p>Inspect the page beside your conversation.</p><button type="button" class="browser-sample-button">Try the interaction</button></div>`;
  }
  function attachElement(element) {
    if (disposed || !pickTask) return;
    const task = pickTask;
    pickTask = void 0;
    status.picking = false;
    updateControls();
    try {
      options.attach(task, { ...element, kind: "element", id: crypto.randomUUID() });
      tell("Element attached to your message.");
    } catch (error) {
      fail(error);
    }
  }
  const unlisten = await Promise.all([
    subscribe("browser-state", (next) => {
      if (disposed || home && !busy) return;
      status = next;
      if (status.url) options.navigated?.(status.url);
      updateControls();
      scheduleBounds();
    }),
    subscribe("browser-element", attachElement)
  ]);
  const liveHost = document.createElement("section");
  viewport.append(liveHost);
  live = await mountJevLive(liveHost, { session: options.session, returned() {
    button("watch-jev").focus({ preventScroll: true });
  }, changed(next, available) {
    if (disposed) return;
    watching = next;
    jevAvailable = available;
    if (watching && status.picking) {
      pickTask = void 0;
      status.picking = false;
      void enqueue(() => call("browser_pick", { enabled: false })).catch(fail);
    }
    updateControls();
    syncBounds();
  } });
  async function act(action, anchor) {
    if (disposed) return;
    if (action === "test") {
      options.test?.(watching ? live?.url() : status.url || void 0, anchor);
      return;
    }
    if (action === "watch-jev") {
      await live?.watch();
      return;
    }
    if (action === "close") {
      options.close();
      return;
    }
    if (action === "refresh-ports") {
      await refreshServers();
      return;
    }
    if (action === "home") {
      options.navigated?.("");
      live?.leave();
      await enqueue(() => call("browser_close"));
      if (disposed) return;
      home = true;
      status = emptyStatus();
      pickTask = void 0;
      tell("");
      updateControls();
      await refreshServers();
      return;
    }
    if (action === "pick") {
      const target = options.task();
      if (!target) return;
      pickTask = status.picking ? void 0 : target;
      await enqueue(() => call("browser_pick", { enabled: !status.picking }));
      return;
    }
    if (action === "capture") {
      const target = options.task();
      if (!target) return;
      busy = true;
      tell("");
      updateControls();
      try {
        const screenshot = await enqueue(() => call("browser_capture"));
        options.attach(target, { ...screenshot, kind: "screenshot" });
        if (!disposed) tell("Screenshot attached to your message.");
      } finally {
        busy = false;
        updateControls();
      }
      return;
    }
    await enqueue(() => call("browser_action", { action: action === "reload" && status.loading ? "stop" : action }));
    syncBounds(true);
  }
  function click(event) {
    const target = event.target.closest("[data-browser-action],[data-server-url]");
    if (target) {
      event.preventDefault();
      event.stopPropagation();
      if (target instanceof HTMLButtonElement && target.disabled) return;
      void (target.dataset.serverUrl ? navigate(target.dataset.serverUrl) : act(target.dataset.browserAction, target)).catch(fail);
    } else if (preview && status.picking && event.target.closest(".browser-sample")) {
      const element = event.target;
      attachElement({ url: status.url, title: status.title, tag: element.tagName.toLowerCase(), selector: element.className ? "." + element.className : element.tagName.toLowerCase(), text: element.textContent?.slice(0, 4e3) || "", html: element.outerHTML.slice(0, 8e3), bounds: { x: 0, y: 0, width: 180, height: 44 } });
      void enqueue(() => call("browser_pick", { enabled: false })).catch(fail);
    }
  }
  function submit(event) {
    if (event.target === query(".browser-address")) {
      event.preventDefault();
      event.stopPropagation();
      void navigate(address.value).catch(fail);
    }
  }
  function keydown(event) {
    if (event.key === "Escape" && status.picking) {
      event.preventDefault();
      event.stopPropagation();
      pickTask = void 0;
      void enqueue(() => call("browser_pick", { enabled: false })).catch(fail);
    }
  }
  host.addEventListener("click", click);
  host.addEventListener("submit", submit);
  host.addEventListener("keydown", keydown);
  const resize = new ResizeObserver(scheduleBounds);
  resize.observe(viewport);
  const menus = /* @__PURE__ */ new Set();
  function observeMenus() {
    const current = new Set(document.querySelectorAll(".floating-menu"));
    for (const menu of menus) if (!current.has(menu)) {
      resize.unobserve(menu);
      menus.delete(menu);
    }
    for (const menu of current) if (!menus.has(menu)) {
      menus.add(menu);
      resize.observe(menu);
    }
  }
  const overlays = new MutationObserver((records) => {
    const selector = ".floating-menu,dialog,#settings-page";
    if (records.some((record) => record.type === "attributes" ? record.target === document.documentElement || record.target instanceof Element && record.target.matches(selector) : [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element && (node.matches(selector) || node.querySelector(selector))))) {
      observeMenus();
      syncBounds();
    }
  });
  overlays.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-hidden", "open", "style", "hidden", "data-popover-state"] });
  overlays.observe(document.documentElement, { attributes: true, attributeFilter: ["data-native-material", "data-theme"] });
  observeMenus();
  window.addEventListener("resize", scheduleBounds);
  function restoreVisibility() {
    if (!document.hidden) syncBounds(true);
  }
  window.addEventListener("focus", restoreVisibility);
  document.addEventListener("visibilitychange", restoreVisibility);
  updateControls();
  void refreshServers();
  if (!watching) address.focus();
  return {
    async navigate(url) {
      if (disposed) throw new Error("Browser is closed.");
      await navigate(url);
      return status;
    },
    async watchJev(runId) {
      if (disposed) throw new Error("Browser is closed.");
      await live?.watch(runId);
    },
    refresh() {
      live?.refresh();
      if (pickTask && pickTask !== options.task()) {
        pickTask = void 0;
        void enqueue(() => call("browser_pick", { enabled: false })).catch(fail);
      }
      updateControls();
      scheduleBounds();
    },
    async close() {
      disposed = true;
      ++request;
      clearTimeout(frame);
      resize.disconnect();
      menus.clear();
      overlays.disconnect();
      const hiding = call("browser_bounds", { bounds: bounds(), visible: false }).catch(() => {
      });
      unlisten.forEach((stop) => stop());
      window.removeEventListener("resize", scheduleBounds);
      window.removeEventListener("focus", restoreVisibility);
      document.removeEventListener("visibilitychange", restoreVisibility);
      host.removeEventListener("click", click);
      host.removeEventListener("submit", submit);
      host.removeEventListener("keydown", keydown);
      await Promise.all([hiding, live?.close(), enqueue(() => call("browser_close"))]);
      host.replaceChildren();
    }
  };
}
export {
  mountBrowser,
  normalizeUrl
};
