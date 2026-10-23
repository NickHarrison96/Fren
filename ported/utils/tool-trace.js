import { escape, icon } from "./dom.ts";
const MAX_SCAN = 2e4;
const MAX_TEXT = 140;
const LIST_ITEMS = 6;
const PREVIEW_LINES = 8;
const DIFF_LINES = 14;
const OMITTED = "[Non-text content omitted]";
const KINDS = {
  shell: ["Running", "Ran", "terminal", "command", "commands"],
  read: ["Reading", "Read", "file", "file", "files"],
  edit: ["Editing", "Edited", "edit", "file", "files"],
  write: ["Writing", "Wrote", "plus", "file", "files"],
  search: ["Searching", "Searched", "search", "search", "searches"],
  web: ["Searching", "Searched", "globe", "search", "searches"],
  fetch: ["Fetching", "Fetched", "external", "page", "pages"],
  todo: ["Updating", "Updated", "check", "plan", "plans"],
  agent: ["Starting", "Started", "bot", "agent", "agents"],
  skill: ["Loading", "Loaded", "spark", "skill", "skills"],
  mcp: ["Using", "Used", "server", "tool", "tools"],
  tool: ["Using", "Used", "command", "tool", "tools"]
};
const SUMMARY_VERB = { search: ["Running", "Ran"], web: ["Running", "Ran"] };
function kindIcon(kind) {
  return KINDS[kind][2];
}
function clip(value, limit = MAX_TEXT) {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > limit ? flat.slice(0, limit - 1) + "\u2026" : flat;
}
function basename(path) {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}
function text(value) {
  return typeof value === "string" ? value : Array.isArray(value) && value.every((part) => typeof part === "string") ? value.join(" ") : "";
}
function field(fields, ...keys) {
  for (const key of keys) {
    const value = text(fields[key]);
    if (value) return value;
  }
  return "";
}
function lines(value) {
  return value ? value.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n") : [];
}
function cleanOutput(output) {
  return output.trim() === OMITTED ? "" : output.slice(0, MAX_SCAN);
}
function parseFields(input) {
  const value = input.slice(0, MAX_SCAN).trim();
  if (!value.startsWith("{")) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function toolKind(name) {
  const n = name.toLowerCase().replace(/^pandacode_architect_/, "");
  if (/^(bash|shell|command|exec_command|local_shell|run_terminal_cmd|pandacode_vm_exec)$/.test(n)) return "shell";
  if (/^(read|read_file|view|readfile)$/.test(n)) return "read";
  if (/^(edit|multiedit|multi_edit|str_replace\w*|apply_patch|patch)$/.test(n)) return "edit";
  if (/^(write|write_file|create|create_file)$/.test(n)) return "write";
  if (/^(grep|glob|search|find|ls|list|list_dir|codebase_search|file_search)$/.test(n)) return "search";
  if (/^web_?search$/.test(n)) return "web";
  if (/^(web_?fetch|fetch)$/.test(n)) return "fetch";
  if (/^(todowrite|todo_write|update_plan)$/.test(n)) return "todo";
  if (/^(task|agent)$/.test(n)) return "agent";
  if (n === "skill") return "skill";
  if (n.startsWith("mcp__") || n.startsWith("pandacode_")) return "mcp";
  return "tool";
}
function shellCommand(input, fields) {
  const command = field(fields, "command", "cmd") || (input.trim().startsWith("{") ? "" : input.trim().split("\n", 1)[0] ?? "");
  const wrapped = /^(?:\S*\/)?(?:ba|z)?sh\s+-l?c\s+(['"])([\s\S]*)\1$/.exec(command.trim());
  return (wrapped ? wrapped[2] : command).trim();
}
function domain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return clip(url, 60);
  }
}
function editLines(fields) {
  const edits = Array.isArray(fields.edits) ? fields.edits : [fields];
  return edits.filter((edit) => edit && typeof edit === "object").map((edit) => ({ old: field(edit, "old_string", "oldText", "old_str"), new: field(edit, "new_string", "newText", "new_str", "content") }));
}
function diffCounts(fields) {
  return editLines(fields).reduce((sum, edit) => ({ added: sum.added + lines(edit.new).length, removed: sum.removed + lines(edit.old).length }), { added: 0, removed: 0 });
}
function filePath(input, fields) {
  return field(fields, "file_path", "path", "filePath", "target_file") || (input.trim().startsWith("{") ? "" : input.trim().split("\n", 1)[0] ?? "");
}
function fileChip(path) {
  return path ? { icon: "file", label: basename(path), title: path } : void 0;
}
function mcpParts(name) {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name);
  if (mcp) return { server: mcp[1], tool: mcp[2] };
  const local = name.replace(/^pandacode_architect_/, "").replace(/^pandacode_/, "");
  return { server: "PandaCode", tool: local };
}
function pandacodeTrace(tool, fields, running) {
  const workers = Array.isArray(fields.workers) ? fields.workers.length : Array.isArray(fields.tasks) ? fields.tasks.length : 0;
  if (tool === "dispatch_workers") return { verb: running ? "Dispatching" : "Dispatched", object: workers ? `${workers} ${workers === 1 ? "worker" : "workers"}` : "workers" };
  if (tool === "title") return { verb: running ? "Naming" : "Named", object: field(fields, "title") ? `the task \u201C${clip(field(fields, "title"), 60)}\u201D` : "the task" };
  return;
}
function describeFields(kind, name, input, fields, running) {
  switch (kind) {
    case "shell": {
      const command = shellCommand(input, fields);
      const [program = "", ...rest] = command.split(/\s+/);
      return program ? { chip: { icon: "terminal", label: basename(program), title: command }, object: clip(rest.join(" ")), mono: true } : { object: field(fields, "description") };
    }
    case "read":
    case "write": {
      const path = filePath(input, fields);
      const content = field(fields, "content", "contents");
      return { chip: fileChip(path), object: kind === "write" && content ? `${lines(content).length} lines` : "" };
    }
    case "edit": {
      const path = field(fields, "file_path", "path", "filePath", "target_file");
      return { chip: fileChip(path), object: "", ...diffCounts(fields) };
    }
    case "search": {
      const where = field(fields, "path", "directory", "target_directory");
      const pattern = field(fields, "pattern", "query", "glob", "regex");
      const glob = /glob|ls|list/.test(name.toLowerCase());
      return { chip: { icon: glob ? "folder" : "search", label: where ? basename(where) : "workspace", title: where || "workspace" }, object: pattern ? `${glob ? "for files matching" : "for"} ${clip(pattern, 80)}` : "" };
    }
    case "web":
      return { chip: { icon: "globe", label: "Web", title: "Web search" }, object: field(fields, "query", "q") ? `for ${clip(field(fields, "query", "q"))}` : "" };
    case "fetch": {
      const url = field(fields, "url");
      return { chip: url ? { icon: "globe", label: domain(url), title: url } : void 0, object: clip(field(fields, "prompt"), 90) };
    }
    case "todo": {
      const todos = Array.isArray(fields.todos) ? fields.todos.length : Array.isArray(fields.plan) ? fields.plan.length : 0;
      return { object: todos ? `the plan \xB7 ${todos} ${todos === 1 ? "step" : "steps"}` : "the plan" };
    }
    case "agent": {
      const type = field(fields, "subagent_type", "agent");
      return { chip: { icon: "bot", label: type || "agent", title: type || "agent" }, object: clip(field(fields, "description", "prompt"), 90) };
    }
    case "skill": {
      const skill = field(fields, "skill", "name", "command");
      return { verb: running ? "Loading skill" : "Loaded skill", chip: skill ? { icon: "spark", label: skill, title: skill } : void 0, object: "" };
    }
    case "mcp": {
      const { server, tool } = mcpParts(name);
      const own = server === "PandaCode" ? pandacodeTrace(tool, fields, running) : void 0;
      if (own) return { chip: { icon: "server", label: "PandaCode", title: name }, object: "", ...own };
      return { chip: { icon: "server", label: server, title: name }, object: tool.replace(/_/g, " ") };
    }
    default:
      return { chip: { icon: "command", label: name || "Tool", title: name || "Tool" }, object: inputHint(input) };
  }
}
function inputHint(input) {
  const fields = parseFields(input);
  const value = input.trim().startsWith("{") ? field(fields, "command", "cmd", "file_path", "filePath", "path", "query", "url", "pattern", "description") : input.trim().split("\n", 1)[0] ?? "";
  return clip(value, 96);
}
function describeTool(tool) {
  const kind = toolKind(tool.name);
  const running = tool.status === "running";
  const fields = parseFields(tool.input);
  const described = describeFields(kind, tool.name, tool.input, fields, running);
  return { ...described, kind, verb: described.verb ?? KINDS[kind][running ? 0 : 1] };
}
function traceRowHtml(trace) {
  const chip = trace.chip ? `<span class="tool-trace-chip" title="${escape(trace.chip.title)}">${icon(trace.chip.icon)}<b>${escape(trace.chip.label)}</b></span>` : "";
  const object = trace.object ? `<span class="tool-trace-object${trace.mono ? " is-mono" : ""}">${escape(trace.object)}</span>` : "";
  const delta = trace.added !== void 0 ? `<span class="tool-trace-delta"><ins>+${trace.added}</ins> <del>\u2212${trace.removed ?? 0}</del></span>` : "";
  return `<span class="tool-trace-verb">${escape(trace.verb)}</span>${chip}${object}${delta}`;
}
function joinPhrases(parts) {
  return parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
function summarizeTools(tools) {
  const running = tools.some((tool) => tool?.status === "running");
  const failed = tools.filter((tool) => tool?.status === "failed").length;
  const counts = /* @__PURE__ */ new Map();
  for (const tool of tools) {
    const kind = tool ? toolKind(tool.name) : "tool";
    const verb = (SUMMARY_VERB[kind] ?? KINDS[kind])[running ? 0 : 1];
    const nouns = counts.get(verb) ?? /* @__PURE__ */ new Map();
    const key = kind === "web" ? "search" : kind;
    counts.set(verb, nouns.set(key, (nouns.get(key) ?? 0) + 1));
  }
  const phrases = [...counts].map(([verb, nouns]) => `${verb.toLowerCase()} ${joinPhrases([...nouns].map(([kind, count]) => kind === "todo" ? "the plan" : `${count} ${KINDS[kind][count === 1 ? 3 : 4]}`))}`);
  const sentence = joinPhrases(phrases);
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + (running ? "\u2026" : "") + (failed ? ` \xB7 ${failed} failed` : "");
}
function summaryIcons(tools, limit = 4) {
  return [...new Set(tools.map((tool) => kindIcon(tool ? toolKind(tool.name) : "tool")))].slice(0, limit);
}
function card(kind, body) {
  return body ? `<div class="tool-trace-card" data-trace-kind="${kind}">${body}</div>` : "";
}
function head(main, meta = "") {
  return `<div class="tool-trace-card-head">${main}${meta ? `<span class="tool-trace-card-meta">${escape(meta)}</span>` : ""}</div>`;
}
function linesPre(value, label) {
  return value.length ? `<pre class="tool-trace-lines" tabindex="0" aria-label="${escape(label)}">${escape(value.map((line) => line.slice(0, 400)).join("\n"))}</pre>` : "";
}
function list(items, total = items.length) {
  if (!items.length) return "";
  const rows = items.slice(0, LIST_ITEMS).map((item) => `<li><span class="tool-trace-item-title"${item.hint ? ` title="${escape(item.hint)}"` : ""}>${escape(clip(item.title, 120))}</span>${item.meta ? `<span class="tool-trace-item-meta">${escape(clip(item.meta, 80))}</span>` : ""}</li>`).join("");
  const more = total - Math.min(items.length, LIST_ITEMS);
  return `<ul class="tool-trace-list">${rows}${more > 0 ? `<li class="tool-trace-more">+${more} more</li>` : ""}</ul>`;
}
function exitCode(output) {
  const codex = /^Exit code: (-?\d+)\n?/.exec(output);
  if (codex) return { code: Number(codex[1]), body: output.slice(codex[0].length).replace(/^Wall time:.*\n?/, "").replace(/^Output:\n?/, "") };
  const json = parseFields(output);
  if (typeof json.exitCode === "number") return { code: json.exitCode, body: [text(json.stdout), text(json.stderr)].filter(Boolean).join("\n") };
  return { body: output };
}
function shellCard(tool, fields) {
  const command = shellCommand(tool.input, fields);
  const { code, body } = exitCode(cleanOutput(tool.output));
  const failed = code !== void 0 ? code !== 0 : tool.status === "failed";
  const badge = code !== void 0 || tool.status === "failed" ? `<span class="tool-trace-badge${failed ? " is-failed" : ""}">${escape(code !== void 0 ? `exit ${code}` : "failed")}</span>` : "";
  const tail = lines(body.trimEnd()).slice(-PREVIEW_LINES);
  return command ? `${head(`<code class="tool-trace-command">${escape(clip(command, 400))}</code>${badge}`)}${linesPre(tail, "Command output, last lines")}` : "";
}
function fileCard(path, meta, preview) {
  return path ? `${head(`<span class="tool-trace-chip" title="${escape(path)}">${icon("file")}<b>${escape(basename(path))}</b></span>`, meta)}${linesPre(preview, "File preview")}` : "";
}
function diffCard(tool, fields) {
  const rows = [];
  for (const edit of editLines(fields)) {
    for (const line of lines(edit.old)) rows.push(`<del>- ${escape(line.slice(0, 300))}</del>`);
    for (const line of lines(edit.new)) rows.push(`<ins>+ ${escape(line.slice(0, 300))}</ins>`);
  }
  const { added, removed } = diffCounts(fields);
  const shown = rows.slice(0, DIFF_LINES).join("\n");
  const more = rows.length > DIFF_LINES ? `<p class="tool-trace-more">+${rows.length - DIFF_LINES} more lines</p>` : "";
  const path = field(fields, "file_path", "path", "filePath", "target_file");
  return (path ? fileCard(path, `+${added} \u2212${removed}`, []) : "") + (shown ? `<pre class="tool-trace-diff" tabindex="0" aria-label="Edit preview">${shown}</pre>${more}` : "");
}
function searchCard(output) {
  const found = lines(output).map((line) => line.trim()).filter((line) => line && !/^Found \d+ (files?|matches?)/i.test(line) && !/^No (files|matches) found/i.test(line));
  if (!found.length) return output.trim() ? `<p class="tool-trace-note">${escape(clip(output, 200))}</p>` : "";
  return list(found.slice(0, LIST_ITEMS).map((line) => {
    const [path, ...match] = line.split(":");
    const meta = match.length && /^\d+$/.test(match[0] ?? "") ? match.slice(1).join(":") : match.join(":");
    return { title: basename(path), meta: [path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "", meta].filter(Boolean).join(" \xB7 "), hint: line };
  }), found.length);
}
function webResults(output) {
  const at = output.indexOf("Links:");
  if (at < 0) return [];
  const start = output.indexOf("[", at);
  const end = output.indexOf("]\n", start) > 0 ? output.indexOf("]\n", start) + 1 : output.lastIndexOf("]") + 1;
  try {
    const value = JSON.parse(output.slice(start, end));
    return Array.isArray(value) ? value.filter((item) => typeof item?.title === "string" && typeof item?.url === "string") : [];
  } catch {
    return [];
  }
}
function webCard(output) {
  const results = webResults(output);
  if (results.length) return list(results.map((result) => ({ title: result.title, meta: domain(result.url), hint: result.url })), results.length);
  return excerptCard(output);
}
function fetchCard(fields, output) {
  const url = field(fields, "url");
  const prompt = field(fields, "prompt");
  const top = url ? head(`<span class="tool-trace-chip" title="${escape(url)}">${icon("globe")}<b>${escape(domain(url))}</b></span>`) : "";
  return top + (prompt ? `<p class="tool-trace-prompt">${escape(clip(prompt, 240))}</p>` : "") + (output.trim() ? `<p class="tool-trace-note">${escape(clip(output, 600))}</p>` : "");
}
function todoCard(fields) {
  const todos = Array.isArray(fields.todos) ? fields.todos : Array.isArray(fields.plan) ? fields.plan : [];
  const items = todos.filter((todo) => todo && typeof todo === "object").slice(0, 12).map((todo) => {
    const status = field(todo, "status");
    return `<li data-status="${escape(status)}">${icon(status === "completed" ? "check" : status === "in_progress" ? "activity" : "circle")}<span>${escape(clip(field(todo, "content", "step", "title"), 160))}</span></li>`;
  }).join("");
  return items ? `<ul class="tool-trace-todos">${items}</ul>` : "";
}
function excerptCard(output) {
  return linesPre(lines(output.trim()).slice(0, PREVIEW_LINES), "Result preview");
}
function previewBody(kind, tool, fields, output) {
  switch (kind) {
    case "shell":
      return shellCard(tool, fields);
    case "read": {
      const path = filePath(tool.input, fields);
      const all = lines(output);
      return fileCard(path, all.length ? `${all.length} ${all.length === 1 ? "line" : "lines"}` : "", all.slice(0, PREVIEW_LINES));
    }
    case "write": {
      const content = lines(field(fields, "content", "contents"));
      return fileCard(field(fields, "file_path", "path", "filePath"), `New file \xB7 ${content.length} lines`, content.slice(0, PREVIEW_LINES));
    }
    case "edit":
      return diffCard(tool, fields);
    case "search":
      return searchCard(output);
    case "web":
      return webCard(output);
    case "fetch":
      return fetchCard(fields, output);
    case "todo":
      return todoCard(fields);
    default:
      return excerptCard(output);
  }
}
function toolPreview(tool) {
  const kind = toolKind(tool.name);
  return card(kind, previewBody(kind, tool, parseFields(tool.input), cleanOutput(tool.output)));
}
export {
  basename,
  describeTool,
  inputHint,
  kindIcon,
  parseFields,
  shellCommand,
  summarizeTools,
  summaryIcons,
  toolKind,
  toolPreview,
  traceRowHtml
};
