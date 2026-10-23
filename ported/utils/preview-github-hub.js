const day = 864e5;
const at = (ago) => new Date(Date.now() - ago).toISOString();
const previewRepos = [
  { nameWithOwner: "orbit-labs/orbit", description: "A calm reading list that syncs everywhere.", private: false, fork: false, archived: false, pushedAt: at(20 * 6e4), url: "https://github.com/orbit-labs/orbit", defaultBranch: "main", openIssues: 6, language: "TypeScript" },
  { nameWithOwner: "orbit-labs/orbit-api", description: "Sync and search service for Orbit.", private: true, fork: false, archived: false, pushedAt: at(3 * 36e5), url: "https://github.com/orbit-labs/orbit-api", defaultBranch: "main", openIssues: 3, language: "Rust" },
  { nameWithOwner: "you/dotfiles", description: "Shell, editor and terminal setup.", private: false, fork: false, archived: false, pushedAt: at(2 * day), url: "https://github.com/you/dotfiles", defaultBranch: "main", openIssues: 0, language: "Shell" },
  { nameWithOwner: "you/meadow", description: "Weekend side project: a tiny garden planner.", private: true, fork: false, archived: false, pushedAt: at(9 * day), url: "https://github.com/you/meadow", defaultBranch: "main", openIssues: 2, language: "Swift" },
  { nameWithOwner: "you/tauri", description: "Fork for a WebView patch.", private: false, fork: true, archived: false, pushedAt: at(40 * day), url: "https://github.com/you/tauri", defaultBranch: "dev", openIssues: 0, language: "Rust" }
];
const pulls = {
  "orbit-labs/orbit": [
    { number: 130, title: "Debounce library search and cache the index", author: "you", state: "open", head: "feat/instant-search", base: "main", updatedAt: at(25 * 6e4), url: "https://github.com/orbit-labs/orbit/pull/130", review: "review_required", checks: "passing", additions: 86, deletions: 31, labels: ["performance"] },
    { number: 127, title: "Offline sync for the reading list", author: "mara", state: "draft", head: "mara/offline-sync", base: "main", updatedAt: at(4 * 36e5), url: "https://github.com/orbit-labs/orbit/pull/127", review: "", checks: "pending", additions: 412, deletions: 58, labels: ["sync"] },
    { number: 124, title: "Fix dark mode contrast for muted text", author: "devon", state: "open", head: "devon/contrast", base: "main", updatedAt: at(day), url: "https://github.com/orbit-labs/orbit/pull/124", review: "changes_requested", checks: "failing", additions: 14, deletions: 9, labels: ["design", "a11y"] },
    { number: 119, title: "Bump vite from 7.1 to 7.3", author: "dependabot", state: "open", head: "dependabot/npm/vite-7.3", base: "main", updatedAt: at(3 * day), url: "https://github.com/orbit-labs/orbit/pull/119", review: "approved", checks: "passing", additions: 22, deletions: 22, labels: ["dependencies"] }
  ],
  "orbit-labs/orbit-api": [
    { number: 52, title: "Stream search results over SSE", author: "you", state: "open", head: "feat/sse", base: "main", updatedAt: at(5 * 36e5), url: "https://github.com/orbit-labs/orbit-api/pull/52", review: "review_required", checks: "passing", additions: 230, deletions: 40, labels: [] }
  ]
};
const issues = {
  "orbit-labs/orbit": [
    { number: 131, title: "Keyboard shortcut cheat sheet", author: "devon", updatedAt: at(2 * 36e5), url: "https://github.com/orbit-labs/orbit/issues/131", comments: 4, labels: ["enhancement"], assignees: [] },
    { number: 128, title: "Search index rebuilds on every keystroke", author: "mara", updatedAt: at(3 * 36e5), url: "https://github.com/orbit-labs/orbit/issues/128", comments: 7, labels: ["bug", "performance"], assignees: ["you"] },
    { number: 126, title: "Export highlights as Markdown", author: "sam", updatedAt: at(day), url: "https://github.com/orbit-labs/orbit/issues/126", comments: 2, labels: ["enhancement"], assignees: [] },
    { number: 97, title: "Dark mode contrast for muted text", author: "you", updatedAt: at(2 * day), url: "https://github.com/orbit-labs/orbit/issues/97", comments: 3, labels: ["design", "a11y"], assignees: ["you"] },
    { number: 88, title: "Crash when importing an empty OPML file", author: "kai", updatedAt: at(6 * day), url: "https://github.com/orbit-labs/orbit/issues/88", comments: 1, labels: ["bug"], assignees: [] }
  ],
  "orbit-labs/orbit-api": [
    { number: 41, title: "Rate-limit the search endpoint per token", author: "you", updatedAt: at(day), url: "https://github.com/orbit-labs/orbit-api/issues/41", comments: 0, labels: ["security"], assignees: [] }
  ],
  "you/meadow": [
    { number: 3, title: "Frost dates by postcode", author: "you", updatedAt: at(8 * day), url: "https://github.com/you/meadow/issues/3", comments: 0, labels: [], assignees: [] }
  ]
};
const minute = 6e4;
const run = (id, workflow, title, branch, state, ago, more = {}) => ({ id, workflow, title, branch, event: "pull_request", state, createdAt: at(ago), startedAt: at(ago - 1e4), updatedAt: at(Math.max(0, ago - 4 * minute - 4e4)), url: `https://github.com/orbit-labs/orbit/actions/runs/${id}`, attempt: 1, pulls: [], ...more });
const runs = {
  "orbit-labs/orbit": [
    run(9120, "CI", "Offline sync for the reading list", "mara/offline-sync", "in_progress", 4 * minute, { pulls: [127] }),
    run(9118, "Deploy preview", "Offline sync for the reading list", "mara/offline-sync", "queued", 5 * minute),
    run(9105, "CI", "Debounce library search and cache the index", "feat/instant-search", "passed", 30 * minute, { pulls: [130] }),
    run(9098, "CI", "Debounce library search and cache the index", "feat/instant-search", "failed", 3 * 36e5, { pulls: [130] }),
    run(9087, "CI", "Fix dark mode contrast for muted text", "devon/contrast", "failed", day, { pulls: [124], attempt: 2 }),
    run(9060, ".github/workflows/nightly.yml", "Nightly", "main", "not_started", day + 36e5, { event: "schedule" }),
    run(9050, "Release", "chore: release 1.4.0", "main", "cancelled", 2 * day, { event: "push" })
  ]
};
const steps = (start, ...items) => items.map(([name, state, ms]) => ({ name, state, startedAt: at(start), completedAt: at(start - ms) }));
const runDetails = {
  9087: {
    jobs: [
      { id: 1, name: "lint", state: "passed", startedAt: at(day), completedAt: at(day - 45e3), url: "https://github.com/orbit-labs/orbit/actions/runs/9087/job/1", steps: steps(day, ["Checkout", "passed", 2e3], ["Run lint", "passed", 4e4]), summary: "" },
      {
        id: 2,
        name: "test (ubuntu-latest)",
        state: "failed",
        startedAt: at(day),
        completedAt: at(day - 4 * minute - 3e4),
        url: "https://github.com/orbit-labs/orbit/actions/runs/9087/job/2",
        steps: steps(day, ["Checkout", "passed", 2e3], ["Install", "passed", 5e4], ["Run tests", "failed", 3 * minute + 3e4]),
        summary: "### Test results\n\n**2 failed**, 184 passed\n\n- `contrast.spec.ts` \u203A muted text meets 4.5:1\n- `contrast.spec.ts` \u203A links in dark mode\n\n<script>alert(1)<\/script>"
      }
    ],
    artifacts: [{ name: "playwright-report", size: 24e5, expired: false }, { name: "coverage", size: 18432, expired: true }],
    attempts: [{
      attempt: 1,
      state: "failed",
      startedAt: at(day + 2 * 36e5),
      updatedAt: at(day + 2 * 36e5 - 3 * minute),
      url: "https://github.com/orbit-labs/orbit/actions/runs/9087/attempts/1",
      jobs: [{ id: 3, name: "test (ubuntu-latest)", state: "failed", startedAt: at(day + 2 * 36e5), completedAt: at(day + 2 * 36e5 - 3 * minute), url: "https://github.com/orbit-labs/orbit/actions/runs/9087/job/3", steps: steps(day + 2 * 36e5, ["Run tests", "failed", 2 * minute]), summary: "" }]
    }]
  }
};
const previewHub = {
  runs: (repo) => structuredClone(runs[repo] ?? []),
  runDetails: (repo, id) => structuredClone(repo in runs ? runDetails[id] ?? { jobs: [], artifacts: [], attempts: [] } : { jobs: [], artifacts: [], attempts: [] }),
  pulls: (repo) => structuredClone(pulls[repo] ?? []),
  issues: (repo) => structuredClone(issues[repo] ?? [])
};
export {
  previewHub,
  previewRepos
};
