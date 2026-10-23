// PandaCode bridge shim for AnythingLLM frontend.
// PandaCode calls native (Tauri) commands; AnythingLLM uses its own API layer.
// TODO: adapt each call to AnythingLLM's request/session APIs.

export const preview = true;

export async function call(command, args = {}) {
  // TODO: route to AnythingLLM API endpoints
  console.warn("bridge.call stub:", command, args);
  return null;
}

export async function subscribe(name, callback) {
  return () => {};
}

export async function chooseAttachments() {
  return [];
}

export async function chooseAttachmentFolder() {
  return null;
}

export async function chooseFolder(title) {
  return null;
}
