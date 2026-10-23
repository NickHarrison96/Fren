import { escape, icon } from "./dom";
let bubble, anchor, frame = 0;
function infoMark(text, label = "Details") {
  return `<span class="info-mark" role="img" aria-label="${escape(label)}" data-tip="${escape(text)}">${icon("info")}</span>`;
}
function hide() {
  cancelAnimationFrame(frame);
  frame = 0;
  if (bubble) {
    bubble.remove();
    bubble = void 0;
  }
  anchor = void 0;
}
function place() {
  frame = 0;
  if (!bubble || !anchor) return;
  if (!anchor.isConnected) {
    hide();
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const width = bubble.offsetWidth, height = bubble.offsetHeight;
  const gap = 8, margin = 10;
  const above = rect.top - height - gap >= margin;
  const top = above ? rect.top - height - gap : rect.bottom + gap;
  const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2, innerWidth - width - margin));
  bubble.style.top = `${Math.round(top)}px`;
  bubble.style.left = `${Math.round(left)}px`;
  bubble.dataset.placement = above ? "above" : "below";
}
function show(mark) {
  const text = mark.getAttribute("data-tip");
  if (!text) return;
  if (anchor === mark && bubble) return;
  hide();
  anchor = mark;
  bubble = document.createElement("div");
  bubble.className = "tip-bubble";
  bubble.setAttribute("role", "tooltip");
  bubble.textContent = text;
  (mark.closest("dialog[open]") ?? document.body).append(bubble);
  place();
  bubble.classList.add("tip-visible");
}
function markFor(target) {
  if (!(target instanceof Element)) return null;
  return target.closest("[data-tip]") ?? (target.matches('button, [role="menuitem"], [role="menuitemradio"], [role="option"]') ? target.querySelector("[data-tip]") : null);
}
function compactSublines(root) {
  for (const small of root.querySelectorAll(".setting-row > div > small:not([data-compact])")) {
    small.dataset.compact = "inline";
    const text = small.textContent?.trim() ?? "";
    if (small.className || text.length <= BRIEF_NOTE) continue;
    small.dataset.compact = "mark";
    small.classList.add("sr-only");
    small.insertAdjacentHTML("beforebegin", infoMark(text));
  }
}
const BRIEF_NOTE = 44;
function installTooltips() {
  let keyboard = false;
  document.addEventListener("keydown", () => {
    keyboard = true;
  }, true);
  document.addEventListener("pointerdown", () => {
    keyboard = false;
  }, true);
  document.addEventListener("pointerover", (event) => {
    const mark = markFor(event.target);
    if (mark) show(mark);
    else if (anchor && !(event.target instanceof Node && (anchor.contains(event.target) || bubble?.contains(event.target)))) hide();
  });
  document.addEventListener("focusin", (event) => {
    const mark = markFor(event.target);
    if (mark && keyboard) show(mark);
    else hide();
  });
  document.addEventListener("focusout", (event) => {
    if (anchor && event.target instanceof Node && anchor.contains(event.target)) hide();
  });
  for (const type of ["pointerdown", "keydown", "wheel"]) document.addEventListener(type, hide, true);
  document.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  window.addEventListener("blur", hide);
}
export {
  compactSublines,
  infoMark,
  installTooltips
};
