import { escape, markdown } from "./dom";
import { trackSegment } from "./motion";
const LINE_LIMIT = 2e3;
const WORDS_PER_MINUTE = 230;
const MARKDOWN = /\.(md|markdown|mdx)$/i;
const TEXT = /\.(txt|text|rst|adoc|asciidoc|org)$/i;
const README_LIKE = /^(readme|changelog|changes|contributing|license|licence|authors|notice|copying|todo|history)$/i;
const views = /* @__PURE__ */ new Map();
const wraps = /* @__PURE__ */ new Map();
function kindOf(path) {
  const name = path.split("/").pop() ?? "";
  if (MARKDOWN.test(name) || README_LIKE.test(name)) return "markdown";
  return TEXT.test(name) ? "text" : "code";
}
function setDocumentView(path, view) {
  const kind = kindOf(path);
  if (kind !== "code") views.set(kind, view);
}
function stats(content) {
  const words = content.match(/\S+/g)?.length ?? 0;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${words.toLocaleString()} word${words === 1 ? "" : "s"} \xB7 ${minutes} min read`;
}
function codeLines(content) {
  const lines = content.split("\n", LINE_LIMIT).map((line, i) => `<div class="code-line"><span class="line-number">${i + 1}</span><code>${escape(line) || " "}</code></div>`).join("");
  const capped = content.split("\n", LINE_LIMIT + 1).length > LINE_LIMIT;
  return `<div class="code-preview">${lines}</div>${capped ? '<div class="inspector-hint">Preview limited to 2,000 lines.</div>' : ""}`;
}
function paragraphs(content) {
  return content.split(/\n\s*\n/).filter((part) => part.trim()).map((part) => `<p>${escape(part.trim())}</p>`).join("");
}
function toolbar(kind, view, wrap, content) {
  const segment = (value, label) => `<button type="button" data-doc-view="${value}" aria-pressed="${view === value}">${label}</button>`;
  const toggle = kind === "code" ? "" : `<div class="doc-view-switch" role="group" aria-label="Document view">${segment("rendered", "Rendered")}${segment("raw", "Raw")}</div>`;
  const words = kind === "code" ? "" : `<span class="doc-stats">${stats(content)}</span>`;
  const wrapButton = kind !== "code" && view === "rendered" ? "" : `<button type="button" class="doc-wrap" data-doc-wrap aria-pressed="${wrap}">Wrap</button>`;
  return `<div class="doc-toolbar">${toggle}${words}${wrapButton}</div>`;
}
function renderDocument(host, path, content) {
  const kind = kindOf(path);
  const view = kind === "code" ? "raw" : views.get(kind) ?? "rendered";
  const wrap = wraps.get(kind) ?? kind !== "code";
  const body = kind === "code" ? codeLines(content) : view === "raw" ? `<pre class="doc-raw">${escape(content)}</pre>` : kind === "text" ? `<article class="doc-reader doc-plain">${paragraphs(content)}</article>` : '<article class="doc-reader markdown"></article>';
  host.innerHTML = `<div class="document-viewer" data-kind="${kind}" data-view="${view}"${wrap ? " data-wrap" : ""}>${toolbar(kind, view, wrap, content)}${body}</div>`;
  const viewer = host.firstElementChild;
  const reader = viewer.querySelector(".doc-reader.markdown");
  if (reader) void markdown(reader, content);
  const group = viewer.querySelector(".doc-view-switch");
  if (group) trackSegment(group, group.querySelector('[aria-pressed="true"]'));
  viewer.addEventListener("click", (event) => {
    const target = event.target.closest("[data-doc-view],[data-doc-wrap]");
    if (!target) return;
    if (target.dataset.docView) views.set(kind, target.dataset.docView);
    else wraps.set(kind, !wrap);
    renderDocument(host, path, content);
  });
}
export {
  renderDocument,
  setDocumentView
};
