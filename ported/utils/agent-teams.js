import "./agent-teams.css";
import { escape, icon } from "./dom";
import { modelChoices } from "./model-catalog";
import { providerLogo } from "./provider-logos";
import { classicTeamSetup, modelKey, namedTeams, namedTeamSetup, setClassicTeamSetup, teamDetail, TEAM_MODELS_MAX } from "./team-mode";
function mountAgentTeams(host, options) {
  host.innerHTML = `<div class="settings-group agent-teams">
    <div class="setting-row"><div><strong>Classic team setup</strong><small>Team opens Architect & workers.</small></div><input type="checkbox" class="settings-switch" aria-label="Classic team setup" ${classicTeamSetup() ? "checked" : ""}></div>
    <div class="setting-row"><div><strong>Agent teams</strong><small>Pick one in the model picker.</small></div><button type="button" class="secondary-button agent-team-new">${icon("plus")}New team</button></div>
    <div class="setting-row"><div><strong>Lead guidance</strong><small>Added to the architect's built-in rules for every team.</small></div><button type="button" class="secondary-button agent-guidance-save">Save</button></div>
    <div class="agent-guidance-row"><textarea class="agent-guidance" aria-label="Lead guidance" rows="3" maxlength="2000" spellcheck="false" placeholder="Leave empty for the built-in rules. For example: you only lead; never edit files yourself."></textarea></div>
    <p class="agent-guidance-status" role="status" hidden></p>
    <ul class="agent-team-list" aria-label="Agent teams"></ul>
    <form class="agent-team-editor" aria-label="Agent team" hidden>
      <label class="agent-team-field"><span>Team name</span><input type="text" maxlength="80" autocomplete="off" spellcheck="false" aria-label="Team name" placeholder="Reviewers"></label>
      <input type="search" class="agent-team-filter" aria-label="Filter models" placeholder="Filter models\u2026" autocomplete="off" spellcheck="false">
      <div class="agent-team-models" role="group" aria-label="Team models"><p class="agent-team-loading" role="status">Loading models\u2026</p></div>
      <label class="agent-team-field" hidden><span>Lead effort</span><select class="agent-team-lead-effort" aria-label="Lead effort"></select></label>
      <div class="agent-team-actions"><span class="agent-team-count" aria-live="polite"></span><button type="button" class="secondary-button agent-team-cancel">Cancel</button><button type="submit" class="primary-button">Save team</button></div>
    </form>
    <p class="agent-team-error" role="alert" hidden></p>
  </div>`;
  const classic = host.querySelector(".settings-switch");
  const list = host.querySelector(".agent-team-list");
  const create = host.querySelector(".agent-team-new");
  const editor = host.querySelector(".agent-team-editor");
  const name = editor.querySelector("input[type=text]");
  const filter = editor.querySelector(".agent-team-filter");
  const models = editor.querySelector(".agent-team-models");
  const count = editor.querySelector(".agent-team-count");
  const leadEffort = editor.querySelector(".agent-team-lead-effort");
  const error = host.querySelector(".agent-team-error");
  const guidance = host.querySelector(".agent-guidance");
  const guidanceSave = host.querySelector(".agent-guidance-save");
  const guidanceStatus = host.querySelector(".agent-guidance-status");
  let guidanceEdited = false;
  const harnessName = (id) => options.providers.find((provider) => provider.id === id)?.name ?? id;
  let library = null, editing = null, leadSelected = "", catalog = [], shown = [], disposed = false, busy = false;
  const showError = (cause) => {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    error.hidden = false;
  };
  function renderList() {
    const teams = library ? namedTeams(library) : [];
    list.hidden = !teams.length;
    list.innerHTML = teams.map((team) => `<li class="agent-team-row" data-id="${escape(team.id)}"><span class="provider-small ${team.setup.architect.provider}">${providerLogo(team.setup.architect.provider)}</span><span class="agent-team-name"><strong>${escape(team.name)}</strong><small>${escape(teamDetail(team, harnessName))}</small></span><button type="button" class="secondary-button" data-team-edit aria-label="Edit ${escape(team.name)}">Edit</button><button type="button" class="icon-button" data-team-delete aria-label="Delete ${escape(team.name)}" title="Delete team">${icon("close")}</button></li>`).join("");
  }
  async function refresh() {
    try {
      library = await options.call("architect_profiles");
      if (disposed) return;
      if (!guidanceEdited) guidance.value = library.leadGuidance ?? "";
      renderList();
    } catch (cause) {
      if (!disposed) showError(cause);
    }
  }
  async function loadCatalog() {
    const installed = options.providers.filter((provider) => provider.installed);
    const loaded = await Promise.allSettled(installed.map((provider) => options.loadModels(provider.id)));
    return installed.flatMap((provider, index) => {
      const result = loaded[index];
      return modelChoices(provider.id, result.status === "fulfilled" ? result.value : provider.models).map((model) => ({ provider: provider.id, harness: provider.name, model: model.id, name: model.name, efforts: model.reasoningEfforts }));
    });
  }
  const effortOptions = (model, current) => `<option value="">Default effort</option>${(model?.efforts ?? []).map((effort) => `<option value="${escape(effort.id)}" ${effort.id === current ? "selected" : ""}>${escape(effort.name)}</option>`).join("")}`;
  const checked = () => [...models.querySelectorAll("input[type=checkbox]:checked")];
  function renderModels(chosen, lead) {
    const saved = editing?.setup.config.workers ?? [];
    const extra = saved.filter((worker) => !catalog.some((model) => modelKey(model) === modelKey(worker))).map((worker) => ({ provider: worker.provider, harness: harnessName(worker.provider), model: worker.model, name: worker.name.split(" \xB7 ")[0], reasoningEffort: worker.reasoningEffort }));
    const all = [...catalog, ...extra];
    if (!all.length) {
      models.innerHTML = '<p class="agent-team-loading">No installed agents report models yet.</p>';
      return;
    }
    const groups = [...new Set(all.map((model) => model.provider))];
    models.innerHTML = groups.map((provider) => `<section aria-label="${escape(harnessName(provider))}"><h4>${providerLogo(provider)}${escape(harnessName(provider))}</h4>${all.filter((model) => model.provider === provider).map((model) => {
      const key = modelKey(model), label = `${model.name} \xB7 ${model.harness}`;
      const effort = model.efforts?.length ? `<select class="agent-team-effort" aria-label="Worker effort for ${escape(label)}">${effortOptions(model, saved.find((worker) => modelKey(worker) === key)?.reasoningEffort)}</select>` : "";
      return `<div class="agent-team-model" data-key="${escape(key)}" data-search="${escape(`${label} ${model.model}`.toLowerCase())}"><label><input type="checkbox" value="${escape(key)}" aria-label="Include ${escape(label)}" ${chosen.has(key) ? "checked" : ""}><span>${escape(model.name)}</span></label><label class="agent-team-lead"><input type="radio" name="agent-team-lead" value="${escape(key)}" aria-label="${escape(label)} leads" ${key === lead ? "checked" : ""}><span>Lead</span></label>${effort}</div>`;
    }).join("")}</section>`).join("");
    shown = all;
    leadSelected = lead;
    leadEffort.innerHTML = effortOptions(all.find((model) => modelKey(model) === lead), editing?.setup.architect.reasoningEffort);
    sync();
  }
  function sync() {
    const included = checked();
    models.querySelectorAll(".agent-team-model").forEach((row) => {
      const box = row.querySelector("input[type=checkbox]"), radio = row.querySelector("input[type=radio]");
      radio.disabled = !box.checked;
      if (!box.checked) radio.checked = false;
      box.disabled = !box.checked && included.length >= TEAM_MODELS_MAX;
      const effort = row.querySelector(".agent-team-effort");
      if (effort) effort.disabled = !box.checked;
    });
    if (included.length && !models.querySelector("input[type=radio]:checked")) models.querySelector(`input[type=radio][value="${CSS.escape(included[0].value)}"]`).checked = true;
    const lead = models.querySelector("input[type=radio]:checked")?.value ?? "";
    const leadModel = shown.find((model) => modelKey(model) === lead);
    if (lead !== leadSelected) {
      leadEffort.innerHTML = effortOptions(leadModel);
      leadSelected = lead;
    }
    leadEffort.parentElement.hidden = !leadModel?.efforts?.length;
    count.textContent = included.length ? `${included.length} model${included.length === 1 ? "" : "s"}` : "Choose models";
  }
  function applyFilter() {
    const query = filter.value.trim().toLowerCase();
    models.querySelectorAll(".agent-team-model").forEach((row) => {
      row.hidden = Boolean(query) && !row.dataset.search.includes(query);
    });
    models.querySelectorAll("section").forEach((group) => {
      group.hidden = !group.querySelector(".agent-team-model:not([hidden])");
    });
  }
  async function openEditor(profile) {
    editing = profile;
    error.hidden = true;
    editor.hidden = false;
    create.hidden = true;
    name.value = profile?.name ?? "";
    filter.value = "";
    name.focus();
    const chosen = new Set((profile?.setup.config.workers ?? []).map(modelKey));
    const lead = profile ? modelKey(profile.setup.architect) : "";
    if (!catalog.length) {
      catalog = await loadCatalog();
      if (disposed || editor.hidden) return;
    }
    renderModels(chosen, lead);
  }
  function closeEditor() {
    editor.hidden = true;
    create.hidden = false;
    editing = null;
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const teamName = name.value.trim();
    const included = checked().map((box) => {
      const model = shown.find((model2) => modelKey(model2) === box.value);
      const effort = box.closest(".agent-team-model")?.querySelector(".agent-team-effort");
      return model && { ...model, reasoningEffort: effort ? effort.value || null : model.reasoningEffort ?? null };
    }).filter((model) => Boolean(model));
    const leadKey = models.querySelector("input[type=radio]:checked")?.value;
    const leadModel = included.find((model) => modelKey(model) === leadKey);
    const lead = leadModel && { ...leadModel, reasoningEffort: leadModel.efforts?.length ? leadEffort.value || null : editing && modelKey(editing.setup.architect) === leadKey ? editing.setup.architect.reasoningEffort ?? null : null };
    if (!teamName) {
      showError(new Error("Give this team a name."));
      name.focus();
      return;
    }
    if (!included.length || !lead) {
      showError(new Error("Choose at least one model for this team."));
      return;
    }
    busy = true;
    error.hidden = true;
    try {
      const setup = namedTeamSetup(teamName, lead, included, editing?.setup.config ?? library?.lastSetup?.config);
      library = await options.call("architect_save_profile", { id: editing?.id ?? null, name: teamName, setup });
      if (disposed) return;
      closeEditor();
      renderList();
      create.focus();
    } catch (cause) {
      if (!disposed) showError(cause);
    } finally {
      busy = false;
    }
  }
  async function remove(id) {
    if (busy) return;
    busy = true;
    error.hidden = true;
    try {
      library = await options.call("architect_delete_profile", { id });
      if (!disposed) {
        renderList();
        create.focus();
      }
    } catch (cause) {
      if (!disposed) showError(cause);
    } finally {
      busy = false;
    }
  }
  classic.addEventListener("change", () => setClassicTeamSetup(classic.checked));
  create.addEventListener("click", () => void openEditor(null));
  editor.querySelector(".agent-team-cancel").addEventListener("click", () => {
    closeEditor();
    create.focus();
  });
  editor.addEventListener("submit", (event) => void save(event));
  models.addEventListener("change", sync);
  filter.addEventListener("input", applyFilter);
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      closeEditor();
      create.focus();
    }
  });
  list.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const id = target?.closest(".agent-team-row")?.dataset.id;
    const team = id && library ? namedTeams(library).find((profile) => profile.id === id) : void 0;
    if (!team) return;
    if (target.closest("[data-team-edit]")) void openEditor(team);
    else if (target.closest("[data-team-delete]")) void remove(team.id);
  });
  guidance.addEventListener("input", () => {
    guidanceEdited = true;
    guidanceStatus.hidden = true;
  });
  guidanceSave.addEventListener("click", () => {
    if (busy) return;
    busy = true;
    error.hidden = true;
    guidanceSave.disabled = true;
    const wanted = guidance.value.trim();
    if (new TextEncoder().encode(wanted).length > 2e3) {
      busy = false;
      guidanceSave.disabled = false;
      showError(new Error("Lead guidance must be under 2000 bytes."));
      return;
    }
    void (async () => {
      try {
        library = await options.call("architect_set_lead_guidance", { guidance: wanted || null });
        if (disposed) return;
        guidanceEdited = false;
        guidance.value = library.leadGuidance ?? "";
        guidanceStatus.textContent = wanted ? "Lead guidance saved. Every team follows it from its next turn." : "Lead guidance cleared. Teams use the built-in rules.";
        guidanceStatus.hidden = false;
      } catch (cause) {
        if (!disposed) showError(cause);
      } finally {
        busy = false;
        if (!disposed) guidanceSave.disabled = false;
      }
    })();
  });
  void refresh();
  return () => {
    disposed = true;
    host.replaceChildren();
  };
}
export {
  mountAgentTeams
};
