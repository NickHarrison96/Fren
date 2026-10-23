const preview = !("__TAURI_INTERNALS__" in window);
async function call(command, args = {}) {
  if (preview) return (await import("./preview")).invoke(command, args);
  return (await import("@tauri-apps/api/core")).invoke(command, args);
}
async function subscribe(name, callback) {
  if (preview) return (await import("./preview")).listen(name, callback);
  return (await import("@tauri-apps/api/event")).listen(name, (event) => callback(event.payload));
}
async function chooseFolder(title = "Open a project in PandaCode") {
  if (preview) return "/Users/you/Projects/new-project";
  const result = await (await import("@tauri-apps/plugin-dialog")).open({ directory: true, multiple: false, title });
  return typeof result === "string" ? result : null;
}
async function chooseAttachments() {
  if (preview) return (await import("./preview")).samplePick("files");
  const result = await (await import("@tauri-apps/plugin-dialog")).open({ multiple: true, title: "Attach to your message", filters: [
    { name: "Images and documents", extensions: ["png", "jpg", "jpeg", "webp", "pdf", "txt", "md", "markdown", "csv", "json", "yaml", "yml", "xml", "html", "rtf", "doc", "docx", "odt", "pages", "key", "numbers", "pptx", "xlsx", "epub", "log"] },
    { name: "All files", extensions: ["*"] }
  ] });
  return Array.isArray(result) ? result : typeof result === "string" ? [result] : [];
}
async function chooseVsix() {
  if (preview) return "/Users/you/Downloads/tokyo-night.vsix";
  const result = await (await import("@tauri-apps/plugin-dialog")).open({ multiple: false, title: "Import a VS Code theme", filters: [{ name: "VS Code extension", extensions: ["vsix"] }] });
  return typeof result === "string" ? result : null;
}
async function chooseAttachmentFolder() {
  if (preview) return (await import("./preview")).samplePick("folder")[0] ?? null;
  const result = await (await import("@tauri-apps/plugin-dialog")).open({ directory: true, multiple: false, title: "Attach a folder to your message" });
  return typeof result === "string" ? result : null;
}
export {
  call,
  chooseAttachmentFolder,
  chooseAttachments,
  chooseFolder,
  chooseVsix,
  preview,
  subscribe
};
