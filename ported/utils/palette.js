import "./palette.css";
import { parseHex } from "./color";
import { accentTokens, vsixTokens } from "./palette-core";
import { wallpaperAccents } from "./wallpaper-accents";
const STORE = "pandacode.palette";
const CLASSIC = "#ffd43b";
const SWATCHES = ["#4f8ef7", "#34c084", "#a86cf0", "#f0679b", "#ff8a3d", "#2fb8c4"];
const TOKEN_NAMES = [
  "--bg",
  "--sidebar",
  "--panel",
  "--raised",
  "--border",
  "--text",
  "--muted",
  "--faint",
  "--success",
  "--danger",
  "--accent",
  "--accent-rgb",
  "--accent-dim",
  "--accent-ink",
  "--focus",
  "--on-accent",
  "--accent-hover",
  "--accent-deep-rgb",
  "--accent-tint",
  "--accent-tint-strong"
];
const root = document.documentElement;
function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    const accent = saved?.accent;
    const valid = accent && (accent.mode === "wallpaper" || accent.mode === "classic" || accent.mode === "custom" && parseHex(accent.color));
    return { accent: valid ? accent : { mode: "wallpaper" }, vsix: saved?.vsix ?? null, cache: saved?.cache ?? null };
  } catch {
    return { accent: { mode: "wallpaper" }, vsix: null, cache: null };
  }
}
let state = read();
let wallpaperId;
let wallpaperColor;
const theme = () => root.dataset.theme === "light" ? "light" : "dark";
function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
  }
}
function write(tokens) {
  for (const name of TOKEN_NAMES) {
    if (name in tokens) root.style.setProperty(name, tokens[name]);
    else root.style.removeProperty(name);
  }
}
let terminalOverrides = {};
function paletteTerminal() {
  return terminalOverrides;
}
function compute() {
  const mode = theme();
  if (state.vsix) {
    const { tokens: tokens2, terminal } = vsixTokens(state.vsix);
    return { key: `vsix:${state.vsix.id}`, tokens: tokens2, terminal };
  }
  const color = state.accent.mode === "custom" ? state.accent.color : state.accent.mode === "wallpaper" ? wallpaperColor : void 0;
  const source = color && parseHex(color)?.rgb;
  if (!source) return { key: `classic:${mode}`, tokens: {}, terminal: {} };
  const tokens = accentTokens(source, mode);
  return { key: `${color}:${mode}`, tokens, terminal: { cursor: tokens["--focus"], selectionBackground: tokens["--accent"] + "40" } };
}
function apply() {
  const next = compute();
  if (state.vsix) root.dataset.theme = state.vsix.kind;
  root.toggleAttribute("data-vsix", Boolean(state.vsix));
  write(next.tokens);
  terminalOverrides = next.terminal;
  const changed = state.cache?.key !== next.key;
  state = { ...state, cache: next };
  persist();
  if (changed) window.dispatchEvent(new CustomEvent("pandacode-palette-change"));
}
const palette = {
  get accent() {
    return state.accent;
  },
  get vsix() {
    return state.vsix;
  },
  get wallpaperColor() {
    return wallpaperColor;
  },
  /** What the wallpaper accent looks like on screen, after tuning for the current base. */
  get wallpaperAccent() {
    const source = wallpaperColor && parseHex(wallpaperColor)?.rgb;
    return source ? accentTokens(source, theme())["--accent"] : void 0;
  },
  setAccent(accent) {
    state = { ...state, accent };
    apply();
  },
  setVsix(themeData) {
    const leaving = state.vsix && !themeData;
    state = { ...state, vsix: themeData };
    apply();
    if (leaving) {
      let saved = "dark";
      try {
        saved = localStorage.getItem("pandacode.theme") === "light" ? "light" : "dark";
      } catch {
      }
      root.dataset.theme = saved;
      apply();
    }
    window.dispatchEvent(new Event("pandacode-theme-change"));
  },
  /** The wallpaper changed: its accent applies, unless a VS Code theme holds the colors. */
  setWallpaper(id) {
    if (id === wallpaperId) return;
    wallpaperId = id;
    wallpaperColor = id ? wallpaperAccents[id] : void 0;
    if (!state.vsix && state.accent.mode === "wallpaper") apply();
  },
  /** Light or dark changed: shades are re-derived for the new base. */
  refresh() {
    apply();
  }
};
if (state.cache) {
  if (state.vsix) {
    root.dataset.theme = state.vsix.kind;
    root.setAttribute("data-vsix", "");
  }
  write(state.cache.tokens);
  terminalOverrides = state.cache.terminal ?? {};
  const prefix = state.cache.key.split(":")[0];
  if (!state.vsix && prefix.startsWith("#") && state.accent.mode === "wallpaper") wallpaperColor = prefix;
}
export {
  CLASSIC,
  SWATCHES,
  palette,
  paletteTerminal
};
