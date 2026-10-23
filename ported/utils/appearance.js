import { call, preview } from "./bridge";
import { isMac } from "./platform";
function initializeNativeAppearance(configure = (preferences) => call("configure_window_appearance", preferences)) {
  const root = document.documentElement;
  root.dataset.nativePlatform = !preview && isMac ? "macos" : "other";
  const transparency = matchMedia("(prefers-reduced-transparency: reduce)");
  const contrast = matchMedia("(prefers-contrast: more)");
  let disposed = false, busy = false, dirty = false;
  function preferences() {
    return {
      reducedTransparency: transparency.matches,
      increasedContrast: contrast.matches,
      darkMode: root.dataset.theme === "dark"
    };
  }
  async function synchronize() {
    busy = true;
    try {
      while (!disposed && dirty) {
        dirty = false;
        const requested = preferences();
        try {
          const result = await configure(requested);
          if (disposed || dirty) continue;
          root.dataset.nativePlatform = result.platform;
          root.dataset.nativeMaterial = result.platform === "macos" && !requested.reducedTransparency && !requested.increasedContrast ? result.material : "solid";
        } catch (error) {
          if (!disposed) root.dataset.nativeMaterial = "solid";
          console.warn("Native window material unavailable; using an opaque surface.", error);
        }
      }
    } finally {
      busy = false;
    }
  }
  function refresh() {
    if (disposed) return;
    dirty = true;
    if (transparency.matches || contrast.matches) root.dataset.nativeMaterial = "solid";
    if (!busy) void synchronize();
  }
  function dispose() {
    disposed = true;
    transparency.removeEventListener("change", refresh);
    contrast.removeEventListener("change", refresh);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("pandacode-theme-change", refresh);
    window.removeEventListener("pagehide", dispose);
    delete root.dataset.nativeMaterial;
    delete root.dataset.nativePlatform;
  }
  transparency.addEventListener("change", refresh);
  contrast.addEventListener("change", refresh);
  window.addEventListener("focus", refresh);
  window.addEventListener("pandacode-theme-change", refresh);
  window.addEventListener("pagehide", dispose, { once: true });
  refresh();
  return dispose;
}
export {
  initializeNativeAppearance
};
