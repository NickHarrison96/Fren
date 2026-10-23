import { escape } from "./dom";
const icons = /* @__PURE__ */ new Map();
const pending = /* @__PURE__ */ new Set();
function projectIconHtml(projectId, name, load, loaded) {
  const known = icons.get(projectId);
  if (known === void 0 && !pending.has(projectId)) {
    pending.add(projectId);
    load(projectId).then((icon) => {
      icons.set(projectId, icon && icon.startsWith("data:image/") ? icon : null);
    }).catch(() => {
      icons.set(projectId, null);
    }).finally(() => {
      pending.delete(projectId);
      loaded();
    });
  }
  if (known) return `<img class="task-app-icon" src="${escape(known)}" alt="" aria-hidden="true" draggable="false" decoding="sync">`;
  const initial = (name.trim()[0] ?? "\xB7").toUpperCase();
  return `<span class="task-app-icon task-app-default" data-initial="${escape(initial)}" aria-hidden="true"></span>`;
}
function forgetProjectIcon(projectId) {
  icons.delete(projectId);
}
export {
  forgetProjectIcon,
  projectIconHtml
};
