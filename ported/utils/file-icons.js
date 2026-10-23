import manifest from "material-icon-theme/dist/material-icons.json";
import { escape } from "./dom.ts";
const { iconDefinitions, light, ...dark } = manifest;
function find(kind, key, isLight) {
  if (isLight && Object.hasOwn(light[kind], key)) return light[kind][key];
  return Object.hasOwn(dark[kind], key) ? dark[kind][key] : void 0;
}
function fileIconId(name, isDir, isLight = false) {
  const lower = name.toLowerCase();
  if (isDir) return find("folderNames", lower, isLight) ?? "folder";
  const exact = find("fileNames", lower, isLight);
  if (exact) return exact;
  for (let dot = lower.indexOf("."); dot !== -1; dot = lower.indexOf(".", dot + 1)) {
    const id = find("fileExtensions", lower.slice(dot + 1), isLight);
    if (id) return id;
  }
  return "file";
}
function fileIconUrl(name, isDir, isLight = false) {
  const file = iconDefinitions[fileIconId(name, isDir, isLight)].iconPath.split("/").pop();
  return new URL(`../node_modules/material-icon-theme/icons/${file}`, import.meta.url).href;
}
function fileIcon(name, isDir, isLight = false) {
  return `<img class="icon file-type-icon" src="${escape(fileIconUrl(name, isDir, isLight))}" alt="" aria-hidden="true" draggable="false">`;
}
export {
  fileIcon,
  fileIconId,
  fileIconUrl
};
