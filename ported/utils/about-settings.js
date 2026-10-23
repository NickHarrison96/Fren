import { preview } from "./bridge";
import { icon } from "./dom";
import { appUpdates, describeUpdate } from "./app-updates";
const PROJECT_LINKS = {
  repository: "https://github.com/aicodeking/pandacode",
  issues: "https://github.com/aicodeking/pandacode/issues",
  releases: "https://github.com/aicodeking/pandacode/releases",
  license: "https://github.com/aicodeking/pandacode/blob/main/LICENSE"
};
const link = (label, url) => `<button type="button" class="secondary-button" data-action="open-url" data-url="${url}">${label}${icon("forward")}</button>`;
function aboutSettingsHtml() {
  return `<div class="settings-group settings-about" aria-labelledby="settings-about-heading">
    <div class="setting-row"><div><strong id="settings-about-heading">About PandaCode</strong><small class="settings-about-version">Version \u2026</small></div></div>
    <div class="setting-row"><div><strong>License</strong><small>Open source (MIT-based). No account, no telemetry.</small></div>${link("PandaCode License", PROJECT_LINKS.license)}</div>
    <div class="setting-row settings-updates"><div><strong>Updates</strong><small class="settings-update-status" aria-live="polite">Checks GitHub Releases automatically.</small></div><div class="settings-row-actions"><button type="button" class="secondary-button settings-update-action" hidden></button>${link("Releases", PROJECT_LINKS.releases)}</div></div>
    <div class="setting-row settings-updates-auto"><div><strong>Install updates automatically</strong><small>Downloads in the background and restarts when no agent is working.</small></div><input type="checkbox" class="settings-switch" data-update-automatic aria-label="Install updates automatically"></div>
    <div class="setting-row"><div><strong>Source code</strong><small>Report bugs and follow development.</small></div><div class="settings-row-actions">${link("GitHub repository", PROJECT_LINKS.repository)}${link("Issues", PROJECT_LINKS.issues)}</div></div>
  </div>`;
}
async function appVersion() {
  if (preview) return "Preview";
  return (await import("@tauri-apps/api/app")).getVersion();
}
function mountAboutSettings(host) {
  const version = host.querySelector(".settings-about-version");
  let disposed = false;
  const cleanupUpdates = mountUpdates(host);
  if (version) {
    appVersion().then((value) => {
      if (!disposed) version.textContent = `Version ${value}`;
    }).catch(() => {
      if (!disposed) version.textContent = "Version unavailable";
    });
  }
  return () => {
    disposed = true;
    cleanupUpdates();
  };
}
function mountUpdates(host) {
  const updates = appUpdates();
  const status = host.querySelector(".settings-update-status");
  const action = host.querySelector(".settings-update-action");
  const auto = host.querySelector("[data-update-automatic]");
  if (!updates?.supported) {
    status.textContent = describeUpdate({ kind: "off" }, false);
    host.querySelector(".settings-updates-auto")?.remove();
    return () => {
    };
  }
  const paint = () => {
    const state = updates.state;
    status.textContent = describeUpdate(state, updates.automatic);
    auto.checked = updates.automatic;
    const restartable = state.kind === "ready" || state.kind === "available";
    action.hidden = state.kind === "downloading" || state.kind === "installing";
    action.disabled = state.kind === "checking";
    action.textContent = restartable ? state.kind === "ready" ? "Restart now" : "Install" : "Check now";
  };
  const click = () => {
    void (updates.state.kind === "ready" || updates.state.kind === "available" ? updates.restart() : updates.check());
  };
  const change = () => updates.setAutomatic(auto.checked);
  action.addEventListener("click", click);
  auto.addEventListener("change", change);
  const unsubscribe = updates.subscribe(paint);
  paint();
  return () => {
    unsubscribe();
    action.removeEventListener("click", click);
    auto.removeEventListener("change", change);
  };
}
export {
  PROJECT_LINKS,
  aboutSettingsHtml,
  mountAboutSettings
};
