import { escape, icon } from "./dom";
import { cloudChip, cloudItems, cloudProvider } from "./cloud-agents";
const LOCAL = "local";
const CONNECT_SETUP = "connect-setup";
function computerControl(session, fresh, targets, chosen, clouds = []) {
  if (session.cloud) return cloudChip(session);
  if (session.remoteDevice) {
    const name2 = escape(session.remoteDevice.name);
    return `<span class="composer-computer composer-computer-fixed" aria-label="Computer: ${name2} (fixed for this task)" title="This task runs on ${name2}. Start a new task to use another computer.">${icon("monitor")}<span>on ${name2}</span></span>`;
  }
  if (!fresh) return "";
  const cloud = clouds.find((item) => item.provider === cloudProvider(chosen));
  const name = cloud ? `Cloud \xB7 ${cloud.label}` : targets.find((target) => target.deviceId === chosen)?.name ?? "This computer";
  return `<button type="button" id="composer-computer" class="composer-computer" data-action="computer-menu" aria-label="Computer: ${escape(name)}" aria-haspopup="dialog" aria-expanded="false" title="Where this task runs">${icon("monitor")}<span>${escape(name)}</span>${icon("down")}</button>`;
}
function computerItems(targets, chosen, clouds = []) {
  return [
    { id: LOCAL, label: "This computer", icon: "monitor", selected: chosen === LOCAL },
    ...targets.map((target) => ({ id: target.deviceId, label: target.name, description: target.online ? target.platform : "Offline", icon: "monitor", selected: target.deviceId === chosen, disabled: !target.online })),
    ...targets.length ? [] : [{ id: CONNECT_SETUP, label: "Set up other computers\u2026", icon: "settings" }],
    ...cloudItems(clouds, chosen)
  ];
}
function behindText(check) {
  const reasons = [
    check.ahead > 0 ? `${check.ahead} unpushed ${check.ahead === 1 ? "commit" : "commits"}` : "",
    check.dirty ? "uncommitted changes" : "",
    check.pushed ? "" : `branch ${check.branch} not pushed`
  ].filter(Boolean);
  return reasons.length ? `GitHub is behind this computer: ${reasons.join(", ")}.` : "";
}
function behindDialog(name, check) {
  return `<form id="remote-behind-form"><p class="dialog-description">${escape(behindText(check))} ${escape(name)} will start from GitHub\u2019s ${escape(check.branch)}.</p><div class="dialog-footer"><button type="button" class="secondary-button" data-action="close-dialog">Cancel</button><button type="submit" class="primary-button">Continue</button></div></form>`;
}
export {
  CONNECT_SETUP,
  LOCAL,
  behindDialog,
  behindText,
  computerControl,
  computerItems
};
