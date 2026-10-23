import "./skills-library.css";
import { escape } from "./dom";
const HARNESS_NAMES = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode", glm: "GLM", mimo: "MiMo", deepseek: "DeepSeek", commandcode: "Command Code", cline: "Cline", omp: "OMP", pi: "Pi", muse: "Muse Code" };
const harnessName = (id) => HARNESS_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
const FINDING_LABELS = { secret: "Secret-shaped value", approvals: "Turns off approvals or the sandbox", "pipe-to-shell": "Download piped into a shell" };
const STATUS_LABELS = { active: "Active", outdated: "Older version", drifted: "Edited on disk", missing: "Missing on disk", prompt: "Via prompt", off: "\u2014" };
const message = (error) => error instanceof Error ? error.message : String(error);
function mountSkillsLibrary(host, options) {
  let items = [];
  let matrix = { project: null, harnesses: [] };
  let projectId = "";
  let source = "folder";
  let pending = null;
  let note = "", error = "", busy = false, disposed = false, clearFields = false;
  const projects = () => options.projects?.() ?? [];
  const scopeArgs = (scope) => scope === "project" ? { projectId } : {};
  async function refresh() {
    try {
      [items, matrix] = await Promise.all([
        options.call("skills_list"),
        options.call("skills_matrix", projectId ? { projectId } : {})
      ]);
    } catch (failure) {
      error = message(failure);
    }
    if (!disposed) draw();
  }
  async function run(work) {
    busy = true;
    error = "";
    note = "";
    draw();
    try {
      note = await work() ?? "";
    } catch (failure) {
      error = message(failure);
    }
    busy = false;
    if (!disposed) await refresh();
  }
  const harnesses = () => {
    const ids = /* @__PURE__ */ new Set(["claude", "codex", ...matrix.harnesses.map((row) => row.harness)]);
    return [...ids].map((id) => matrix.harnesses.find((row) => row.harness === id) ?? { harness: id, installed: false, prompt: false, cells: [], unmanaged: [] });
  };
  const scopes = () => projectId ? ["user", "project"] : ["user"];
  const active = (item, harness, scope) => item.activations.some((a) => a.harness === harness && a.scope === scope && (scope === "user" || a.project === matrix.project));
  function itemHtml(item) {
    const from = item.source.kind === "github" ? `GitHub \xB7 ${item.source.location}${item.source.commit ? ` @ ${item.source.commit.slice(0, 7)}` : ""}` : item.source.location;
    const toggles = harnesses().flatMap((row) => scopes().map((scope) => {
      const label = `${harnessName(row.harness)} \xB7 ${scope === "user" ? "User" : "Project"}`;
      return `<label class="skills-toggle"><input type="checkbox" data-harness="${escape(row.harness)}" data-scope="${scope}" ${active(item, row.harness, scope) ? "checked" : ""} ${busy ? "disabled" : ""} aria-label="${escape(`${item.name}: ${label}`)}"><span>${escape(label)}</span></label>`;
    })).join("");
    const findings = item.findings.length ? `<ul class="skills-findings" aria-label="${escape(`Safety findings for ${item.name}`)}">${item.findings.map((f) => `<li><strong>${escape(FINDING_LABELS[f.rule])}</strong> <span>${escape(f.file)}:${f.line}</span><code>${escape(f.excerpt)}</code></li>`).join("")}</ul>` : "";
    const confirm = pending?.id === item.id ? `<div class="skills-confirm" role="alert"><span>${escape(`${item.name} has ${item.findings.length} safety finding${item.findings.length === 1 ? "" : "s"}. Activate it for ${harnessName(pending.harness)} anyway?`)}</span><button type="button" class="secondary-button" data-action="acknowledge">Activate anyway</button><button type="button" class="secondary-button" data-action="cancel">Cancel</button></div>` : "";
    return `<li class="skills-item" data-id="${escape(item.id)}">
      <div class="skills-item-head"><div><strong>${escape(item.name)}</strong><span class="skills-kind">${item.kind === "rule" ? "Rule" : "Skill"}</span><small>${escape(item.description)}</small><small class="skills-source">${escape(from)}</small></div>
        <button type="button" class="secondary-button" data-action="remove" aria-label="${escape(`Remove ${item.name}`)}" ${busy ? "disabled" : ""}>Remove</button></div>
      ${findings}${confirm}<div class="skills-toggles">${toggles}</div></li>`;
  }
  function matrixHtml() {
    const rows = matrix.harnesses;
    if (!rows.length || !items.length) return '<p class="skills-empty">No installed harness found yet, or nothing in the library.</p>';
    const columns = rows.flatMap((row) => scopes().map((scope) => ({ row, scope })));
    const head = columns.map(({ row, scope }) => `<th scope="col">${escape(harnessName(row.harness))}<small>${scope === "user" ? "User" : "Project"}${row.prompt ? " \xB7 prompt" : ""}</small></th>`).join("");
    const body = items.map((item) => `<tr><th scope="row">${escape(item.name)}</th>${columns.map(({ row, scope }) => {
      const cell = row.cells.find((c) => c.id === item.id && c.scope === scope);
      const status = cell?.status ?? "off";
      return `<td class="skills-status" data-status="${status}" title="${escape(cell?.surface ?? "")}">${STATUS_LABELS[status]}</td>`;
    }).join("")}</tr>`).join("");
    const unmanaged = rows.flatMap((row) => row.unmanaged.map((u) => `<li><strong>${escape(harnessName(row.harness))}</strong> <code>${escape(u.path)}</code> <span>${escape(u.detail)}</span></li>`)).join("");
    const prompt = rows.some((row) => row.prompt) ? '<p class="skills-note">Harnesses marked \u201Cprompt\u201D have no skill files; PandaCode adds these items to their messages.</p>' : "";
    return `<div class="skills-matrix-wrap"><table class="skills-matrix" aria-label="Skills by harness"><thead><tr><th scope="col">Item</th>${head}</tr></thead><tbody>${body}</tbody></table></div>${prompt}
      ${unmanaged ? `<h4 class="skills-subheading">Found on disk, not managed by PandaCode</h4><ul class="skills-unmanaged">${unmanaged}</ul>` : ""}`;
  }
  function draw() {
    const list = projects();
    const values = clearFields ? {} : Object.fromEntries([...host.querySelectorAll(".skills-import [name]")].map((field) => [field.name, field.value]));
    host.innerHTML = `<div class="settings-group skills-library" aria-label="Skills and rules">
      <form class="skills-import" aria-label="Import a skill or rule" novalidate>
        <div class="skills-import-row">
          <select name="kind" aria-label="Kind"><option value="skill">Skill</option><option value="rule">Rule</option></select>
          <select name="source" aria-label="Source"><option value="folder" ${source === "folder" ? "selected" : ""}>Local folder or file</option><option value="github" ${source === "github" ? "selected" : ""}>GitHub repository</option></select>
          ${list.length ? `<select name="project" aria-label="Project for project scope"><option value="">User scope only</option>${list.map((p) => `<option value="${escape(p.id)}" ${p.id === projectId ? "selected" : ""}>${escape(p.name)}</option>`).join("")}</select>` : ""}
        </div>
        ${source === "folder" ? '<input name="path" aria-label="Folder or file path" placeholder="/path/to/skill-folder or rule.md" spellcheck="false" autocomplete="off">' : '<div class="skills-import-row"><input name="repo" aria-label="Repository" placeholder="owner/name" spellcheck="false" autocomplete="off"><input name="repoPath" aria-label="Path in repository" placeholder="skills/pdf" spellcheck="false" autocomplete="off"><input name="ref" aria-label="Branch, tag or commit" placeholder="Default branch" spellcheck="false" autocomplete="off"></div>'}
        <div class="skills-import-row skills-import-actions"><p class="skills-message" role="status">${escape(busy ? "Working\u2026" : note)}</p><button type="submit" class="secondary-button" ${busy ? "disabled" : ""}>Import</button></div>
        <p class="skills-error" role="alert" ${error ? "" : "hidden"}>${escape(error)}</p>
      </form>
    </div>
    <h3 class="settings-heading">Library</h3>
    ${items.length ? `<ul class="settings-group skills-list" aria-label="Library">${items.map(itemHtml).join("")}</ul>` : '<p class="skills-empty">The library is empty. Import a skill folder (with a SKILL.md) or a rule (one Markdown file).</p>'}
    <h3 class="settings-heading">By harness</h3>${matrixHtml()}`;
    for (const [name, value] of Object.entries(values)) {
      const field = host.querySelector(`.skills-import [name="${name}"]`);
      if (field && name !== "source" && name !== "project") field.value = value;
    }
    clearFields = false;
  }
  function toggle(input) {
    const id = input.closest(".skills-item").dataset.id;
    const { harness, scope } = input.dataset;
    const item = items.find((entry) => entry.id === id);
    if (!input.checked) {
      void run(async () => {
        const change = await options.call("skills_deactivate", { id, harness, scope, ...scopeArgs(scope) });
        return change.kept.length ? `Left ${change.kept.length} edited file${change.kept.length === 1 ? "" : "s"} in place: ${change.kept.join(", ")}` : `${item.name} is off for ${harnessName(harness)}.`;
      });
      return;
    }
    if (item.findings.length && item.acknowledged !== item.sha256) {
      input.checked = false;
      pending = { id, harness, scope };
      draw();
      return;
    }
    void activate(id, harness, scope, false);
  }
  function activate(id, harness, scope, acknowledge) {
    pending = null;
    return run(async () => {
      await options.call("skills_activate", { id, harness, scope, ...scopeArgs(scope), acknowledge });
      const row = matrix.harnesses.find((r) => r.harness === harness);
      return row?.prompt ? `${harnessName(harness)} has no skill files; PandaCode adds this to its messages.` : `Active for ${harnessName(harness)}.`;
    });
  }
  function importItem(form) {
    const data = new FormData(form);
    const kind = String(data.get("kind") ?? "skill");
    const text = (name) => String(data.get(name) ?? "").trim();
    if (source === "folder" && !text("path")) {
      error = "Enter a folder or file path.";
      draw();
      return;
    }
    if (source === "github" && !text("repo")) {
      error = "Enter the repository as owner/name.";
      draw();
      return;
    }
    void run(async () => {
      const item = source === "folder" ? await options.call("skills_import_folder", { path: text("path"), kind }) : await options.call("skills_import_github", { repo: text("repo"), path: text("repoPath"), gitRef: text("ref") || null, kind });
      clearFields = true;
      return `Imported ${item.name}.${item.findings.length ? ` ${item.findings.length} safety finding${item.findings.length === 1 ? "" : "s"} to review.` : ""}`;
    });
  }
  const onClick = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.closest(".skills-item")?.dataset.id;
    if (button.dataset.action === "remove" && id) void run(async () => {
      await options.call("skills_remove", { id });
      return "Removed.";
    });
    if (button.dataset.action === "acknowledge" && pending) void activate(pending.id, pending.harness, pending.scope, true);
    if (button.dataset.action === "cancel") {
      pending = null;
      draw();
    }
  };
  const onChange = (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.harness) toggle(target);
    if (target instanceof HTMLSelectElement && target.name === "source") {
      source = target.value;
      draw();
    }
    if (target instanceof HTMLSelectElement && target.name === "project") {
      projectId = target.value;
      pending = null;
      void refresh();
    }
  };
  const onSubmit = (event) => {
    event.preventDefault();
    importItem(event.target);
  };
  host.addEventListener("click", onClick);
  host.addEventListener("change", onChange);
  host.addEventListener("submit", onSubmit);
  draw();
  void refresh();
  return () => {
    disposed = true;
    host.removeEventListener("click", onClick);
    host.removeEventListener("change", onChange);
    host.removeEventListener("submit", onSubmit);
  };
}
export {
  mountSkillsLibrary
};
