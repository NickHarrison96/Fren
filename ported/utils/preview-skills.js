const PROMPT = /* @__PURE__ */ new Set(["kimi", "opencode", "glm", "antigravity", "grok", "mimo", "pi", "deepseek", "commandcode", "cline", "omp", "muse"]);
const FILES = ["claude", "codex"];
const PROJECT_ROOT = "/Users/you/Projects/orbit";
function scan(file, text) {
  return text.split("\n").flatMap((line, index) => {
    const found = [];
    if (/\b(ghp_|sk-ant-|AKIA)[A-Za-z0-9_-]{12,}/.test(line)) found.push({ rule: "secret", file, line: index + 1, excerpt: line.replace(/(ghp_|sk-ant-|AKIA)[A-Za-z0-9_-]+/, "$1\u2026") });
    if (/dangerously-skip-permissions|danger-full-access|--yolo/i.test(line)) found.push({ rule: "approvals", file, line: index + 1, excerpt: line.trim() });
    if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/.test(line)) found.push({ rule: "pipe-to-shell", file, line: index + 1, excerpt: line.trim() });
    return found;
  });
}
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
const hash = (text) => [...text].reduce((h, c) => h * 31 + c.charCodeAt(0) >>> 0, 7).toString(16).padStart(8, "0").repeat(8);
function createPreviewSkills() {
  const entries = /* @__PURE__ */ new Map();
  const disk = /* @__PURE__ */ new Map();
  const key = (id, harness, scope) => `${harness}:${scope}:${id}`;
  const view = (entry) => structuredClone(entry.item);
  const list = () => [...entries.values()].sort((a, b) => a.item.id.localeCompare(b.item.id)).map(view);
  const find = (id) => {
    const entry = entries.get(String(id));
    if (!entry) throw new Error("That skill is not in the library.");
    return entry;
  };
  function add(kind, name, text, source, files) {
    const id = slug(name);
    if (!id) throw new Error("Give the skill a name in its frontmatter.");
    const previous = entries.get(id);
    if (previous && previous.item.kind !== kind) throw new Error(`A ${kind === "skill" ? "rule" : "skill"} named ${id} is already in the library.`);
    const main = kind === "skill" ? "SKILL.md" : "RULE.md";
    const sha256 = hash(text);
    const item = {
      id,
      name,
      kind,
      description: text.split("\n").find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---")) ?? "",
      sha256,
      importedAt: Date.now(),
      source,
      acknowledged: previous?.item.acknowledged === sha256 ? sha256 : null,
      activations: previous?.item.activations ?? [],
      files: files ?? [main],
      findings: scan(main, text)
    };
    entries.set(id, { item, text });
    return view({ item, text });
  }
  add("skill", "Release notes", "# Release notes\nWrites release notes from merged pull requests.", { kind: "github", location: "anthropics/skills/release-notes", gitRef: null, commit: "9f3c2a1b7e" }, ["SKILL.md", "templates/short.md"]);
  add("rule", "No force push", "Never force-push to main or release branches.", { kind: "folder", location: "/Users/you/rules/no-force-push.md", gitRef: null, commit: null });
  function cell(entry, harness, scope) {
    const activation = entry.item.activations.find((a) => a.harness === harness && a.scope === scope);
    const base = scope === "user" ? "~" : PROJECT_ROOT;
    const surface = PROMPT.has(harness) ? "prompt" : entry.item.kind === "skill" ? `${base}/.${harness}/skills/${entry.item.id}` : harness === "claude" ? `${base}/${scope === "user" ? ".claude/" : ""}CLAUDE.md` : `${base}/${scope === "user" ? ".codex/" : ""}AGENTS.md`;
    if (!activation) return { id: entry.item.id, scope, status: "off", surface };
    if (activation.surface === "prompt") return { id: entry.item.id, scope, status: "prompt", surface };
    const onDisk = disk.get(key(entry.item.id, harness, scope));
    const status = onDisk === void 0 ? "missing" : onDisk !== activation.sha256 ? "drifted" : activation.sha256 !== entry.item.sha256 ? "outdated" : "active";
    return { id: entry.item.id, scope, status, surface };
  }
  return {
    PROJECT_ROOT,
    /** Simulate a hand edit of an activated file. */
    edit(id, harness, scope) {
      disk.set(key(id, harness, scope), "edited");
    },
    list,
    importFolder(path, kind) {
      const text = String(path ?? "").trim();
      if (!text.startsWith("/")) throw new Error("Choose a folder or Markdown file.");
      const name = text.split("/").filter(Boolean).pop().replace(/\.md$/, "");
      const body = name.includes("setup") ? "# Setup\nInstall with `curl -fsSL https://example.com/install.sh | sh`." : `# ${name}
Imported from ${text}.`;
      return add(kind === "rule" ? "rule" : "skill", name, body, { kind: "folder", location: text, gitRef: null, commit: null });
    },
    importGithub(repo, path, gitRef, kind) {
      const name = String(repo ?? "").trim();
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) throw new Error("Enter the repository as owner/name.");
      const inner = String(path ?? "").replace(/^\/|\/$/g, "");
      return add(kind === "rule" ? "rule" : "skill", inner.split("/").pop() || name.split("/")[1], `# ${inner || name}
From GitHub.`, { kind: "github", location: inner ? `${name}/${inner}` : name, gitRef: gitRef || null, commit: "a1b2c3d4e5f6" });
    },
    activate(id, harness, scope, projectId, acknowledge) {
      const entry = find(id);
      const h = String(harness), s = scope;
      if (!FILES.includes(h) && !PROMPT.has(h)) throw new Error("Unknown harness.");
      if (s === "project" && !projectId) throw new Error("Choose a project for project scope.");
      if (entry.item.findings.length && entry.item.acknowledged !== entry.item.sha256) {
        if (!acknowledge) throw new Error(`Review the ${entry.item.findings.length} safety finding(s) before activating ${entry.item.name}.`);
        entry.item = { ...entry.item, acknowledged: entry.item.sha256 };
      }
      const k = key(entry.item.id, h, s);
      const previous = entry.item.activations.find((a) => a.harness === h && a.scope === s);
      if (previous && previous.surface !== "prompt" && disk.get(k) !== previous.sha256) throw new Error("That file was edited on disk; PandaCode will not overwrite it.");
      const activation = { harness: h, scope: s, project: s === "project" ? PROJECT_ROOT : null, surface: PROMPT.has(h) ? "prompt" : entry.item.kind === "skill" ? "folder" : "block", sha256: entry.item.sha256, files: [] };
      if (!PROMPT.has(h)) disk.set(k, entry.item.sha256);
      entry.item = { ...entry.item, activations: [...entry.item.activations.filter((a) => a !== previous), activation] };
      return { items: list(), kept: [] };
    },
    deactivate(id, harness, scope) {
      const entry = find(id);
      const previous = entry.item.activations.find((a) => a.harness === harness && a.scope === scope);
      if (!previous) throw new Error(`${entry.item.name} is not active there.`);
      const k = key(entry.item.id, String(harness), scope);
      const kept = previous.surface !== "prompt" && disk.has(k) && disk.get(k) !== previous.sha256 ? [cell(entry, String(harness), scope).surface] : [];
      if (!kept.length) disk.delete(k);
      entry.item = { ...entry.item, activations: entry.item.activations.filter((a) => a !== previous) };
      return { items: list(), kept };
    },
    scan(id) {
      return find(id).item.findings;
    },
    remove(id) {
      const entry = find(id);
      if (entry.item.activations.length) throw new Error(`Turn ${entry.item.name} off everywhere before removing it.`);
      entries.delete(entry.item.id);
      return list();
    },
    matrix(projectId) {
      const scopes = projectId ? ["user", "project"] : ["user"];
      const all = [...entries.values()];
      const used = new Set(all.flatMap((e) => e.item.activations.map((a) => a.harness)));
      const harnesses = [...FILES, ...[...PROMPT].filter((h) => used.has(h))].map((harness) => ({
        harness,
        installed: FILES.includes(harness),
        prompt: PROMPT.has(harness),
        cells: scopes.flatMap((scope) => all.map((entry) => cell(entry, harness, scope))),
        unmanaged: harness === "claude" ? [{ scope: "user", kind: "skill", path: "~/.claude/skills/pdf-tools", detail: "Not in the library." }] : []
      }));
      return { project: projectId ? PROJECT_ROOT : null, harnesses };
    },
    /** One entry point for `invoke` in src/preview.ts. */
    call(command, args) {
      switch (command) {
        case "skills_list":
          return list();
        case "skills_import_folder":
          return this.importFolder(args.path, args.kind);
        case "skills_import_github":
          return this.importGithub(args.repo, args.path, args.gitRef, args.kind);
        case "skills_activate":
          return this.activate(args.id, args.harness, args.scope, args.projectId, args.acknowledge);
        case "skills_deactivate":
          return this.deactivate(args.id, args.harness, args.scope);
        case "skills_matrix":
          return this.matrix(args.projectId);
        case "skills_scan":
          return this.scan(args.id);
        case "skills_remove":
          return this.remove(args.id);
        default:
          throw new Error(`Unknown preview command: ${command}`);
      }
    }
  };
}
export {
  createPreviewSkills
};
