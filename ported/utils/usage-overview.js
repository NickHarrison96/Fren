import { escape, icon } from "./dom";
import { providerLogo } from "./provider-logos";
import { infoMark } from "./tooltip";
import { costChart } from "./usage-cost-chart";
import { formatShare, formatTokens, formatUsd, RANGE_LABEL } from "./usage-ledger";
const percent = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 });
const TRACKED_LOGS = "Claude Code and Codex";
function tone(value) {
  return value >= 95 ? "exhausted" : value >= 80 ? "high" : "normal";
}
function renderLimitHero(host, limits, average, pending) {
  const reporting = limits.filter((limit) => limit.peak !== null).length;
  const value = average ?? 0;
  const circumference = 2 * Math.PI * 26;
  const caption = average === null ? pending ? "Checking account limits\u2026" : "No agent reported a limit." : `Across ${reporting} ${reporting === 1 ? "agent" : "agents"}${pending ? ` \xB7 ${pending} still checking` : ""}`;
  host.dataset.tone = tone(value);
  host.innerHTML = `<svg class="usage-ring" viewBox="0 0 64 64" role="img" aria-label="${average === null ? "Average limit use unavailable" : `Average limit use ${percent.format(value)}%`}">
      <circle cx="32" cy="32" r="26" class="usage-ring-track"/>
      <circle cx="32" cy="32" r="26" class="usage-ring-value" stroke-dasharray="${(Math.min(100, value) / 100 * circumference).toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 32 32)"/>
    </svg>
    <div class="usage-hero-copy"><span class="usage-hero-label">Average limit use ${infoMark("The average of each agent\u2019s most-used limit window, such as a 5-hour or weekly window. Agents that do not report limits are left out.", "About average limit use")}</span>
      <strong class="usage-hero-value">${average === null ? "\u2014" : `${percent.format(value)}%`}</strong><small>${escape(caption)}</small></div>`;
}
function renderAgents(host, limits, cost) {
  const summary = cost.kind === "ready" ? cost.summary : null;
  const total = summary?.totals.cost ?? 0;
  const byProvider = new Map(summary?.agents.map((agent) => [agent.provider, agent]));
  const order = [...limits].sort((a, b) => (byProvider.get(b.provider)?.cost ?? -1) - (byProvider.get(a.provider)?.cost ?? -1));
  host.innerHTML = order.map((limit) => {
    const agent = byProvider.get(limit.provider);
    const tracked = cost.kind === "ready" && cost.tracked.includes(limit.provider);
    const amount = agent ? formatUsd(agent.cost) : tracked ? "$0.00" : "";
    const detail = agent ? `${formatShare(agent.cost, total)} of cost \xB7 ${formatTokens(agent.tokens)} tokens${agent.sessions ? ` \xB7 ${agent.sessions} ${agent.sessions === 1 ? "session" : "sessions"}` : ""}` : tracked ? "No usage in this period" : "Cost not tracked";
    const peak = limit.peak === null ? `<span class="usage-agent-limit" data-state="none">${escape(limit.state)}</span>` : `<span class="usage-agent-limit" data-tone="${tone(limit.peak)}"><span class="usage-mini-track"><span style="width:${Math.min(100, limit.peak)}%"></span></span>${percent.format(limit.peak)}%</span>`;
    return `<button type="button" class="usage-agent-row" data-provider="${limit.provider}" aria-label="${escape(`${limit.name}. ${amount ? `${amount} estimated. ` : ""}${detail}. ${limit.peak === null ? limit.state : `${percent.format(limit.peak)}% of limit used`}. Open details`)}">
      <span class="usage-agent-dot" data-provider="${limit.provider}" aria-hidden="true"></span>${providerLogo(limit.provider)}
      <span class="usage-agent-copy"><strong>${escape(limit.name)}</strong><small>${escape(detail)}</small></span>
      ${peak}<span class="usage-agent-cost">${escape(amount)}</span>${icon("chevron", "usage-agent-chevron")}</button>`;
  }).join("");
}
function totalsGrid(summary) {
  const t = summary.totals;
  const cells = [
    ["Processed tokens", formatTokens(t.tokens)],
    ["Cached input", formatTokens(t.cacheRead)],
    ["Uncached input", formatTokens(t.input + t.cacheWrite)],
    ["Output", formatTokens(t.output)],
    ["Cache savings", formatUsd(t.savings)]
  ];
  return `<dl class="usage-totals">${cells.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>`;
}
function breakdownTable(summary, by) {
  const total = summary.totals.cost;
  const date = new Intl.DateTimeFormat(void 0, { weekday: "short", month: "short", day: "numeric" });
  const rows = by === "model" ? summary.models.map((row) => `<tr><th scope="row">${providerLogo(row.provider)}<span>${escape(row.model)}</span>${row.priced ? "" : "<small>unpriced</small>"}</th><td>${row.priced ? formatUsd(row.cost) : "\u2014"}</td><td>${formatShare(row.cost, total)}</td><td>${formatTokens(row.tokens)}</td></tr>`) : [...summary.dailyCost].reverse().filter((day) => day.tokens > 0).map((day) => {
    const [y, m, d] = day.date.split("-").map(Number);
    return `<tr><th scope="row"><span>${escape(date.format(new Date(y, m - 1, d)))}</span></th><td>${formatUsd(day.cost)}</td><td>${formatShare(day.cost, total)}</td><td>${formatTokens(day.tokens)}</td></tr>`;
  });
  return `<table class="usage-breakdown"><thead><tr><th scope="col">${by === "model" ? "Model" : "Day"}</th><th scope="col">Cost</th><th scope="col">Share</th><th scope="col">Tokens</th></tr></thead>
    <tbody>${rows.join("") || '<tr><td colspan="4" class="usage-breakdown-empty">No usage in this period.</td></tr>'}</tbody></table>`;
}
function renderCostHero(host, cost) {
  const about = `Estimated from token counts in ${TRACKED_LOGS} logs on this computer, read when this window opens. Only counts are kept and nothing is uploaded. Priced at standard API rates (batch, priority, and fast-mode pricing excluded); subscriptions bill differently.`;
  const label = `<span class="usage-hero-label">Estimated API cost ${infoMark(cost.kind === "ready" ? `${about} ${cost.pricing}` : about, "About estimated API cost")}</span>`;
  if (cost.kind === "pending") {
    host.innerHTML = `${label}<strong class="usage-hero-value usage-hero-pending">$\u2014</strong><small role="status">Reading local agent logs\u2026</small>`;
    return;
  }
  if (cost.kind === "error") {
    host.innerHTML = `${label}<strong class="usage-hero-value">\u2014</strong><small role="alert">${escape(cost.message)}</small>`;
    return;
  }
  const { summary } = cost;
  const unpriced = summary.totals.unpricedTokens / (summary.totals.tokens || 1);
  const notes = [`${summary.sessions} ${summary.sessions === 1 ? "session" : "sessions"}`, RANGE_LABEL[summary.range].toLowerCase()];
  if (unpriced > 0) notes.push(`excludes ${formatShare(summary.totals.unpricedTokens, summary.totals.tokens)} unpriced tokens`);
  host.innerHTML = `${label}<strong class="usage-hero-value">${formatUsd(summary.totals.cost)}</strong><small>${escape(notes.join(" \xB7 "))}</small>`;
}
function renderCostDetails(host, cost, names, breakdown) {
  if (cost.kind !== "ready") {
    host.replaceChildren();
    return;
  }
  const { summary } = cost;
  if (!summary.totals.tokens) {
    host.innerHTML = `<p class="usage-cost-empty">${cost.tracked.length ? `No ${TRACKED_LOGS} usage in this period.` : `No ${TRACKED_LOGS} logs were found on this computer.`}</p>`;
    return;
  }
  const chart = document.createElement("section");
  chart.className = "usage-section usage-chart-section";
  chart.innerHTML = `<h3>${summary.range === "year" ? "Weekly cost" : "Daily cost"}</h3>`;
  chart.append(costChart({ series: summary.series.map((line) => ({ ...line, name: names(line.provider) })), buckets: summary.buckets }));
  const totals = document.createElement("section");
  totals.className = "usage-section";
  totals.innerHTML = `<h3>Totals</h3>${totalsGrid(summary)}`;
  const table = document.createElement("section");
  table.className = "usage-section usage-breakdown-section";
  table.innerHTML = `<header class="usage-section-heading"><h3>Breakdown</h3><div class="usage-segmented usage-breakdown-switch" role="group" aria-label="Break down by">
      <button type="button" data-breakdown="model" aria-pressed="${breakdown === "model"}">Model</button><button type="button" data-breakdown="day" aria-pressed="${breakdown === "day"}">Day</button></div></header>
    <div class="usage-breakdown-scroll">${breakdownTable(summary, breakdown)}</div>`;
  host.replaceChildren(chart, totals, table);
}
function agentCostStrip(provider, cost) {
  if (cost.kind !== "ready" || !cost.tracked.includes(provider)) return "";
  const agent = cost.summary.agents.find((entry) => entry.provider === provider);
  const models = cost.summary.models.filter((model) => model.provider === provider);
  const stats = agent ? [[formatUsd(agent.cost), "Estimated API cost"], [formatTokens(agent.tokens), "Tokens"], [formatTokens(agent.cacheRead), "Cached input"], [String(agent.sessions), agent.sessions === 1 ? "Session" : "Sessions"]] : [["$0.00", "Estimated API cost"]];
  return `<section class="usage-section usage-agent-cost-section"><h3>${escape(RANGE_LABEL[cost.summary.range])}</h3>
    <dl class="usage-totals usage-totals-compact">${stats.map(([value, label]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>
    ${models.length ? `<ul class="usage-model-list">${models.map((model) => `<li><span>${escape(model.model)}</span><span>${model.priced ? formatUsd(model.cost) : "unpriced"}</span><span>${formatTokens(model.tokens)}</span></li>`).join("")}</ul>` : ""}</section>`;
}
export {
  agentCostStrip,
  renderAgents,
  renderCostDetails,
  renderCostHero,
  renderLimitHero,
  tone
};
