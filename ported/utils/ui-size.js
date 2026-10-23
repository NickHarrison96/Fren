import "./ui-size.css";
import { preview } from "./bridge";
import { commandKey } from "./platform";
const preferenceKey = "pandacode.uiScale";
const minimum = 0.8, maximum = 1.6, step = 0.1;
let scale = 1;
try {
  const saved = Number(localStorage.getItem(preferenceKey));
  if (Number.isFinite(saved) && saved >= minimum && saved <= maximum) scale = Math.round(saved * 10) / 10;
} catch {
}
apply();
function apply() {
  document.documentElement.style.setProperty("--ui-scale", String(preview ? scale : 1));
  document.documentElement.style.setProperty("--page-zoom", String(pageZoom()));
  if (preview) return;
  void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) => getCurrentWebview().setZoom(scale)).catch((cause) => console.error("Setting the interface size failed", cause));
}
function uiScale() {
  return scale;
}
function pageZoom() {
  return preview ? 1 : scale;
}
function textScale() {
  return preview ? scale : 1;
}
function setUiScale(value) {
  if (!Number.isFinite(value)) return;
  const next = Math.min(maximum, Math.max(minimum, Math.round(value * 10) / 10));
  if (next === scale) return;
  scale = next;
  apply();
  try {
    localStorage.setItem(preferenceKey, String(scale));
  } catch {
  }
  document.querySelectorAll("[data-ui-size-value]").forEach((output) => {
    output.value = `${Math.round(scale * 100)}%`;
  });
  document.querySelectorAll('[data-action="ui-size-decrease"]').forEach((button) => {
    button.disabled = scale === minimum;
  });
  document.querySelectorAll('[data-action="ui-size-increase"]').forEach((button) => {
    button.disabled = scale === maximum;
  });
  window.dispatchEvent(new Event("pandacode-ui-scale-change"));
  window.dispatchEvent(new Event("resize"));
}
function changeUiScale(direction) {
  setUiScale(scale + direction * step);
}
function uiSizeControls() {
  const modifier = commandKey;
  return `<div class="setting-row text-size-setting"><div><strong>Interface size</strong><small>${modifier} + / \u2212 to resize \xB7 ${modifier} 0 to reset</small></div><div class="text-size-controls" role="group" aria-label="Interface size"><button type="button" data-action="ui-size-decrease" aria-label="Decrease interface size" title="Decrease interface size (${modifier} \u2212)" ${scale === minimum ? "disabled" : ""}>A\u2212</button><output data-ui-size-value aria-label="Current interface size" aria-live="polite">${Math.round(scale * 100)}%</output><button type="button" data-action="ui-size-increase" aria-label="Increase interface size" title="Increase interface size (${modifier} +)" ${scale === maximum ? "disabled" : ""}>A+</button><button type="button" class="text-size-reset" data-action="ui-size-reset" aria-label="Reset interface size" title="Reset interface size (${modifier} 0)">Reset</button></div></div>`;
}
function initializeUiSizing() {
  const onKeyDown = (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing || event.defaultPrevented) return;
    const direction = event.key === "+" || event.key === "=" ? 1 : event.key === "-" ? -1 : 0;
    if (!direction && event.key !== "0") return;
    event.preventDefault();
    event.stopPropagation();
    if (direction) changeUiScale(direction);
    else setUiScale(1);
  };
  document.addEventListener("keydown", onKeyDown, true);
  return () => document.removeEventListener("keydown", onKeyDown, true);
}
export {
  changeUiScale,
  initializeUiSizing,
  pageZoom,
  setUiScale,
  textScale,
  uiScale,
  uiSizeControls
};
