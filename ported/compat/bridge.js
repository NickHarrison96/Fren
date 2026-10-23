// PandaCode bridge adapter for AnythingLLM frontend.
// PandaCode calls native (Tauri) commands via `call`. AnythingLLM uses fetch +
// baseHeaders against API_BASE. File pickers use the browser's native <input>.

import { API_BASE } from "./constants";
import { baseHeaders } from "./request";

export const preview = true;

export async function call(command, args = {}) {
  // Route to AnythingLLM API endpoints where a mapping exists.
  // TODO: add per-command routing (e.g., "read_file" -> GET /workspace/...).
  console.warn("bridge.call stub (no mapping):", command, args);
  return null;
}

export async function subscribe(name, callback) {
  // AnythingLLM uses React state + polling; no native event bus.
  return () => {};
}

export async function chooseAttachments() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []).map((f) => f.name);
      resolve(files);
    };
    input.click();
  });
}

export async function chooseAttachmentFolder() {
  // Browser can't pick folders reliably; fall back to null.
  return null;
}

export async function chooseFolder(title) {
  return null;
}

export { API_BASE, baseHeaders };
