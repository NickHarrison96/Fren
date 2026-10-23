import "./github-pull.css";
import { escape, icon, markdownHtml } from "./dom";
import { trackSegment } from "./motion";
const MERGE_LABEL = { squash: "Squash and merge", merge: "Create a merge commit", rebase: "Rebase and merge" };
const FRESH_FOR = 6e4;
const STATE_LABEL = { open: "Open", draft: "Draft", merged: "Merged", closed: "Closed" };
const REVIEW_LABEL = { approved: "Approved", changes_requested: "Changes requested", review_required: "Review required" };
const VERDICT_LABEL = { approved: "approved", changes_requested: "requested changes", commented: "reviewed", dismissed: "review dismissed" };
function ago(iso) {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - at) / 6e4));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 30) return `${Math.round(minutes / 1440)}d ago`;
  return new Date(at).toLocaleDateString(void 0, { month: "short", day: "numeric", year: "numeric" });
}
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
function fileSection(patch, path) {
  const sections = patch.split(/^(?=diff --git )/m);
  return sections.find((section) => {
    const header = section.slice(0, section.indexOf("\n"));
    return header.endsWith(` b/${path}`) || header.endsWith(` "b/${path}"`);
  }) ?? "";
}
function checksSummary(checks) {
  const count = (state) => checks.filter((check) => check.state === state).length;
  const failing = count("failure"), pending = count("pending");
  if (failing) return { tone: "failure", text: `${failing} failing of ${plural(checks.length, "check")}` };
  if (pending) return { tone: "pending", text: `${pending} running of ${plural(checks.length, "check")}` };
  return { tone: "success", text: `${plural(checks.length, "check")} passed` };
}
function createPullView(host) {
  const details = /* @__PURE__ */ new Map();
  const diffs = /* @__PURE__ */ new Map();
  let mounted;
  let requests = 0;
  function dispose() {
    mounted?.viewers.forEach((viewer) => viewer.dispose());
    mounted = void 0;
  }
  function show(target, session) {
    const link = session.pullRequest;
    if (!link) {
      dispose();
      target.innerHTML = `<div class="inspector-empty">${icon("pull")}<h3>No pull request</h3><p>Link one from the branch menu.</p></div>`;
      return;
    }
    const key = `${session.id}:${link.number}`;
    if (mounted?.key === key && mounted.root.parentElement === target) {
      mounted.session = session;
      return;
    }
    dispose();
    const root = document.createElement("div");
    root.className = "pull-view";
    root.addEventListener("click", (event) => void onClick(event));
    target.replaceChildren(root);
    mounted = { key, session, root, section: "overview", viewers: /* @__PURE__ */ new Map(), request: 0, merge: "idle", method: "squash" };
    void load(false);
  }
  async function load(force) {
    const view = mounted;
    if (!view) return;
    const hit = details.get(view.key);
    if (hit && !force && Date.now() - hit.at < FRESH_FOR) {
      await render(view, hit.detail);
      return;
    }
    const request = view.request = ++requests;
    if (hit) {
      await render(view, hit.detail);
      view.root.setAttribute("aria-busy", "true");
    } else view.root.innerHTML = `<div class="inspector-empty" role="status">${icon("pull")}<p>Loading pull request #${view.session.pullRequest?.number ?? ""}\u2026</p></div>`;
    try {
      const detail = await host.call("github_pull_request", { sessionId: view.session.id });
      details.set(view.key, { at: Date.now(), detail });
      if (force) diffs.delete(view.key);
      if (mounted === view && view.request === request) await render(view, detail);
    } catch (error) {
      if (mounted !== view || view.request !== request) return;
      const url = view.session.pullRequest?.url ?? "";
      view.root.innerHTML = `<div class="inspector-empty" role="alert">${icon("alert")}<h3>Unable to load the pull request</h3><p class="pull-error">${escape(error instanceof Error ? error.message : String(error))}</p><div class="pull-error-actions"><button class="secondary-button" data-pull-action="refresh">${icon("refresh")}Retry</button>${url ? `<button class="secondary-button" data-pull-action="open" data-url="${escape(url)}">${icon("globe")}Open on GitHub</button>` : ""}</div></div>`;
    } finally {
      if (mounted === view && view.request === request) view.root.removeAttribute("aria-busy");
    }
  }
  function mergeControls(detail, view) {
    if (detail.state !== "open") return "";
    if (detail.mergeable === "conflicting") return `<div class="pull-merge"><button class="primary-button" disabled title="Resolve the merge conflicts first">${icon("pull")}Merge</button><small>Resolve the conflicts before merging.</small></div>`;
    if (view.merge === "idle") return `<div class="pull-merge"><button class="primary-button" data-pull-action="merge-start">${icon("pull")}Merge</button></div>`;
    const busy = view.merge === "merging";
    const options = Object.keys(MERGE_LABEL).map((method) => `<option value="${method}" ${method === view.method ? "selected" : ""}>${MERGE_LABEL[method]}</option>`).join("");
    return `<div class="pull-merge pull-merge-confirm" role="group" aria-label="Merge pull request #${detail.number}">
      <select data-pull-merge-method aria-label="Merge method" ${busy ? "disabled" : ""}>${options}</select>
      <button class="primary-button" data-pull-action="merge-confirm" ${busy ? "disabled" : ""}>${busy ? "Merging\u2026" : `Confirm merge`}</button>
      <button class="secondary-button" data-pull-action="merge-cancel" ${busy ? "disabled" : ""}>Cancel</button>
    </div>`;
  }
  async function merge(view) {
    const detail = details.get(view.key)?.detail;
    if (!detail || view.merge === "merging") return;
    view.method = view.root.querySelector("[data-pull-merge-method]")?.value ?? view.method;
    view.merge = "merging";
    await render(view, detail);
    try {
      const saved = await host.call("github_merge_pull_request", { sessionId: view.session.id, method: view.method });
      if (mounted === view) {
        view.session = saved;
        view.merge = "idle";
      }
      host.notify(`Merged pull request #${detail.number}`);
      host.merged(saved);
      if (mounted === view) await load(true);
    } catch (error) {
      if (mounted !== view) return;
      view.merge = "confirm";
      await render(view, detail);
      host.notify(`Couldn\u2019t merge #${detail.number}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  function header(detail, view) {
    const state = detail.state || "open";
    const review = REVIEW_LABEL[detail.reviewDecision];
    const checks = detail.checks.length ? checksSummary(detail.checks) : null;
    const conflict = detail.mergeable === "conflicting" && state === "open";
    const badges = [
      review ? `<span class="pull-badge pull-review-${escape(detail.reviewDecision)}">${icon(detail.reviewDecision === "approved" ? "check" : "info")}${review}</span>` : "",
      checks ? `<span class="pull-badge pull-tone-${checks.tone}">${icon(checks.tone === "success" ? "check" : checks.tone === "failure" ? "close" : "refresh")}${checks.text}</span>` : "",
      conflict ? `<span class="pull-badge pull-tone-failure">${icon("alert")}Merge conflicts</span>` : ""
    ].join("");
    return `<header class="pull-header">
      <div class="pull-topline"><span class="pull-state pull-state-${escape(state)}">${icon("pull")}${STATE_LABEL[state] ?? escape(state)}</span><span class="pull-number">#${detail.number}</span>
        <span class="pull-actions"><button class="icon-button" data-pull-action="refresh" aria-label="Refresh pull request" title="Refresh">${icon("refresh")}</button><button class="icon-button" data-pull-action="open" data-url="${escape(detail.url)}" aria-label="Open on GitHub" title="Open on GitHub">${icon("globe")}</button><button class="icon-button" data-pull-action="unlink" aria-label="Unlink pull request" title="Unlink from this task">${icon("close")}</button></span></div>
      <h3 class="pull-title">${escape(detail.title)}</h3>
      <p class="pull-meta">${detail.author ? `<strong>${escape(detail.author)}</strong> \xB7 ` : ""}<code title="${escape(detail.head)}">${escape(detail.head)}</code><span class="pull-into" aria-label="into">\u2192</span><code>${escape(detail.base)}</code></p>
      <p class="pull-stats"><span class="pull-added">+${detail.additions}</span><span class="pull-removed">\u2212${detail.deletions}</span><span>${plural(detail.changedFiles, "file")}</span><span>${plural(detail.commits.length, "commit")}</span><span>${escape(state === "merged" ? `merged ${ago(detail.mergedAt)}` : `updated ${ago(detail.updatedAt)}`)}</span></p>
      ${badges ? `<div class="pull-badges">${badges}</div>` : ""}
      ${detail.labels.length ? `<div class="pull-labels">${detail.labels.map((label) => `<span>${escape(label)}</span>`).join("")}</div>` : ""}
      ${mergeControls(detail, view)}
    </header>`;
  }
  async function overview(detail) {
    const body = detail.body.trim() ? await markdownHtml(detail.body + (detail.bodyTruncated ? "\n\n*Description shortened; the rest is on GitHub.*" : "")) : '<p class="pull-muted">No description provided.</p>';
    const checks = detail.checks.length ? `<section class="pull-section"><h4>Checks</h4><ul class="pull-checks">${detail.checks.map((check) => `<li class="pull-tone-${escape(check.state)}">${icon(check.state === "success" ? "check" : check.state === "failure" ? "close" : check.state === "pending" ? "refresh" : "minimize")}${check.url ? `<button data-pull-action="open" data-url="${escape(check.url)}" title="Open details">${escape(check.name)}</button>` : `<span>${escape(check.name)}</span>`}</li>`).join("")}</ul></section>` : "";
    const entries = await Promise.all(detail.timeline.map(async (entry) => {
      const verdict = entry.kind === "review" ? VERDICT_LABEL[entry.state] ?? "reviewed" : "commented";
      const text = entry.body.trim() ? `<div class="pull-comment-body markdown">${await markdownHtml(entry.body)}</div>` : "";
      return `<li class="pull-comment pull-verdict-${escape(entry.state || "comment")}"><p class="pull-comment-meta"><strong>${escape(entry.author || "Someone")}</strong> ${verdict} \xB7 ${escape(ago(entry.createdAt))}</p>${text}</li>`;
    }));
    const conversation = entries.length ? `<section class="pull-section"><h4>Conversation <small>${entries.length}</small></h4><ol class="pull-timeline">${entries.join("")}</ol></section>` : "";
    return `<section class="pull-section"><h4>Description</h4><div class="pull-body markdown">${body}</div></section>${checks}${conversation}`;
  }
  function files(detail, view) {
    if (!detail.files.length) return '<p class="pull-muted pull-pad">No files changed.</p>';
    return `<ul class="pull-files">${detail.files.map((file) => {
      const open = view.viewers.has(file.path);
      const name = file.path.split("/").pop() ?? file.path, folder = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
      return `<li><button class="pull-file" data-pull-action="file" data-path="${escape(file.path)}" aria-expanded="${open}">${icon("chevron")}<span class="pull-file-name"><strong>${escape(name)}</strong>${folder ? `<small>${escape(folder)}</small>` : ""}</span><span class="pull-added">+${file.additions}</span><span class="pull-removed">\u2212${file.deletions}</span></button><div class="pull-file-diff" data-diff-path="${escape(file.path)}" ${open ? "" : "hidden"}></div></li>`;
    }).join("")}</ul>`;
  }
  function commits(detail) {
    if (!detail.commits.length) return '<p class="pull-muted pull-pad">No commits.</p>';
    return `<ol class="pull-commits">${[...detail.commits].reverse().map((commit) => `<li><span class="pull-commit-headline">${escape(commit.headline)}</span><span class="pull-commit-meta"><code>${escape(commit.oid)}</code>${commit.author ? ` \xB7 ${escape(commit.author)}` : ""} \xB7 ${escape(ago(commit.date))}</span></li>`).join("")}</ol>`;
  }
  async function render(view, detail) {
    const content = view.section === "overview" ? await overview(detail) : view.section === "files" ? files(detail, view) : commits(detail);
    if (mounted !== view) return;
    view.viewers.forEach((viewer) => viewer.dispose());
    view.viewers.clear();
    const tab = (id, label) => `<button role="tab" data-pull-action="section" data-section="${id}" aria-selected="${view.section === id}">${label}</button>`;
    view.root.innerHTML = `${header(detail, view)}<div class="pull-tabs" role="tablist" aria-label="Pull request sections">${tab("overview", "Overview")}${tab("files", `Files <small>${detail.files.length}</small>`)}${tab("commits", `Commits <small>${detail.commits.length}</small>`)}</div><div class="pull-content" role="tabpanel">${content}</div>`;
    const tabs = view.root.querySelector(".pull-tabs");
    trackSegment(tabs, tabs.querySelector('[aria-selected="true"]'));
  }
  async function toggleFile(view, button) {
    const path = button.dataset.path, diffHost = view.root.querySelector(`.pull-file-diff[data-diff-path="${CSS.escape(path)}"]`);
    if (!diffHost) return;
    const viewer = view.viewers.get(path);
    if (viewer) {
      viewer.dispose();
      view.viewers.delete(path);
      diffHost.hidden = true;
      diffHost.replaceChildren();
      button.setAttribute("aria-expanded", "false");
      return;
    }
    button.setAttribute("aria-expanded", "true");
    diffHost.hidden = false;
    diffHost.innerHTML = '<p class="pull-muted pull-pad" role="status">Loading diff\u2026</p>';
    try {
      let pending = diffs.get(view.key);
      if (!pending) {
        pending = host.call("github_pull_request_diff", { sessionId: view.session.id });
        diffs.set(view.key, pending);
        pending.catch(() => diffs.delete(view.key));
      }
      const [{ patch, truncated }, { mountDiffViewer }] = await Promise.all([pending, import("./diff-viewer")]);
      if (mounted !== view || !diffHost.isConnected || button.getAttribute("aria-expanded") !== "true") return;
      const section = fileSection(patch, path);
      if (!section) {
        diffHost.innerHTML = `<p class="pull-muted pull-pad">${truncated ? "This diff is too large to show here; open it on GitHub." : "No textual changes (binary or renamed file)."}</p>`;
        return;
      }
      diffHost.replaceChildren();
      view.viewers.set(path, mountDiffViewer(diffHost, { patch: section, path, layout: "unified", truncated: false }));
    } catch (error) {
      if (diffHost.isConnected) diffHost.innerHTML = `<p class="pull-error pull-pad" role="alert">${escape(error instanceof Error ? error.message : String(error))}</p>`;
    }
  }
  async function onClick(event) {
    const view = mounted;
    if (!view) return;
    const target = event.target.closest("[data-pull-action]");
    if (!target) return;
    const detail = details.get(view.key)?.detail;
    switch (target.dataset.pullAction) {
      case "refresh":
        await load(true);
        break;
      case "open":
        if (target.dataset.url) await host.openUrl(target.dataset.url);
        break;
      case "unlink":
        await host.unlink(view.session);
        break;
      case "merge-start":
        if (detail) {
          view.merge = "confirm";
          await render(view, detail);
          view.root.querySelector('[data-pull-action="merge-confirm"]')?.focus();
        }
        break;
      case "merge-cancel":
        if (detail) {
          view.merge = "idle";
          await render(view, detail);
        }
        break;
      case "merge-confirm":
        await merge(view);
        break;
      case "section":
        if (detail) {
          view.section = target.dataset.section;
          await render(view, detail);
          view.root.querySelector('[aria-selected="true"]')?.focus();
        }
        break;
      case "file":
        await toggleFile(view, target);
        break;
    }
  }
  function forget(sessionId) {
    for (const key of [...details.keys()]) if (key.startsWith(`${sessionId}:`)) details.delete(key);
    for (const key of [...diffs.keys()]) if (key.startsWith(`${sessionId}:`)) diffs.delete(key);
    if (mounted?.key.startsWith(`${sessionId}:`)) dispose();
  }
  return { show, dispose, forget };
}
export {
  createPullView,
  fileSection
};
