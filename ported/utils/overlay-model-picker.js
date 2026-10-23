import "./overlay-model-picker.css";
import { openModelPicker } from "./model-picker";
import { nativeOverlay, overlayCall } from "./overlay-client";
let discovery;
let discoveredAt = 0;
const catalogs = /* @__PURE__ */ new Map();
let watching;
function watchModelPreferences() {
  return watching ?? (watching = (async () => {
    const invalidate = () => {
      catalogs.delete("opencode");
      discovery = void 0;
    };
    if (nativeOverlay) {
      await (await import("@tauri-apps/api/event")).listen("provider-models-changed", (event) => {
        if (event.payload.provider === "opencode") invalidate();
      });
    } else {
      window.addEventListener("storage", (event) => {
        if (event.key === "pandacode.preview.opencode-models") invalidate();
      });
      window.addEventListener("pandacode-preview-models-changed", invalidate);
    }
  })().catch((error) => {
    watching = void 0;
    throw error;
  }));
}
async function providers() {
  if (!discovery || Date.now() - discoveredAt > 6e4) {
    discoveredAt = Date.now();
    discovery = overlayCall("list_providers").catch((error) => {
      discovery = void 0;
      throw error;
    });
  }
  return discovery;
}
async function openOverlayModelPicker(options) {
  await watchModelPreferences();
  const available = await providers();
  if (!options.valid()) return;
  available.forEach((provider) => options.catalog(provider.id, provider.models));
  if (!available.length) throw new Error("No harnesses found. Check your agent connections in PandaCode.");
  const openCodeSaved = (available.find((provider) => provider.id === "opencode")?.models.length ?? 0) > 1;
  return openModelPicker({
    recent: (provider) => provider === "opencode" && !openCodeSaved ? [] : null,
    anchor: options.anchor,
    providers: available,
    current: { ...options.current, provider: options.current.provider },
    canSwitchProvider: true,
    placement: "below",
    onSelect: options.select,
    onClose: options.close,
    loadModels: async (provider) => {
      let cached = catalogs.get(provider);
      if (!cached || Date.now() - cached.time > 6e4) {
        const promise = overlayCall("list_provider_models", { provider }).catch((error) => {
          catalogs.delete(provider);
          throw error;
        });
        cached = { time: Date.now(), promise };
        catalogs.set(provider, cached);
      }
      const models = await cached.promise;
      if (options.valid()) options.catalog(provider, models);
      return models;
    }
  });
}
export {
  openOverlayModelPicker
};
