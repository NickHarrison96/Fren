import { escape, icon } from "./dom.ts";
const PREFIX = "cloud:";
const SETUP_CHOICE = "cloud-setup";
const CLOUD_HARNESSES = ["claude", "glm", "mimo", "codex", "opencode"];
const BUSY = /* @__PURE__ */ new Set(["creating", "installing", "credentials", "uploading", "running", "reconnecting", "syncing"]);
const CLOUD_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.5 4.5 0 0 0 7 18Z"/></svg>';
const cloudChoice = (provider) => PREFIX + provider;
const cloudProvider = (choice) => choice.startsWith(PREFIX) ? choice.slice(PREFIX.length) : void 0;
const cloudIcon = () => CLOUD_ICON;
function cloudItems(targets, chosen) {
  return [
    ...targets.filter((target) => target.ready).map((target) => ({ id: cloudChoice(target.provider), label: `Cloud \xB7 ${target.label}`, leading: CLOUD_ICON, selected: chosen === cloudChoice(target.provider) })),
    { id: SETUP_CHOICE, label: "Set up cloud providers\u2026", icon: "settings" }
  ];
}
function harnessRefusal(harness, name) {
  return CLOUD_HARNESSES.includes(harness) ? "" : `${name} can\u2019t run on a cloud machine yet. Choose Claude Code, GLM, MiMo, Codex or OpenCode.`;
}
function installing(harness) {
  return harness === "codex" ? "Codex" : harness === "opencode" ? "OpenCode" : "Claude Code";
}
function stageText(stage, detail, harness) {
  switch (stage) {
    case "creating":
      return "Creating machine";
    case "installing":
      return `Installing ${installing(harness)}`;
    case "credentials":
      return "Copying logins";
    case "uploading":
      return "Uploading checkout";
    case "ready":
      return "Ready";
    case "running":
      return "Running";
    case "reconnecting":
      return "Reconnecting\u2026";
    case "syncing":
      return "Syncing changes";
    case "stopped":
      return "Stopped";
    case "error":
      return `Error: ${detail || "the machine could not be prepared"}`;
  }
}
const busyStage = (stage) => BUSY.has(stage);
function cloudChip(session) {
  const cloud = session.cloud, label = escape(cloud.label), stage = escape(stageText(cloud.stage, cloud.detail, session.provider));
  return `<span class="composer-computer composer-computer-fixed" aria-label="Computer: ${label} cloud machine (fixed for this task) \xB7 ${stage}" title="This task runs on a ${label} cloud machine. ${stage}.">${CLOUD_ICON}<span>on ${label}</span></span>`;
}
function cloudStrip(session) {
  const cloud = session.cloud;
  if (!cloud) return "";
  const text = stageText(cloud.stage, cloud.detail, session.provider);
  const lead = busyStage(cloud.stage) ? '<span class="support-spinner" aria-hidden="true"></span>' : CLOUD_ICON;
  return `<div class="cloud-strip" data-stage="${cloud.stage}"><span class="cloud-strip-status" role="status">${lead}<span class="cloud-strip-text">${escape(cloud.label)} \xB7 ${escape(text)}</span></span><button type="button" id="cloud-menu" class="cloud-strip-menu" data-action="cloud-menu" aria-haspopup="dialog" aria-expanded="false" aria-label="Cloud machine actions" title="Cloud machine actions">${icon("more")}</button></div>`;
}
function cloudActionItems(session) {
  const stage = session.cloud?.stage;
  return [
    { id: "sync", label: "Sync changes", icon: "refresh", disabled: stage === "syncing" },
    ...stage === "error" ? [{ id: "retry", label: "Retry", icon: "refresh" }] : [],
    { id: "open", label: "Open machine", icon: "monitor" },
    { id: "stop", label: "Stop machine", icon: "stop", disabled: stage === "stopped" },
    { id: "delete", label: "Delete machine\u2026", icon: "trash", danger: true }
  ];
}
function deleteMachineDialog(session) {
  return `<form id="cloud-delete-form"><p class="dialog-description">Delete this task\u2019s ${escape(session.cloud?.label ?? "cloud")} machine? Its files there are lost; the task stays and creates a new machine with your next message.</p><div class="dialog-footer"><button type="button" class="secondary-button" data-action="close-dialog">Cancel</button><button type="submit" class="secondary-button delete-task-confirm">Delete machine</button></div></form>`;
}
export {
  CLOUD_HARNESSES,
  SETUP_CHOICE,
  busyStage,
  cloudActionItems,
  cloudChip,
  cloudChoice,
  cloudIcon,
  cloudItems,
  cloudProvider,
  cloudStrip,
  deleteMachineDialog,
  harnessRefusal,
  stageText
};
