import { escape, icon } from "./dom.ts";
import { describeTool, kindIcon, summarizeTools, summaryIcons, toolPreview, traceRowHtml } from "./tool-trace.ts";
const MAX_CONTENT = 1e5;
const MAX_DETAIL = 2e4;
const MAX_LABEL = 256;
const MAX_ID = 512;
function decodeToolActivity(content) {
  if (content.length > MAX_CONTENT || !content.trimStart().startsWith("{")) return;
  try {
    const value = JSON.parse(content);
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const record = value;
    if (record.type !== "tool_activity" || record.version !== 1 || typeof record.id !== "string" || record.id.length > MAX_ID || typeof record.name !== "string" || record.name.length > MAX_LABEL || record.status !== "running" && record.status !== "completed" && record.status !== "failed" || typeof record.input !== "string" || record.input.length > MAX_DETAIL || typeof record.output !== "string" || record.output.length > MAX_DETAIL) return;
    return { id: record.id, name: record.name, status: record.status, input: record.input, output: record.output };
  } catch {
    return;
  }
}
function bounded(value, limit = MAX_DETAIL) {
  return value.length > limit ? value.slice(0, limit) + "\n[Display truncated]" : value;
}
function section(kind, content) {
  const label = kind === "input" ? "Input" : "Output";
  return `<section class="tool-activity-section" data-tool-section="${kind}"><h4>${label}</h4><pre tabindex="0" aria-label="Tool ${kind}">${escape(bounded(content))}</pre></section>`;
}
function toolNote(tool) {
  if (tool.output.trim()) return "";
  const note = tool.status === "running" ? tool.input.trim() ? "Waiting for output\u2026" : "Waiting for tool details\u2026" : tool.status === "completed" ? "No output was returned." : "No output was recorded.";
  return `<p class="tool-activity-note">${note}</p>`;
}
function rawRecord(tool) {
  const sections = (tool.input.trim() ? section("input", tool.input) : "") + (tool.output.trim() ? section("output", tool.output) : "");
  return sections ? `<details class="tool-trace-raw"><summary>${icon("chevron")}Raw input/output</summary><div class="tool-trace-raw-body">${sections}</div></details>` : "";
}
function renderToolActivity(content, key) {
  const tool = typeof content === "string" ? decodeToolActivity(content) : content;
  if (!tool) return renderLegacyTool(content, key);
  const named = { ...tool, name: tool.name.slice(0, MAX_LABEL) };
  const trace = describeTool(named);
  const status = tool.status === "failed" ? '<span class="tool-activity-status">Failed</span>' : "";
  const lead = icon(tool.status === "failed" ? "alert" : kindIcon(trace.kind), "tool-trace-icon");
  const body = toolPreview(named) + toolNote(tool) + rawRecord(tool);
  return `<details class="tool-activity tool-trace" data-tool-key="${escape(key)}" data-tool-status="${escape(tool.status)}" data-tool-kind="${trace.kind}" data-tool-name="${escape(named.name)}"><summary title="${escape(named.name || "Tool")}">${lead}${traceRowHtml(trace)}${status}${icon("chevron", "tool-trace-chevron")}</summary><div class="tool-activity-body">${body}</div></details>`;
}
function renderLegacyTool(content, key) {
  const text = bounded(content).trim();
  const newline = text.indexOf("\n");
  const name = bounded(newline < 0 ? text : text.slice(0, newline), MAX_LABEL) || "Tool activity";
  const remainder = newline < 0 ? "" : text.slice(newline + 1).trim();
  const body = remainder ? `<pre class="tool-activity-legacy-body" tabindex="0" aria-label="Recorded tool details">${escape(remainder)}</pre>` : '<p class="tool-activity-note">Details were not recorded for this earlier tool call.</p>';
  return `<details class="tool-activity" data-tool-key="${escape(key)}"><summary>${icon("terminal")}<span class="tool-activity-name">${escape(name)}</span>${icon("chevron")}</summary><div class="tool-activity-body">${body}</div></details>`;
}
function renderToolStatus(content) {
  return `<div class="tool-activity-status-row">${icon("terminal")}<span>${escape(bounded(content))}</span></div>`;
}
function groupToolRuns(entries, toolKey) {
  const runs = [];
  for (const entry of entries) {
    const key = toolKey(entry);
    if (key === void 0) {
      runs.push({ kind: "message", item: entry });
      continue;
    }
    const previous = runs[runs.length - 1];
    if (previous?.kind === "tools" && previous.items.length < 5) previous.items.push(entry);
    else runs.push({ kind: "tools", key, items: [entry] });
  }
  return runs;
}
function renderToolGroup(entries, expanded = false) {
  if (!entries.length) return "";
  const tools = entries.map((entry) => typeof entry.content === "string" ? decodeToolActivity(entry.content) : entry.content);
  const failed = tools.some((tool) => tool?.status === "failed");
  const running = tools.some((tool) => tool?.status === "running");
  const [sentence, failures] = summarizeTools(tools).split(" \xB7 ");
  const stack = `<span class="tool-trace-stack" aria-hidden="true">${summaryIcons(tools).map((name) => icon(name)).join("")}</span>`;
  const status = failures ? `<span class="tool-group-status has-failure"> \xB7 ${escape(failures)}</span>` : "";
  return `<details class="tool-group" data-tool-group-key="${escape("group:" + entries[0].key)}"${running ? " data-running" : ""}${expanded ? " open" : ""}><summary class="tool-group-summary">${failed ? icon("alert") : ""}<span class="tool-group-label">${escape(sentence)}</span>${stack}${status}${icon("chevron")}</summary><div class="tool-group-body">${entries.map((entry) => renderToolActivity(entry.content, entry.key)).join("")}</div></details>`;
}
export {
  decodeToolActivity,
  groupToolRuns,
  renderToolActivity,
  renderToolGroup,
  renderToolStatus
};
