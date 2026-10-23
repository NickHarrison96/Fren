import { call, preview } from "./bridge";
import { CHECK_EVERY, readyToRestart } from "./app-updates-policy";
import { describeUpdate } from "./app-updates-policy";
const KEY = "pandacode.autoUpdate";
const FIRST_CHECK = 3e4;
let instance;
const appUpdates = () => instance;
function startAppUpdates(host) {
  const listeners = /* @__PURE__ */ new Set();
  let state = preview ? { kind: "off" } : { kind: "idle" };
  let automatic = (() => {
    try {
      return localStorage.getItem(KEY) !== "off";
    } catch {
      return true;
    }
  })();
  let pending = null, lastCheck = 0, lastInput = Date.now(), checking = null;
  const set = (next) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const message = (cause) => cause instanceof Error ? cause.message : String(cause);
  async function download(update) {
    let total = 0, received = 0;
    set({ kind: "downloading", version: update.version, percent: null });
    await update.download((event) => {
      if (event.event === "Started") total = event.data?.contentLength ?? 0;
      if (event.event === "Progress") {
        received += event.data?.chunkLength ?? 0;
        if (total) set({ kind: "downloading", version: update.version, percent: Math.min(100, Math.round(received / total * 100)) });
      }
    });
    set({ kind: "ready", version: update.version });
  }
  async function run() {
    if (preview || state.kind === "downloading" || state.kind === "ready" || state.kind === "installing") return;
    lastCheck = Date.now();
    set({ kind: "checking" });
    try {
      const { check: check2 } = await import("@tauri-apps/plugin-updater");
      const update = await check2();
      if (!update) {
        set({ kind: "current", checkedAt: Date.now() });
        return;
      }
      pending = update;
      if (automatic) await download(update);
      else set({ kind: "available", version: update.version });
    } catch (cause) {
      set({ kind: "error", message: message(cause) });
    }
  }
  const check = () => checking ?? (checking = run().finally(() => {
    checking = null;
  }));
  async function localSign() {
    try {
      await call("local_sign_app");
    } catch (cause) {
      console.warn("Local signing failed:", cause);
    }
  }
  async function restart() {
    if (!pending) return;
    if (host.busy()) {
      host.notify("PandaCode will restart to update when your agents finish.");
      return;
    }
    if (state.kind === "available") {
      try {
        await download(pending);
      } catch (cause) {
        set({ kind: "error", message: message(cause) });
        return;
      }
    }
    const version = pending.version;
    set({ kind: "installing", version });
    try {
      await localSign();
      await pending.install();
      await localSign();
      await (await import("@tauri-apps/plugin-process")).relaunch();
    } catch (cause) {
      set({ kind: "error", message: message(cause) });
    }
  }
  if (!preview) {
    const input = () => {
      lastInput = Date.now();
    };
    for (const name of ["pointerdown", "keydown", "wheel"]) addEventListener(name, input, { passive: true, capture: true });
    window.setTimeout(() => {
      if (automatic) void check();
    }, FIRST_CHECK);
    window.setInterval(() => {
      if (automatic && Date.now() - lastCheck >= CHECK_EVERY) void check();
      if (automatic && state.kind === "ready" && readyToRestart(host.busy(), lastInput)) void restart();
    }, 3e4);
  }
  instance = {
    get state() {
      return state;
    },
    get automatic() {
      return automatic;
    },
    supported: !preview,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setAutomatic(on) {
      automatic = on;
      try {
        localStorage.setItem(KEY, on ? "on" : "off");
      } catch {
      }
      if (on && state.kind !== "ready") void check();
      listeners.forEach((listener) => listener());
    },
    check,
    restart
  };
  return instance;
}
export {
  appUpdates,
  describeUpdate,
  startAppUpdates
};
