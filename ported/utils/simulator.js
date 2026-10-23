import "./simulator.css";
import { icon } from "./dom";
import { isWindows } from "./platform";
import { chosenFinish, modelSpec, rememberFinish } from "./simulator-models";
const KEYS = { Enter: "return", Backspace: "backspace", Tab: "tab", Escape: "escape", ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Delete: "delete" };
const TYPE_DELAY = 140, SCROLL_DELAY = 90, SETUP = "android-setup", ADD_DUO = "add-duo", DUO_TYPE = "com.apple.CoreSimulator.SimDeviceType.iPhone-Duo";
const POSES = [{ id: "closed", label: "Closed", description: "Cover display" }, { id: "book", label: "Book", description: "Inner display, half open" }, { id: "open", label: "Open", description: "Inner display, flat" }];
const poseName = (pose) => POSES.find((p) => p.id === pose)?.label ?? "Closed";
const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const isDark = () => document.documentElement.dataset.theme === "dark" || !document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches;
const NO_SDK = "Install Android Studio (or the Android command-line tools) into %LOCALAPPDATA%\\Android\\Sdk, create an emulator in Device Manager, then reopen this tab.";
const forPlatform = (status) => {
  if (!isWindows) return status;
  const devices = status.devices.filter((d) => d.platform === "android");
  const selected = devices.some((d) => d.udid === status.selected) ? status.selected : null;
  return { ...status, available: Boolean(status.android) || devices.length > 0, axe: true, duoAvailable: false, pose: null, error: null, devices, selected, screen: selected ? status.screen : null };
};
function mountSimulator(root, host) {
  root.innerHTML = `<div class="sim-stage-wrap"><button type="button" class="sim-reset" data-sim="reset" aria-label="Face forward" title="Face forward">${icon("reset")}</button><div class="sim-stage" tabindex="0" role="application" aria-label="iOS Simulator. Click the screen to tap, drag on it to swipe, type to enter text. Drag around the device to turn it." aria-describedby="sim-hint" title="Drag to turn \xB7 Scroll to zoom \xB7 Click the screen to tap \xB7 Double-click to face forward"></div></div>
    <p class="sr-only" id="sim-hint">Drag around the device to turn it, scroll to zoom, click the screen to tap, double-click to face forward.</p>
    <p class="sim-status" role="status" hidden></p>
    <div class="sim-axe" role="note" hidden><span>Touch and typing need <strong>AXe</strong>.</span><code></code><button type="button" class="secondary-button" data-sim="copy-axe">${icon("copy")}Copy</button></div>
    <div class="sim-dock">
      <button type="button" class="sim-device" data-sim="device" aria-haspopup="menu" aria-label="Choose simulator">${icon("phone")}<span class="sim-device-name">Simulator</span><small class="sim-device-runtime"></small>${icon("down")}</button>
      <div class="sim-actions" role="toolbar" aria-label="Simulator controls">
        <button type="button" class="icon-button" data-sim="power" aria-label="Boot simulator" title="Boot">${icon("stop")}</button>
        <button type="button" class="icon-button" data-sim="back" aria-label="Back" title="Back" hidden>${icon("back")}</button>
        <button type="button" class="icon-button" data-sim="home" aria-label="Home" title="Home">${icon("circle")}</button>
        <button type="button" class="icon-button" data-sim="recents" aria-label="Recent apps" title="Recent apps" hidden>${icon("square")}</button>
        <button type="button" class="icon-button" data-sim="lock" aria-label="Lock" title="Lock">${icon("lock")}</button>
        <button type="button" class="icon-button" data-sim="pose" aria-haspopup="menu" aria-label="iPhone Duo pose: Closed" title="Closed" hidden>${icon("panel")}</button>
        <button type="button" class="icon-button" data-sim="appearance" aria-label="Toggle dark appearance" title="Light / dark">${icon("moon")}</button>
        <button type="button" class="icon-button" data-sim="capture" aria-label="Copy screenshot" title="Copy screenshot">${icon("camera")}</button>
        <button type="button" class="icon-button sim-finish" data-sim="finish" aria-haspopup="menu" aria-label="Device finish" title="Finish"><span class="sim-finish-dot"></span></button>
      </div>
    </div>`;
  const stage = root.querySelector(".sim-stage");
  const statusLine = root.querySelector(".sim-status");
  const button = (name) => root.querySelector(`[data-sim="${name}"]`);
  let status, device, flat, settingUp = false;
  let visible = false, disposed = false, pumpGeneration = 0, seq = 0, busy = false, poseBusy = false, poseWanted, poseEpoch = 0, poll = 0, polling = false, appearance = "light", warnedAxe = false;
  let typed = "", typeTimer = 0, scroll = { dx: 0, dy: 0, at: { x: 0, y: 0 } }, scrollTimer = 0;
  const call = async (command, args) => forPlatform(await host.call(command, args));
  const current = () => status?.devices.find((d) => d.udid === status?.selected);
  const booted = () => current()?.state === "Booted";
  const shape = () => {
    const screen = status?.screen, base = { homeButton: screen?.homeButton ?? false, family: current()?.family ?? "phone", deviceType: current()?.deviceType ?? "" };
    if (!current()?.duo) return { width: screen?.width ?? 402, height: screen?.height ?? 874, ...base };
    const cover = { width: screen?.width ?? 466, height: screen?.height ?? 678 }, inner = screen?.inner ?? { width: 951, height: 669 };
    return { ...status?.pose && status.pose !== "closed" ? inner : cover, ...base, duo: { cover, inner } };
  };
  const spec = () => modelSpec(current()?.duo ? DUO_TYPE : current()?.deviceType ?? "", current()?.family ?? "phone");
  function message(text) {
    stage.removeAttribute("aria-busy");
    device?.setMessage(text);
    if (flat) {
      flat.removeAttribute("src");
      flat.alt = text;
    }
  }
  function loading() {
    stage.setAttribute("aria-busy", "true");
    device?.setLoading(true);
    if (flat) {
      flat.removeAttribute("src");
      flat.alt = "Loading display\u2026";
    }
  }
  function say(text) {
    statusLine.textContent = text;
    statusLine.hidden = !text;
  }
  async function ensureView() {
    if (device || flat) return;
    try {
      const { mountDevice3D } = await import("./simulator-3d");
      if (disposed) return;
      device = mountDevice3D(stage, { onGesture: (gesture) => void send(gesture), onButton: (name) => void press(name), onScroll: queueScroll });
      device.setDark(isDark());
    } catch {
      flat = Object.assign(document.createElement("img"), { className: "sim-flat", alt: "" });
      flat.addEventListener("click", (event) => {
        const rect = flat.getBoundingClientRect(), s = shape();
        void send({ kind: "tap", x: (event.clientX - rect.left) / rect.width * s.width, y: (event.clientY - rect.top) / rect.height * s.height });
      });
      stage.append(flat);
      stage.classList.add("sim-stage-flat");
    }
  }
  function render() {
    const chosen = current();
    root.querySelector(".sim-device-name").textContent = chosen?.name ?? (status?.available ? "No simulators" : "Simulator");
    root.querySelector(".sim-device-runtime").textContent = chosen ? `${chosen.runtime} \xB7 ${chosen.state === "Booted" ? "Running" : chosen.state}` : "";
    button("device").title = chosen ? `${chosen.name} \xB7 ${chosen.runtime}` : "";
    const power2 = button("power");
    power2.innerHTML = icon(booted() ? "stop" : "play");
    power2.setAttribute("aria-label", booted() ? "Shut down simulator" : "Boot simulator");
    power2.title = booted() ? "Shut down" : "Boot";
    power2.disabled = !chosen || busy;
    for (const name of ["home", "lock", "appearance", "capture", "back", "recents"]) button(name).disabled = !booted() || busy;
    const android = chosen?.platform === "android";
    button("back").hidden = !android;
    button("recents").hidden = !android;
    button("appearance").innerHTML = icon(appearance === "dark" ? "sun" : "moon");
    const pose = button("pose"), shown = poseName(status?.pose);
    pose.hidden = !chosen?.duo;
    pose.setAttribute("aria-label", `iPhone Duo pose: ${shown}`);
    pose.title = shown;
    pose.disabled = !booted() || busy;
    const look = chosenFinish(spec());
    button("finish").style.setProperty("--finish", look.color);
    button("finish").setAttribute("aria-label", `Device finish: ${look.name}`);
    button("finish").title = look.name;
    button("finish").disabled = !chosen;
    const axeNote = root.querySelector(".sim-axe");
    axeNote.hidden = !status || !status.available || status.axe;
    axeNote.querySelector("code").textContent = status?.axeInstall ?? "";
    if (!status) return;
    if (!status.available) {
      say(isWindows ? NO_SDK : status.error ?? "Install Xcode to use the iOS Simulator.");
      message(isWindows ? "Android SDK needed" : "Xcode needed");
      return;
    }
    if (!chosen) {
      say(isWindows ? "No Android emulators. Add one in Android Studio \u2192 Device Manager." : "No iOS simulators. Add one in Xcode \u2192 Window \u2192 Devices and Simulators.");
      message("");
      return;
    }
    say("");
    device?.setShape(shape());
    if (chosen.duo && status.pose && device?.getPose() !== status.pose) device?.setPose(status.pose, false);
    if (busy) return;
    if (!booted()) message(chosen.state === "Booting" ? "Booting\u2026" : "Press \u25B6 to boot");
  }
  async function refresh() {
    try {
      const view = ensureView();
      let next = await call("simulator_status");
      if (!next.selected && next.devices.length) next = await call("simulator_select", { udid: (next.devices.find((d) => d.state === "Booted") ?? next.devices[0]).udid });
      if (disposed) return;
      const changed = next.selected !== status?.selected;
      status = next;
      if (changed) seq = 0;
      await view;
      render();
      pump();
    } catch (error) {
      say(error instanceof Error ? error.message : String(error));
    }
  }
  function pump() {
    const generation = ++pumpGeneration;
    if (!visible || !booted() || !status?.selected) return;
    const udid = status.selected;
    void (async () => {
      let failures = 0;
      while (!disposed && visible && generation === pumpGeneration) {
        try {
          const data = await host.call("simulator_frame", { udid, after: seq });
          if (generation !== pumpGeneration) return;
          if (data && data.byteLength > 8) {
            seq = Number(new DataView(data).getBigUint64(0, true));
            const blob = new Blob([data.slice(8)]);
            if (device) {
              const bitmap = await createImageBitmap(blob);
              if (generation === pumpGeneration) device.setFrame(bitmap);
              bitmap.close();
            } else if (flat) {
              const url = URL.createObjectURL(blob);
              flat.onload = () => URL.revokeObjectURL(url);
              flat.src = url;
            }
            if (generation === pumpGeneration) stage.removeAttribute("aria-busy");
            failures = 0;
          }
        } catch (error) {
          if (generation !== pumpGeneration) return;
          if (++failures >= 3) {
            message("Screen unavailable");
            say(error instanceof Error ? error.message : String(error));
            await sleep(2e3);
            void refresh();
            return;
          }
          await sleep(500);
        }
      }
    })();
  }
  async function input(value) {
    const udid = status?.selected;
    if (!udid || !booted()) return;
    if (status && !status.axe && current()?.platform !== "android") {
      if (!warnedAxe) {
        warnedAxe = true;
        host.notify(`Touch input needs AXe: ${status.axeInstall}`);
      }
      return;
    }
    try {
      await host.call("simulator_input", { udid, input: value });
    } catch (error) {
      host.notify(error instanceof Error ? error.message : String(error));
    }
  }
  async function send(gesture) {
    stage.focus({ preventScroll: true });
    await flushTyping();
    await input(gesture);
  }
  async function press(name) {
    await input({ kind: "button", button: name });
  }
  function queueScroll(dx, dy, at) {
    if (!scroll.dx && !scroll.dy) scroll.at = at;
    scroll.dx += dx;
    scroll.dy += dy;
    clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      const s = shape(), limit = s.height * 0.38, { dx: sx, dy: sy, at: from } = scroll;
      scroll = { dx: 0, dy: 0, at: { x: 0, y: 0 } };
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const endX = clamp(from.x - clamp(sx, -limit, limit), 1, s.width - 1), endY = clamp(from.y - clamp(sy, -limit, limit), 1, s.height - 1);
      if (Math.hypot(endX - from.x, endY - from.y) >= 8) void input({ kind: "swipe", x: from.x, y: from.y, endX, endY, durationMs: 220 });
    }, SCROLL_DELAY);
  }
  async function flushTyping() {
    clearTimeout(typeTimer);
    const text = typed;
    typed = "";
    if (text) await input({ kind: "type", text });
  }
  stage.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || !booted()) return;
    const named = KEYS[event.key];
    if (named) {
      event.preventDefault();
      void flushTyping().then(() => input({ kind: "key", key: named }));
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      typed += event.key;
      clearTimeout(typeTimer);
      typeTimer = window.setTimeout(() => void flushTyping(), TYPE_DELAY);
    }
  });
  stage.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text/plain");
    if (!text || !booted()) return;
    event.preventDefault();
    typed += text.slice(0, 2e3);
    void flushTyping();
  });
  async function power() {
    const chosen = current();
    if (!chosen || busy) return;
    const on = chosen.state !== "Booted";
    busy = true;
    render();
    message(on ? "Booting\u2026" : "Shutting down\u2026");
    try {
      status = await call("simulator_power", { udid: chosen.udid, on });
      seq = 0;
    } catch (error) {
      host.notify(error instanceof Error ? error.message : String(error));
    } finally {
      busy = false;
      render();
      pump();
    }
  }
  async function capture() {
    const udid = status?.selected;
    if (!udid) return;
    try {
      const png = await host.call("simulator_capture", { udid });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([png], { type: "image/png" }) })]);
      host.notify("Simulator screenshot copied");
    } catch (error) {
      host.notify(error instanceof Error ? error.message : String(error));
    }
  }
  function chooseDevice(anchor) {
    if (!status) return;
    const items = status.devices.map((d) => ({ id: d.udid, label: d.name, description: `${d.duo ? "Foldable \xB7 " : ""}${d.runtime} \xB7 ${d.state === "Booted" ? "Running" : d.state}`, icon: "phone", selected: d.udid === status?.selected }));
    if (status.available && !isWindows && !status.devices.some((d) => d.duo)) items.push({ id: ADD_DUO, label: "Add iPhone Duo", description: status.duoAvailable ? "Foldable \xB7 creates a simulator" : "Needs Xcode 27.1 or later", icon: "plus", disabled: !status.duoAvailable });
    if (!status.android && !isWindows) items.push({ id: SETUP, label: settingUp ? "Setting up Android\u2026" : "Set up Android emulator\u2026", description: "Downloads about 2 GB with Homebrew", icon: "download", disabled: settingUp });
    if (!items.length) return;
    host.choose(anchor, "Devices", items, (id) => {
      if (id === SETUP) {
        void setupAndroid();
        return;
      }
      if (id === ADD_DUO) {
        void addDuo();
        return;
      }
      void call("simulator_select", { udid: id }).then((next) => {
        status = next;
        seq = 0;
        render();
        pump();
      }).catch((error) => host.notify(String(error)));
    });
  }
  async function addDuo() {
    say("Adding iPhone Duo\u2026");
    try {
      status = await call("simulator_create_duo");
      seq = 0;
      say("");
      render();
      pump();
    } catch (error) {
      say("");
      host.notify(error instanceof Error ? error.message : String(error));
    }
  }
  async function setPose(pose) {
    const udid = status?.selected, shown = status?.pose ?? "closed";
    if (!udid || !status || pose === shown) return;
    poseEpoch++;
    poseWanted = pose;
    pumpGeneration++;
    status = { ...status, pose };
    device?.setPose(pose, true);
    render();
    loading();
    if (poseBusy) return;
    poseBusy = true;
    let held = shown;
    try {
      while (poseWanted && !disposed && status?.selected === udid) {
        const target = poseWanted;
        poseWanted = void 0;
        try {
          const next = await call("simulator_pose", { udid, pose: target });
          held = next.pose ?? target;
          if (!poseWanted && !disposed && next.selected === status?.selected) {
            status = next;
            device?.setPose(held, true);
          }
        } catch (error) {
          if (poseWanted) continue;
          if (status?.selected === udid) {
            status = { ...status, pose: held };
            device?.setPose(held, true);
            seq = 0;
          }
          host.notify(error instanceof Error ? error.message : String(error));
        }
      }
    } finally {
      poseBusy = false;
      poseWanted = void 0;
      render();
      pump();
    }
  }
  function watchPose() {
    clearInterval(poll);
    poll = 0;
    if (!visible || disposed) return;
    poll = window.setInterval(async () => {
      if (polling || poseBusy || !visible || disposed || !current()?.duo || !booted()) return;
      polling = true;
      const epoch = poseEpoch;
      try {
        const next = await call("simulator_status");
        if (disposed || poseBusy || epoch !== poseEpoch || next.selected !== status?.selected || !next.pose || next.pose === device?.getPose()) return;
        status = next;
        device?.setPose(next.pose, true);
        render();
        loading();
        pump();
      } catch {
      } finally {
        polling = false;
      }
    }, 3e3);
  }
  async function setupAndroid() {
    if (settingUp) return;
    settingUp = true;
    say("Setting up the Android emulator\u2026");
    const stop = await host.listen?.("android-setup", (event) => {
      if (!event.done) say(`Android setup ${event.step}/${event.total} \xB7 ${event.label}`);
    });
    try {
      const avd = await host.call("android_setup");
      host.notify("Android emulator ready");
      say("");
      await refresh();
      status = await call("simulator_select", { udid: `android:${avd}` });
      seq = 0;
      render();
      pump();
    } catch (error) {
      say(error instanceof Error ? error.message : String(error));
    } finally {
      settingUp = false;
      stop?.();
    }
  }
  root.addEventListener("click", (event) => {
    const target = event.target.closest("[data-sim]");
    if (!target || target.disabled) return;
    switch (target.dataset.sim) {
      case "device":
        chooseDevice(target);
        break;
      case "power":
        void power();
        break;
      case "home":
        void press("home");
        break;
      case "back":
        void press("back");
        break;
      case "recents":
        void press("recents");
        break;
      case "lock":
        void press("lock");
        break;
      case "appearance": {
        const udid = status?.selected;
        if (!udid) break;
        appearance = appearance === "dark" ? "light" : "dark";
        render();
        void host.call("simulator_appearance", { udid, mode: appearance }).catch((error) => host.notify(String(error)));
        break;
      }
      case "capture":
        void capture();
        break;
      case "pose": {
        const now = status?.pose ?? "closed";
        host.choose(target, "iPhone Duo pose", POSES.map((p) => ({ id: p.id, label: p.label, description: p.description, icon: "phone", selected: p.id === now })), (id) => void setPose(id));
        break;
      }
      case "reset":
        device?.resetView(true);
        break;
      case "finish": {
        const model = spec(), now = chosenFinish(model);
        host.choose(target, "Finish", model.finishes.map((finish) => ({ id: finish.id, label: finish.name, icon: "circle", selected: finish.id === now.id })), (id) => {
          const finish = model.finishes.find((item) => item.id === id);
          if (!finish) return;
          rememberFinish(model, finish);
          device?.setFinish(finish);
          render();
        });
        break;
      }
      case "copy-axe":
        void navigator.clipboard.writeText(status?.axeInstall ?? "").then(() => host.notify("Install command copied"));
        break;
    }
  });
  const themeWatch = new MutationObserver(() => device?.setDark(isDark()));
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return {
    show() {
      if (visible) return;
      visible = true;
      watchPose();
      device?.setActive(true);
      void refresh().then(() => device?.setActive(visible));
    },
    hide() {
      visible = false;
      clearInterval(poll);
      pumpGeneration++;
      device?.setActive(false);
    },
    refresh,
    dispose() {
      disposed = true;
      visible = false;
      clearInterval(poll);
      pumpGeneration++;
      themeWatch.disconnect();
      clearTimeout(typeTimer);
      clearTimeout(scrollTimer);
      device?.dispose();
      root.replaceChildren();
    }
  };
}
export {
  mountSimulator
};
