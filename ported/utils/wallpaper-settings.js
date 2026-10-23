import "./wallpaper-settings.css";
import { escape, icon } from "./dom";
import { wallpaperAt, wallpaperPeriods, wallpaperSets } from "./wallpapers";
const thumbnail = (id) => `/wallpapers/thumbnails/${id}.webp`;
function mountWallpaperSettings(host, controller) {
  host.classList.add("wallpaper-settings");
  host.innerHTML = `
    <figure class="wallpaper-settings-preview" aria-label="Wallpaper preview">
      <img class="wallpaper-preview-image" alt="" decoding="async">
      <div class="wallpaper-preview-scrim"></div>
      <div class="wallpaper-preview-workspace" aria-hidden="true">
        <div class="wallpaper-preview-sidebar"><i></i><i></i><i></i></div>
        <div class="wallpaper-preview-thread"><span>A little room to think.</span><div><i></i><i></i></div><div class="wallpaper-preview-composer">Describe a task\u2026<b>\u2191</b></div></div>
      </div>
      <figcaption><span class="wallpaper-preview-caption"></span><span class="wallpaper-preview-badge">Live preview</span></figcaption>
    </figure>
    <div class="wallpaper-adjustments">
    <div class="wallpaper-visibility-control">
      <div class="wallpaper-control-heading"><label for="wallpaper-visibility">Wallpaper visibility</label><output class="wallpaper-visibility-output" for="wallpaper-visibility"></output></div>
      <input id="wallpaper-visibility" class="wallpaper-range-slider wallpaper-visibility-slider" type="range" min="0" max="100" step="1" aria-describedby="wallpaper-visibility-endpoints">
      <div id="wallpaper-visibility-endpoints" class="wallpaper-range-endpoints"><span>Solid</span><span>Wallpaper</span></div>
    </div>
    <div class="wallpaper-blur-control">
      <div class="wallpaper-control-heading"><label for="wallpaper-blur">Wallpaper blur</label><output class="wallpaper-blur-output" for="wallpaper-blur"></output></div>
      <input id="wallpaper-blur" class="wallpaper-range-slider" type="range" min="0" max="24" step="1" aria-describedby="wallpaper-blur-endpoints">
      <div id="wallpaper-blur-endpoints" class="wallpaper-range-endpoints"><span>Sharp</span><span>Soft</span></div>
    </div>
    <p class="wallpaper-accessibility-note" hidden>Your accessibility settings keep the workspace solid. Your wallpaper choices are saved.</p>
    </div>
    <section aria-labelledby="wallpaper-set-heading">
      <div class="wallpaper-section-heading"><h3 id="wallpaper-set-heading">Wallpaper set</h3><span>Three scenes per day</span></div>
      <div class="wallpaper-set-grid" role="group" aria-label="Wallpaper sets">
        <button type="button" class="wallpaper-set-card wallpaper-set-automatic" data-wallpaper-set="automatic" aria-label="Automatic weekly rotation" aria-pressed="false"><span class="wallpaper-set-art">${icon("refresh")}<small>7 days \xB7 21 scenes</small></span><span class="wallpaper-set-label">Automatic<span class="wallpaper-selection-check">${icon("check")}</span></span></button>
        ${wallpaperSets.map((set) => `<button type="button" class="wallpaper-set-card" data-wallpaper-set="${escape(set.id)}" aria-label="${escape(set.label)} wallpaper set" aria-pressed="false"><span class="wallpaper-set-art"><img src="${thumbnail(`${set.id}-morning`)}" alt="" loading="lazy" decoding="async"></span><span class="wallpaper-set-label">${escape(set.label)}<span class="wallpaper-selection-check">${icon("check")}</span></span></button>`).join("")}
      </div>
    </section>
    <section aria-labelledby="wallpaper-default-heading">
      <div class="wallpaper-section-heading"><h3 id="wallpaper-default-heading">Keep a favorite</h3><button type="button" class="wallpaper-resume" hidden>Resume rotation</button></div>
      <p class="wallpaper-default-help">Choose a scene to use it every day.</p>
      <div class="wallpaper-period-grid" role="group" aria-label="Default wallpaper">
        ${wallpaperPeriods.map((period) => `<button type="button" class="wallpaper-period-card" data-wallpaper-period="${escape(period.id)}" aria-pressed="false"><span class="wallpaper-period-art"><img alt="" loading="lazy" decoding="async"><span class="wallpaper-default-badge">${icon("check")} Default</span></span><span class="wallpaper-period-label">${escape(period.label)}<small>${period.id === "morning" ? "6 am \u2013 noon" : period.id === "afternoon" ? "Noon \u2013 6 pm" : "6 pm \u2013 6 am"}</small></span></button>`).join("")}
      </div>
      <p class="wallpaper-schedule-description" role="status"></p>
    </section>`;
  const find = (selector) => host.querySelector(selector);
  const preview = find(".wallpaper-settings-preview");
  const previewImage = find(".wallpaper-preview-image");
  const caption = find(".wallpaper-preview-caption");
  const slider = find(".wallpaper-visibility-slider");
  const output = find(".wallpaper-visibility-output");
  const blurSlider = find("#wallpaper-blur");
  const blurOutput = find(".wallpaper-blur-output");
  const accessibility = find(".wallpaper-accessibility-note");
  const resume = find(".wallpaper-resume");
  const schedule = find(".wallpaper-schedule-description");
  const setButtons = Array.from(host.querySelectorAll("[data-wallpaper-set]"));
  const periodButtons = Array.from(host.querySelectorAll("[data-wallpaper-period]"));
  let disposed = false;
  function displaySet(preferences) {
    if (preferences.pinned) return preferences.pinned.split("-")[0];
    return preferences.set === "automatic" ? wallpaperAt().split("-")[0] : preferences.set;
  }
  function render() {
    if (disposed) return;
    const preferences = controller.preferences;
    const id = controller.currentId ?? wallpaperAt(/* @__PURE__ */ new Date(), preferences);
    const [day, period] = id.split("-");
    const dayName = wallpaperSets.find((set) => set.id === day)?.label ?? day;
    const visible = preferences.enabled && !controller.accessibilityOverride;
    const visibility = visible ? preferences.visibility : 0;
    const sliderVisibility = preferences.enabled ? preferences.visibility : 0;
    if (preview.dataset.wallpaper !== id) {
      preview.dataset.wallpaper = id;
      previewImage.src = thumbnail(id);
      previewImage.alt = `${dayName} ${period} wallpaper`;
    }
    preview.style.setProperty("--wallpaper-visibility", String(visibility / 100));
    preview.style.setProperty("--wallpaper-scrim-edge", String(1 - visibility / 100));
    preview.style.setProperty("--wallpaper-scrim-center", String((1 - visibility / 100) * (1 + 0.35 * visibility / 100)));
    const previewBlur = Math.round(preferences.blur * 0.35 * 100) / 100;
    preview.style.setProperty("--wallpaper-filter", previewBlur ? `blur(${previewBlur}px)` : "none");
    preview.style.setProperty("--wallpaper-bleed", `${previewBlur * 3}px`);
    preview.dataset.solid = String(visibility === 0);
    caption.textContent = visibility === 0 ? "Solid background" : `${dayName} \xB7 ${wallpaperPeriods.find((item) => item.id === period)?.label ?? period}`;
    if (slider.value !== String(sliderVisibility)) slider.value = String(sliderVisibility);
    slider.style.setProperty("--wallpaper-range-value", `${sliderVisibility}%`);
    slider.setAttribute("aria-valuetext", sliderVisibility === 0 ? "Solid background, 0 percent wallpaper" : sliderVisibility === 100 ? "Full wallpaper, 100 percent" : `${sliderVisibility} percent wallpaper`);
    output.value = `${sliderVisibility}%`;
    if (blurSlider.value !== String(preferences.blur)) blurSlider.value = String(preferences.blur);
    blurSlider.style.setProperty("--wallpaper-range-value", `${preferences.blur / 24 * 100}%`);
    blurSlider.setAttribute("aria-valuetext", preferences.blur ? `${preferences.blur} pixels of blur` : "Off, sharp wallpaper");
    blurOutput.value = preferences.blur ? `${preferences.blur} px` : "Off";
    accessibility.hidden = !controller.accessibilityOverride;
    for (const button of setButtons) button.setAttribute("aria-pressed", String(button.dataset.wallpaperSet === preferences.set));
    const shownSet = displaySet(preferences);
    const shownName = wallpaperSets.find((set) => set.id === shownSet)?.label ?? shownSet;
    for (const button of periodButtons) {
      const time = button.dataset.wallpaperPeriod;
      const scene = `${shownSet}-${time}`;
      button.setAttribute("aria-label", `Set ${shownName} ${time} as default`);
      button.setAttribute("aria-pressed", String(preferences.pinned === scene));
      const image = button.querySelector("img");
      if (button.dataset.wallpaper !== scene) {
        button.dataset.wallpaper = scene;
        image.src = thumbnail(scene);
      }
    }
    resume.hidden = !preferences.pinned;
    const pinnedPeriod = preferences.pinned?.split("-")[1];
    const description = preferences.pinned ? `${shownName} ${pinnedPeriod} is your default. It stays until you change it.` : preferences.set === "automatic" ? "Follows the day of the week and your local time." : `${shownName} scenes follow your local time, every day.`;
    if (schedule.textContent !== description) schedule.textContent = description;
  }
  function input() {
    controller.update({ visibility: Number(slider.value) }, false);
  }
  function blurInput() {
    controller.update({ blur: Number(blurSlider.value) }, false);
  }
  function commit() {
    controller.update({}, true);
  }
  function click(event) {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (!target || !host.contains(target)) return;
    const set = target.dataset.wallpaperSet;
    const visible = { enabled: true, visibility: controller.preferences.visibility || 20 };
    if (set) controller.update({ ...visible, set, pinned: null });
    else if (target.dataset.wallpaperPeriod) controller.update({ ...visible, pinned: target.dataset.wallpaper });
    else if (target === resume) controller.update({ ...visible, pinned: null });
  }
  slider.addEventListener("input", input);
  slider.addEventListener("change", commit);
  blurSlider.addEventListener("input", blurInput);
  blurSlider.addEventListener("change", commit);
  host.addEventListener("click", click);
  const unsubscribe = controller.subscribe(render);
  render();
  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    slider.removeEventListener("input", input);
    slider.removeEventListener("change", commit);
    blurSlider.removeEventListener("input", blurInput);
    blurSlider.removeEventListener("change", commit);
    host.removeEventListener("click", click);
    controller.update({}, true);
    host.querySelectorAll("img").forEach((image) => image.removeAttribute("src"));
    host.replaceChildren();
  };
}
export {
  mountWallpaperSettings
};
