// PandaCode dom shim for AnythingLLM frontend.
// Provides the minimal helpers the ported modules need. Stubs marked TODO.

export function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const ICONS = {
  file: '<path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
  terminal: '<path d="m4 6 6 6-6 6m9 0h7"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/>',
  command: '<path d="M8 8h8v8H8Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  activity: '<path d="M4 20h16M7 16V9m5 7V4m5 12v-5"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="4"/>',
  file: '<path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
  attach: '<path d="m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2m-5 11 7-7"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
};
export function icon(name, cls = "") {
  const path = ICONS[name] ?? ICONS.file;
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function fileIcon(name, isDir) {
  return icon(isDir ? "folder" : "file");
}

// TODO: wire to AnythingLLM's markdown renderer
export async function markdownHtml(value) {
  return value;
}

export function $(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

export function morph(target, html, depth = 4) {
  target.innerHTML = html;
}
