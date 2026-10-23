var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import css from "./generative-ui.css?inline";
import richCss from "./rich-markdown.css?inline";
import { icon } from "./dom";
let sheet;
function generativeSheet() {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(`${richCss}
${css}`);
  }
  return sheet;
}
let library;
const components = () => library ?? (library = import("./generative-ui-components"));
class GenerativeView extends HTMLElement {
  constructor() {
    super(...arguments);
    __publicField(this, "drawn", "");
    __publicField(this, "queued", false);
  }
  connectedCallback() {
    this.schedule();
  }
  attributeChangedCallback() {
    this.schedule();
  }
  /** Streaming sets attributes before it updates children, so read the source a microtask later. */
  schedule() {
    if (this.queued || !this.isConnected) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      void this.draw();
    });
  }
  async draw() {
    const code = this.querySelector("code");
    const kind = (code?.className.match(/language-(\w+)/)?.[1] ?? "ui").toLowerCase();
    const source = code?.textContent ?? "";
    const pending = this.classList.contains("pending");
    const key = `${pending}\0${kind}\0${source}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.adoptedStyleSheets = [generativeSheet()];
    if (pending) {
      root.replaceChildren(placeholder());
      return;
    }
    if (!root.firstChild) root.append(placeholder());
    try {
      const view = await (await components()).renderBlock(kind, source);
      if (this.drawn !== key) return;
      root.replaceChildren(view);
      if (kind === "html" || kind === "svg") root.append(sourceToggle());
    } catch {
      if (this.drawn === key) {
        const note = document.createElement("p");
        note.className = "gu-error";
        note.textContent = "This view could not be shown.";
        root.replaceChildren(note);
      }
    }
  }
}
__publicField(GenerativeView, "observedAttributes", ["class"]);
function sourceToggle() {
  const details = document.createElement("details");
  details.className = "gu-source";
  const summary = document.createElement("summary");
  summary.setAttribute("aria-label", "Source");
  details.append(summary, document.createElement("slot"));
  return details;
}
function placeholder() {
  const note = document.createElement("div");
  note.className = "gu-pending";
  note.setAttribute("role", "status");
  note.setAttribute("aria-label", "Building view");
  return note;
}
function fillComposer(text) {
  const prompt = document.querySelector("#prompt");
  if (!prompt || prompt.disabled) return false;
  const current = prompt.value.trimEnd();
  prompt.value = current ? `${current}

${text}` : text;
  prompt.dispatchEvent(new Event("input", { bubbles: true }));
  prompt.focus();
  prompt.setSelectionRange(prompt.value.length, prompt.value.length);
  return true;
}
const COPY_STYLE = ":host{display:block;position:relative}button{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:24px;height:24px;color:var(--muted);background:var(--panel);border:1px solid var(--border);border-radius:5px;padding:0;cursor:pointer;opacity:0}svg{width:14px;height:14px}:host(:hover) button,button:focus-visible{opacity:1}button:hover{color:var(--text)}button:focus-visible{outline:2px solid var(--focus);outline-offset:1px}@media (hover:none){button{opacity:1}}";
class CodeBlock extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = COPY_STYLE;
    const copy = document.createElement("button");
    const show = (label, symbol) => {
      copy.setAttribute("aria-label", label);
      copy.title = label;
      copy.innerHTML = icon(symbol);
    };
    copy.type = "button";
    show("Copy code", "copy");
    copy.addEventListener("click", () => {
      void navigator.clipboard?.writeText(this.querySelector("code")?.textContent ?? "").then(() => show("Copied", "check"), () => show("Copy failed", "alert")).finally(() => setTimeout(() => show("Copy code", "copy"), 1500));
    });
    root.append(style, document.createElement("slot"), copy);
  }
}
if (typeof customElements !== "undefined" && !customElements.get("pandacode-ui")) {
  customElements.define("pandacode-ui", GenerativeView);
  customElements.define("pandacode-code", CodeBlock);
  setTimeout(() => {
    void components().catch(() => {
      library = void 0;
    });
  }, 1500);
}
export {
  fillComposer,
  generativeSheet
};
