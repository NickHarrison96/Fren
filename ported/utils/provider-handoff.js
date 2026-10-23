const providers = /* @__PURE__ */ new Set(["claude", "codex", "kimi", "opencode", "glm", "antigravity", "grok", "mimo", "pi", "deepseek", "commandcode", "cline", "omp", "github-copilot", "muse"]);
function decodeHandoff(message) {
  if (message.role !== "handoff") return null;
  try {
    const value = JSON.parse(message.content);
    return providers.has(value.fromProvider) && providers.has(value.toProvider) && typeof value.summary === "string" ? { fromProvider: value.fromProvider, toProvider: value.toProvider, summary: value.summary.slice(0, 1e3) } : null;
  } catch {
    return null;
  }
}
function historicalProvider(message, messages, current) {
  if (message.authorProvider && providers.has(message.authorProvider)) return message.authorProvider;
  if (message.id < 0) return current;
  for (const next of messages) {
    if (next.sessionId !== message.sessionId || next.id <= message.id) continue;
    const handoff = decodeHandoff(next);
    if (handoff) return handoff.fromProvider;
  }
  return current;
}
export {
  decodeHandoff,
  historicalProvider
};
