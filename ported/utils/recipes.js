import "./recipes.css";
import { escape } from "./dom";
const LABEL = { supported: "Supported", fallback: "Fallback", manual: "Manual", blocked: "Blocked" };
const summary = (step) => (step.kind === "slash" ? step.command : step.text) ?? "";
const NEW_RECIPE = { name: "my-recipe", description: "", steps: [{ kind: "prompt", text: "Review the changed files." }, { kind: "check", text: "npm test" }, { kind: "approval", text: "Ready to commit?" }] };
function mountRecipes(root, host) {
  let recipes = [];
  let selected = null;
  let plan = null;
  let editing = null;
  let message = "";
  let busy = false;
  const rowFor = (recipe) => `<li><button type="button" class="recipe-pick" data-recipe="${escape(recipe.name)}" aria-pressed="${recipe.name === selected?.name}"><b>${escape(recipe.name)}</b><span>${escape(recipe.description)}</span><i>${recipe.scope === "global" ? "Global" : "Project"}</i></button></li>`;
  function detail() {
    if (editing !== null) {
      return `<textarea class="recipe-json" aria-label="Recipe JSON" spellcheck="false">${escape(editing)}</textarea>
        <div class="recipe-actions"><button type="button" class="secondary-button" data-action="recipe-cancel">Cancel</button><button type="button" class="primary-button" data-action="recipe-save">Save</button></div>`;
    }
    if (!selected) return '<p class="recipe-empty">Choose a recipe, or create one.</p>';
    const rows = selected.steps.map((step, i) => {
      const report = plan?.steps[i];
      return `<tr><td>${i + 1}</td><td>${escape(step.kind)}</td><td class="recipe-text">${escape(summary(step))}</td><td>${report ? `<span class="recipe-status" data-status="${report.status}">${LABEL[report.status]}</span>` : ""}</td><td class="recipe-reason">${escape(report?.reason ?? "")}</td></tr>`;
    }).join("");
    const blocked = !plan || plan.steps.some((s) => s.status === "blocked");
    return `<h3>${escape(selected.name)}</h3><p class="recipe-description">${escape(selected.description)}</p>
      <table class="recipe-steps" aria-label="Dry run for ${escape(selected.name)}"><thead><tr><th>#</th><th>Step</th><th>What</th><th>Status</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="recipe-actions"><button type="button" class="secondary-button" data-action="recipe-delete">Delete</button><button type="button" class="secondary-button" data-action="recipe-edit">Edit</button><button type="button" class="primary-button" data-action="recipe-run" ${blocked || busy ? "disabled" : ""}>Run</button></div>`;
  }
  function draw() {
    root.innerHTML = `<section class="recipes" aria-label="Workflow recipes"><div class="recipe-list"><ul>${recipes.map(rowFor).join("")}</ul><button type="button" class="secondary-button" data-action="recipe-new">New recipe</button></div>
      <div class="recipe-detail">${detail()}<p class="recipe-message" role="status">${escape(message)}</p></div></section>`;
  }
  async function dryRun(recipe) {
    selected = recipe;
    plan = null;
    editing = null;
    message = "";
    draw();
    try {
      plan = await host.call("recipes_dry_run", { recipe, provider: host.provider, slash: await host.slashCommands() });
    } catch (error) {
      message = String(error);
    }
    draw();
  }
  async function reload(pick) {
    recipes = await host.call("recipes_list", { projectId: host.projectId });
    const next = recipes.find((r) => r.name === (pick ?? selected?.name));
    if (next) await dryRun(next);
    else {
      selected = null;
      plan = null;
      draw();
    }
  }
  root.addEventListener("click", async (event) => {
    const target = event.target;
    const pick = target.closest("[data-recipe]");
    if (pick) {
      const recipe = recipes.find((r) => r.name === pick.dataset.recipe);
      if (recipe) await dryRun(recipe);
      return;
    }
    const action = target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "recipe-new") {
        editing = JSON.stringify(NEW_RECIPE, null, 2);
        selected = null;
        message = "";
        draw();
      } else if (action === "recipe-edit" && selected) {
        editing = JSON.stringify({ name: selected.name, description: selected.description, steps: selected.steps }, null, 2);
        message = "";
        draw();
      } else if (action === "recipe-cancel") {
        editing = null;
        draw();
      } else if (action === "recipe-save") {
        const recipe = JSON.parse(root.querySelector(".recipe-json").value);
        await host.call("recipes_save", { projectId: host.projectId, scope: selected?.scope ?? "project", recipe });
        editing = null;
        await reload(recipe.name);
        message = "Saved.";
        draw();
      } else if (action === "recipe-delete" && selected) {
        await host.call("recipes_delete", { projectId: host.projectId, scope: selected.scope ?? "project", name: selected.name });
        selected = null;
        message = "Deleted.";
        await reload();
        message = "Deleted.";
        draw();
      } else if (action === "recipe-run" && plan && !busy) {
        busy = true;
        draw();
        const messages = plan.messages;
        for (const text of messages) await host.enqueue(text);
        busy = false;
        message = `Queued ${messages.length} ${messages.length === 1 ? "message" : "messages"}.`;
        draw();
        host.done?.(messages.length);
      }
    } catch (error) {
      busy = false;
      message = error instanceof SyntaxError ? `Not valid JSON: ${error.message}` : String(error);
      draw();
    }
  });
  void reload().catch((error) => {
    message = String(error);
    draw();
  });
  draw();
}
export {
  mountRecipes
};
