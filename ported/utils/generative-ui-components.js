var __defProp = Object.defineProperty;
var __defNormalProp = (obj2, key, value) => key in obj2 ? __defProp(obj2, key, { enumerable: true, configurable: true, writable: true, value }) : obj2[key] = value;
var __publicField = (obj2, key, value) => __defNormalProp(obj2, typeof key !== "symbol" ? key + "" : key, value);
const LIMITS = { source: 64 * 1024, depth: 4, nodes: 120, text: 4e3, prompt: 4e3, css: 16 * 1024, rows: 200, columns: 12, items: 40 };
const VIEW_TYPES = ["markdown", "callout", "card", "stats", "table", "chart", "progress", "steps", "plan", "timeline", "checklist", "tabs", "accordion", "tree", "diff", "code", "terminal", "compare", "gallery", "actions", "chips", "form", "stack", "grid", "custom"];
const obj = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const str = (value, max = 200) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.slice(0, max) : void 0;
};
const list = (value, max = LIMITS.items) => Array.isArray(value) ? value.slice(0, max) : [];
const num = (value) => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : void 0;
};
const pick = (value, options, fallback) => options.includes(value) ? value : fallback;
const STATUS = ["done", "active", "pending", "error", "skipped"];
function actions(value) {
  return list(value, 8).flatMap((entry) => {
    const raw = typeof entry === "string" ? { label: entry } : obj(entry);
    const label = str(raw.label, 60);
    return label ? [{ label, prompt: str(raw.prompt, LIMITS.prompt) ?? label, tone: pick(raw.tone ?? raw.style, ["primary", "secondary", "danger"], "secondary") }] : [];
  });
}
function steps(value) {
  return list(value).flatMap((entry) => {
    const raw = typeof entry === "string" ? { title: entry } : obj(entry);
    const title = str(raw.title ?? raw.text ?? raw.label, 300);
    return title ? [{ title, detail: str(raw.detail ?? raw.body, LIMITS.text), status: pick(raw.status, STATUS, "pending"), time: str(raw.time ?? raw.date, 40) }] : [];
  });
}
function tree(value, depth) {
  if (depth > 8) return [];
  return list(value, 100).flatMap((entry) => {
    const raw = typeof entry === "string" ? { name: entry } : obj(entry);
    const name = str(raw.name ?? raw.path, 200);
    return name ? [{ name, note: str(raw.note, 120), status: str(raw.status, 20), children: tree(raw.children, depth + 1) }] : [];
  });
}
function treeFromPaths(paths) {
  const root = [];
  for (const path of paths.slice(0, 200)) {
    let level = root;
    for (const part of path.split("/").filter(Boolean)) {
      let node = level.find((item) => item.name === part);
      if (!node) {
        node = { name: part, children: [] };
        level.push(node);
      }
      level = node.children;
    }
  }
  return root;
}
class Budget {
  constructor() {
    __publicField(this, "nodes", 0);
  }
}
function normalize(value, depth = 0, budget = new Budget()) {
  const raw = obj(value);
  const type = typeof raw.type === "string" ? raw.type : "";
  if (!type) throw new Error('A view needs a "type".');
  if (++budget.nodes > LIMITS.nodes) throw new Error(`A view may hold at most ${LIMITS.nodes} parts.`);
  if (depth > LIMITS.depth) throw new Error(`Views nest at most ${LIMITS.depth} deep.`);
  const children = (entries) => list(entries, 24).map((child) => normalize(child, depth + 1, budget));
  const title = str(raw.title, 200);
  switch (type) {
    case "markdown":
    case "text":
      return { type: "markdown", text: str(raw.text ?? raw.body, LIMITS.text) ?? "" };
    case "callout":
    case "alert":
      return { type: "callout", tone: pick(raw.tone ?? raw.variant, ["info", "success", "warning", "danger", "note"], "info"), title, body: str(raw.body ?? raw.text, LIMITS.text) };
    case "card":
      return { type: "card", title, body: str(raw.body, LIMITS.text), footer: str(raw.footer, 400), actions: actions(raw.actions), children: children(raw.children) };
    case "stats":
    case "kv":
      return { type: "stats", items: list(raw.items, 12).flatMap((entry) => {
        const item = obj(entry), label = str(item.label ?? item.key, 80), shown = str(item.value, 80);
        if (!label || shown === void 0) return [];
        const delta = str(item.delta, 40);
        const trend = pick(item.trend, ["up", "down", "flat"], delta?.startsWith("-") ? "down" : delta ? "up" : "flat");
        const spark = list(item.spark, 60).map(num).filter((n) => n !== void 0);
        return [{ label, value: shown, delta, trend, hint: str(item.hint, 120), spark: spark.length > 1 ? spark : void 0 }];
      }) };
    case "table": {
      const columns = list(raw.columns, LIMITS.columns).flatMap((entry) => {
        const column = typeof entry === "string" ? { label: entry } : obj(entry);
        const label = str(column.label ?? column.key, 80);
        return label ? [{ label, key: str(column.key, 80) ?? label, align: ["left", "center", "right"].includes(column.align) ? column.align : void 0 }] : [];
      });
      const rows = list(raw.rows, LIMITS.rows).map((row) => Array.isArray(row) ? row.slice(0, columns.length).map((cell) => str(cell, 400) ?? "") : columns.map((column) => str(obj(row)[column.key], 400) ?? ""));
      if (!columns.length) throw new Error('A table needs "columns".');
      return { type: "table", title, columns: columns.map(({ label, align }) => ({ label, align })), rows, sortable: raw.sortable !== false };
    }
    case "chart": {
      const labels = list(raw.labels, 48).map((label) => str(label, 40) ?? "");
      const series = list(raw.series, 6).map((entry) => {
        const item = obj(entry);
        return { name: str(item.name, 60), values: list(item.values, labels.length || 60).map((v) => num(v) ?? 0) };
      });
      if (!series.some((entry) => entry.values.length)) throw new Error('A chart needs at least one series of "values".');
      const chart2 = pick(raw.chart ?? raw.kind, ["bar", "line", "pie", "area", "sparkline"], "bar");
      return { type: "chart", chart: chart2, title, labels: labels.length ? labels : series[0].values.map((_, i) => String(i + 1)), series };
    }
    case "progress": {
      const max = Math.max(1, num(raw.max) ?? 100);
      return { type: "progress", label: str(raw.label, 120) ?? title, value: Math.min(max, Math.max(0, num(raw.value) ?? 0)), max, note: str(raw.note, 200) };
    }
    case "steps":
    case "plan":
    case "timeline":
      return { type, title, summary: str(raw.summary ?? raw.body, LIMITS.text), items: steps(raw.items ?? raw.steps), actions: actions(raw.actions) };
    case "checklist":
      return { type: "checklist", title, items: list(raw.items).flatMap((entry) => {
        const item = typeof entry === "string" ? { text: entry } : obj(entry), text = str(item.text ?? item.label, 300);
        return text ? [{ text, done: item.done === true || item.checked === true }] : [];
      }) };
    case "tabs":
    case "accordion": {
      const items = list(raw.items ?? raw.tabs, 12).flatMap((entry) => {
        const item = obj(entry), label = str(item.label ?? item.title, 80);
        return label ? [{ label, body: str(item.body, LIMITS.text), children: children(item.children), open: item.open === true }] : [];
      });
      if (!items.length) throw new Error(`${type === "tabs" ? 'Tabs need "tabs"' : 'An accordion needs "items"'} with a label.`);
      return { type, items };
    }
    case "tree":
    case "files":
      return { type: "tree", title, items: Array.isArray(raw.paths) ? treeFromPaths(list(raw.paths, 200).map((path) => str(path, 300) ?? "").filter(Boolean)) : tree(raw.items, 0) };
    case "diff":
      return { type: "diff", file: str(raw.file, 300), diff: str(raw.diff ?? raw.patch, 24e3) ?? "" };
    case "code":
      return { type: "code", file: str(raw.file ?? raw.filename, 300), language: str(raw.language, 30), code: str(raw.code, 24e3) ?? "" };
    case "terminal":
      return { type: "terminal", command: str(raw.command, 500), output: str(raw.output, 24e3) ?? "", exitCode: num(raw.exitCode) };
    case "compare":
    case "pros-cons": {
      const source = Array.isArray(raw.items) ? raw.items : [raw];
      const strings = (entries) => list(entries, 20).map((entry) => str(entry, 300)).filter((text) => Boolean(text));
      return { type: "compare", title: Array.isArray(raw.items) ? title : void 0, items: list(source, 4).map((entry) => {
        const item = obj(entry);
        return { title: str(item.title ?? item.name, 120) ?? "", pros: strings(item.pros), cons: strings(item.cons), verdict: str(item.verdict, 300) };
      }) };
    }
    case "gallery":
      return { type: "gallery", images: list(raw.images, 12).flatMap((entry) => {
        const item = typeof entry === "string" ? { path: entry } : obj(entry), path = str(item.path, 400);
        return path && !/^[a-z][\w+.-]*:/i.test(path) && !path.includes("..") ? [{ path, caption: str(item.caption ?? item.alt, 160) }] : [];
      }) };
    case "actions":
    case "buttons":
      return { type: "actions", label: str(raw.label, 120), buttons: actions(raw.buttons ?? raw.actions) };
    case "chips":
      return { type: "chips", label: str(raw.label, 120), options: actions(raw.options) };
    case "followups":
      return { type: "chips", label: str(raw.label, 120) ?? "Suggested follow-ups", options: actions(raw.items ?? raw.options) };
    case "form": {
      const fields = list(raw.fields, 12).flatMap((entry) => {
        const field = obj(entry), name = str(field.name, 40)?.replace(/[^\w-]/g, "");
        if (!name) return [];
        const options = list(field.options, 30).map((option) => str(option, 120)).filter((text) => Boolean(text));
        return [{ name, label: str(field.label, 120) ?? name, type: pick(field.type, ["text", "textarea", "number", "select", "checkbox"], options.length ? "select" : "text"), options, placeholder: str(field.placeholder, 120), value: str(field.value, 400), required: field.required === true }];
      });
      if (!fields.length) throw new Error('A form needs "fields" with a "name".');
      return { type: "form", title, fields, submit: str(raw.submit, 40) ?? "Add to prompt", prompt: str(raw.prompt, LIMITS.prompt) };
    }
    case "stack":
    case "grid":
      return { type, columns: Math.min(4, Math.max(1, Math.round(num(raw.columns) ?? 2))), children: children(raw.children) };
    case "custom": {
      const html = typeof raw.html === "string" ? raw.html : "";
      if (!html.trim()) throw new Error('A custom view needs "html".');
      if (html.length > LIMITS.source) throw new Error("A custom view may hold at most 64 KB of HTML.");
      const state = {};
      for (const [key, entry] of Object.entries(obj(raw.state)).slice(0, 40)) {
        const text = str(entry, 400);
        if (/^[\w-]{1,40}$/.test(key) && text !== void 0) state[key] = text;
      }
      return { type: "custom", html, css: scrubCss(typeof raw.css === "string" ? raw.css : ""), state, height: Math.min(900, Math.max(80, num(raw.height) ?? 480)) };
    }
    default:
      return { type: "unknown", name: type.slice(0, 40), raw: JSON.stringify(value, null, 2).slice(0, 2e3) };
  }
}
function parseSpec(source) {
  if (source.length > LIMITS.source) throw new Error("This view is larger than 64 KB.");
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("This view is not valid JSON.");
  }
  return normalize(value);
}
function scrubCss(css) {
  return css.slice(0, LIMITS.css).replace(/<\/?style/gi, "").replace(/@import[^;]*;?/gi, "").replace(/@font-face\s*\{[^}]*\}/gi, "").replace(/url\(\s*(['"]?)(?!data:image\/(?:png|jpe?g|gif|webp);)[^)]*\)/gi, "none").replace(/image-set\([^)]*\)|expression\([^)]*\)|-moz-binding[^;]*/gi, "none");
}
function formPrompt(template, fields, values) {
  const text = template ? template.replace(/\{([\w-]+)\}/g, (match, name) => name in values ? values[name] : match) : fields.map((field) => `${field.label}: ${values[field.name] ?? ""}`).join("\n");
  return text.slice(0, LIMITS.prompt);
}
const interpolate = (text, state) => text.replace(/\{([\w-]+)\}/g, (match, key) => state[key] ?? match).slice(0, LIMITS.prompt);
function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === void 0 || value === false) continue;
    if (name === "class") node.className = String(value);
    else node.setAttribute(name, value === true ? "" : String(value));
  }
  for (const kid of kids) if (kid !== void 0 && kid !== false) node.append(kid);
  return node;
}
async function renderBlock(kind, source) {
  const host = h("div", { class: "gu" });
  if (kind === "mermaid") {
    host.append(codeView("Diagram \xB7 Mermaid", source));
    return host;
  }
  if (kind !== "ui") {
    const rich = await import("./rich-markdown");
    const box = h("div");
    await rich.richMarkdown(box, `\`\`\`${kind}
${source.slice(0, LIMITS.source)}${source.endsWith("\n") ? "" : "\n"}\`\`\``, { image: workspaceImage });
    host.append(box);
    return host;
  }
  let spec;
  try {
    spec = parseSpec(source);
  } catch (error) {
    host.append(failure(error instanceof Error ? error.message : "This view could not be shown.", source));
    return host;
  }
  host.append(await view(spec));
  return host;
}
function failure(message, source) {
  return h("div", { class: "gu-failed" }, h("p", { class: "gu-error" }, message), h("pre", {}, h("code", {}, source.slice(0, 4e3))));
}
function workspaceImage(path) {
  const sessionId = document.querySelector("#prompt")?.dataset.sessionId;
  if (!sessionId) return Promise.reject(new Error("No task is open."));
  return import("./bridge").then((bridge) => bridge.call("workspace_image", { sessionId, path }));
}
async function md(text, cls = "gu-md") {
  if (!text) return void 0;
  const box = h("div", { class: cls });
  const { markdownHtml } = await import("./dom");
  box.innerHTML = await markdownHtml(text);
  for (const anchor of box.querySelectorAll("a")) {
    if (/^(?:https?:|mailto:)/i.test(anchor.getAttribute("href") ?? "")) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    } else anchor.removeAttribute("href");
  }
  return box;
}
async function fill(prompt) {
  const { fillComposer } = await import("./generative-ui");
  fillComposer(prompt);
}
function actionRow(items, cls = "gu-actions") {
  if (!items.length) return void 0;
  const row = h("div", { class: cls });
  for (const item of items) {
    const button = h("button", { type: "button", class: `gu-button gu-${item.tone}`, title: item.prompt === item.label ? void 0 : item.prompt }, item.label);
    button.addEventListener("click", () => void fill(item.prompt));
    row.append(button);
  }
  return row;
}
const heading = (text) => text ? h("div", { class: "gu-title" }, text) : void 0;
async function view(spec) {
  switch (spec.type) {
    case "markdown":
      return await md(spec.text) ?? h("div");
    case "callout":
      return h("aside", { class: `gu-callout gu-tone-${spec.tone}`, role: spec.tone === "danger" || spec.tone === "warning" ? "alert" : "note" }, heading(spec.title), await md(spec.body));
    case "card":
      return h("section", { class: "gu-card" }, heading(spec.title), await md(spec.body), ...await Promise.all(spec.children.map(view)), actionRow(spec.actions), spec.footer ? h("footer", { class: "gu-footer" }, spec.footer) : void 0);
    case "stats":
      return h("div", { class: "gu-stats" }, ...spec.items.map((item) => h(
        "div",
        { class: "gu-stat" },
        h("div", { class: "gu-stat-label" }, item.label),
        h("div", { class: "gu-stat-value" }, item.value),
        item.delta ? h("div", { class: `gu-delta gu-${item.trend}` }, `${item.trend === "up" ? "\u25B2" : item.trend === "down" ? "\u25BC" : "\u2022"} ${item.delta}`) : void 0,
        item.spark ? sparkline(item.spark) : void 0,
        item.hint ? h("div", { class: "gu-hint" }, item.hint) : void 0
      )));
    case "table":
      return table(spec);
    case "chart":
      return chart(spec);
    case "progress": {
      const percent = Math.round(spec.value / spec.max * 100);
      return h(
        "div",
        { class: "gu-progress" },
        h("div", { class: "gu-progress-head" }, h("span", {}, spec.label ?? "Progress"), h("span", {}, `${percent}%`)),
        h("div", { class: "gu-bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": spec.max, "aria-valuenow": spec.value, "aria-label": spec.label ?? "Progress" }, h("span", { style: `width:${percent}%` })),
        spec.note ? h("div", { class: "gu-hint" }, spec.note) : void 0
      );
    }
    case "steps":
    case "plan":
    case "timeline": {
      const items = await Promise.all(spec.items.map(async (step) => h(
        "li",
        { class: `gu-step gu-s-${step.status}` },
        h("span", { class: "gu-dot", "aria-hidden": "true" }),
        h("div", {}, step.time ? h("div", { class: "gu-hint" }, step.time) : void 0, h("div", { class: "gu-step-title" }, step.title, h("span", { class: "sr-only" }, ` (${step.status})`)), await md(step.detail, "gu-md gu-step-detail"))
      )));
      return h("section", { class: `gu-flow gu-${spec.type}` }, heading(spec.title ?? (spec.type === "plan" ? "Plan" : void 0)), await md(spec.summary), h(spec.type === "timeline" ? "ul" : "ol", { class: "gu-steps" }, ...items), actionRow(spec.actions));
    }
    case "checklist": {
      const done = spec.items.filter((item) => item.done).length;
      return h(
        "section",
        { class: "gu-checklist" },
        heading(spec.title ? `${spec.title} \xB7 ${done}/${spec.items.length}` : void 0),
        h("ul", {}, ...spec.items.map((item) => h("li", { class: item.done ? "gu-done" : "" }, h("span", { class: "gu-check", role: "img", "aria-label": item.done ? "Done" : "Not done" }), item.text)))
      );
    }
    case "tabs":
      return tabs(spec.items);
    case "accordion":
      return h("div", { class: "gu-accordion" }, ...await Promise.all(spec.items.map(async (item) => h("details", { open: item.open }, h("summary", {}, item.label), h("div", { class: "gu-panel" }, await md(item.body), ...await Promise.all(item.children.map(view)))))));
    case "tree":
      return h("section", { class: "gu-tree" }, heading(spec.title), branch(spec.items, true));
    case "diff":
      return h("figure", { class: "gu-code gu-diff" }, codeHead(spec.file, spec.diff), h("pre", {}, ...spec.diff.split("\n").slice(0, 600).map((line) => h("span", { class: line.startsWith("+") && !line.startsWith("+++") ? "gu-add" : line.startsWith("-") && !line.startsWith("---") ? "gu-del" : line.startsWith("@@") ? "gu-hunk" : "" }, `${line}
`))));
    case "code":
      return codeView(spec.file ?? spec.language, spec.code);
    case "terminal":
      return h(
        "figure",
        { class: "gu-code gu-terminal" },
        codeHead(spec.exitCode === void 0 ? "Terminal" : `Exit ${spec.exitCode}`, spec.output),
        h("pre", {}, spec.command ? h("span", { class: "gu-command" }, `$ ${spec.command}
`) : void 0, spec.output)
      );
    case "compare":
      return h("section", {}, heading(spec.title), h("div", { class: "gu-compare" }, ...spec.items.map((item) => h(
        "div",
        { class: "gu-card" },
        heading(item.title),
        item.pros.length ? h("ul", { class: "gu-pros", "aria-label": "Pros" }, ...item.pros.map((text) => h("li", {}, text))) : void 0,
        item.cons.length ? h("ul", { class: "gu-cons", "aria-label": "Cons" }, ...item.cons.map((text) => h("li", {}, text))) : void 0,
        item.verdict ? h("footer", { class: "gu-footer" }, item.verdict) : void 0
      ))));
    case "gallery": {
      const box = h("div", { class: "gu-gallery" });
      const rich = await import("./rich-markdown");
      await rich.richMarkdown(box, spec.images.map((image) => `![${(image.caption ?? "").replace(/[[\]\n]/g, " ")}](<${image.path}>)`).join(" "), { image: workspaceImage });
      return box;
    }
    case "actions":
      return h("div", {}, spec.label ? h("div", { class: "gu-hint" }, spec.label) : void 0, actionRow(spec.buttons));
    case "chips":
      return h("div", {}, spec.label ? h("div", { class: "gu-hint" }, spec.label) : void 0, actionRow(spec.options, "gu-actions gu-chips"));
    case "form":
      return form(spec);
    case "stack":
    case "grid":
      return h("div", { class: `gu-${spec.type}`, style: spec.type === "grid" ? `--gu-columns:${spec.columns}` : void 0 }, ...await Promise.all(spec.children.map(view)));
    case "custom":
      return custom(spec);
    case "unknown":
      return h("div", { class: "gu-failed" }, h("p", { class: "gu-error" }, `PandaCode has no \u201C${spec.name}\u201D view. Showing its data instead.`), h("pre", {}, h("code", {}, spec.raw)));
  }
}
const codeView = (label, code) => h("figure", { class: "gu-code" }, codeHead(label, code), h("pre", {}, h("code", {}, code)));
function codeHead(label, text) {
  const copy = h("button", { type: "button", class: "gu-copy", "aria-label": `Copy ${label ?? "code"}` }, "Copy");
  copy.addEventListener("click", () => void navigator.clipboard?.writeText(text).then(() => {
    copy.textContent = "Copied";
  }, () => {
    copy.textContent = "Copy failed";
  }));
  return h("figcaption", { class: "gu-code-head" }, h("span", {}, label ?? ""), copy);
}
function branch(items, top = false) {
  return h("ul", { role: top ? "tree" : "group" }, ...items.map((item) => h(
    "li",
    { role: "treeitem", class: item.children.length ? "gu-folder" : "gu-file" },
    h("span", { class: `gu-name${item.status ? ` gu-t-${item.status.toLowerCase()}` : ""}` }, item.name),
    item.status ? h("span", { class: "gu-badge" }, item.status) : void 0,
    item.note ? h("span", { class: "gu-hint" }, ` ${item.note}`) : void 0,
    item.children.length ? branch(item.children) : void 0
  )));
}
function table(spec) {
  const body = h("tbody");
  const rows = spec.rows.map((cells) => h("tr", {}, ...spec.columns.map((column, i) => h("td", { class: column.align ? `gu-${column.align}` : void 0 }, cells[i] ?? ""))));
  body.append(...rows);
  const head = h("tr");
  spec.columns.forEach((column, index) => {
    const cell = h("th", { scope: "col", class: column.align ? `gu-${column.align}` : void 0 });
    if (!spec.sortable) {
      cell.textContent = column.label;
      head.append(cell);
      return;
    }
    const sort = h("button", { type: "button", class: "gu-sort" }, column.label);
    sort.addEventListener("click", () => {
      const ascending = cell.getAttribute("aria-sort") !== "ascending";
      for (const other of head.children) other.removeAttribute("aria-sort");
      cell.setAttribute("aria-sort", ascending ? "ascending" : "descending");
      const key = (row) => row.cells[index]?.textContent ?? "";
      const sorted = [...body.rows].sort((a, b) => {
        const x = key(a), y = key(b), nx = Number(x.replace(/[,%$]/g, "")), ny = Number(y.replace(/[,%$]/g, ""));
        const order = x.trim() && y.trim() && Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y, void 0, { numeric: true });
        return ascending ? order : -order;
      });
      body.append(...sorted);
    });
    cell.append(sort);
    head.append(cell);
  });
  return h("figure", { class: "gu-table" }, spec.title ? h("figcaption", { class: "gu-title" }, spec.title) : void 0, h("div", { class: "gu-scroll" }, h("table", {}, h("thead", {}, head), body)));
}
const NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}
function sparkline(values, width = 120, height = 28) {
  const min = Math.min(...values), span = Math.max(...values) - min || 1;
  const points = values.map((v, i) => `${i / Math.max(1, values.length - 1) * width},${height - 2 - (v - min) / span * (height - 4)}`).join(" ");
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "gu-spark", role: "img", "aria-label": `Trend from ${values[0]} to ${values[values.length - 1]}` });
  root.append(svg("polyline", { points, fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  return root;
}
async function chart(spec) {
  if (spec.chart === "sparkline") return h("figure", { class: "gu-sparkline" }, spec.title ? h("figcaption", {}, spec.title) : void 0, sparkline(spec.series[0].values, 240, 48));
  const rich = await import("./rich-markdown");
  const drawn = rich.chart({ type: spec.chart === "area" ? "line" : spec.chart, title: spec.title, labels: spec.labels, series: spec.series });
  if (spec.chart === "area") {
    for (const line of drawn.querySelectorAll("polyline")) {
      const points = line.getAttribute("points") ?? "", xs = points.split(" ").map((point) => point.split(",")[0]);
      line.before(svg("polygon", { points: `${xs[0]},226 ${points} ${xs[xs.length - 1]},226`, fill: line.getAttribute("stroke") ?? "var(--accent)", "fill-opacity": 0.18 }));
    }
  }
  return drawn;
}
let tabGroups = 0;
async function tabs(items) {
  const group = ++tabGroups;
  const list2 = h("div", { class: "gu-tablist", role: "tablist" });
  const panels = await Promise.all(items.map(async (item, i) => h("div", { class: "gu-panel", role: "tabpanel", id: `gu-${group}-panel-${i}`, "aria-labelledby": `gu-${group}-tab-${i}`, tabindex: 0, hidden: i > 0 }, await md(item.body), ...await Promise.all(item.children.map(view)))));
  const buttons = items.map((item, i) => h("button", { type: "button", role: "tab", id: `gu-${group}-tab-${i}`, "aria-controls": `gu-${group}-panel-${i}`, "aria-selected": String(i === 0), tabindex: i === 0 ? 0 : -1 }, item.label));
  const select = (index) => buttons.forEach((button, i) => {
    button.setAttribute("aria-selected", String(i === index));
    button.tabIndex = i === index ? 0 : -1;
    panels[i].hidden = i !== index;
    if (i === index) button.focus();
  });
  buttons.forEach((button, i) => {
    button.addEventListener("click", () => select(i));
    button.addEventListener("keydown", (event) => {
      const next = event.key === "ArrowRight" ? i + 1 : event.key === "ArrowLeft" ? i - 1 : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -2;
      if (next === -2) return;
      event.preventDefault();
      select((next + buttons.length) % buttons.length);
    });
  });
  list2.append(...buttons);
  return h("div", { class: "gu-tabs" }, list2, ...panels);
}
let forms = 0;
function form(spec) {
  const id = ++forms;
  const element = h("form", { class: "gu-form" }, heading(spec.title));
  for (const field of spec.fields) {
    const name = `gu-${id}-${field.name}`;
    const control = field.type === "textarea" ? h("textarea", { id: name, name: field.name, rows: 3, placeholder: field.placeholder, required: field.required }) : field.type === "select" ? h("select", { id: name, name: field.name, required: field.required }, ...field.options.map((option) => h("option", { value: option, selected: option === field.value }, option))) : h("input", { id: name, name: field.name, type: field.type, placeholder: field.placeholder, required: field.required, checked: field.type === "checkbox" && (field.value === "true" || field.value === "yes") });
    if (field.value && (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) && field.type !== "checkbox") control.value = field.value;
    element.append(h("label", { class: field.type === "checkbox" ? "gu-field gu-inline" : "gu-field", for: name }, h("span", {}, field.label), control));
  }
  element.append(h("div", { class: "gu-actions" }, h("button", { type: "submit", class: "gu-button gu-primary" }, spec.submit)));
  element.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = {};
    for (const field of spec.fields) {
      const control = element.elements.namedItem(field.name);
      values[field.name] = control instanceof HTMLInputElement && control.type === "checkbox" ? control.checked ? "yes" : "no" : String(control?.value ?? "");
    }
    void fill(formPrompt(spec.prompt, spec.fields, values));
  });
  return element;
}
const CUSTOM_BASE = ":host{display:block;color:var(--text);font:inherit;overflow:auto}*{box-sizing:border-box;max-width:100%}img{height:auto}a{color:var(--accent-ink)}button{font:inherit;color:inherit;background:var(--raised);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer}button:focus-visible{outline:2px solid var(--focus);outline-offset:1px}[hidden]{display:none!important}";
async function cleanCustom(html) {
  const purify = (await import("dompurify")).default;
  const clean = purify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true },
    FORBID_TAGS: ["script", "style", "form", "input", "textarea", "select", "iframe", "frame", "object", "embed", "link", "meta", "base", "video", "audio", "source", "track", "foreignObject"],
    FORBID_ATTR: ["srcset", "action", "formaction", "background", "ping"],
    ALLOW_DATA_ATTR: true,
    RETURN_DOM_FRAGMENT: true
  });
  for (const element of clean.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase(), value = attribute.value.trim();
      if (name.startsWith("on")) element.removeAttribute(attribute.name);
      else if (name === "style") element.setAttribute("style", scrubCss(value));
      else if ((name === "href" || name === "xlink:href") && element.tagName.toLowerCase() !== "a" && !value.startsWith("#")) element.removeAttribute(attribute.name);
      else if (name === "src" && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) element.removeAttribute(attribute.name);
    }
    if (element instanceof HTMLAnchorElement) {
      if (/^(?:https?:|mailto:)/i.test(element.getAttribute("href") ?? "")) {
        element.target = "_blank";
        element.rel = "noopener noreferrer";
      } else element.removeAttribute("href");
    }
    if (element instanceof HTMLButtonElement) element.type = "button";
  }
  return clean;
}
async function custom(spec) {
  const host = h("div", { class: "gu-custom", style: `max-height:${spec.height}px` });
  const root = host.attachShadow({ mode: "open" });
  const base = document.createElement("style");
  base.textContent = CUSTOM_BASE;
  const own = document.createElement("style");
  own.textContent = spec.css;
  root.append(base, own, await cleanCustom(spec.html));
  const state = { ...spec.state };
  const bind = () => {
    for (const node of root.querySelectorAll("[data-ui-bind]")) node.textContent = state[node.dataset.uiBind ?? ""] ?? "";
  };
  const find = (selector) => {
    try {
      return root.querySelectorAll(selector);
    } catch {
      return [];
    }
  };
  bind();
  const showTab = (name) => {
    for (const tab of root.querySelectorAll("[data-ui-tab]")) {
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(tab.dataset.uiTab === name));
    }
    for (const panel of root.querySelectorAll("[data-ui-panel]")) panel.hidden = panel.dataset.uiPanel !== name;
  };
  const first = root.querySelector("[data-ui-tab]")?.dataset.uiTab;
  if (first) showTab(first);
  root.addEventListener("click", (event) => {
    const target = event.target?.closest("[data-ui-toggle],[data-ui-tab],[data-ui-set],[data-ui-prompt]");
    if (!target) return;
    const data = target.dataset;
    if (data.uiToggle) for (const node of find(data.uiToggle)) node.hidden = !node.hidden;
    if (data.uiTab) showTab(data.uiTab);
    if (data.uiSet) {
      const at = data.uiSet.indexOf("=");
      if (at > 0) {
        state[data.uiSet.slice(0, at)] = data.uiSet.slice(at + 1).slice(0, 400);
        bind();
      }
    }
    if (data.uiPrompt) void fill(interpolate(data.uiPrompt, state));
  });
  return host;
}
export {
  LIMITS,
  VIEW_TYPES,
  formPrompt,
  interpolate,
  normalize,
  parseSpec,
  renderBlock,
  scrubCss,
  treeFromPaths
};
