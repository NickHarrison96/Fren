const PREVIEW_EXTENSIONS = /\.(?:html?|svg|png|jpe?g|gif|webp|avif|bmp|ico|pdf)$/i;
const TEXT_EXTENSIONS = /\.(?:html?|svg|png|jpe?g|gif|webp|avif|bmp|ico|pdf|md|mdx|txt|css|scss|sass|less|js|jsx|ts|tsx|mjs|cjs|json|jsonc|yaml|yml|toml|xml|csv|rs|py|go|java|c|cc|cpp|h|hpp|swift|kt|sh|zsh|fish|sql|vue|svelte|astro|lock|env)$/i;
function isPreviewableFile(path) {
  return PREVIEW_EXTENSIONS.test(path);
}
function fileReference(input) {
  if (!input || input.length > 1024 || /[\x00-\x1f<>]/.test(input)) return;
  let path = input.trim();
  if (/^file:/i.test(path)) {
    try {
      const url = new URL(path);
      if (url.protocol !== "file:" || url.hostname && url.hostname !== "localhost" || url.search) return;
      path = url.pathname + url.hash;
      if (/^\/[a-z]:[\\/]/i.test(path)) path = path.slice(1);
    } catch {
      return;
    }
  }
  try {
    path = decodeURIComponent(path);
  } catch {
    return;
  }
  if (/[\x00-\x1f<>]/.test(path)) return;
  if (/^\/[a-z]:[\\/]/i.test(path)) path = path.slice(1);
  path = path.replace(/(?::\d+(?::\d+)?|#L\d+(?:-L?\d+)?)$/, "");
  if (!path || /[?#]/.test(path) || path.startsWith("//") || path.startsWith("\\\\")) return;
  if (/^[a-z][a-z\d+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)) return;
  if (path.includes("@") || /[:]/.test(path.replace(/^[a-z]:/i, ""))) return;
  if (!/(?:^|[\\/])[^\\/]+\.[a-z\d]{1,12}$/i.test(path) && !/(?:^|[\\/])(?:README|LICENSE|Dockerfile|Makefile|\.gitignore|\.env)$/i.test(path)) return;
  return path;
}
function findFileReferences(text) {
  const matches = [];
  const tokens = /[^\s<>"'`()[\]{};,!=]+/g;
  for (const match of text.matchAll(tokens)) {
    const token = match[0].replace(/[.!]+$/, "");
    const path = fileReference(token);
    if (path && (TEXT_EXTENSIONS.test(path) || /(?:^|\/)README$/.test(path))) matches.push({ start: match.index, end: match.index + token.length, path });
    if (matches.length >= 96) break;
  }
  return matches;
}
let options;
const targets = /* @__PURE__ */ new WeakMap();
const hubs = /* @__PURE__ */ new Map();
const MAX_CACHE = 512;
const BATCH_SIZE = 32;
function configureFileLinks(value) {
  options = value;
  hubs.clear();
}
function refreshFileLinks(context) {
  const hub = hubs.get(JSON.stringify([context.projectId, context.sessionId ?? ""]));
  if (!hub) return;
  if (hub.busy) {
    hub.refreshPending = true;
    return;
  }
  for (const [path, entry] of hub.cache) if (!entry.file) hub.cache.delete(path);
  updateTargets(hub);
}
function updateTargets(hub) {
  for (const reference of hub.targets) {
    const target = reference.deref();
    if (!target || !target.isConnected || targets.get(target)?.hub !== hub) hub.targets.delete(reference);
    else decorateFileLinks(target, target);
  }
}
function hubFor(context) {
  if (!context?.projectId || !options) return;
  const key = JSON.stringify([context.projectId, context.sessionId ?? ""]);
  let hub = hubs.get(key);
  if (!hub) {
    hub = { context: { ...context }, options, cache: /* @__PURE__ */ new Map(), queue: /* @__PURE__ */ new Set(), targets: /* @__PURE__ */ new Set(), busy: false };
    hubs.set(key, hub);
    if (hubs.size > 24) hubs.delete(hubs.keys().next().value);
  }
  return hub;
}
function bindFileLinkContext(target, context) {
  const previous = targets.get(target);
  const hub = hubFor(context);
  if (previous && previous.hub === hub) return;
  targets.set(target, { hub });
  if (hub) hub.targets.add(new WeakRef(target));
  installClickHandler(target);
}
function captureFileLinkContext(target) {
  return capture(target);
}
function capture(target) {
  let bound = targets.get(target);
  if (!bound) {
    const hub = hubFor(options?.context());
    bound = { hub };
    targets.set(target, bound);
    if (hub) hub.targets.add(new WeakRef(target));
    installClickHandler(target);
  }
  return bound.hub;
}
const listening = /* @__PURE__ */ new WeakSet();
const linkFiles = /* @__PURE__ */ new WeakMap();
function installClickHandler(target) {
  if (listening.has(target)) return;
  listening.add(target);
  target.addEventListener("click", (event) => {
    const link = event.target.closest?.(".workspace-file-link");
    if (!link || !target.contains(link)) return;
    event.preventDefault();
    event.stopPropagation();
    const bound = linkFiles.get(link);
    if (!bound || targets.get(target)?.hub !== bound.hub) return;
    void Promise.resolve(bound.hub.options.open(bound.hub.context, bound.file)).catch(() => {
    });
  });
}
function cached(hub, input) {
  const entry = hub.cache.get(input);
  if (entry && entry.expires > Date.now()) return entry.file;
  if (entry) hub.cache.delete(input);
}
function request(hub, input) {
  if (cached(hub, input) !== void 0 || hub.queue.size >= MAX_CACHE) return;
  hub.queue.add(input);
  if (!hub.timer && !hub.busy) hub.timer = window.setTimeout(() => {
    hub.timer = void 0;
    void flush(hub);
  }, 100);
}
async function flush(hub) {
  const paths = [...hub.queue].slice(0, BATCH_SIZE);
  if (!paths.length || hub.busy) return;
  paths.forEach((path) => hub.queue.delete(path));
  hub.busy = true;
  paths.forEach((path) => hub.cache.set(path, { file: null, expires: Date.now() + 3e4 }));
  try {
    const files = await hub.options.resolve(hub.context, paths);
    for (const file of files) if (paths.includes(file.input) && typeof file.path === "string" && file.path.length <= 4096) {
      hub.cache.set(file.input, { file, expires: Infinity });
    }
  } catch {
  } finally {
    hub.busy = false;
    while (hub.cache.size > MAX_CACHE) hub.cache.delete(hub.cache.keys().next().value);
    if (hub.refreshPending) {
      hub.refreshPending = false;
      for (const [path, entry] of hub.cache) if (!entry.file) hub.cache.delete(path);
    }
    updateTargets(hub);
    if (hub.queue.size && !hub.timer) hub.timer = window.setTimeout(() => {
      hub.timer = void 0;
      void flush(hub);
    }, 100);
  }
}
function fileLink(hub, file, contents) {
  const link = document.createElement("button");
  link.type = "button";
  link.className = "workspace-file-link";
  link.title = `${file.previewable ? "Preview" : "Open"} ${file.path}`;
  link.append(...contents);
  linkFiles.set(link, { hub, file });
  return link;
}
function decorateFileLinks(root, target) {
  const hub = capture(target);
  for (const anchor of root.querySelectorAll("a")) {
    const href = anchor.getAttribute("href") ?? "";
    if (!href) continue;
    if (/^(?:https?:|mailto:|tel:)/i.test(href)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      continue;
    }
    const path = fileReference(href);
    const span = document.createElement("span");
    span.append(...anchor.childNodes);
    if (path && hub) {
      const file = cached(hub, path);
      if (file) {
        span.replaceChildren(fileLink(hub, file, [...span.childNodes]));
      } else {
        span.dataset.fileReference = path;
        request(hub, path);
      }
    }
    anchor.replaceWith(span);
  }
  if (!hub) return;
  for (const span of root.querySelectorAll("[data-file-reference]")) {
    const path = span.dataset.fileReference;
    const file = cached(hub, path);
    if (file) span.replaceChildren(fileLink(hub, file, [...span.childNodes]));
    if (file) delete span.dataset.fileReference;
    else request(hub, path);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest("a,pre,button,script,style,[data-file-reference]")) continue;
    textNodes.push(node);
  }
  let count = 0;
  for (const text of textNodes) {
    if (count >= 96) break;
    const full = text.parentElement?.tagName === "CODE" ? fileReference(text.data) : void 0;
    const references = full ? [{ start: 0, end: text.length, path: full }] : findFileReferences(text.data);
    if (!references.length) continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let linked = false;
    for (const ref of references) {
      if (++count > 96) break;
      const file = cached(hub, ref.path);
      if (!file) {
        request(hub, ref.path);
        continue;
      }
      fragment.append(text.data.slice(cursor, ref.start), fileLink(hub, file, [document.createTextNode(text.data.slice(ref.start, ref.end))]));
      cursor = ref.end;
      linked = true;
    }
    if (linked) {
      fragment.append(text.data.slice(cursor));
      text.replaceWith(fragment);
    }
  }
}
function retainFileLink(old, next) {
  const bound = linkFiles.get(next);
  if (bound) linkFiles.set(old, bound);
  else linkFiles.delete(old);
}
export {
  bindFileLinkContext,
  captureFileLinkContext,
  configureFileLinks,
  decorateFileLinks,
  fileReference,
  findFileReferences,
  isPreviewableFile,
  refreshFileLinks,
  retainFileLink
};
