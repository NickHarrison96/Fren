import "./sidebar-resize.css";
function initializeSidebarResizing(workspace, sidebar, right = false) {
  const preferenceKey = right ? "pandacode.inspectorWidth" : "pandacode.sidebarWidth";
  const widthProperty = right ? "--inspector-width" : "--sidebar-width";
  const minimumWidth = right ? 270 : 190;
  const maximumWidth = right ? 1e4 : 440;
  const resizingClass = right ? "inspector-resizing" : "sidebar-resizing";
  let preferredWidth;
  try {
    const saved = localStorage.getItem(preferenceKey);
    const width2 = saved === null ? NaN : Number(saved);
    if (Number.isFinite(width2) && width2 >= minimumWidth && width2 <= maximumWidth) preferredWidth = width2;
  } catch {
  }
  const separator = document.createElement("div");
  separator.className = right ? "inspector-resize-handle" : "sidebar-resize-handle";
  separator.tabIndex = 0;
  separator.setAttribute("role", "separator");
  separator.setAttribute("aria-orientation", "vertical");
  separator.setAttribute("aria-label", right ? "Resize right sidebar" : "Resize sidebar");
  separator.setAttribute("aria-description", "Use Left and Right arrows to resize. Hold Shift for larger steps. Home and End select the smallest and largest size. Double-click to reset.");
  separator.title = `${right ? "Resize right sidebar" : "Resize sidebar"} \xB7 Double-click to reset`;
  if (!sidebar.id) sidebar.id = "workspace-sidebar";
  separator.setAttribute("aria-controls", sidebar.id);
  sidebar.append(separator);
  const compact = matchMedia("(max-width: 650px)");
  const inspector = workspace.querySelector(right ? ":scope > .sidebar" : ":scope > .inspector");
  let width = 235, availableMinimum = minimumWidth, availableMaximum = maximumWidth, layoutFrame = 0;
  let drag;
  const clamp = (value) => Math.round(Math.min(availableMaximum, Math.max(availableMinimum, value)));
  function paint(value, responsive = false) {
    width = clamp(value);
    const valueInPixels = responsive ? "" : `${width}px`;
    if (workspace.style.getPropertyValue(widthProperty) !== valueInPixels) {
      workspace.style.setProperty(widthProperty, valueInPixels);
      if (!layoutFrame) layoutFrame = requestAnimationFrame(() => {
        layoutFrame = 0;
        window.dispatchEvent(new Event("resize"));
      });
    }
    separator.setAttribute("aria-valuemin", String(availableMinimum));
    separator.setAttribute("aria-valuemax", String(availableMaximum));
    separator.setAttribute("aria-valuenow", String(width));
    separator.setAttribute("aria-valuetext", `${width} pixels`);
  }
  function persist() {
    try {
      if (preferredWidth === void 0) localStorage.removeItem(preferenceKey);
      else localStorage.setItem(preferenceKey, String(preferredWidth));
    } catch {
    }
  }
  function refreshConstraints() {
    const unavailable = sidebar.hidden || !right && (compact.matches || workspace.classList.contains("board-view"));
    separator.hidden = unavailable;
    if (unavailable && drag) finishDrag(false);
    if (unavailable) return;
    const style = getComputedStyle(workspace);
    const conversationMinimum = parseFloat(style.getPropertyValue("--conversation-min-width")) || 420;
    const defaultWidth = parseFloat(style.getPropertyValue("--sidebar-default-width")) || 235;
    let inspectorWidth = 0;
    if (inspector && !inspector.hidden && (right || !workspace.classList.contains("inspector-closed"))) {
      const inspectorStyle = getComputedStyle(inspector);
      if (inspectorStyle.display !== "none" && inspectorStyle.position !== "absolute") inspectorWidth = inspector.getBoundingClientRect().width;
    }
    const overlay = right && getComputedStyle(sidebar).position === "absolute";
    const remaining = Math.floor(workspace.clientWidth - inspectorWidth - (overlay ? 0 : conversationMinimum));
    availableMinimum = right ? Math.min(minimumWidth, Math.max(1, remaining)) : minimumWidth;
    availableMaximum = Math.max(availableMinimum, Math.min(maximumWidth, remaining));
    if (right && preferredWidth === void 0 && !drag) {
      workspace.style.removeProperty(widthProperty);
      paint(sidebar.getBoundingClientRect().width, true);
    } else paint(drag ? width : preferredWidth ?? defaultWidth);
  }
  function finishDrag(commit) {
    if (!drag) return;
    const finished = drag;
    drag = void 0;
    workspace.classList.remove(resizingClass);
    if (separator.hasPointerCapture(finished.id)) separator.releasePointerCapture(finished.id);
    if (commit && finished.moved) {
      preferredWidth = width;
      persist();
    }
    refreshConstraints();
  }
  function pointerDown(event) {
    if (event.button !== 0 || !event.isPrimary || separator.hidden || drag) return;
    event.preventDefault();
    refreshConstraints();
    drag = { id: event.pointerId, startX: event.clientX, startWidth: sidebar.getBoundingClientRect().width, moved: false };
    separator.setPointerCapture(event.pointerId);
    separator.focus({ preventScroll: true });
    workspace.classList.add(resizingClass);
  }
  function pointerMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    drag.moved || (drag.moved = distance !== 0);
    paint(drag.startWidth + distance * (right ? -1 : 1));
  }
  function pointerUp(event) {
    if (drag?.id === event.pointerId) finishDrag(true);
  }
  function pointerCancel(event) {
    if (drag?.id === event.pointerId) finishDrag(false);
  }
  function keyDown(event) {
    if (separator.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape" && drag) {
      event.preventDefault();
      finishDrag(false);
      return;
    }
    const step = (event.shiftKey ? 32 : 8) * (right ? -1 : 1);
    const next = event.key === "ArrowLeft" ? width - step : event.key === "ArrowRight" ? width + step : event.key === "Home" ? availableMinimum : event.key === "End" ? availableMaximum : void 0;
    if (next === void 0) return;
    event.preventDefault();
    paint(next);
    preferredWidth = width;
    persist();
  }
  function reset() {
    if (separator.hidden) return;
    finishDrag(false);
    preferredWidth = void 0;
    persist();
    refreshConstraints();
  }
  const resize = new ResizeObserver(refreshConstraints);
  resize.observe(workspace);
  if (inspector) resize.observe(inspector);
  if (right) resize.observe(sidebar);
  const layout = new MutationObserver(refreshConstraints);
  layout.observe(workspace, { attributes: true, attributeFilter: ["class"] });
  layout.observe(sidebar, { attributes: true, attributeFilter: ["hidden"] });
  if (right && inspector) layout.observe(inspector, { attributes: true, attributeFilter: ["hidden"] });
  compact.addEventListener("change", refreshConstraints);
  separator.addEventListener("pointerdown", pointerDown);
  separator.addEventListener("pointermove", pointerMove);
  separator.addEventListener("pointerup", pointerUp);
  separator.addEventListener("pointercancel", pointerCancel);
  separator.addEventListener("lostpointercapture", pointerUp);
  separator.addEventListener("keydown", keyDown);
  separator.addEventListener("dblclick", reset);
  refreshConstraints();
  return () => {
    finishDrag(false);
    resize.disconnect();
    layout.disconnect();
    compact.removeEventListener("change", refreshConstraints);
    cancelAnimationFrame(layoutFrame);
    separator.remove();
    workspace.style.removeProperty(widthProperty);
  };
}
export {
  initializeSidebarResizing
};
