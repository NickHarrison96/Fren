import { teamActive } from "./architect-types";
import { icon } from "./dom";
import { providerLogo } from "./provider-logos";
import { fallbackModel } from "./model-catalog";
const pending = (worker) => !worker.abandoned && ["running", "waiting", "queued"].includes(worker.status);
const workerLabels = {
  running: "Working",
  waiting: "Needs attention",
  queued: "Queued",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped"
};
function text(root, selector, value) {
  const element = root.querySelector(selector);
  if (element.textContent !== value) element.textContent = value;
}
function updateTeamProgress(host, team, providers, only, needsInput = () => false) {
  const spawned = only ?? team?.workers ?? [];
  const visible = spawned.length > 0;
  host.hidden = !visible;
  if (!team || !visible) {
    host.replaceChildren();
    return false;
  }
  let list = host.querySelector(".team-progress");
  if (!list || list.dataset.sessionId !== team.sessionId) {
    list = document.createElement("section");
    list.className = "team-progress";
    list.setAttribute("aria-label", "Team progress");
    list.dataset.sessionId = team.sessionId;
    list.innerHTML = '<button type="button" class="team-progress-more" data-action="open-team-progress" hidden></button>';
    host.replaceChildren(list);
  }
  list.dataset.status = team.status;
  const active = spawned.filter((worker) => pending(worker) && worker.status !== "queued");
  const queued = spawned.filter((worker) => pending(worker) && worker.status === "queued");
  const settled = spawned.filter((worker) => !pending(worker)).slice().reverse();
  const visibleIds = new Set([...active, ...queued, ...settled].slice(0, 6).map((worker) => worker.id));
  const workers = spawned.filter((worker) => visibleIds.has(worker.id));
  const rows = new Map([...list.querySelectorAll(".team-progress-worker")].map((row) => [row.dataset.workerId, row]));
  for (const [id, row] of rows) if (!visibleIds.has(id)) row.remove();
  workers.forEach((worker, index) => {
    let row = rows.get(worker.id);
    if (!row) {
      row = document.createElement("button");
      row.type = "button";
      row.className = "team-progress-worker";
      row.dataset.action = "open-team-worker";
      row.dataset.workerId = worker.id;
      row.innerHTML = `<span class="team-progress-logo"></span><span class="team-progress-description"><span class="team-progress-verb">Spawned</span> <strong></strong> <small></small></span><span class="team-progress-spinner" aria-hidden="true"></span><span class="team-progress-status"></span>${icon("chevron")}`;
    }
    if (row !== list.children[index]) list.insertBefore(row, list.children[index] ?? null);
    const profile = team.config.workers.find((profile2) => profile2.id === worker.profileId);
    const provider = providers.find((provider2) => provider2.id === worker.provider);
    const model = provider?.models.find((model2) => model2.id === worker.model)?.name ?? fallbackModel(worker.provider, worker.model).name;
    const harness = provider?.name ?? worker.provider;
    const detail = [...new Set([profile?.name !== worker.name ? profile?.name ?? "" : "", model].flatMap((part) => part.split(" \xB7 ")).map((part) => part.trim()))].filter((part) => part && part !== harness && part !== worker.name);
    const status = worker.abandoned ? "Skipped" : !teamActive(team) && pending(worker) ? "Paused" : worker.status === "running" && needsInput(worker.sessionId) ? "Needs attention" : workerLabels[worker.status];
    text(row, ".team-progress-description strong", worker.name);
    text(row, ".team-progress-description small", detail.join(" \xB7 "));
    text(row, ".team-progress-status", status);
    row.dataset.status = status;
    row.title = worker.assignment;
    if (row.dataset.provider !== worker.provider) {
      row.querySelector(".team-progress-logo").innerHTML = providerLogo(worker.provider);
      row.dataset.provider = worker.provider;
    }
  });
  const more = list.querySelector(".team-progress-more");
  const remaining = spawned.length - workers.length;
  more.hidden = remaining === 0;
  text(list, ".team-progress-more", remaining ? `${remaining} more ${remaining === 1 ? "worker" : "workers"}` : "");
  if (more !== list.lastElementChild) list.append(more);
  return true;
}
export {
  updateTeamProgress
};
