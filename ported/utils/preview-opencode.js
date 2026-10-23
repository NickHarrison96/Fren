import { fallbackModel } from "./model-catalog";
const openCodePreviewModels = [
  { id: "opencode/big-pickle", name: "Big Pickle", description: "opencode/big-pickle", contextWindow: 2e5 },
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "anthropic/claude-sonnet-4-6", contextWindow: 2e5 },
  { id: "openai/gpt-5.4", name: "GPT-5.4", description: "openai/gpt-5.4", contextWindow: 105e4 },
  { id: "google/gemini-3-pro", name: "Gemini 3 Pro", description: "google/gemini-3-pro", contextWindow: 1e6 },
  { id: "moonshot/kimi-k2.5", name: "Kimi K2.5", description: "moonshot/kimi-k2.5", contextWindow: 256e3 },
  { id: "zai/glm-5", name: "GLM-5", description: "zai/glm-5", contextWindow: 2e5 },
  { id: "xai/grok-4", name: "Grok 4", description: "xai/grok-4", contextWindow: 256e3 }
];
const openCodePreviewKey = "pandacode.preview.opencode-models";
function previewOpenCodeSelection() {
  try {
    const stored = JSON.parse(localStorage.getItem(openCodePreviewKey) || "[]");
    return Array.isArray(stored) ? stored.filter((id) => typeof id === "string" && id.includes("/") && id.length <= 200) : [];
  } catch {
    return [];
  }
}
function openCodeChoices({ models, selectedModelIds, error }) {
  if (!selectedModelIds.length) {
    if (error) throw new Error(error);
    return [fallbackModel("opencode"), ...models.filter((model) => model.id !== "default")];
  }
  return [fallbackModel("opencode"), ...selectedModelIds.map((id) => models.find((model) => model.id === id) ?? fallbackModel("opencode", id))];
}
function previewOpenCodeChoices() {
  return openCodeChoices({ models: openCodePreviewModels, selectedModelIds: previewOpenCodeSelection(), error: null });
}
export {
  openCodeChoices,
  openCodePreviewKey,
  openCodePreviewModels,
  previewOpenCodeChoices,
  previewOpenCodeSelection
};
