import "./jev-live.css";
import { call, subscribe } from "./bridge";
import { escape, icon } from "./dom";
const active = (report) => report?.status === "starting" || report?.status === "running";
const statuses = { starting: "Starting browser", running: "Testing", done: "Finished", blocked: "Blocked", failed: "Test failed", cancelled: "Cancelled", limit: "Limit reached" };
const duration = (ms) => ms < 6e4 ? `${Math.max(0, Math.floor(ms / 1e3))}s` : `${Math.floor(ms / 6e4)}m ${Math.floor(ms % 6e4 / 1e3)}s`;
const errorText = (error) => error instanceof Error ? error.message : String(error);
function validImage(value, live = false) {
  return typeof value === "string" && value.length <= (live ? 35e4 : 28e5) && (live ? /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/ : /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).test(value);
}
async function mountJevLive(host, options) {
  host.className = "jev-live";
  host.hidden = true;
  host.setAttribute("role", "region");
  host.setAttribute("aria-label", "Jev live browser");
  host.innerHTML = `<header class="jev-live-heading"><span class="jev-live-mark">${icon("spark")}</span><strong>Jev</strong><span class="jev-live-status" role="status"></span><button type="button" class="jev-live-stop" data-jev-live-stop>${icon("stop")}Stop test</button><button type="button" class="browser-tool" data-jev-live-return aria-label="Return to browser" title="Return to browser">${icon("back")}</button></header>
    <div class="jev-live-run-picker" hidden><select aria-label="Jev run"></select>${icon("down")}</div>
    <div class="jev-live-context"><strong class="jev-live-goal"></strong><span class="jev-live-url"></span></div>
    <figure class="jev-live-screen"><img alt="Jev browser live view" hidden><div class="jev-live-waiting">${icon("globe")}<span>Waiting for the browser\u2026</span></div><figcaption>Live browser \xB7 read only</figcaption></figure>
    <div class="jev-live-progress"><span class="jev-live-step"></span><p class="jev-live-current"></p></div>
    <p class="jev-live-error" role="status" hidden></p>
    <details class="jev-live-timeline"><summary>Browser actions <span class="jev-live-count">0</span>${icon("down")}</summary><ol></ol><p class="jev-live-no-actions">Actions will appear as Jev works.</p></details>`;
  const query = (selector2) => host.querySelector(selector2);
  const image = query("img"), selector = query("select");
  const timeline = query(".jev-live-timeline"), stopButton = query("[data-jev-live-stop]");
  const reports = /* @__PURE__ */ new Map(), eventVersions = /* @__PURE__ */ new Map();
  const dismissed = /* @__PURE__ */ new Set();
  const manualAfter = /* @__PURE__ */ new Map();
  let disposed = false, session, selected, revision = 0, eventVersion = 0;
  let listPending, stopping, finalRead;
  let sequence = -1, pendingFrame, frameTimer = 0, lastPaint = 0, timelineKey = "", optionKey = "";
  let lease, leaseTimer = 0, leaseQueue = Promise.resolve();
  const renewals = /* @__PURE__ */ new Set();
  const current = () => selected ? reports.get(selected) : void 0;
  const wasDismissed = (report) => dismissed.has(report.id) || report.createdAt <= (manualAfter.get(report.sessionId) ?? -Infinity);
  const alive = (ticket, task) => !disposed && ticket === revision && task === session && task === options.session();
  function tell(message) {
    query(".jev-live-error").textContent = message;
    query(".jev-live-error").hidden = !message;
  }
  function notify() {
    options.changed(Boolean(selected), reports.size > 0);
  }
  function resetFrame() {
    clearTimeout(frameTimer);
    frameTimer = 0;
    pendingFrame = void 0;
    sequence = -1;
    lastPaint = 0;
    image.removeAttribute("src");
    image.hidden = true;
    query(".jev-live-waiting").hidden = false;
  }
  function setImage(dataUrl) {
    if (image.getAttribute("src") !== dataUrl) image.src = dataUrl;
    image.hidden = false;
    query(".jev-live-waiting").hidden = true;
  }
  function commandLease(target, watching) {
    if (watching && renewals.has(target)) return;
    if (watching) renewals.add(target);
    leaseQueue = leaseQueue.then(() => call("jev_watch_run", { ...target, watching })).then(() => {
    }, (error) => {
      if (!disposed && watching && lease === target && session === options.session()) tell(errorText(error));
    }).finally(() => {
      if (watching) renewals.delete(target);
    });
  }
  function syncLease() {
    const report = current(), wanted = !disposed && !document.hidden && session === options.session() && active(report) ? report : void 0;
    if (lease?.runId === wanted?.id && lease?.sessionId === wanted?.sessionId) return;
    clearInterval(leaseTimer);
    leaseTimer = 0;
    if (lease) commandLease(lease, false);
    lease = wanted ? { sessionId: wanted.sessionId, runId: wanted.id } : void 0;
    if (lease) {
      commandLease(lease, true);
      leaseTimer = window.setInterval(() => {
        if (lease) commandLease(lease, true);
      }, 5e3);
    }
  }
  function showTimeline() {
    const events = current()?.events ?? [];
    if (!timeline.open) return;
    const key = JSON.stringify(events);
    if (timelineKey === key) return;
    timelineKey = key;
    query("ol").innerHTML = events.map((event) => `<li><span class="jev-live-action-step">${escape(event.step)}</span><div><strong>${escape(event.operation.replaceAll("_", " "))}</strong>${event.target ? `<span>${escape(event.target)}</span>` : ""}${event.url ? `<small>${escape(event.url)}</small>` : ""}</div><time>${duration(event.elapsedMs)}</time></li>`).join("");
    query(".jev-live-no-actions").hidden = events.length > 0;
  }
  function render() {
    if (disposed) return;
    const report = current();
    host.hidden = !report;
    const ordered = [...reports.values()].sort((a, b) => b.createdAt - a.createdAt);
    const optionsKey = JSON.stringify(ordered.map((run) => [run.id, run.goal, run.status]));
    if (optionKey !== optionsKey) {
      optionKey = optionsKey;
      selector.replaceChildren(...ordered.map((run) => new Option(`${statuses[run.status]} \xB7 ${run.goal || run.url}`, run.id)));
    }
    selector.value = selected ?? "";
    query(".jev-live-run-picker").hidden = reports.size < 2;
    if (!report) {
      syncLease();
      notify();
      return;
    }
    const running = active(report), last = report.events.at(-1);
    query(".jev-live-status").textContent = `${statuses[report.status]} \xB7 ${duration(report.durationMs)}`;
    host.dataset.running = String(running);
    query(".jev-live-goal").textContent = report.goal;
    query(".jev-live-url").textContent = last?.url || report.url;
    query(".jev-live-url").title = last?.url || report.url;
    query(".jev-live-step").textContent = report.steps ? `Step ${report.steps}` : "Getting ready";
    query(".jev-live-current").textContent = running && last ? `${last.operation.replaceAll("_", " ")}${last.target ? ` \xB7 ${last.target}` : ""}` : report.summary;
    query(".jev-live-count").textContent = String(report.events.length);
    query("figcaption").textContent = running ? "Live browser \xB7 read only" : "Final browser view \xB7 read only";
    query(".jev-live-waiting span").textContent = running ? "Waiting for the browser\u2026" : "No browser image available";
    stopButton.hidden = !running;
    stopButton.disabled = stopping === report.id;
    if (!running && validImage(report.screenshot)) setImage(report.screenshot);
    showTimeline();
    syncLease();
    notify();
  }
  function choose(runId) {
    if (!reports.has(runId) || disposed) return;
    if (selected !== runId) {
      const previous = current();
      if (previous?.screenshot) reports.set(previous.id, { ...previous, screenshot: void 0 });
      resetFrame();
      timelineKey = "";
      query("ol").replaceChildren();
      timeline.open = false;
      tell("");
    }
    selected = runId;
    finalRead = void 0;
    render();
    void readFinal();
  }
  function autoWatch() {
    if (selected) return;
    const next = [...reports.values()].filter((run) => active(run) && !wasDismissed(run)).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (next) choose(next.id);
    else render();
  }
  function retain(report) {
    const previous = reports.get(report.id);
    if (previous && (!active(previous) && active(report) || active(previous) && active(report) && (report.durationMs < previous.durationMs || report.events.length < previous.events.length || previous.status === "running" && report.status === "starting"))) return;
    reports.set(report.id, previous?.screenshot && !report.screenshot ? { ...report, screenshot: previous.screenshot } : report);
    if (reports.size > 100) for (const old of [...reports.values()].sort((a, b) => a.createdAt - b.createdAt)) {
      if (old.id !== selected && !active(old)) {
        reports.delete(old.id);
        eventVersions.delete(old.id);
        break;
      }
    }
  }
  async function readFinal() {
    const report = current();
    if (!report || active(report) || report.screenshot || finalRead === report.id) return;
    finalRead = report.id;
    const ticket = revision, task = session;
    try {
      const result = await call("jev_read_run", { sessionId: task, runId: report.id });
      if (!alive(ticket, task) || selected !== report.id || result.sessionId !== task || result.id !== report.id) return;
      if (validImage(result.screenshot)) {
        const latest = current();
        if (latest && !active(latest)) {
          latest.screenshot = result.screenshot;
          render();
        }
      }
    } catch (error) {
      if (alive(ticket, task) && selected === report.id) tell(errorText(error));
    }
  }
  function refresh() {
    if (disposed || session === options.session()) return;
    session = options.session();
    ++revision;
    selected = void 0;
    stopping = void 0;
    finalRead = void 0;
    reports.clear();
    eventVersions.clear();
    resetFrame();
    tell("");
    render();
    if (!session) {
      listPending = void 0;
      return;
    }
    const task = session, ticket = revision, started = eventVersion;
    listPending = (async () => {
      try {
        const list = await call("jev_list_runs", { sessionId: task });
        if (!alive(ticket, task)) return;
        for (const report of list.slice(0, 100)) if (report.sessionId === task && (eventVersions.get(report.id) ?? 0) <= started) retain(report);
        autoWatch();
      } catch (error) {
        if (alive(ticket, task)) tell(errorText(error));
      }
    })();
  }
  function receiveReport(report) {
    if (disposed || report.sessionId !== options.session()) return;
    refresh();
    const freshRun = !reports.has(report.id), selectedFinished = selected && !active(current());
    retain(report);
    eventVersions.set(report.id, ++eventVersion);
    if (selected === report.id && !active(report) && query(".jev-live-error").textContent === "Stopping the browser test\u2026") tell("");
    if (freshRun && active(report) && selectedFinished && !wasDismissed(report)) {
      choose(report.id);
      return;
    }
    if (selected) {
      render();
      void readFinal();
    } else autoWatch();
  }
  function receiveFrame(frame) {
    if (disposed || document.hidden || session !== options.session() || frame.sessionId !== session || frame.runId !== selected || !active(current()) || !Number.isSafeInteger(frame.sequence) || frame.sequence <= sequence || !validImage(frame.dataUrl, true) || !Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width < 1 || frame.height < 1 || frame.width > 4096 || frame.height > 4096) return;
    sequence = frame.sequence;
    pendingFrame = frame;
    if (!frameTimer) frameTimer = window.setTimeout(() => {
      frameTimer = 0;
      const next = pendingFrame;
      pendingFrame = void 0;
      if (!next || disposed || document.hidden || session !== options.session() || selected !== next.runId || !active(current())) return;
      setImage(next.dataUrl);
      lastPaint = performance.now();
    }, Math.max(0, 500 - (performance.now() - lastPaint)));
  }
  function leave() {
    if (session) {
      manualAfter.delete(session);
      manualAfter.set(session, Date.now());
    }
    while (manualAfter.size > 100) manualAfter.delete(manualAfter.keys().next().value);
    for (const report of reports.values()) if (active(report)) dismissed.add(report.id);
    while (dismissed.size > 200) dismissed.delete(dismissed.values().next().value);
    const previous = current();
    if (previous?.screenshot) reports.set(previous.id, { ...previous, screenshot: void 0 });
    selected = void 0;
    finalRead = void 0;
    resetFrame();
    render();
  }
  async function watch(runId) {
    refresh();
    const ticket = revision, task = session;
    if (!task || disposed) throw new Error("Choose a task to watch its browser tests.");
    await listPending;
    if (!alive(ticket, task)) return;
    const id = runId ?? [...reports.values()].sort((a, b) => Number(active(b)) - Number(active(a)) || b.createdAt - a.createdAt)[0]?.id;
    if (!id) return;
    if (!reports.has(id)) {
      const report = await call("jev_read_run", { sessionId: task, runId: id });
      if (!alive(ticket, task)) return;
      if (report.sessionId !== task || report.id !== id) throw new Error("This browser test belongs to another task.");
      if (!reports.has(id)) retain(report);
    }
    choose(id);
  }
  async function stop() {
    const report = current();
    if (!report || !active(report) || stopping === report.id) return;
    const task = session, ticket = revision;
    stopping = report.id;
    tell("");
    render();
    try {
      const result = await call("jev_cancel", { sessionId: task, runId: report.id });
      if (alive(ticket, task) && selected === report.id && active(current())) tell("Stopping the browser test\u2026");
      if (alive(ticket, task) && result && result.sessionId === task && result.id === report.id) receiveReport(result);
    } catch (error) {
      if (alive(ticket, task) && selected === report.id) tell(errorText(error));
    } finally {
      if (alive(ticket, task)) {
        stopping = void 0;
        render();
      }
    }
  }
  function visibility() {
    if (document.hidden) {
      clearTimeout(frameTimer);
      frameTimer = 0;
      pendingFrame = void 0;
    }
    syncLease();
  }
  selector.addEventListener("change", () => choose(selector.value));
  query("[data-jev-live-return]").addEventListener("click", () => {
    leave();
    options.returned();
  });
  stopButton.addEventListener("click", () => {
    void stop();
  });
  timeline.addEventListener("toggle", showTimeline);
  document.addEventListener("visibilitychange", visibility);
  const unlisten = await Promise.all([subscribe("jev-run", receiveReport), subscribe("jev-frame", receiveFrame)]);
  refresh();
  return { watch, refresh, leave, url: () => current()?.events.at(-1)?.url || current()?.url, async close() {
    disposed = true;
    ++revision;
    selected = void 0;
    resetFrame();
    syncLease();
    document.removeEventListener("visibilitychange", visibility);
    unlisten.forEach((stop2) => stop2());
    reports.clear();
    eventVersions.clear();
    dismissed.clear();
    manualAfter.clear();
    host.replaceChildren();
    await leaseQueue;
  } };
}
export {
  mountJevLive
};
