import { escape, icon } from "./dom";
import "./message-actions.css";
function messageActionsHtml(sessionId, key, canFork = true) {
  const data = `data-message-session="${escape(sessionId)}" data-message-key="${escape(key)}"`;
  return `<div class="message-actions" role="group" aria-label="Message actions"><button type="button" data-message-action="copy" ${data} aria-label="Copy message" title="Copy message">${icon("copy")}</button>${canFork ? `<button type="button" data-message-action="fork" ${data} aria-label="Fork from here" title="Fork through this message into a new task in the same checkout">${icon("branch")}</button>` : ""}<span class="message-action-status" role="status" aria-live="polite"></span></div>`;
}
async function copyText(value) {
  const resolved = Promise.resolve(value).then((text2) => {
    if (text2 === void 0) throw new Error("This message is no longer available. Please reopen the conversation.");
    return text2;
  });
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    const blob = resolved.then((text2) => new Blob([text2], { type: "text/plain" }));
    void blob.catch(() => {
    });
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return;
    } catch {
    }
  }
  const text = await resolved;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
  }
  const focused = document.activeElement;
  const input = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? focused : null;
  const inputSelection = input ? [input.selectionStart, input.selectionEnd, input.selectionDirection] : null;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  (focused?.closest("dialog[open]") ?? document.body).append(field);
  try {
    field.select();
    if (!document.execCommand("copy")) throw new Error("Could not copy this message. Please select its text and copy it manually.");
  } finally {
    field.remove();
    focused?.focus({ preventScroll: true });
    if (input && inputSelection && inputSelection[0] !== null && inputSelection[1] !== null) input.setSelectionRange(inputSelection[0], inputSelection[1], inputSelection[2] ?? void 0);
    if (selection && ranges.length) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
  }
}
function bindMessageActions(root, options) {
  const pending = /* @__PURE__ */ new Set();
  const feedback = /* @__PURE__ */ new Map();
  const click = (event) => {
    const button = event.target instanceof Element ? event.target.closest("button[data-message-action]") : null;
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    const sessionId = button.dataset.messageSession, key = button.dataset.messageKey;
    const action = button.dataset.messageAction;
    const token = JSON.stringify([sessionId, key, action]);
    if (pending.has(token)) return;
    if (action === "fork" && (!options.onFork || !Number.isSafeInteger(Number(key)) || Number(key) <= 0)) return;
    const hadFocus = document.activeElement === button;
    pending.add(token);
    button.disabled = action === "fork";
    button.setAttribute("aria-busy", "true");
    button.setAttribute("aria-disabled", "true");
    const work = (async () => action === "fork" ? options.onFork(sessionId, Number(key)) : copyText(options.content(sessionId, key)))();
    void work.then(() => {
      if (action !== "copy" || !button.isConnected) return;
      clearTimeout(feedback.get(button));
      button.innerHTML = icon("check");
      button.dataset.copied = "true";
      button.title = "Copied";
      button.setAttribute("aria-label", "Copied");
      const status = button.parentElement?.querySelector(".message-action-status");
      if (status) status.textContent = "Message copied";
      feedback.set(button, setTimeout(() => {
        feedback.delete(button);
        delete button.dataset.copied;
        button.innerHTML = icon("copy");
        button.title = "Copy message";
        button.setAttribute("aria-label", "Copy message");
        if (status) status.textContent = "";
      }, 1600));
    }).catch(options.report).finally(() => {
      pending.delete(token);
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.removeAttribute("aria-disabled");
      if (hadFocus && button.isConnected && document.activeElement === document.body) button.focus({ preventScroll: true });
    });
  };
  root.addEventListener("click", click);
  return () => {
    root.removeEventListener("click", click);
    feedback.forEach(clearTimeout);
    feedback.clear();
  };
}
export {
  bindMessageActions,
  messageActionsHtml
};
