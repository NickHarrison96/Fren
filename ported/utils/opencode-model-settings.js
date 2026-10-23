import "./opencode-model-settings.css";
import { call } from "./bridge";
import { icon } from "./dom";
import { tokenCount } from "./model-catalog";
function mountOpenCodeModels(host, saved) {
  let disposed = false, loading = false, saving = false, initialized = false;
  let models = [], selected = /* @__PURE__ */ new Set(), persisted = /* @__PURE__ */ new Set();
  let visibleLimit = 80;
  const rows = /* @__PURE__ */ new Map();
  let rowId = 0;
  host.classList.add("opencode-model-settings");
  host.innerHTML = `<p class="dialog-description">Choose the OpenCode models you want in your model selectors.</p>
    <div class="opencode-model-toolbar"><label class="opencode-model-search">${icon("search")}<input type="search" aria-label="Search OpenCode models" placeholder="Search models or providers" autocomplete="off" spellcheck="false"></label><button type="button" class="secondary-button" data-refresh aria-label="Refresh models" title="Refresh from OpenCode">${icon("refresh")}</button></div>
    <p class="opencode-model-status" role="status" hidden></p>
    <div class="opencode-model-list" role="group" aria-label="Available OpenCode models"></div>
    <button type="button" class="secondary-button opencode-model-more" hidden>Show more models</button>
    <p class="opencode-model-empty" hidden></p>
    <div class="opencode-model-footer"><span class="opencode-model-count"></span><button type="button" class="primary-button" data-save>Save models</button></div>
    <small class="opencode-model-note">Default always uses OpenCode\u2019s own selection. Models and connected providers come from your OpenCode installation.</small>`;
  const search = host.querySelector("input");
  const list = host.querySelector(".opencode-model-list");
  const empty = host.querySelector(".opencode-model-empty");
  const status = host.querySelector(".opencode-model-status");
  const count = host.querySelector(".opencode-model-count");
  const refreshButton = host.querySelector("[data-refresh]");
  const saveButton = host.querySelector("[data-save]");
  const moreButton = host.querySelector(".opencode-model-more");
  const dirty = () => selected.size !== persisted.size || [...selected].some((id) => !persisted.has(id));
  function message(text, error = false) {
    status.textContent = text;
    status.hidden = !text;
    status.classList.toggle("error", error);
  }
  function controls() {
    refreshButton.disabled = loading || saving;
    saveButton.disabled = !initialized || saving || !dirty();
    saveButton.textContent = saving ? "Saving\u2026" : "Save models";
    count.textContent = selected.size === 100 ? "100 selected \xB7 limit reached" : `${selected.size} selected`;
    for (const input of list.querySelectorAll("input")) input.disabled = saving || selected.size >= 100 && !input.checked;
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const available = new Map(models.filter((model) => model.id !== "default").map((model) => [model.id, model]));
    const items = [...available.values()];
    for (const id of selected) if (!available.has(id)) items.push({ id, name: id, description: "" });
    items.sort((a, b) => a.id.split("/")[0].localeCompare(b.id.split("/")[0]) || a.name.localeCompare(b.name));
    const keep = /* @__PURE__ */ new Set();
    const matching = items.filter((model) => `${model.name} ${model.id}`.toLocaleLowerCase().includes(query));
    const shown = Math.min(visibleLimit, matching.length);
    moreButton.hidden = shown === matching.length;
    moreButton.textContent = `Show more models \xB7 ${matching.length - shown} remaining`;
    for (const [index, model] of matching.slice(0, visibleLimit).entries()) {
      keep.add(model.id);
      let row = rows.get(model.id);
      if (!row) {
        row = document.createElement("label");
        row.className = "opencode-model-row";
        row.innerHTML = `<input type="checkbox"><span class="opencode-model-copy"><strong></strong><small></small></span><span class="opencode-model-context"></span>`;
        const checkbox2 = row.querySelector("input");
        checkbox2.dataset.modelId = model.id;
        const description = row.querySelector("small");
        description.id = `opencode-model-description-${++rowId}`;
        checkbox2.setAttribute("aria-describedby", description.id);
        rows.set(model.id, row);
      }
      const checkbox = row.querySelector("input");
      checkbox.checked = selected.has(model.id);
      checkbox.disabled = saving;
      checkbox.setAttribute("aria-label", model.name);
      row.querySelector("strong").textContent = model.name;
      row.querySelector("small").textContent = available.has(model.id) ? model.id : `${model.id} \xB7 Currently unavailable`;
      row.querySelector(".opencode-model-context").textContent = model.contextWindow ? `${tokenCount(model.contextWindow)} context` : "";
      row.classList.toggle("selected", checkbox.checked);
      if (list.children[index] !== row) list.insertBefore(row, list.children[index] ?? null);
    }
    for (const [id, row] of rows) if (!keep.has(id)) {
      row.remove();
      rows.delete(id);
    }
    list.hidden = shown === 0;
    empty.hidden = shown > 0;
    empty.textContent = loading ? "Loading models from OpenCode\u2026" : query ? "No matching models. Try another name or provider." : "No models found. Connect a provider in OpenCode, then refresh.";
    controls();
  }
  async function refresh() {
    if (disposed || loading || saving) return;
    loading = true;
    controls();
    message("Loading models from OpenCode\u2026");
    if (!models.length) render();
    try {
      const result = await call("list_opencode_models");
      if (disposed) return;
      if (!initialized) {
        selected = new Set(result.selectedModelIds);
        persisted = new Set(result.selectedModelIds);
        initialized = true;
      }
      if (!result.error || result.models.length) models = result.models;
      message(result.error || "");
      status.classList.toggle("error", Boolean(result.error));
    } catch (error) {
      if (!disposed) message(String(error), true);
    } finally {
      loading = false;
      if (!disposed) render();
    }
  }
  async function save() {
    if (disposed || saving || !initialized || !dirty()) return;
    saving = true;
    render();
    try {
      const ids = await call("save_opencode_models", { modelIds: [...selected] });
      if (disposed) return;
      persisted = new Set(ids);
      selected = new Set(ids);
      saved();
      message("Models saved. Available in every model selector.");
    } catch (error) {
      if (!disposed) message(String(error), true);
    } finally {
      saving = false;
      if (!disposed) render();
    }
  }
  function change(event) {
    const checkbox = event.target;
    if (!(checkbox instanceof HTMLInputElement) || !checkbox.dataset.modelId || saving) return;
    if (checkbox.checked) selected.add(checkbox.dataset.modelId);
    else selected.delete(checkbox.dataset.modelId);
    checkbox.closest("label").classList.toggle("selected", checkbox.checked);
    message("");
    controls();
  }
  function filter() {
    visibleLimit = 80;
    list.scrollTop = 0;
    render();
  }
  function more() {
    visibleLimit += 80;
    render();
  }
  search.addEventListener("input", filter);
  list.addEventListener("change", change);
  moreButton.addEventListener("click", more);
  refreshButton.addEventListener("click", refresh);
  saveButton.addEventListener("click", save);
  void refresh();
  if (host.closest("dialog")) search.focus({ preventScroll: true });
  return () => {
    disposed = true;
    rows.clear();
    search.removeEventListener("input", filter);
    moreButton.removeEventListener("click", more);
    list.removeEventListener("change", change);
    refreshButton.removeEventListener("click", refresh);
    saveButton.removeEventListener("click", save);
  };
}
export {
  mountOpenCodeModels
};
