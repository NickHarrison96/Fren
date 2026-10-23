let parser;
function load() {
  parser ?? (parser = import("./vendor/enriched-markdown/md4c.js").then((module) => module.default()).then((wasm) => wasm.cwrap("parseMarkdown", "string", ["string", "number", "number", "number", "number", "number", "number", "number", "number"])).catch((error) => {
    parser = void 0;
    throw error;
  }));
  return parser;
}
async function parseMarkdown(markdown) {
  const parse = await load();
  const node = JSON.parse(parse(markdown, 0, 1, 0, 0, 0, 0, 0, 1));
  if (!node || typeof node.type !== "string") throw new Error("Markdown could not be parsed.");
  return node;
}
const escapeText = (text2) => text2.replace(/[&<>]/g, (c) => c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;");
const escapeAttr = (text2) => escapeText(text2).replace(/"/g, "&quot;");
const text = (node) => node.content ?? (node.children ?? []).map(text).join("");
const ADMONITIONS = { note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution" };
const ALIGN = /* @__PURE__ */ new Set(["left", "center", "right"]);
const GENERATIVE = /* @__PURE__ */ new Set(["ui", "chart", "svg", "html", "mermaid"]);
const DETAILS_OPEN = /^<details( open)?>\s*(?:<summary>([\s\S]*?)<\/summary>)?$/i;
const SUMMARY = /^<summary>([\s\S]*?)<\/summary>$/i;
const FOLLOWUP = /:(?:codex-)?followup\[([^\]\n]{1,80})\](?:\{prompt=("|&quot;)([\s\S]*?)\2\})?/g;
function renderMarkdown(root, options = {}) {
  const link = (url) => escapeAttr(options.link ? options.link(url) : url);
  const kids = (node) => (node.children ?? []).map(render).join("");
  let details = 0;
  const paragraph = (node) => {
    const a = node.attributes ?? {};
    const raw = node.children?.every((child) => child.type === "Text" || child.type === "SoftBreak") ? text(node).trim() : "";
    const open = raw.match(DETAILS_OPEN);
    if (open) {
      details++;
      return `<details${open[1] ? " open" : ""}>${open[2] === void 0 ? "" : `<summary>${escapeText(open[2])}</summary>`}
`;
    }
    const summary = details ? raw.match(SUMMARY) : null;
    if (summary) return `<summary>${escapeText(summary[1])}</summary>
`;
    if (/^<\/details>$/i.test(raw) && details) {
      details--;
      return "</details>\n";
    }
    const followups = [];
    const html2 = kids(node).replace(FOLLOWUP, (_, label, _quote, prompt) => {
      followups.push({ label: unescapeText(label), prompt: unescapeText(prompt ?? label) });
      return "";
    });
    const body = html2.trim() ? a.tight === "true" ? html2 : `<p>${html2}</p>
` : "";
    return followups.length ? `${body}<pandacode-ui><pre><code class="language-ui">${escapeText(JSON.stringify({ type: "followups", items: followups.slice(0, 8) }))}</code></pre></pandacode-ui>
` : body;
  };
  const cell = (tag, node) => {
    const align = node.attributes?.align ?? "";
    return `<${tag}${ALIGN.has(align) ? ` class="md-align-${align}"` : ""}>${kids(node)}</${tag}>`;
  };
  function render(node) {
    const a = node.attributes ?? {};
    switch (node.type) {
      case "Document":
        return kids(node);
      // Tight list items hold their text directly, as CommonMark renders them.
      case "Paragraph":
        return paragraph(node);
      case "Text":
        return escapeText(node.content ?? "");
      case "SoftBreak":
        return "\n";
      case "LineBreak":
        return "<br>\n";
      case "Heading": {
        const level = Math.min(6, Math.max(1, Number(a.level) || 1));
        return `<h${level}>${kids(node)}</h${level}>
`;
      }
      case "Strong":
        return `<strong>${kids(node)}</strong>`;
      case "Emphasis":
        return `<em>${kids(node)}</em>`;
      case "Strikethrough":
        return `<del>${kids(node)}</del>`;
      case "Underline":
        return `<u>${kids(node)}</u>`;
      case "Superscript":
        return `<sup>${kids(node)}</sup>`;
      case "Subscript":
        return `<sub>${kids(node)}</sub>`;
      case "Highlight":
        return `<mark>${kids(node)}</mark>`;
      case "Code":
        return `<code>${escapeText(text(node))}</code>`;
      case "Link":
        return `<a href="${link(a.url ?? "")}"${a.title ? ` title="${escapeAttr(a.title)}"` : ""}>${kids(node)}</a>`;
      // Remote images are not loaded in the transcript; their description links to them instead.
      case "Image":
      case "Video": {
        const label = text(node) || a.title || (node.type === "Video" ? "Video" : "Image");
        return `<a class="md-media" href="${link(a.url ?? "")}">${escapeText(label)}</a>`;
      }
      case "Blockquote":
        return `<blockquote>
${kids(node)}</blockquote>
`;
      case "Admonition": {
        const type = ADMONITIONS[a.admonitionType ?? ""] ? a.admonitionType : "note";
        return `<aside class="md-admonition md-admonition-${type}" role="note"><p class="md-admonition-title">${ADMONITIONS[type]}</p>${kids(node)}</aside>
`;
      }
      case "UnorderedList":
      case "OrderedList": {
        const tag = node.type === "OrderedList" ? "ol" : "ul";
        const tasks = node.children?.some((item) => item.attributes?.isTask === "true");
        const start = Number(a.start);
        return `<${tag}${tasks ? ' class="md-task-list"' : ""}${tag === "ol" && Number.isInteger(start) && start !== 1 ? ` start="${start}"` : ""}>
${kids(node)}</${tag}>
`;
      }
      case "ListItem": {
        if (a.isTask !== "true") return `<li>${kids(node)}</li>
`;
        const done = a.taskChecked === "true";
        return `<li class="md-task${done ? " md-task-done" : ""}"><span class="md-checkbox" role="img" aria-label="${done ? "Done" : "Not done"}"></span>${kids(node)}</li>
`;
      }
      case "CodeBlock": {
        const language = (a.language ?? "").trim().split(/\s/)[0];
        const code = `<pre><code${language ? ` class="language-${escapeAttr(language)}"` : ""}>${escapeText(text(node))}</code></pre>`;
        return GENERATIVE.has(language.toLowerCase()) ? `<pandacode-ui>${code}</pandacode-ui>
` : `<pandacode-code>${code}</pandacode-code>
`;
      }
      case "ThematicBreak":
        return "<hr>\n";
      case "Table":
        return `<table>
${kids(node)}</table>
`;
      case "TableHead":
        return `<thead>
${kids(node)}</thead>
`;
      case "TableBody":
        return `<tbody>
${kids(node)}</tbody>
`;
      case "TableRow":
        return `<tr>${kids(node)}</tr>
`;
      case "TableHeaderCell":
        return cell("th", node);
      case "TableCell":
        return cell("td", node);
      case "LatexMathInline":
        return `<code class="md-math">${escapeText(text(node))}</code>`;
      case "LatexMathDisplay":
        return `<pre class="md-math-display"><code class="md-math">${escapeText(text(node))}</code></pre>
`;
      case "BlankLine":
        return "";
      default:
        return kids(node);
    }
  }
  const html = render(root);
  return details > 0 ? html + "</details>\n".repeat(details) : html;
}
let katex;
const unescapeText = (html) => html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
async function typesetMath(html) {
  if (!html.includes('class="md-math"')) return html;
  katex ?? (katex = import("./math").then((module) => module.default));
  const engine = await katex;
  const typeset = (tex, display) => {
    try {
      return engine.renderToString(unescapeText(tex), { displayMode: display, throwOnError: false, trust: false, strict: "ignore", output: "htmlAndMathml", maxExpand: 1e3, maxSize: 20 });
    } catch {
      return `<code class="md-math-error">${tex}</code>`;
    }
  };
  return html.replace(/<pre class="md-math-display"><code class="md-math">([\s\S]*?)<\/code><\/pre>/g, (_, tex) => `<div class="md-math-block">${typeset(tex, true)}</div>`).replace(/<code class="md-math">([\s\S]*?)<\/code>/g, (_, tex) => typeset(tex, false));
}
export {
  parseMarkdown,
  renderMarkdown,
  typesetMath
};
