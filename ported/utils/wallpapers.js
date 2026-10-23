const wallpaperSets = [
  { id: "mon", label: "Monday" },
  { id: "tue", label: "Tuesday" },
  { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" },
  { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" }
];
const wallpaperPeriods = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "night", label: "Night" }
];
const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const preferenceKey = "pandacode.wallpaperPreferences";
const legacyKey = "pandacode.wallpapers";
function normalizeWallpaperPreferences(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    visibility: typeof input.visibility === "number" && Number.isFinite(input.visibility) ? Math.max(0, Math.min(100, Math.round(input.visibility))) : 20,
    blur: typeof input.blur === "number" && Number.isFinite(input.blur) ? Math.max(0, Math.min(24, Math.round(input.blur))) : 0,
    set: wallpaperSets.some((day) => day.id === input.set) ? input.set : "automatic",
    pinned: typeof input.pinned === "string" && /^(mon|tue|wed|thu|fri|sat|sun)-(morning|afternoon|night)$/.test(input.pinned) ? input.pinned : null
  };
}
function readPreferences() {
  try {
    const stored = localStorage.getItem(preferenceKey);
    if (stored) {
      try {
        return normalizeWallpaperPreferences(JSON.parse(stored));
      } catch {
      }
    }
    return normalizeWallpaperPreferences({ enabled: localStorage.getItem(legacyKey) !== "false" });
  } catch {
    return normalizeWallpaperPreferences(null);
  }
}
function wallpaperAt(date = /* @__PURE__ */ new Date(), preferences) {
  const choice = normalizeWallpaperPreferences(preferences);
  if (choice.pinned) return choice.pinned;
  const hour = date.getHours();
  const period = hour >= 6 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "night";
  return `${choice.set === "automatic" ? days[date.getDay()] : choice.set}-${period}`;
}
function nextWallpaperChange(date = /* @__PURE__ */ new Date()) {
  const next = new Date(date);
  const hour = date.getHours();
  next.setHours(hour < 6 ? 6 : hour < 12 ? 12 : hour < 18 ? 18 : 24, 0, 0, 0);
  return next;
}
function mountWallpapers(host) {
  const layer = document.createElement("div");
  layer.className = "workspace-wallpaper";
  layer.setAttribute("aria-hidden", "true");
  host.prepend(layer);
  const contrast = matchMedia("(prefers-contrast: more)");
  const transparency = matchMedia("(prefers-reduced-transparency: reduce)");
  let preferences = Object.freeze(readPreferences());
  const listeners = /* @__PURE__ */ new Set();
  let disposed = false, generation = 0, timer = 0, pendingId = "";
  let current, pending;
  function emit() {
    listeners.forEach((listener) => listener());
  }
  function applyAppearance() {
    const visibility = preferences.enabled ? preferences.visibility / 100 : 0;
    host.style.setProperty("--wallpaper-visibility", String(visibility));
    host.style.setProperty("--wallpaper-scrim-edge", String(1 - visibility));
    host.style.setProperty("--wallpaper-scrim-center", String((1 - visibility) * (1 + 0.35 * visibility)));
    host.style.setProperty("--wallpaper-blur", `${preferences.blur}px`);
    host.style.setProperty("--wallpaper-filter", preferences.blur ? `blur(${preferences.blur}px)` : "none");
    host.style.setProperty("--wallpaper-bleed", `${preferences.blur * 3}px`);
  }
  function persist() {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(preferences));
      localStorage.setItem(legacyKey, String(preferences.enabled && preferences.visibility > 0));
    } catch {
    }
  }
  function remove(image) {
    image.remove();
    image.removeAttribute("src");
  }
  function clear() {
    ++generation;
    pendingId = "";
    if (pending) {
      remove(pending);
      pending = void 0;
    }
    layer.querySelectorAll("img").forEach(remove);
    current = void 0;
    delete host.dataset.wallpaper;
  }
  async function load(id) {
    const requested = ++generation;
    layer.querySelectorAll("img").forEach((child) => {
      if (child !== current) remove(child);
    });
    pendingId = id;
    if (pending) remove(pending);
    const image = new Image();
    pending = image;
    image.alt = "";
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src = `/wallpapers/${id}.webp`;
    try {
      await image.decode();
      if (disposed || requested !== generation || document.hidden) {
        remove(image);
        return;
      }
      const previous = current;
      layer.append(image);
      current = image;
      host.dataset.wallpaper = id;
      emit();
      if (previous) remove(previous);
    } catch {
      remove(image);
    } finally {
      if (requested === generation) {
        pendingId = "";
        pending = void 0;
      }
    }
  }
  function refresh() {
    window.clearTimeout(timer);
    if (disposed) return;
    if (!preferences.enabled || !preferences.visibility || contrast.matches || transparency.matches) {
      clear();
      emit();
      return;
    }
    if (document.hidden) {
      emit();
      return;
    }
    const now = /* @__PURE__ */ new Date(), id = wallpaperAt(now, preferences);
    if (host.dataset.wallpaper === id && pendingId && pendingId !== id) {
      ++generation;
      pendingId = "";
      if (pending) {
        remove(pending);
        pending = void 0;
      }
    }
    if (host.dataset.wallpaper !== id && pendingId !== id) void load(id);
    if (!preferences.pinned) timer = window.setTimeout(refresh, Math.max(1, nextWallpaperChange(now).getTime() - now.getTime()));
    emit();
  }
  function update(patch, save = true) {
    if (disposed) return;
    const previous = preferences;
    const next = normalizeWallpaperPreferences({ ...previous, ...patch });
    if (patch.visibility !== void 0 && patch.enabled === void 0) next.enabled = next.visibility > 0;
    preferences = Object.freeze(next);
    applyAppearance();
    if (save) persist();
    if (next.set !== previous.set || next.pinned !== previous.pinned || next.enabled !== previous.enabled || next.visibility === 0 !== (previous.visibility === 0)) refresh();
    else emit();
  }
  function setEnabled(value) {
    update({ enabled: value, visibility: preferences.visibility || 20 });
  }
  function synchronize(event) {
    if (event.key !== preferenceKey && event.key !== null) return;
    preferences = Object.freeze(readPreferences());
    applyAppearance();
    refresh();
  }
  function dispose() {
    persist();
    disposed = true;
    window.clearTimeout(timer);
    clear();
    layer.remove();
    contrast.removeEventListener("change", refresh);
    transparency.removeEventListener("change", refresh);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("pagehide", dispose);
    window.removeEventListener("storage", synchronize);
    listeners.clear();
  }
  contrast.addEventListener("change", refresh);
  transparency.addEventListener("change", refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pagehide", dispose, { once: true });
  window.addEventListener("storage", synchronize);
  applyAppearance();
  refresh();
  return {
    get preferences() {
      return preferences;
    },
    get enabled() {
      return preferences.enabled && preferences.visibility > 0;
    },
    get currentId() {
      return host.dataset.wallpaper;
    },
    get accessibilityOverride() {
      return contrast.matches || transparency.matches;
    },
    update,
    setEnabled,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose
  };
}
export {
  mountWallpapers,
  nextWallpaperChange,
  normalizeWallpaperPreferences,
  wallpaperAt,
  wallpaperPeriods,
  wallpaperSets
};
