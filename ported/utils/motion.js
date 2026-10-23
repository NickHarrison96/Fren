const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOTION = false;
const canAnimate = (element) => MOTION && !document.hidden && typeof element.animate === "function";
const FRAME = 1e3 / 60;
function springProgress({ damping = 1, response = 0.36, velocity = 0 } = {}) {
  const omega = 2 * Math.PI / Math.max(0.05, response);
  const x0 = -1, v0 = velocity;
  const displacement = (t) => {
    if (Math.abs(damping - 1) < 1e-3) return (x0 + (v0 + omega * x0) * t) * Math.exp(-omega * t);
    if (damping < 1) {
      const wd = omega * Math.sqrt(1 - damping * damping);
      return Math.exp(-damping * omega * t) * (x0 * Math.cos(wd * t) + (v0 + damping * omega * x0) / wd * Math.sin(wd * t));
    }
    const root = omega * Math.sqrt(damping * damping - 1), r1 = -damping * omega + root, r2 = -damping * omega - root;
    const b = (v0 - r1 * x0) / (r2 - r1);
    return (x0 - b) * Math.exp(r1 * t) + b * Math.exp(r2 * t);
  };
  const samples = [];
  const limit = Math.min(2e3, Math.max(200, response * 4e3));
  let settled = 0;
  for (let ms = 0; ms <= limit; ms += FRAME) {
    const x = displacement(ms / 1e3);
    samples.push(1 + x);
    settled = Math.abs(x) < 4e-3 ? settled + 1 : 0;
    if (settled >= 3 && ms > 60) break;
  }
  samples[samples.length - 1] = 1;
  return { samples, duration: (samples.length - 1) * FRAME };
}
function springKeyframes(spring, frame) {
  const { samples, duration } = springProgress(spring);
  return { keyframes: samples.map(frame), duration };
}
function springEasing(spring) {
  if (typeof CSS === "undefined" || !CSS.supports("animation-timing-function", "linear(0, 1)")) return void 0;
  const { samples, duration } = springProgress(spring);
  const step = Math.max(1, Math.round(samples.length / 40));
  const points = samples.filter((_, index) => index % step === 0 || index === samples.length - 1);
  return { easing: `linear(${points.map((value) => value.toFixed(4).replace(/\.?0+$/, "") || "0").join(", ")})`, duration };
}
function publishSpringEasings(root = document.documentElement) {
  const curves = {
    "--spring": { damping: 1, response: 0.36 },
    "--spring-fast": { damping: 1, response: 0.24 },
    "--spring-bounce": { damping: 0.72, response: 0.34 }
  };
  for (const [name, spring] of Object.entries(curves)) {
    const curve = springEasing(spring);
    if (!curve) return;
    root.style.setProperty(name, curve.easing);
    root.style.setProperty(`${name}-duration`, `${Math.round(curve.duration)}ms`);
  }
}
const opacityLead = (progress) => Math.max(0, Math.min(1, progress * 1.6));
const px = (value) => `${Math.round(value * 100) / 100}px`;
const fixed = (value) => value.toFixed(4);
function clearFilter(filter) {
  if (!filter || filter === "none") return void 0;
  const identities = { blur: "0px", saturate: "1", brightness: "1", contrast: "1", opacity: "1", grayscale: "0", sepia: "0", invert: "0", "hue-rotate": "0deg" };
  let valid = true;
  const cleared = filter.replace(/([a-z-]+)\(([^)]*)\)/g, (_, name) => {
    const identity = identities[name];
    if (identity === void 0) valid = false;
    return `${name}(${identity})`;
  });
  return valid ? cleared : void 0;
}
function mixFilter(from, to, progress) {
  const numbers = (value) => (value.match(/-?[\d.]+/g) ?? []).map(Number);
  const a = numbers(from), b = numbers(to);
  let index = 0;
  return to.replace(/-?[\d.]+/g, () => {
    const i = index++;
    const start = a[i] ?? 0, end = b[i] ?? 0;
    return String(Math.round((start + (end - start) * progress) * 1e3) / 1e3);
  });
}
const filterShape = (filter) => filter.replace(/\([^)]*\)/g, "");
function backdropOf(element, style = getComputedStyle(element)) {
  return style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter") || "none";
}
const backdropFrame = (filter) => ({ backdropFilter: filter, webkitBackdropFilter: filter });
function presentation(element) {
  const style = getComputedStyle(element);
  const matrix = style.transform.match(/matrix\(([^)]+)\)/);
  const [a = 1, , , d = 1, e = 0, f = 0] = matrix ? matrix[1].split(",").map(Number) : [];
  return { opacity: Number(style.opacity), scale: (a + d) / 2, x: e, y: f, backdrop: backdropOf(element, style) };
}
const running = /* @__PURE__ */ new WeakMap();
const inFlight = /* @__PURE__ */ new Set();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) for (const animation of [...inFlight]) animation.cancel();
});
function play(element, keyframes, duration, easing = "linear", delay = 0) {
  if (!MOTION) return void 0;
  running.get(element)?.cancel();
  let animation;
  try {
    animation = element.animate(keyframes, { duration, easing, delay, fill: delay ? "backwards" : "none" });
  } catch {
    return void 0;
  }
  running.set(element, animation);
  inFlight.add(animation);
  const deadline = window.setTimeout(() => animation.cancel(), duration + delay + 80);
  const done = () => {
    clearTimeout(deadline);
    inFlight.delete(animation);
    if (running.get(element) === animation) running.delete(element);
  };
  animation.onfinish = done;
  animation.oncancel = done;
  return animation;
}
function settle(animation, duration) {
  if (!animation) return Promise.resolve();
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, duration + 80);
    animation.addEventListener("finish", finish, { once: true });
    animation.addEventListener("cancel", finish, { once: true });
  });
}
function materializeIn(element, { scale = 0.96, x = 0, y = 10, spring = { response: 0.34 }, origin } = {}) {
  if (!canAnimate(element)) return void 0;
  if (origin) element.style.transformOrigin = origin;
  const live = running.has(element) ? presentation(element) : void 0;
  running.get(element)?.cancel();
  if (reducedMotion()) return play(element, [{ opacity: live?.opacity ?? 0 }, { opacity: 1 }], 120, "ease-out");
  const target = backdropOf(element), clear = clearFilter(target);
  const start = {
    opacity: live?.opacity ?? 0,
    scale: live?.scale ?? scale,
    x: live?.x ?? x,
    y: live?.y ?? y,
    backdrop: clear ? live && filterShape(live.backdrop) === filterShape(target) ? live.backdrop : clear : void 0
  };
  const { keyframes, duration } = springKeyframes(spring, (progress) => ({
    opacity: start.opacity + (1 - start.opacity) * opacityLead(progress),
    transform: `translate(${px(start.x * (1 - progress))}, ${px(start.y * (1 - progress))}) scale(${fixed(start.scale + (1 - start.scale) * progress)})`,
    ...start.backdrop ? backdropFrame(progress >= 1 ? target : mixFilter(start.backdrop, target, opacityLead(progress))) : {}
  }));
  return play(element, keyframes, duration);
}
function materializeOut(element, { scale = 0.97, x = 0, y = 6 } = {}) {
  if (!canAnimate(element) || !element.isConnected) return Promise.resolve();
  const live = presentation(element);
  const duration = reducedMotion() ? 90 : 150;
  const from = { opacity: live.opacity, transform: `translate(${px(live.x)}, ${px(live.y)}) scale(${fixed(live.scale)})` };
  const to = { opacity: 0, transform: `translate(${px(x)}, ${px(y)}) scale(${fixed(scale)})` };
  if (reducedMotion()) return settle(play(element, [{ opacity: live.opacity }, { opacity: 0 }], duration, "ease-in"), duration);
  const clear = clearFilter(live.backdrop);
  if (clear) {
    Object.assign(from, backdropFrame(live.backdrop));
    Object.assign(to, backdropFrame(clear));
  }
  return settle(play(element, [from, to], duration, "cubic-bezier(.4, 0, .9, .6)"), duration);
}
const offset = (side, distance) => ({ left: { x: -distance, y: 0 }, right: { x: distance, y: 0 }, top: { x: 0, y: -distance }, bottom: { x: 0, y: distance } })[side];
function glideIn(element, side, distance = 18, { fade = true, spring = { response: 0.38 } } = {}) {
  if (!canAnimate(element)) return;
  if (reducedMotion()) {
    if (fade) play(element, [{ opacity: 0 }, { opacity: 1 }], 140, "ease-out");
    return;
  }
  const { x, y } = offset(side, distance);
  const { keyframes, duration } = springKeyframes(spring, (progress) => ({ ...fade ? { opacity: opacityLead(progress) } : {}, transform: `translate(${px(x * (1 - progress))}, ${px(y * (1 - progress))})` }));
  play(element, keyframes, duration);
}
function revealIn(element, side, spring = { response: 0.4 }) {
  if (!canAnimate(element) || reducedMotion()) return;
  const inset = (progress) => {
    const hidden = `${((1 - progress) * 100).toFixed(2)}%`;
    return { left: `inset(0 ${hidden} 0 0)`, right: `inset(0 0 0 ${hidden})`, top: `inset(0 0 ${hidden} 0)`, bottom: `inset(${hidden} 0 0 0)` }[side];
  };
  const { keyframes, duration } = springKeyframes(spring, (progress) => ({ clipPath: inset(Math.min(1, progress)) }));
  play(element, keyframes, duration);
}
function glideOut(element, side, distance = 14) {
  if (!canAnimate(element) || element.hidden || !element.isConnected) return Promise.resolve();
  const { x, y } = offset(side, distance);
  const duration = reducedMotion() ? 90 : 140;
  const frames = reducedMotion() ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "translate(0px, 0px)" }, { opacity: 0, transform: `translate(${px(x)}, ${px(y)})` }];
  return settle(play(element, frames, duration, "cubic-bezier(.4, 0, .9, .6)"), duration);
}
function enterView(element, distance = 10, spring = { response: 0.4 }) {
  if (!canAnimate(element) || element.hidden) return;
  if (reducedMotion()) {
    play(element, [{ opacity: 0 }, { opacity: 1 }], 150, "ease-out");
    return;
  }
  const { keyframes, duration } = springKeyframes(spring, (progress) => ({ opacity: opacityLead(progress), transform: `translateY(${px(distance * (1 - progress))}) scale(${fixed(0.99 + 0.01 * progress)})` }));
  play(element, keyframes, duration);
}
function cascade(elements, stepMs = 22, maxDelayMs = 200) {
  if (document.hidden || reducedMotion()) return;
  const { keyframes, duration } = springKeyframes({ response: 0.4 }, (progress) => ({ opacity: opacityLead(progress), transform: `translateY(${px(12 * (1 - progress))})` }));
  let index = 0;
  for (const element of elements) play(element, keyframes, duration, "linear", Math.min(maxDelayMs, index++ * stepMs));
}
let toastGeneration = 0;
function showToast(toast) {
  toastGeneration++;
  toast.hidden = false;
  if (!canAnimate(toast)) return;
  if (reducedMotion()) {
    play(toast, [{ opacity: 0 }, { opacity: 1 }], 120, "ease-out");
    return;
  }
  const { keyframes, duration } = springKeyframes({ damping: 0.9, response: 0.4 }, (progress) => ({ opacity: opacityLead(progress), transform: `translateY(${px(16 * (1 - progress))}) scale(${fixed(0.95 + 0.05 * progress)})` }));
  play(toast, keyframes, duration);
}
async function hideToast(toast) {
  const generation = toastGeneration;
  if (canAnimate(toast) && !toast.hidden) {
    const frames = reducedMotion() ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "translateY(0px) scale(1)" }, { opacity: 0, transform: "translateY(10px) scale(.97)" }];
    await settle(play(toast, frames, 140, "cubic-bezier(.4, 0, .9, .6)"), 140);
  }
  if (generation === toastGeneration) toast.hidden = true;
}
function sibling(dialog, className) {
  let element = document.querySelector(`.${className}`);
  if (!element) {
    element = document.createElement("div");
    element.className = className;
    element.setAttribute("aria-hidden", "true");
    element.hidden = true;
    dialog.before(element);
  }
  return element;
}
function fitPlate(plate, dialog, previous) {
  const rect = dialog.getBoundingClientRect();
  if (!rect.width || !rect.height) return void 0;
  const next = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  Object.assign(plate.style, { left: px(next.left), top: px(next.top), width: px(next.width), height: px(next.height), borderRadius: getComputedStyle(dialog).borderRadius });
  const keys = ["left", "top", "width", "height"];
  const moved = previous && keys.some((key) => Math.abs(previous[key] - next[key]) > 0.5);
  if (moved && canAnimate(plate) && !reducedMotion()) {
    const style = getComputedStyle(plate);
    const from = running.has(plate) ? Object.fromEntries(keys.map((key) => [key, Number.parseFloat(style[key]) || 0])) : previous;
    const mix = (start, end, progress) => start + (end - start) * progress;
    const { samples, duration } = springProgress({ response: 0.36 });
    play(plate, samples.map((progress) => Object.fromEntries(keys.map((key) => [key, px(mix(from[key], next[key], progress))]))), duration);
    const radius = getComputedStyle(dialog).borderRadius;
    play(dialog, samples.map((progress) => {
      const top = mix(from.top, next.top, progress) - next.top, left = mix(from.left, next.left, progress) - next.left;
      const right = next.left + next.width - mix(from.left + from.width, next.left + next.width, progress);
      const bottom = next.top + next.height - mix(from.top + from.height, next.top + next.height, progress);
      return { clipPath: `inset(${px(top)} ${px(right)} ${px(bottom)} ${px(left)} round ${radius})` };
    }), duration);
  }
  return next;
}
function copyLiveState(source, target) {
  const inputs = source.querySelectorAll("input, textarea, select");
  const clones = target.querySelectorAll("input, textarea, select");
  inputs.forEach((input, index) => {
    const clone = clones[index];
    if (!clone) return;
    if (input instanceof HTMLInputElement && clone instanceof HTMLInputElement && (input.type === "checkbox" || input.type === "radio")) clone.checked = input.checked;
    else if (!(input instanceof HTMLInputElement && input.type === "password")) clone.value = input.value;
  });
  const sources = [source, ...source.querySelectorAll("*")], targets = [target, ...target.querySelectorAll("*")];
  sources.forEach((node, index) => {
    if (node.scrollTop || node.scrollLeft) {
      const clone = targets[index];
      if (clone) {
        clone.scrollTop = node.scrollTop;
        clone.scrollLeft = node.scrollLeft;
      }
    }
  });
}
let ghostStage;
const mirroredSheets = /* @__PURE__ */ new WeakSet();
function stage() {
  if (!ghostStage) {
    const host = document.createElement("div");
    host.className = "dialog-ghost-stage";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483000;pointer-events:none";
    host.hidden = true;
    const root2 = host.attachShadow({ mode: "closed" });
    const page2 = document.createElement("html");
    root2.append(page2);
    document.body.append(host);
    ghostStage = { host, root: root2, page: page2 };
  }
  const { root, page } = ghostStage;
  for (const sheet of document.querySelectorAll('style, link[rel="stylesheet"]')) {
    if (mirroredSheets.has(sheet)) continue;
    mirroredSheets.add(sheet);
    root.insertBefore(sheet.cloneNode(true), page);
  }
  for (const { name, value } of document.documentElement.attributes) page.setAttribute(name, value);
  return ghostStage;
}
function ghostOf(dialog, rect) {
  const ghost = dialog.cloneNode(true);
  ghost.removeAttribute("open");
  ghost.removeAttribute("aria-label");
  ghost.classList.add("dialog-ghost");
  ghost.inert = true;
  ghost.style.cssText = `display:block;position:fixed;left:${px(rect.left)};top:${px(rect.top)};width:${px(rect.width)};height:${px(rect.height)};max-width:none;max-height:none;margin:0;pointer-events:none;transform-origin:50% 45%`;
  copyLiveState(dialog, ghost);
  const { host, page } = stage();
  page.append(ghost);
  host.hidden = false;
  return ghost;
}
function dismissGhost(ghost) {
  ghost.remove();
  if (ghostStage && !ghostStage.page.childElementCount) ghostStage.host.hidden = true;
}
function contentArrives(dialog, x, delay) {
  if (!canAnimate(dialog) || reducedMotion()) return;
  const { keyframes, duration } = springKeyframes({ response: 0.34 }, (progress) => ({ opacity: opacityLead(progress), transform: `translate(${px(x * (1 - progress))}, ${px(6 * (1 - progress))})` }));
  for (const child of dialog.children) play(child, keyframes, duration, "linear", delay);
}
function installDialogMotion(dialog) {
  const scrim = sibling(dialog, "dialog-scrim"), plate = sibling(dialog, "dialog-plate");
  const nativeClose = dialog.close;
  let rect, departed = false;
  stage();
  function arrive() {
    departed = false;
    stage();
    scrim.hidden = false;
    plate.hidden = false;
    rect = fitPlate(plate, dialog);
    if (!canAnimate(dialog)) return;
    play(scrim, [{ opacity: presentation(scrim).opacity }, { opacity: 1 }], reducedMotion() ? 120 : 240, "ease-out");
    materializeIn(plate, { scale: 0.94, y: 16, spring: { response: 0.4 }, origin: "50% 45%" });
    contentArrives(dialog, 0, 40);
  }
  function depart() {
    if (!dialog.open || departed) return;
    departed = true;
    const bounds = rect ?? fitPlate(plate, dialog);
    rect = void 0;
    if (!canAnimate(dialog) || !bounds) {
      scrim.hidden = true;
      plate.hidden = true;
      return;
    }
    const ghost = ghostOf(dialog, bounds);
    void materializeOut(ghost, { scale: 0.97, y: 8 }).then(() => dismissGhost(ghost));
    void materializeOut(plate, { scale: 0.95, y: 8 }).then(() => {
      if (!dialog.open) plate.hidden = true;
    });
    void settle(play(scrim, [{ opacity: presentation(scrim).opacity }, { opacity: 0 }], 170, "ease-out"), 170).then(() => {
      if (!dialog.open) scrim.hidden = true;
    });
  }
  function refit() {
    if (dialog.open && !departed) rect = fitPlate(plate, dialog, rect);
  }
  dialog.close = function close(returnValue) {
    depart();
    nativeClose.call(this, returnValue);
  };
  const onCancel = (event) => {
    if (!event.defaultPrevented) depart();
  };
  const onClose = () => {
    if (!running.has(scrim)) {
      scrim.hidden = true;
      plate.hidden = true;
    }
  };
  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("close", onClose);
  window.addEventListener("resize", refit);
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(refit) : void 0;
  resize?.observe(dialog);
  const overlay = (node) => node instanceof Element && (node.classList.contains("floating-menu") || node.classList.contains("tip-bubble"));
  const contentChanged = (record) => record.type === "childList" && [...record.addedNodes, ...record.removedNodes].some((node) => !overlay(node));
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === "attributes" && record.attributeName === "open" && dialog.open)) {
      arrive();
      return;
    }
    if (dialog.open && !departed && records.some(contentChanged)) {
      refit();
      contentArrives(dialog, 12, 0);
    }
  });
  observer.observe(dialog, { attributes: true, attributeFilter: ["open"], childList: true });
  return () => {
    observer.disconnect();
    resize?.disconnect();
    window.removeEventListener("resize", refit);
    dialog.removeEventListener("cancel", onCancel);
    dialog.removeEventListener("close", onClose);
    dialog.close = nativeClose;
    scrim.remove();
    plate.remove();
    ghostStage?.host.remove();
    ghostStage = void 0;
  };
}
const groups = /* @__PURE__ */ new WeakMap();
function trackSegment(group, selected) {
  if (!group.querySelector(":scope > .segment-thumb")) {
    const thumb = document.createElement("span");
    thumb.className = "segment-thumb";
    thumb.setAttribute("aria-hidden", "true");
    group.prepend(thumb);
    group.dataset.segmented = "";
  }
  if (!groups.has(group) && typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      const current = group.dataset.segmentSelected ? group.querySelector(`:scope > ${group.dataset.segmentSelected}`) : null;
      if (current) place(group, current);
    });
    observer.observe(group);
    groups.set(group, observer);
  }
  if (!selected || selected.parentElement !== group) {
    group.style.setProperty("--seg-w", "0px");
    return;
  }
  group.dataset.segmentSelected = selected.hasAttribute("aria-pressed") ? '[aria-pressed="true"]' : selected.hasAttribute("aria-selected") ? '[aria-selected="true"]' : ".selected";
  place(group, selected);
}
function place(group, selected) {
  group.style.setProperty("--seg-x", px(selected.offsetLeft));
  group.style.setProperty("--seg-y", px(selected.offsetTop));
  group.style.setProperty("--seg-w", px(selected.offsetWidth));
  group.style.setProperty("--seg-h", px(selected.offsetHeight));
  if (group.dataset.segmentReady === void 0 && selected.offsetWidth > 0) requestAnimationFrame(() => requestAnimationFrame(() => {
    group.dataset.segmentReady = "";
  }));
}
export {
  cascade,
  enterView,
  glideIn,
  glideOut,
  hideToast,
  installDialogMotion,
  materializeIn,
  materializeOut,
  publishSpringEasings,
  reducedMotion,
  revealIn,
  showToast,
  springEasing,
  springKeyframes,
  springProgress,
  trackSegment
};
