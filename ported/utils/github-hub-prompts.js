const PULL_ACTIONS = [
  { id: "thread", label: "Open in thread", icon: "chat" },
  { id: "checks", label: "Fix failing checks", icon: "check" },
  { id: "feedback", label: "Address review comments", icon: "edit" },
  { id: "merge", label: "Merge when ready", icon: "branch" }
];
function pullPrompt(action, pull) {
  const ref = `#${pull.number}`;
  switch (action) {
    case "review":
      return `Review pull request ${ref} (${pull.head} \u2192 ${pull.base}). Check it out with \`gh pr checkout ${pull.number}\`, read the whole diff against ${pull.base} and run the tests. Report bugs, risky changes and missing tests with file and line references, and suggest fixes. Don't push or comment on GitHub unless I ask.`;
    case "checks":
      return `Pull request ${ref} has failing checks. Check it out with \`gh pr checkout ${pull.number}\`, see what failed with \`gh pr checks ${pull.number}\`, reproduce it locally, fix it and push to ${pull.head}. Then tell me what was wrong.`;
    case "feedback":
      return `Address the review comments on pull request ${ref}. Read them with \`gh pr view ${pull.number} --comments\`, make the requested changes on ${pull.head}, run the tests, push, and summarize what changed for each comment.`;
    case "merge":
      return `Get pull request ${ref} merged if it's ready: checks pass (\`gh pr checks ${pull.number}\`), it's approved and it merges cleanly into ${pull.base}. If so, merge it with \`gh pr merge ${pull.number} --squash --delete-branch\`. If anything blocks it, don't merge; tell me what's blocking and how to fix it.`;
    case "thread":
      return `Let's work on pull request ${ref}: `;
  }
}
function issuePrompt(action, issue) {
  const ref = `#${issue.number}`;
  return action === "solve" ? `Fix issue ${ref}: ${issue.title}. Work on a new branch, make the change, add or update tests and run them. When it's done, summarize what changed and offer to open a pull request that closes ${ref}.` : `Let's work on issue ${ref}: `;
}
function runPrompt(run) {
  if (run.state === "not_started") return `The "${run.workflow}" workflow run ${run.id} on ${run.branch} didn't start: GitHub reported a startup failure, so no job ran and there are no logs. The workflow file is likely invalid: a YAML or schema error, an action or reusable workflow that doesn't exist, or a \`runs-on\` label no runner has. Find the file under .github/workflows (\`gh run view ${run.id}\` names it), validate it (use \`actionlint\` if it's installed), fix it and explain what was wrong. Don't push unless I ask.`;
  const attempts = (run.attempt ?? 1) > 1 ? ` This was attempt ${run.attempt}; compare it with earlier attempts (\`gh run view ${run.id} --attempt N\`) to tell a flaky failure from a real one.` : "";
  return `The "${run.workflow}" workflow run ${run.id} on ${run.branch} failed. See what failed with \`gh run view ${run.id} --log-failed\`, check out ${run.branch}, reproduce the failure locally, fix it and run the tests.${attempts} Summarize what was wrong and what you changed; don't push unless I ask.`;
}
const WORKFLOW_CHECK_TITLE = "Check workflow files";
const workflowCheckPrompt = (repo) => `Check the GitHub Actions workflow files of ${repo} in this checkout (.github/workflows/*.yml and *.yaml) for anything that stops GitHub from starting a run: YAML syntax errors, schema errors (use \`actionlint\` if it's installed), \`runs-on\` labels no GitHub-hosted or self-hosted runner has, and \`uses:\` references to actions or reusable workflows that don't exist (check \`owner/repo@ref\` with \`gh api repos/OWNER/REPO\` and that the ref exists; local \`./\` paths must exist). List each file with what's wrong, and for each valid workflow its jobs and their steps. Don't change anything unless I ask.`;
const runTitle = (run) => (run.state === "not_started" ? `Fix ${run.workflow} workflow file` : `Fix ${run.workflow} on ${run.branch}`).slice(0, 120);
function threadTitle(kind, action, item) {
  const verb = kind === "issue" ? action === "solve" ? "Fix" : "Issue" : { review: "Review", checks: "Fix checks on", feedback: "Address review on", merge: "Merge", thread: "PR" }[action];
  return `${verb} #${item.number}: ${item.title}`.slice(0, 120);
}
function age(iso, now = Date.now()) {
  const at = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(0, Math.round((now - at) / 6e4));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  if (minutes < 60 * 24 * 30) return `${Math.round(minutes / 1440)}d`;
  return `${Math.round(minutes / 43200)}mo`;
}
const RECENT_DAYS = 30;
function isRecent(pushedAt, now = Date.now()) {
  const at = Date.parse(pushedAt);
  return Number.isFinite(at) && now - at <= RECENT_DAYS * 864e5;
}
function connectAdvice(error) {
  if (/not found|no such file|cannot find|failed to start|program not found/i.test(error)) return "PandaCode uses the GitHub CLI. Install it (for example <code>brew install gh</code>), then try again.";
  if (/auth login|not logged|authenticat|token/i.test(error)) return "Sign in to the GitHub CLI by running <code>gh auth login</code> in a terminal, then try again.";
  return "PandaCode couldn\u2019t reach GitHub through the GitHub CLI. Check your connection, then try again.";
}
export {
  PULL_ACTIONS,
  RECENT_DAYS,
  WORKFLOW_CHECK_TITLE,
  age,
  connectAdvice,
  isRecent,
  issuePrompt,
  pullPrompt,
  runPrompt,
  runTitle,
  threadTitle,
  workflowCheckPrompt
};
