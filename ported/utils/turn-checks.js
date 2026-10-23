//! Optional turn-end project checks: Settings → Agents turns them on, and a
//! failing check queues one fix-it message through the ordinary message
//! queue, where the user sees and can edit or cancel it. One repair per run:
//! a repair turn's own failure waits for the user instead of looping.
const KEY = "pandacode.turnChecks";
const repaired = /* @__PURE__ */ new Set();
const manualSends = /* @__PURE__ */ new Map();
function enabled() {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}
function setEnabled(on) {
  try {
    localStorage.setItem(KEY, String(on));
  } catch {
  }
}
function noteManualSend(sessionId) {
  repaired.delete(sessionId);
  manualSends.set(sessionId, (manualSends.get(sessionId) ?? 0) + 1);
}
function shouldRepair(input) {
  return input.on && input.report.checked === true && input.report.ok === false && !input.alreadyRepaired;
}
function repairPrompt(report) {
  const name = report.name ?? "project checks";
  const output = (report.output ?? "").trim();
  return `Project checks failed after your last turn (${name}). Fix the failures before anything else; do not start new work.${output ? `

\`\`\`
${output}
\`\`\`` : ""}`;
}
const read = (value) => typeof value === "function" ? value() : value;
const READ_ONLY = /* @__PURE__ */ new Set(["plan", "read-only", "readonly"]);
function idle(context) {
  return !read(context.isRunning) && read(context.queued) === 0 && !READ_ONLY.has(read(context.mode) ?? "");
}
async function afterRun(sessionId, context) {
  if (!enabled() || !context.task || context.isTeam || context.isBot || !idle(context)) return;
  const sends = manualSends.get(sessionId) ?? 0;
  const stale = () => !enabled() || !idle(context) || (manualSends.get(sessionId) ?? 0) !== sends;
  let report;
  try {
    report = await context.call("run_turn_checks", { sessionId });
  } catch (error) {
    context.onError(error);
    return;
  }
  if (stale()) return;
  if (report.checked && report.ok) repaired.delete(sessionId);
  if (!shouldRepair({ on: enabled(), report, alreadyRepaired: repaired.has(sessionId) })) return;
  repaired.add(sessionId);
  try {
    await context.call("queue_add", { sessionId, text: repairPrompt(report), attachments: [] });
    context.onQueued(sessionId);
  } catch (error) {
    repaired.delete(sessionId);
    context.onError(error);
  }
}
export {
  afterRun,
  enabled,
  noteManualSend,
  repairPrompt,
  setEnabled,
  shouldRepair
};
