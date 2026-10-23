import "./worktrees.css";
import { escape, icon } from "./dom";
import { githubEnabled } from "./github";
function worktreeMissing(session, gitError) {
  return Boolean(session?.worktreePath) && /worktree/i.test(gitError);
}
function suggestBranch(session, draft) {
  const source = session?.issue ? `${session.issue.number} ${session.issue.title}` : session && session.title !== "New conversation" ? session.title : draft;
  const words = source.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  let slug = "";
  for (const word of words) {
    if (slug && slug.length + 1 + word.length > 40) break;
    slug = slug ? `${slug}-${word}` : word.slice(0, 40);
  }
  return slug;
}
function finalBranchName(name) {
  const trimmed = name.trim();
  return /^(pandacode|kingcode|codex)\//.test(trimmed) ? trimmed : trimmed ? `pandacode/${trimmed}` : "";
}
const BRANCH_PATTERN = /^(?!.*\.\.)[A-Za-z0-9_/-]+$/;
function createWorktrees(host) {
  let cleanup;
  function checkoutLabel(session) {
    return session.worktreePath ? "Worktree" : "Local";
  }
  function contextBar(session, fresh) {
    const project = host.project(), git = host.git(), missing = worktreeMissing(session, host.gitError());
    const branch = session.worktreePath && (missing || !git?.branch) ? session.worktreeBranch || "" : git?.branch || "";
    const path = session.worktreePath ?? project?.path ?? "";
    const projectControl = fresh ? `<button type="button" id="composer-project" class="composer-project" data-action="change-task-project" aria-label="Change task project" aria-haspopup="dialog" aria-expanded="false" title="${escape(project?.path)}" ${session.worktreePath ? "disabled" : ""}>${icon("folder")}<span>${escape(project?.name)}</span>${icon("down")}</button>` : `<span class="composer-project composer-project-fixed" title="${escape(project?.path)}">${icon("folder")}<span>${escape(project?.name)}</span></span>`;
    const chip = session.remoteDevice ? `<span class="branch-chip branch-chip-fixed" title="Branch actions run on ${escape(session.remoteDevice.name)}, not here.">${icon(session.worktreePath ? "worktree" : "branch")}<span class="branch-chip-name">${escape(session.worktreeBranch || "Remote checkout")}</span></span>` : git?.isRepo || session.worktreePath ? `<button type="button" id="branch-chip" class="branch-chip ${missing ? "branch-chip-missing" : ""}" data-action="branch-menu" aria-label="Branch and worktree actions" aria-haspopup="dialog" aria-expanded="false" title="${escape(path)}">${icon(missing ? "alert" : "branch")}<span class="branch-chip-name">${escape(missing ? "Worktree missing" : branch || "Detached HEAD")}</span>${icon("down")}</button>` : "";
    const links = [session.issue, session.pullRequest].filter(Boolean).map((link) => linkChip(link, session.id)).join("");
    return `<div class="composer-context ${fresh ? "" : "composer-context-compact"}">${projectControl}${host.computer(session, fresh)}<span class="composer-local" title="${escape(path)}">${icon(session.worktreePath ? "worktree" : "terminal")}${checkoutLabel(session)}</span>${chip}${links}</div>`;
  }
  async function showMenu(anchor) {
    const session = host.session();
    if (!session || session.remoteDevice) return;
    const project = host.project(), git = host.git(), missing = worktreeMissing(session, host.gitError());
    const path = session.worktreePath ?? project?.path ?? "";
    const branch = missing ? session.worktreeBranch || "unknown branch" : git?.branch || session.worktreeBranch || "Detached HEAD";
    const items = [{ id: "checkout", label: branch, description: `${checkoutLabel(session)} \xB7 ${path}`, icon: session.worktreePath ? "worktree" : "branch", disabled: true }];
    if (missing) {
      items.push({ id: "worktree-recreate", label: "Recreate worktree", description: "Check the branch out again at the same path.", icon: "refresh" });
      items.push({ id: "archive-task", label: "Archive task", description: "Keep the history; forget the checkout.", icon: "archive" });
    } else if (session.worktreePath) {
      const target = (await host.call("git_branches", { projectId: session.projectId, sessionId: session.id }).catch(() => null))?.defaultBranch || "main";
      items.push({ id: "worktree-merge", label: `Merge into ${target}`, description: host.running() ? "Wait for the agent to finish." : "Locally, in the project checkout. Commit first.", icon: "merge", disabled: host.running() });
      items.push(...host.extraItems(session));
      items.push({ id: "worktree-remove", label: "Remove worktree\u2026", description: "Archives the task; refuses when work would be lost.", icon: "close", disabled: host.running() });
      items.push({ id: "copy-path", label: "Copy worktree path", icon: "copy" });
    } else {
      const list = await host.call("git_branches", { projectId: session.projectId, sessionId: session.id }).catch(() => null);
      if (list) {
        const busy = host.running(), others = list.branches.filter((name) => name !== list.current);
        if (list.defaultBranch && list.defaultBranch !== list.current) items.push({ id: "switch-default", label: `Switch to ${list.defaultBranch}`, description: busy ? "Wait for the agent to finish." : "Uncommitted changes come along when they don\u2019t conflict.", icon: "branch", disabled: busy });
        if (others.length) items.push({ id: "switch-other", label: "Other branch\u2026", description: busy ? "Wait for the agent to finish." : `${others.length} local ${others.length === 1 ? "branch" : "branches"}`, icon: "branch", disabled: busy });
      }
      if (host.attachable()) items.push({ id: "worktree-attach", label: "Work in a new worktree\u2026", description: "Keeps this draft and task; isolates its changes.", icon: "worktree" });
      else items.push({ id: "worktree-new", label: "New task in a worktree\u2026", description: "Same harness and model, in an isolated checkout.", icon: "worktree" });
      items.push(...host.extraItems(session));
      items.push({ id: "copy-path", label: "Copy project path", icon: "copy" });
    }
    await host.showChoices(anchor, { title: "Branch and worktree", width: 320, actions: true, items, onSelect: async (id) => {
      const current = host.session();
      if (!current || current.id !== session.id) return;
      switch (id) {
        case "worktree-attach":
          openDialog("attach");
          break;
        case "worktree-new":
          openDialog("new");
          break;
        case "worktree-remove":
          await removeInteractive(current);
          break;
        case "worktree-merge":
          await merge(current);
          break;
        case "worktree-recreate":
          await recreate(current);
          break;
        case "switch-default":
          await switchTo(current, "");
          break;
        // The picker replaces this menu, so it opens once this one has closed.
        case "switch-other":
          window.setTimeout(() => void pickBranch(current, anchor), 0);
          break;
        case "archive-task":
          await host.archive(current);
          break;
        case "copy-path":
          await navigator.clipboard.writeText(path);
          host.notify(current.worktreePath ? "Worktree path copied" : "Project path copied");
          break;
        default:
          await host.onExtra(id, current, anchor);
      }
    } });
  }
  async function switchTo(session, branch) {
    try {
      const target = branch || (await host.call("git_branches", { projectId: session.projectId, sessionId: session.id })).defaultBranch;
      if (!target) {
        host.notify("This repository has no main branch.");
        return;
      }
      const list = await host.call("git_switch_branch", { projectId: session.projectId, sessionId: session.id, branch: target });
      host.notify(`Switched to ${list.current}`);
      window.setTimeout(() => void host.branchChanged(), 0);
    } catch (cause) {
      host.notify(`Couldn\u2019t switch branches: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  async function pickBranch(session, anchor) {
    const list = await host.call("git_branches", { projectId: session.projectId, sessionId: session.id }).catch(() => null);
    const others = list?.branches.filter((name) => name !== list.current) ?? [];
    if (!others.length) {
      host.notify("There are no other local branches.");
      return;
    }
    const target = anchor.isConnected ? anchor : document.querySelector("#branch-chip");
    if (!target) return;
    await host.showChoices(target, { title: "Switch branch", width: 320, ...others.length > 8 ? { searchPlaceholder: "Search branches\u2026" } : {}, items: others.map((name) => ({ id: name, label: name, icon: "branch", ...name === list?.defaultBranch ? { description: "main branch" } : {} })), onSelect: async (name) => {
      const current = host.session();
      if (current?.id === session.id) await switchTo(current, name);
    } });
  }
  function openDialog(mode, initialBranch = "") {
    const session = host.session();
    if (!session) {
      host.notify("Start a task before creating a worktree.");
      return;
    }
    const project = host.project(), git = host.git();
    const suggested = initialBranch || suggestBranch(session, host.draft());
    const description = mode === "attach" ? `This task keeps its draft, harness, and model, and its changes stay in an isolated checkout beside ${escape(project?.name)}.` : `Start a new task in an isolated checkout of ${escape(project?.name)}. It inherits this task's harness and model.`;
    const dialog = host.modal(mode === "attach" ? "Work in a new worktree" : "New task in a worktree", `<form id="worktree-form" data-mode="${mode}" data-session-id="${escape(session.id)}"><p class="dialog-description">${description}</p><label class="field-label" for="branch-name">Branch name</label><input id="branch-name" name="branch" value="${escape(suggested)}" placeholder="my-feature" required pattern="[A-Za-z0-9_\\/\\-]+" maxlength="120" autocomplete="off" spellcheck="false"><p class="field-help worktree-preview" id="branch-preview" data-live></p><label class="field-label" for="branch-base">Start from</label><select id="branch-base" name="base" aria-describedby="branch-base-help"><option value="">${escape(git?.branch ? `Current branch (${git.branch})` : "Current HEAD")}</option></select><p class="field-help" id="branch-base-help">Local branches load from the ${session.worktreePath ? "worktree" : "project"} checkout.</p><label class="worktree-existing" hidden><input type="checkbox" name="existing"><span>Use the existing branch instead of creating one</span></label><p class="worktree-error field-help" role="alert" hidden></p><div class="dialog-footer"><button type="button" class="secondary-button" data-action="close-dialog">Cancel</button><button class="primary-button">${mode === "attach" ? "Use a worktree" : "Create worktree task"}</button></div></form>`, "compact-dialog worktree-dialog");
    const input = dialog.querySelector("#branch-name"), preview = dialog.querySelector("#branch-preview");
    const update = () => {
      const final = finalBranchName(input.value);
      preview.innerHTML = final ? `Creates <code>${escape(final)}</code> in <code>${escape((project?.path ?? "").replace(/\/[^/]*$/, ""))}/${escape(project?.name)}-worktrees/${escape(final.replaceAll("/", "-"))}</code>` : "Names may use letters, numbers, hyphens, underscores, and slashes.";
      preview.classList.toggle("worktree-preview-invalid", Boolean(input.value) && !BRANCH_PATTERN.test(input.value.trim()));
    };
    input.addEventListener("input", update);
    update();
    input.focus();
    input.select();
    const select = dialog.querySelector("#branch-base");
    void host.call("git_branches", { projectId: session.projectId, sessionId: session.id }).then((list) => {
      if (!select.isConnected) return;
      for (const name of list.branches) if (name !== list.current) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.append(option);
      }
    }).catch(() => {
    });
  }
  async function submit(form, data) {
    if (form.id === "worktree-cleanup-form") {
      const pending = cleanup;
      cleanup = void 0;
      if (pending) {
        pending.resolve({ proceed: true, remove: data.get("remove") === "on" });
        host.closeModal();
      }
      return true;
    }
    if (form.id !== "worktree-form") return false;
    const session = host.session();
    const mode = form.dataset.mode;
    if (!session || session.id !== form.dataset.sessionId) {
      host.closeModal();
      return true;
    }
    const branch = String(data.get("branch") ?? "").trim(), base = String(data.get("base") ?? "").trim(), existing = data.get("existing") === "on";
    const error = form.querySelector(".worktree-error"), existingRow = form.querySelector(".worktree-existing");
    if (!BRANCH_PATTERN.test(branch)) {
      error.textContent = "Use letters, numbers, hyphens, underscores, and slashes.";
      error.hidden = false;
      return true;
    }
    try {
      const saved = await host.call(mode === "attach" ? "attach_worktree" : "create_worktree", { sessionId: session.id, branch, ...base ? { base } : {}, existing });
      const live = form.isConnected && Boolean(form.closest("dialog[open]"));
      if (mode === "attach") await host.afterAttach(saved, live);
      else await host.afterCreate(saved, live, host.session()?.id === session.id);
      host.notify(mode === "attach" ? `Working in ${saved.worktreeBranch ?? finalBranchName(branch)}` : "Worktree task created");
    } catch (cause) {
      if (!form.isConnected) return true;
      const message = cause instanceof Error ? cause.message : String(cause);
      error.textContent = message;
      error.hidden = false;
      if (/already exists/.test(message) && !existing) {
        existingRow.hidden = false;
        existingRow.querySelector("input").focus();
      }
    }
    return true;
  }
  function cleanupOffer(session, intent) {
    if (!session.worktreePath) return Promise.resolve({ proceed: true, remove: false });
    return host.call("worktree_status", { sessionId: session.id }).catch(() => void 0).then((status) => new Promise((resolve) => {
      if (!status) {
        resolve({ proceed: true, remove: false });
        return;
      }
      if (!status.exists && intent !== "remove") {
        resolve({ proceed: true, remove: false });
        return;
      }
      const verb = intent === "archive" ? "Archive task" : intent === "complete" ? "Mark complete" : "Remove worktree";
      const branch = status.branch || session.worktreeBranch || "its branch";
      const unpublished = !status.merged && (!status.hasUpstream || status.ahead > 0);
      let summary, control = "";
      if (!status.exists) summary = `The worktree folder is already gone. ${verb === "Remove worktree" ? "Its registration is pruned and the task is archived." : ""}`;
      else if (!status.clean) summary = `Its worktree has ${status.changes} uncommitted change${status.changes === 1 ? "" : "s"}, so the checkout stays at <code>${escape(session.worktreePath)}</code>.${intent === "remove" ? " Commit or discard them first." : ""}`;
      else {
        summary = `Its worktree is clean${status.merged ? " and its branch is merged" : unpublished ? `, but <strong>${escape(branch)}</strong> has commits that are not pushed or merged` : ""}.`;
        control = `<label class="worktree-cleanup-option"><input type="checkbox" name="remove" ${intent === "remove" || !unpublished ? "checked" : ""}><span>Remove the worktree folder${status.merged ? ` and delete <code>${escape(branch)}</code>` : `; <code>${escape(branch)}</code> is kept until it is merged`}</span></label>`;
      }
      const canProceed = intent !== "remove" || (status.exists ? status.clean : true);
      const dialog = host.modal(verb, `<form id="worktree-cleanup-form" data-session-id="${escape(session.id)}"><p class="dialog-description">${summary}</p>${control}<div class="dialog-footer"><button type="button" class="secondary-button" data-action="close-dialog">Cancel</button><button class="primary-button" ${canProceed ? "" : "disabled"}>${intent === "remove" ? "Remove and archive" : verb}</button></div></form>`, "compact-dialog worktree-dialog");
      cleanup?.resolve({ proceed: false, remove: false });
      cleanup = { resolve, dialog };
      dialog.addEventListener("close", () => {
        if (cleanup?.dialog === dialog) {
          cleanup = void 0;
          resolve({ proceed: false, remove: false });
        }
      }, { once: true });
    }));
  }
  async function remove(session) {
    const removal = await host.call("remove_worktree", { sessionId: session.id, deleteBranch: true });
    host.notify(removal.note || (removal.branchDeleted ? `Removed the worktree and deleted ${removal.branch}` : removal.removed ? `Removed the worktree; ${removal.branch} is kept` : "Worktree registration pruned"));
    return removal;
  }
  async function removeInteractive(session) {
    const decision = await cleanupOffer(session, "remove");
    if (!decision.proceed) return;
    if (decision.remove || !(await host.call("worktree_status", { sessionId: session.id })).exists) await remove(session);
    await host.archive(session);
  }
  async function merge(session) {
    let merged;
    try {
      merged = await host.call("merge_worktree", { sessionId: session.id });
    } catch (cause) {
      host.notify(`Couldn\u2019t merge: ${cause instanceof Error ? cause.message : String(cause)}`);
      return;
    }
    const moved = merged.switchedFrom ? ` (the project checkout moved from ${merged.switchedFrom})` : "";
    host.notify(merged.commits ? `Merged ${merged.commits} commit${merged.commits === 1 ? "" : "s"} from ${merged.branch} into ${merged.target}${moved}` : `${merged.target} already has everything from ${merged.branch}`);
    window.setTimeout(() => void host.branchChanged(), 0);
    await removeInteractive(session);
  }
  async function recreate(session) {
    const restored = await host.call("recreate_worktree", { sessionId: session.id });
    await host.afterAttach(restored, false);
    host.notify(`Worktree restored on ${restored.worktreeBranch ?? "its branch"}`);
  }
  return { contextBar, showMenu, openDialog, submit, cleanupOffer, remove, removeInteractive, recreate };
}
function linkChip(link, sessionId) {
  if (!githubEnabled()) return "";
  const label = link.kind === "pull" ? `PR #${link.number}` : `#${link.number}`;
  const action = link.kind === "pull" && sessionId ? `data-action="open-pull" data-session-id="${escape(sessionId)}"` : `data-action="open-url" data-url="${escape(link.url)}"`;
  return `<button type="button" class="link-chip link-chip-${escape(link.state || "open")}" ${action} title="${escape(link.title)}" aria-label="${escape(`${link.kind === "pull" ? "Pull request" : "Issue"} ${link.number}: ${link.title} (${link.state})`)}">${icon(link.kind === "pull" ? "pull" : "issue")}<span>${label}</span><span class="link-chip-state">${escape(link.state || "open")}</span></button>`;
}
export {
  createWorktrees,
  finalBranchName,
  linkChip,
  suggestBranch,
  worktreeMissing
};
