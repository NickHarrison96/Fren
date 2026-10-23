function showPopover(panel, anchor) {
  panel.classList.add("floating-menu");
  panel.inert = false;
  panel.removeAttribute("aria-hidden");
  panel.style.pointerEvents = "";
  panel.style.opacity = "1";
  panel.style.transform = "none";
  const trigger = anchor.getBoundingClientRect();
  const bounds = panel.getBoundingClientRect();
  const above = panel.dataset.placement ? panel.dataset.placement === "above" : bounds.top + panel.offsetHeight / 2 < trigger.top + trigger.height / 2;
  panel.dataset.placement = above ? "above" : "below";
  panel.dataset.popoverState = "open";
}
function hidePopover(panel) {
  panel.inert = true;
  panel.setAttribute("aria-hidden", "true");
  panel.style.pointerEvents = "none";
  panel.dataset.popoverState = "closing";
  panel.remove();
}
export {
  hidePopover,
  showPopover
};
