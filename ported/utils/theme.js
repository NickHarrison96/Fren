import { migratePreferences } from "./preferences";
try {
  migratePreferences(localStorage);
} catch {
}
function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#1c1c1b" : "#ffffff");
}
function setTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem("pandacode.theme", theme);
  } catch {
  }
  window.dispatchEvent(new Event("pandacode-theme-change"));
}
let saved = "dark";
try {
  if (localStorage.getItem("pandacode.theme") === "light") saved = "light";
} catch {
}
applyTheme(saved);
export {
  currentTheme,
  setTheme
};
