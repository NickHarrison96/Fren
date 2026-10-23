import { workerQueueReason } from "./worker-scheduling.ts";
const storageKey = "pandacode.preview.architect-configs";
const libraryKey = "pandacode.preview.architect-library";
const sampleNotice = "Browser preview \u2014 sample output only. No model, command, or file operation is running.";
function boundedSummary(text, limit) {
  const bytes = new TextEncoder().encode(text);
  let end = Math.min(bytes.length, limit);
  while (end > 0 && end < bytes.length && (bytes[end] & 192) === 128) end--;
  return new TextDecoder().decode(bytes.subarray(0, end));
}
function createPreviewArchitect(host) {
  const teams = /* @__PURE__ */ new Map();
  const configs = /* @__PURE__ */ new Map();
  let library = { enabled: false, lastSetup: null, activeProfileId: null, profiles: [] };
  function integer(value, low, high, label) {
    if (!Number.isInteger(value) || Number(value) < low || Number(value) > high) throw new Error(`${label} must be between ${low} and ${high}.`);
    return Number(value);
  }
  function validateSelection(selection) {
    if (!selection || !["claude", "codex", "kimi", "opencode", "glm", "antigravity", "grok", "mimo", "pi", "deepseek", "commandcode", "cline", "omp", "github-copilot", "muse"].includes(selection.provider) || typeof selection.model !== "string" || selection.model.length > 200) throw new Error("Choose a valid architect harness and model.");
    const models = host.models(selection.provider);
    const model = selection.model ? models.find((model2) => model2.id === selection.model) : models[0];
    if (selection.reasoningEffort != null && (typeof selection.reasoningEffort !== "string" || selection.reasoningEffort.length > 32 || model && !model.reasoningEfforts?.some((effort) => effort.id === selection.reasoningEffort))) throw new Error("This architect model does not support that reasoning effort.");
    return { provider: selection.provider, model: selection.model, reasoningEffort: selection.reasoningEffort ?? null };
  }
  function parentSelection(parent) {
    return { provider: parent.provider, model: parent.model, reasoningEffort: parent.reasoningEffort ?? null };
  }
  function validateSetup(setup) {
    if (!setup) throw new Error("Choose an architect and worker setup.");
    return { architect: validateSelection(setup.architect), config: validate(setup.config) };
  }
  function profileName(value) {
    if (typeof value !== "string" || !value.trim() || [...value.trim()].length > 80 || /[\u0000-\u001f\u007f-\u009f]/u.test(value.trim())) throw new Error("Profile names must be 1\u201380 characters.");
    return value.trim();
  }
  function validate(config) {
    const [min, max] = config?.auto ? [0, 24] : [1, 6];
    if (!config || !Array.isArray(config.workers) || config.workers.length < min || config.workers.length > max) throw new Error(config?.auto ? "Auto teams list at most 24 models." : "Add between 1 and 6 worker profiles.");
    const ids = /* @__PURE__ */ new Set();
    const workers = config.workers.map((profile) => {
      if (!profile || typeof profile.id !== "string" || !profile.id.trim() || profile.id.length > 100 || ids.has(profile.id)) throw new Error("Worker profile IDs must be unique.");
      ids.add(profile.id);
      if (typeof profile.name !== "string" || !profile.name.trim() || profile.name.length > 80) throw new Error("Worker names must be 1\u201380 characters.");
      if (!["claude", "codex", "kimi", "opencode", "glm", "antigravity", "grok", "mimo", "pi", "deepseek", "commandcode", "cline", "omp", "github-copilot", "muse"].includes(profile.provider) || typeof profile.model !== "string" || profile.model.length > 200) throw new Error("Choose a valid worker harness and model.");
      const models = host.models(profile.provider);
      const model = profile.model ? models.find((model2) => model2.id === profile.model) : models[0];
      if (profile.reasoningEffort != null && (typeof profile.reasoningEffort !== "string" || profile.reasoningEffort.length > 32 || model && !model.reasoningEfforts?.some((effort) => effort.id === profile.reasoningEffort))) throw new Error("This worker model does not support that reasoning effort.");
      return { id: profile.id, name: profile.name.trim(), provider: profile.provider, model: profile.model, reasoningEffort: profile.reasoningEffort ?? null };
    });
    if (config.workspace !== "shared") throw new Error("Workers must use the task\u2019s shared workspace.");
    if (config.rosterOnly && (!config.auto || !workers.length)) throw new Error("A named agent team needs at least one model.");
    if (config.name != null && (typeof config.name !== "string" || !config.name.trim() || config.name.length > 80)) throw new Error("Team names must be 1\u201380 characters.");
    const guidance = typeof config.leadGuidance === "string" ? config.leadGuidance.trim() : "";
    if (new TextEncoder().encode(guidance).length > 2e3) throw new Error("Lead guidance must be under 2000 bytes.");
    return { ...config.auto ? { auto: true } : {}, ...config.rosterOnly ? { rosterOnly: true } : {}, ...config.name != null ? { name: config.name } : {}, ...guidance ? { leadGuidance: guidance } : {}, workers, maxParallel: integer(config.maxParallel, 0, Number.MAX_SAFE_INTEGER, "Parallel workers"), maxRounds: integer(config.maxRounds, 1, 20, "Review rounds"), maxAssignments: integer(config.maxAssignments, 1, 50, "Assignments"), workspace: "shared", summaryLimit: integer(config.summaryLimit, 512, 6e3, "Summary limit") };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      for (const [sessionId, config] of Object.entries(saved).slice(0, 100)) {
        try {
          host.parent(sessionId);
          configs.set(sessionId, validate(config));
        } catch {
        }
      }
    }
  } catch {
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(configs)));
    } catch {
    }
  }
  function persistLibrary() {
    try {
      localStorage.setItem(libraryKey, JSON.stringify(library));
    } catch {
    }
  }
  try {
    const raw = localStorage.getItem(libraryKey);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      const lastSetup = saved.lastSetup ? validateSetup(saved.lastSetup) : null;
      const profiles2 = [], ids = /* @__PURE__ */ new Set(), names = /* @__PURE__ */ new Set();
      for (const profile of Array.isArray(saved.profiles) ? saved.profiles.slice(0, 20) : []) {
        try {
          const name = profileName(profile.name), key = name.toLowerCase();
          if (typeof profile.id !== "string" || !profile.id || ids.has(profile.id) || names.has(key)) continue;
          const setup = validateSetup(profile.setup);
          profiles2.push({ id: profile.id, name, setup, updatedAt: Number.isFinite(profile.updatedAt) ? profile.updatedAt : 0 });
          ids.add(profile.id);
          names.add(key);
        } catch {
        }
      }
      library = { enabled: saved.enabled === true && lastSetup !== null, lastSetup, profiles: profiles2, activeProfileId: profiles2.some((profile) => profile.id === saved.activeProfileId) ? saved.activeProfileId : null };
    } else if (configs.size) {
      const newest = [...configs].sort(([a], [b]) => host.parent(b).updatedAt - host.parent(a).updatedAt)[0];
      library = { enabled: true, lastSetup: validateSetup({ architect: parentSelection(host.parent(newest[0])), config: newest[1] }), activeProfileId: null, profiles: [] };
      persistLibrary();
    }
  } catch {
  }
  function profiles() {
    return structuredClone(library);
  }
  function setLeadGuidance(guidance) {
    const text = typeof guidance === "string" ? guidance.trim() : "";
    if (new TextEncoder().encode(text).length > 2e3 || text.includes("\0")) throw new Error("Lead guidance must be under 2000 bytes.");
    library = { ...library, leadGuidance: text || void 0 };
    persistLibrary();
    return profiles();
  }
  function saveProfile(id, name, setup) {
    const checkedName = profileName(name), checked = validateSetup(setup);
    const existing = id == null ? void 0 : library.profiles.find((profile2) => profile2.id === id);
    if (id != null && !existing) throw new Error("Team profile not found.");
    if (library.profiles.some((profile2) => profile2.id !== existing?.id && profile2.name.toLowerCase() === checkedName.toLowerCase())) throw new Error("A team profile with this name already exists.");
    if (!existing && library.profiles.length >= 20) throw new Error("Save up to 20 team profiles.");
    const profile = { id: existing?.id ?? crypto.randomUUID(), name: checkedName, setup: checked, updatedAt: Date.now() };
    if (existing) library.profiles[library.profiles.indexOf(existing)] = profile;
    else library.profiles.push(profile);
    if (library.activeProfileId === profile.id && JSON.stringify(profile.setup) !== JSON.stringify(library.lastSetup)) library.activeProfileId = null;
    persistLibrary();
    return profiles();
  }
  function deleteProfile(id) {
    if (!library.profiles.some((profile) => profile.id === id)) throw new Error("Team profile not found.");
    library.profiles = library.profiles.filter((profile) => profile.id !== id);
    if (library.activeProfileId === id) library.activeProfileId = null;
    persistLibrary();
    return profiles();
  }
  function inherit(sessionId) {
    const parent = host.parent(sessionId);
    if (!library.enabled || !library.lastSetup || configs.has(parent.id)) return;
    if (!library.lastSetup.config.auto) Object.assign(parent, structuredClone(library.lastSetup.architect));
    configs.set(parent.id, structuredClone(library.lastSetup.config));
    persist();
  }
  function publish(team) {
    team.snapshot.revision++;
    team.snapshot.updatedAt = Date.now();
    host.emit(structuredClone(team.snapshot));
    return structuredClone(team.snapshot);
  }
  function active(team) {
    return !!team && ["running", "waiting", "paused"].includes(team.snapshot.status);
  }
  function get(sessionId) {
    const parent = host.parent(sessionId);
    let team = teams.get(parent.id);
    const config = configs.get(parent.id);
    if (!team && config) {
      team = { snapshot: { sessionId: parent.id, config: structuredClone(config), status: "ready", round: 0, revision: 0, workers: [], updatedAt: Date.now() }, runs: [], batchStart: 0 };
      teams.set(parent.id, team);
    }
    return team ? structuredClone(team.snapshot) : null;
  }
  function configure(sessionId, config, architect, profileId) {
    const parent = host.parent(sessionId);
    const existing = teams.get(parent.id);
    const used = !!existing && (existing.snapshot.round > 0 || existing.snapshot.workers.length > 0);
    const running = !!existing && ["running", "waiting"].includes(existing.snapshot.status);
    if (!existing || config === null) host.assertIdle(parent);
    if (parent.archived || parent.taskStage === "completed") throw new Error("Reopen this task before changing its team.");
    if (parent.goalState?.status === "active") throw new Error("Pause the task goal before enabling architect mode.");
    if (config === null) {
      if (existing && used) throw new Error("This run keeps its saved setup. Create a new task to use a different team.");
      library.enabled = false;
      configs.delete(parent.id);
      teams.delete(parent.id);
      persist();
      persistLibrary();
      host.emit({ sessionId: parent.id, removed: true });
      return null;
    }
    const checked = validateSetup({ config, architect: architect ?? parentSelection(parent) });
    if (profileId != null) {
      const profile = library.profiles.find((profile2) => profile2.id === profileId);
      if (!profile) throw new Error("Team profile not found.");
      if (JSON.stringify(profile.setup) !== JSON.stringify(checked)) throw new Error("This setup does not match the saved team profile.");
    }
    if (!existing && parent.resumeId && parent.provider !== checked.architect.provider) throw new Error("A started task keeps its harness. Create a new task to change it.");
    if (existing && checked.config.maxAssignments < existing.snapshot.workers.length) throw new Error("Assignment limit cannot be below the existing assignment count.");
    if (existing && checked.config.maxRounds < existing.snapshot.round) throw new Error("Architect round limit cannot be below the current round.");
    library = { ...library, enabled: true, lastSetup: structuredClone(checked), activeProfileId: profileId ?? null };
    persistLibrary();
    if (existing) {
      existing.snapshot.pendingSetup = checked;
      if (JSON.stringify(checked) === JSON.stringify({ architect: parentSelection(parent), config: existing.snapshot.config })) existing.snapshot.pendingSetup = null;
      if (!running) applyPending(existing);
      return publish(existing);
    }
    Object.assign(parent, checked.architect, { updatedAt: Date.now() });
    configs.set(parent.id, checked.config);
    persist();
    teams.delete(parent.id);
    get(parent.id);
    return publish(teams.get(parent.id));
  }
  function applyPending(team) {
    const setup = team.snapshot.pendingSetup;
    if (!setup) return;
    const parent = host.parent(team.snapshot.sessionId);
    if (parent.provider !== setup.architect.provider) {
      parent.resumeId = null;
      parent.contextUsage = null;
    }
    Object.assign(parent, structuredClone(setup.architect), { updatedAt: Date.now() });
    team.snapshot.config = structuredClone(setup.config);
    team.snapshot.pendingSetup = null;
    configs.set(parent.id, structuredClone(setup.config));
    persist();
  }
  function workerMessage(run, role, content) {
    const message = { id: host.nextMessageId(), sessionId: run.worker.sessionId, role, content, createdAt: Date.now() };
    run.messages.push(message);
    return message;
  }
  function finishWorker(team, run) {
    run.timer = void 0;
    workerMessage(run, "assistant", run.output);
    const user = [...run.messages].reverse().find((message) => message.role === "user");
    if (user) user.turnDurationMs = Math.max(0, Date.now() - user.createdAt);
    host.finishChanges(workerMessage(run, "changes", ""));
    run.worker.status = "completed";
    run.worker.updatedAt = Date.now();
    run.worker.summary = boundedSummary(run.output, team.snapshot.config.summaryLimit);
    run.worker.checkpoint = { summary: "Sample assignment explored. No files were changed.", nextSteps: "Await the sample architect review.", blocker: null, updatedAt: Date.now() };
    const messages = team.messages ?? (team.messages = []);
    messages.push({ id: messages.length + 1, sender: run.worker.id, recipient: "architect", message: `${run.worker.name}: sample summary ready for review. ${sampleNotice}`, createdAt: Date.now() });
    team.snapshot.coordinationRevision = (team.snapshot.coordinationRevision ?? 0) + 1;
    host.agent({ sessionId: run.worker.sessionId, kind: "done", text: "" });
    publish(team);
    schedule(team);
  }
  function tick(team, run) {
    run.timer = void 0;
    if (team.snapshot.status !== "running") return;
    const chunk = run.output.slice(run.cursor, run.cursor + 9);
    run.cursor += chunk.length;
    host.agent({ sessionId: run.worker.sessionId, kind: "text", text: chunk });
    if (team.snapshot.status !== "running") return;
    if (run.cursor < run.output.length) run.timer = window.setTimeout(() => tick(team, run), 45);
    else finishWorker(team, run);
  }
  function review(team) {
    team.reviewTimer = void 0;
    if (team.snapshot.status !== "running") return;
    applyPending(team);
    const parent = host.parent(team.snapshot.sessionId);
    const count = team.runs.length - team.batchStart;
    const output = `### Sample architect review

${count} worker${count === 1 ? "" : "s"} returned a bounded summary. The sample assignments are ready for your review.

${sampleNotice}`;
    host.agent({ sessionId: parent.id, kind: "message_start", text: "" });
    host.agent({ sessionId: parent.id, kind: "text", text: output });
    host.append(parent.id, "assistant", output);
    host.finishTiming(parent.id);
    parent.status = "idle";
    parent.taskStage = "review";
    parent.lastResponseAt = Date.now();
    parent.updatedAt = Date.now();
    team.snapshot.status = "completed";
    team.snapshot.summary = boundedSummary(output, team.snapshot.config.summaryLimit);
    publish(team);
    host.agent({ sessionId: parent.id, kind: "done", text: "" });
  }
  function schedule(team) {
    if (team.snapshot.status !== "running") return;
    const batch = team.runs.slice(team.batchStart);
    for (const run of batch) {
      if (run.worker.status !== "queued" || workerQueueReason(run.worker, team.snapshot.workers, team.snapshot.config.maxParallel)) continue;
      run.worker.status = "running";
      run.worker.updatedAt = Date.now();
      run.worker.checkpoint = { summary: "Sample assignment started.", nextSteps: "Explore the sample scope and report a concise result.", blocker: null, updatedAt: Date.now() };
      host.agent({ sessionId: run.worker.sessionId, kind: "status", text: "Running sample worker" });
      run.timer = window.setTimeout(() => tick(team, run), 200);
    }
    publish(team);
    if (batch.every((run) => run.worker.status === "completed") && team.reviewTimer === void 0) {
      host.agent({ sessionId: team.snapshot.sessionId, kind: "status", text: "Reviewing sample worker summaries" });
      team.reviewTimer = window.setTimeout(() => review(team), 350);
    }
  }
  function start(sessionId, text, imageIds) {
    const parent = host.parent(sessionId);
    host.assertIdle(parent);
    if (parent.archived || parent.taskStage === "completed") throw new Error("Reopen this task before starting its team.");
    if (parent.goalState?.status === "active") throw new Error("Pause the task goal before starting an architect team.");
    get(parent.id);
    const team = teams.get(parent.id);
    if (!team) throw new Error("Configure workers before starting an architect team.");
    if (["running", "waiting"].includes(team.snapshot.status)) throw new Error("This team is already active.");
    if (typeof text !== "string" || !text.trim() || new TextEncoder().encode(text).length > 128 * 1024) throw new Error("Write a task under 128 KiB.");
    if (imageIds != null && (!Array.isArray(imageIds) || imageIds.length > 8 || imageIds.some((id) => typeof id !== "string"))) throw new Error("Invalid image attachments.");
    applyPending(team);
    const available = team.snapshot.config.maxAssignments - team.runs.length;
    if (available <= 0) throw new Error("Worker assignment limit reached. Increase the run limit before starting more work.");
    parent.status = "running";
    parent.taskStage = "in_progress";
    parent.completedAt = null;
    parent.updatedAt = Date.now();
    if (parent.title === "New conversation") parent.title = text.trim().slice(0, 48);
    host.append(parent.id, "user", text.trim());
    team.snapshot.status = "running";
    team.snapshot.round = 1;
    team.snapshot.summary = null;
    team.snapshot.error = null;
    team.batchStart = team.runs.length;
    const roster = team.snapshot.config.workers;
    const staff = !team.snapshot.config.auto ? roster : roster.length ? roster.slice(0, 2) : [{ id: "auto", name: parent.model || "Default model", provider: parent.provider, model: parent.model, reasoningEffort: parent.reasoningEffort ?? null }];
    const batch = staff.slice(0, available).map((profile, index) => {
      const time = Date.now();
      const worker = { ...profile, id: crypto.randomUUID(), sessionId: crypto.randomUUID(), profileId: profile.id, status: "queued", assignment: `Sample assignment ${index + 1}: ${text.trim().slice(0, 320)}`, summary: "", dependsOn: [], files: [`sample/assignment-${team.batchStart + index + 1}`], readOnly: false, attempt: 1, createdAt: time, updatedAt: time };
      const run = { worker, cursor: 0, messages: [], output: `**${profile.name}** is exploring sample assignment ${index + 1}.

I would inspect the relevant files, make a focused change, and report the result to the architect. This preview demonstrates a separate worker conversation and streamed progress.

${sampleNotice}` };
      workerMessage(run, "user", worker.assignment);
      return run;
    });
    team.runs.push(...batch);
    team.snapshot.workers = team.runs.map((run) => run.worker);
    host.agent({ sessionId: parent.id, kind: "status", text: "Planning sample worker assignments" });
    const planning = `I\u2019ll coordinate ${batch.length} sample worker${batch.length === 1 ? "" : "s"} and review their summaries. ${sampleNotice}`;
    host.append(parent.id, "assistant", planning);
    host.agent({ sessionId: parent.id, kind: "text", text: planning });
    schedule(team);
  }
  function control(sessionId, action) {
    const parent = host.parent(sessionId);
    get(parent.id);
    const team = teams.get(parent.id);
    if (!team) throw new Error("This task has no architect team.");
    if (!["pause", "resume", "stop"].includes(String(action))) throw new Error("Choose pause, resume, or stop.");
    if (action === "resume") {
      if (!["paused", "interrupted", "failed"].includes(team.snapshot.status)) throw new Error("Only an interrupted team can resume.");
      const restart = team.snapshot.status !== "paused" || Boolean(team.snapshot.error);
      if (parent.archived || parent.taskStage === "completed") throw new Error("Reopen this task before resuming its team.");
      host.assertIdle(parent);
      applyPending(team);
      if (team.snapshot.round >= team.snapshot.config.maxRounds) {
        if (team.snapshot.round >= 20) throw new Error("This team used all 20 architect rounds. Send a message to continue.");
        team.snapshot.config = { ...team.snapshot.config, maxRounds: Math.min(20, team.snapshot.round + 4) };
      }
      parent.status = "running";
      team.snapshot.status = "running";
      team.snapshot.error = null;
      for (const run of team.runs.slice(team.batchStart)) if (run.worker.status === "stopped" || run.worker.status === "failed") {
        if (restart) {
          run.cursor = 0;
          run.worker.attempt++;
        }
        run.worker.status = "queued";
      }
      host.agent({ sessionId: parent.id, kind: "status", text: "Resuming sample workers" });
      schedule(team);
      return structuredClone(team.snapshot);
    }
    if (!active(team)) throw new Error("This team is not running.");
    window.clearTimeout(team.reviewTimer);
    team.reviewTimer = void 0;
    for (const run of team.runs) {
      window.clearTimeout(run.timer);
      run.timer = void 0;
      if (["queued", "running", "waiting"].includes(run.worker.status)) {
        if (action === "stop" && run.cursor) workerMessage(run, "assistant", run.output.slice(0, run.cursor));
        run.worker.status = "stopped";
        run.worker.updatedAt = Date.now();
        if (action === "stop") host.agent({ sessionId: run.worker.sessionId, kind: "done", text: "Stopped" });
      }
    }
    parent.status = "idle";
    parent.updatedAt = Date.now();
    applyPending(team);
    team.snapshot.status = "paused";
    team.snapshot.error = action === "stop" ? "Team stopped. Resume explicitly to retry unfinished work." : null;
    host.finishTiming(parent.id);
    host.agent({ sessionId: parent.id, kind: "done", text: action === "pause" ? "Paused" : "Stopped" });
    return publish(team);
  }
  function workerMessages(sessionId, workerId, beforeId) {
    const parent = host.parent(sessionId);
    const run = teams.get(parent.id)?.runs.find((run2) => run2.worker.id === workerId);
    if (!run) throw new Error("Worker does not belong to this task.");
    if (beforeId != null && (!Number.isSafeInteger(beforeId) || Number(beforeId) < 1)) throw new Error("Invalid message cursor.");
    const eligible = run.messages.filter((message) => beforeId == null || message.id < Number(beforeId));
    return structuredClone({ messages: eligible.slice(-100), hasOlder: eligible.length > 100 });
  }
  function teamMessages(sessionId, afterId = 0, limit = 50) {
    const parent = host.parent(sessionId);
    const team = teams.get(parent.id);
    if (!team) throw new Error("This task has no architect team.");
    if (!Number.isSafeInteger(afterId) || Number(afterId) < 0 || !Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 50) throw new Error("Invalid team message cursor or page size.");
    const eligible = (team.messages ?? []).filter((message) => message.id > Number(afterId));
    const messages = eligible.slice(0, Number(limit));
    return structuredClone({ messages, nextCursor: messages.at(-1)?.id ?? Number(afterId), hasMore: eligible.length > messages.length });
  }
  function remove(sessionIds) {
    for (const sessionId of sessionIds) {
      const team = teams.get(sessionId);
      if (team) {
        window.clearTimeout(team.reviewTimer);
        for (const run of team.runs) window.clearTimeout(run.timer);
      }
      teams.delete(sessionId);
      configs.delete(sessionId);
    }
    persist();
  }
  return { get, configure, profiles, setLeadGuidance, saveProfile, deleteProfile, inherit, start, control, workerMessages, teamMessages, remove, isActive: (sessionId) => active(teams.get(sessionId)) };
}
export {
  createPreviewArchitect
};
