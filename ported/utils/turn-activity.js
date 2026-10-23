import { decodeToolActivity } from "./tool-activity.ts";
function validTime(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function makeTurn(messages) {
  const user = messages[0].role === "user" ? messages[0] : void 0;
  const coordination = messages[0].role === "coordination" ? messages[0] : void 0;
  const start = user ?? coordination;
  let toolKey;
  let legacyKey;
  let hasToolCall = false;
  for (const message of messages) {
    if (message.role !== "tool") continue;
    if (message.content !== "Tool finished") hasToolCall = true;
    const tool = decodeToolActivity(message.content);
    if (tool) toolKey ?? (toolKey = `turn:tool:${tool.id}`);
    else {
      legacyKey ?? (legacyKey = `turn:message:${message.id}`);
    }
  }
  const substantive = (message) => message !== start && message.role !== "error" && message.role !== "changes" && !(hasToolCall && message.role === "tool" && message.content === "Tool finished");
  const lastContent = [...messages].reverse().find(substantive);
  const final = lastContent?.role === "assistant" ? lastContent : void 0;
  const activity = messages.filter((message) => message !== final && substantive(message));
  let durationMs = null;
  let estimated = false;
  if (start && validTime(start.turnDurationMs)) durationMs = start.turnDurationMs;
  else if (start && (final || messages.some((message) => message.role === "error")) && messages.every((message, index) => validTime(message.createdAt) && (index === 0 || message.createdAt >= messages[index - 1].createdAt))) {
    durationMs = messages[messages.length - 1].createdAt - start.createdAt;
    estimated = true;
  }
  return {
    user,
    coordination,
    activity,
    final,
    errors: messages.filter((message) => message.role === "error"),
    key: toolKey ?? legacyKey ?? `turn:${start?.role ?? "message"}:${messages[0].id}`,
    durationMs,
    estimated,
    changes: messages.find((message) => message.role === "changes" && message.turnChanges)?.turnChanges ?? start?.turnChanges ?? void 0
  };
}
function groupTurns(messages) {
  const turns = [];
  let current = [];
  for (const message of messages) {
    if (message.role === "handoff") {
      if (current.length) turns.push(makeTurn(current));
      current = [];
      turns.push({ handoff: message, activity: [], errors: [], key: `handoff:${message.id}`, durationMs: null, estimated: false });
      continue;
    }
    if ((message.role === "user" || message.role === "coordination") && current.length) {
      turns.push(makeTurn(current));
      current = [];
    }
    current.push(message);
    if (message.role === "changes") {
      turns.push(makeTurn(current));
      current = [];
    }
  }
  if (current.length) turns.push(makeTurn(current));
  return turns;
}
function formatDuration(ms) {
  const seconds = validTime(ms) ? Math.floor(ms / 1e3) : 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return [hours ? `${hours}h` : "", minutes || hours ? `${minutes}m` : "", `${seconds % 60}s`].filter(Boolean).join(" ");
}
function turnLabel(durationMs, estimated = false) {
  return validTime(durationMs) ? `Worked for ${estimated ? "about " : ""}${formatDuration(durationMs)}` : "Tool activity";
}
export {
  formatDuration,
  groupTurns,
  turnLabel
};
