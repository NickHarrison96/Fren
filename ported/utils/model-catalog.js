function fallbackModel(provider, id = "default") {
  id || (id = "default");
  if (id === "default" && provider === "glm") return { id, name: "GLM-5.3", description: "Default Z.AI Coding Plan model via Claude Code." };
  if (id === "default" && provider === "mimo") return { id, name: "MiMo-V2.6-Pro", description: "Default MiMo Token Plan model via Claude Code." };
  if (id === "default") return { id, name: "Default", description: "Uses the model selected by your harness." };
  const alias = provider === "claude" ? { sonnet: "Claude Sonnet", opus: "Claude Opus", haiku: "Claude Haiku" }[id] : "";
  return { id, name: alias || id, description: alias ? "Version resolved by Claude Code." : "" };
}
function modelChoices(provider, catalog, current = "") {
  const models = /* @__PURE__ */ new Map([["default", fallbackModel(provider)]]);
  for (const model of catalog) if (model.id) models.set(model.id, model);
  if (current && !models.has(current)) models.set(current, fallbackModel(provider, current));
  return [...models.values()];
}
function tokenCount(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
function contextSummary(usage, capacity) {
  const window = usage?.contextWindow ?? capacity;
  if (usage) {
    const used = tokenCount(usage.usedTokens);
    return window ? { label: `${used} / ${tokenCount(window)} context`, detail: `${usage.usedTokens.toLocaleString()} of ${window.toLocaleString()} context tokens (${Math.round(usage.usedTokens / window * 100)}%). Last reported by the harness.` } : { label: `${used} tokens in context`, detail: `${usage.usedTokens.toLocaleString()} context tokens. Last reported by the harness; total capacity is unavailable.` };
  }
  return window ? { label: `${tokenCount(window)} context`, detail: `${window.toLocaleString()} token context window reported by the harness.` } : null;
}
function parseContextUsage(value) {
  if (!value || typeof value !== "object") return null;
  const { usedTokens, contextWindow } = value;
  if (typeof usedTokens !== "number" || !Number.isSafeInteger(usedTokens) || usedTokens < 0 || usedTokens > 1e9) return null;
  if (contextWindow != null && (typeof contextWindow !== "number" || !Number.isSafeInteger(contextWindow) || contextWindow <= 0 || contextWindow > 1e9)) return null;
  return { usedTokens, contextWindow: contextWindow ?? null };
}
export {
  contextSummary,
  fallbackModel,
  modelChoices,
  parseContextUsage,
  tokenCount
};
