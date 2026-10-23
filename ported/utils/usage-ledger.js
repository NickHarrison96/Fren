const RANGE_DAYS = { week: 7, month: 30, year: 365 };
const RANGE_LABEL = { week: "Past 7 days", month: "Past 30 days", year: "Past year" };
const HOUR_MS = 36e5;
function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function hourDay(hour) {
  return dayKey(new Date(hour * HOUR_MS));
}
function emptyTotals() {
  return { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, cost: 0, savings: 0, tokens: 0, unpricedTokens: 0 };
}
function addRow(totals, row, priced) {
  const tokens = row[2] + row[3] + row[4] + row[5];
  return {
    input: totals.input + row[2],
    cacheRead: totals.cacheRead + row[3],
    cacheWrite: totals.cacheWrite + row[4],
    output: totals.output + row[5],
    cost: totals.cost + row[6],
    savings: totals.savings + row[7],
    tokens: totals.tokens + tokens,
    unpricedTokens: totals.unpricedTokens + (priced ? 0 : tokens)
  };
}
function lastDays(count, today = /* @__PURE__ */ new Date()) {
  return Array.from({ length: count }, (_, i) => dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (count - 1 - i))));
}
function summarize(ledger, range, today = /* @__PURE__ */ new Date()) {
  const days = lastDays(RANGE_DAYS[range], today);
  const dayIndex = new Map(days.map((day, i) => [day, i]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days.length - 1)).getTime() / HOUR_MS;
  const bucketSize = range === "year" ? 7 : 1;
  const bucketCount = Math.ceil(days.length / bucketSize);
  const bucketOf = (index) => Math.max(0, bucketCount - 1 - Math.floor((days.length - 1 - index) / bucketSize));
  const agentTotals = /* @__PURE__ */ new Map();
  const modelTotals = /* @__PURE__ */ new Map();
  const series = /* @__PURE__ */ new Map();
  const daily = days.map((date) => ({ date, cost: 0, tokens: 0 }));
  let totals = emptyTotals();
  for (const row of ledger.rows) {
    const index = dayIndex.get(hourDay(row[0]));
    const model = ledger.models[row[1]];
    if (index === void 0 || !model) continue;
    totals = addRow(totals, row, model.priced);
    agentTotals.set(model.provider, addRow(agentTotals.get(model.provider) ?? emptyTotals(), row, model.priced));
    const previous = modelTotals.get(row[1]) ?? { cost: 0, tokens: 0 };
    modelTotals.set(row[1], { cost: previous.cost + row[6], tokens: previous.tokens + row[2] + row[3] + row[4] + row[5] });
    const values = series.get(model.provider) ?? Array(bucketCount).fill(0);
    values[bucketOf(index)] += row[6];
    series.set(model.provider, values);
    daily[index] = { ...daily[index], cost: daily[index].cost + row[6], tokens: daily[index].tokens + row[2] + row[3] + row[4] + row[5] };
  }
  const inRange = ledger.sessions.filter((session) => session.last >= start);
  const agents = [...agentTotals].map(([provider, value]) => ({ ...value, provider, sessions: inRange.filter((session) => session.provider === provider).length })).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens);
  const models = [...modelTotals].map(([index, value]) => ({ ...value, provider: ledger.models[index].provider, model: ledger.models[index].name, priced: ledger.models[index].priced })).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens);
  const buckets = Array.from({ length: bucketCount }, (_, bucket) => {
    const last = Math.min(days.length - 1, days.length - 1 - (bucketCount - 1 - bucket) * bucketSize);
    return { start: days[Math.max(0, last - bucketSize + 1)], end: days[last] };
  });
  return { range, days, totals, sessions: inRange.length, agents, models, series: [...series].map(([provider, values]) => ({ provider, values })), buckets, dailyCost: daily };
}
function calendarFor(provider, ledger, prompts) {
  const add = (map, date, value) => map.set(date, (map.get(date) ?? 0) + value);
  const tokens = /* @__PURE__ */ new Map();
  for (const row of ledger?.rows ?? []) if (ledger.models[row[1]]?.provider === provider) add(tokens, hourDay(row[0]), row[2] + row[3] + row[4] + row[5]);
  if (tokens.size) return { unit: "tokens", daily: [...tokens].map(([date, value]) => ({ date, tokens: value })) };
  const sent = /* @__PURE__ */ new Map();
  for (const [hour, owner, count] of prompts ?? []) if (owner === provider) add(sent, hourDay(hour), count);
  return sent.size ? { unit: "prompts", daily: [...sent].map(([date, value]) => ({ date, tokens: value })) } : null;
}
function averageLimit(peaks) {
  const valid = peaks.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat(void 0, { notation: "compact", maximumFractionDigits: 1 });
const share = new Intl.NumberFormat(void 0, { style: "percent", maximumFractionDigits: 1 });
function formatUsd(value) {
  return value > 0 && value < 0.01 ? "<$0.01" : usd.format(value);
}
function formatUsdAxis(value) {
  return value >= 1e3 ? usdCompact.format(value) : usd.format(value).replace(/\.00$/, "");
}
function formatTokens(value) {
  return compact.format(value);
}
function formatShare(part, whole) {
  if (!whole || !part) return "0%";
  const ratio = part / whole;
  return ratio < 1e-3 ? "<0.1%" : share.format(ratio);
}
export {
  RANGE_DAYS,
  RANGE_LABEL,
  averageLimit,
  calendarFor,
  dayKey,
  formatShare,
  formatTokens,
  formatUsd,
  formatUsdAxis,
  hourDay,
  lastDays,
  summarize
};
