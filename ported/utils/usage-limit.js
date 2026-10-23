import { escape, icon } from "./dom";
const time = new Intl.DateTimeFormat(void 0, { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat(void 0, { weekday: "short", hour: "numeric", minute: "2-digit" });
function limitActive(task, now = Date.now()) {
  return Boolean(task.limitedAt) && (task.limitedUntil == null || task.limitedUntil > now);
}
function resetLabel(until, now = Date.now()) {
  if (!until) return "Reset time not reported";
  const sameDay = new Date(until).toDateString() === new Date(now).toDateString();
  return `Resets ${(sameDay ? time : day).format(until)}`;
}
function limitBanner(task, now = Date.now()) {
  if (!task.limitedAt) return "";
  const passed = task.limitedUntil != null && task.limitedUntil <= now;
  const status = passed ? "The usage limit has reset" : `Usage limit reached \xB7 ${resetLabel(task.limitedUntil, now)}`;
  const toggle = task.limitedUntil && !passed ? `<label class="limit-resume"><input type="checkbox" class="limit-resume-switch" ${task.resumeAtReset ? "checked" : ""}><span>Resume at reset</span></label>` : "";
  return `<section class="limit-banner" aria-label="Usage limit" data-passed="${passed}">${icon("alert")}<span class="limit-status" role="status">${escape(status)}</span>${toggle}
    <button type="button" class="limit-continue" data-action="limit-continue">Continue now</button><button type="button" class="icon-button" data-action="limit-dismiss" aria-label="Dismiss usage limit" title="Dismiss">${icon("close")}</button></section>`;
}
export {
  limitActive,
  limitBanner,
  resetLabel
};
