const CLASSIC_KEY = "pandacode.teamClassic";
const TEAM_MODE_EVENT = "pandacode:team-mode";
const TEAM_MODELS_MAX = 24;
function classicTeamSetup() {
  try {
    return localStorage.getItem(CLASSIC_KEY) === "true";
  } catch {
    return false;
  }
}
function setClassicTeamSetup(on) {
  try {
    localStorage.setItem(CLASSIC_KEY, String(on));
  } catch {
  }
  window.dispatchEvent(new CustomEvent(TEAM_MODE_EVENT, { detail: on }));
}
const modelKey = (model) => `${model.provider}:${model.model}`;
function rosterId(model, taken) {
  const base = `${model.provider}-${model.model || "default"}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || model.provider;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}
function namedTeamSetup(name, lead, models, limits) {
  const taken = /* @__PURE__ */ new Set();
  const workers = models.map((model) => {
    const id = rosterId(model, taken);
    taken.add(id);
    return { id, name: `${model.name} \xB7 ${model.harness}`.slice(0, 80), provider: model.provider, model: model.model, reasoningEffort: model.reasoningEffort || null };
  });
  const architect = { provider: lead.provider, model: lead.model, reasoningEffort: lead.reasoningEffort || null };
  const config = { auto: true, rosterOnly: true, name: name.trim(), workers, maxParallel: limits?.maxParallel ?? 0, maxRounds: limits?.maxRounds ?? 8, maxAssignments: limits?.maxAssignments ?? 24, workspace: "shared", summaryLimit: limits?.summaryLimit ?? 3072, ...limits?.leadGuidance ? { leadGuidance: limits.leadGuidance } : {} };
  return { architect, config };
}
const selectionKey = (model) => [model.provider, model.model, model.reasoningEffort ?? null];
function sameTeamSetup(left, right) {
  const key = (setup) => JSON.stringify([
    selectionKey(setup.architect),
    setup.config.workers.map((worker) => [worker.id, worker.name, ...selectionKey(worker)]),
    setup.config.maxParallel,
    setup.config.maxRounds,
    setup.config.maxAssignments,
    setup.config.workspace,
    setup.config.summaryLimit,
    setup.config.leadGuidance?.trim() || null
  ]);
  return key(left) === key(right);
}
const namedTeams = (library) => library.profiles.filter((profile) => profile.setup.config.rosterOnly);
function teamDetail(profile, harnessName) {
  const { architect, config } = profile.setup;
  const lead = config.workers.find((worker) => worker.provider === architect.provider && worker.model === architect.model);
  const count = config.workers.length;
  return `${count} model${count === 1 ? "" : "s"} \xB7 led by ${lead ? lead.name : `${architect.model || "Default"} \xB7 ${harnessName(architect.provider)}`}`;
}
function isTeam(config, profile) {
  return Boolean(config?.rosterOnly && config.name === profile.setup.config.name && JSON.stringify(config.workers) === JSON.stringify(profile.setup.config.workers));
}
export {
  TEAM_MODELS_MAX,
  TEAM_MODE_EVENT,
  classicTeamSetup,
  isTeam,
  modelKey,
  namedTeamSetup,
  namedTeams,
  sameTeamSetup,
  setClassicTeamSetup,
  teamDetail
};
