import "./capabilities-panel.css";
import { preview } from "./bridge";
import { escape, icon } from "./dom";
const tokenCount = (value) => value == null ? "\u2014" : new Intl.NumberFormat().format(value);
const deliveryLabel = (value) => value === "cachedSystemPrompt" ? "Cached system prompt" : value === "messageInjection" ? "Message injection" : value;
function inventoryTable(data, loading, failed) {
  if (loading) return '<p class="capabilities-table-status" role="status">Reading local harness metadata\u2026</p>';
  if (failed) return '<p class="capabilities-table-status" role="alert">Could not read the capability inventory. Try refreshing.</p>';
  if (!data?.harnesses.length) return '<p class="capabilities-table-status">No installed harnesses were found.</p>';
  if (!data.matrix.length) return '<p class="capabilities-table-status">No commands, integrations, hooks, plugins, or skills were discovered.</p>';
  const entryByKey = new Map(data.entries.map((entry) => [entry.harness + "\0" + entry.kind + "\0" + entry.name, entry]));
  const headings = data.harnesses.map((harness) => `<th scope="col">${escape(harness.name)}</th>`).join("");
  const rows = data.matrix.map((row) => {
    const states = row.states.map((cell) => {
      const entry = entryByKey.get(cell.harness + "\0" + row.kind + "\0" + row.name);
      const command = entry?.command ? `<small class="capabilities-command">${escape(entry.command)}</small>` : "";
      const source = entry ? `<small class="capabilities-source">${escape(entry.source)}</small>` : "";
      const label = cell.state === "native" ? "Native" : cell.state === "discovered" ? "Discovered" : "Missing";
      return `<td><span class="capabilities-state" data-state="${escape(cell.state)}">${label}</span>${command}${source}</td>`;
    }).join("");
    return `<tr><th scope="row"><span>${escape(row.name)}</span><small>${escape(row.kind)}</small></th>${states}</tr>`;
  }).join("");
  return `<div class="capabilities-table-scroll"><table class="capabilities-table" aria-label="Capability alignment">
    <thead><tr><th scope="col">Capability</th>${headings}</tr></thead><tbody>${rows}</tbody>
  </table></div>${data.warnings.length ? `<p class="capabilities-table-status" role="status">${escape(data.warnings.join(" "))}</p>` : ""}`;
}
function cacheTable(data, loading, failed) {
  if (loading) return '<p class="capabilities-table-status" role="status">Reading cache alignment\u2026</p>';
  if (failed) return '<p class="capabilities-table-status" role="alert">Could not read cache alignment. Try refreshing.</p>';
  if (!data?.harnesses.length) return '<p class="capabilities-table-status">No installed harnesses were found.</p>';
  const rows = data.harnesses.map((harness) => {
    const observed = harness.cacheTokens === "observed";
    const stateLabel = harness.state === "supported" ? "Supported" : harness.state === "partial" ? "Partial" : harness.state;
    const read = observed ? tokenCount(harness.cacheReadTokens) : "Not exposed";
    const created = observed ? tokenCount(harness.cacheCreationTokens) : "Not exposed";
    return `<tr>
      <th scope="row">${escape(harness.name)}</th>
      <td>${escape(deliveryLabel(harness.instructionDelivery))}</td>
      <td><span class="capabilities-state" data-state="${escape(harness.state)}">${escape(stateLabel)}</span></td>
      <td><span class="capabilities-token-label" title="${escape(harness.cacheTokenSource)}">${observed ? "Observed" : "Not exposed"}</span><span class="capabilities-token-value">${escape(read)}</span></td>
      <td><span class="capabilities-token-label" title="${escape(harness.cacheTokenSource)}">${observed ? "Observed" : "Not exposed"}</span><span class="capabilities-token-value">${escape(created)}</span></td>
    </tr>`;
  }).join("");
  return `<div class="capabilities-table-scroll"><table class="capabilities-table capabilities-cache-table" aria-label="Cache alignment">
    <thead><tr><th scope="col">Harness</th><th scope="col">Stable instructions</th><th scope="col">Alignment</th><th scope="col">Cache reads</th><th scope="col">Cache creation</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
function mount(host, call, taskId) {
  let inventory = null;
  let cache = null;
  let loading = true;
  let inventoryFailed = false;
  let cacheFailed = false;
  let disposed = false;
  let request = 0;
  const args = taskId ? { taskId } : {};
  const draw = () => {
    if (disposed) return;
    host.innerHTML = `<div class="settings-group capabilities-panel" aria-labelledby="capabilities-heading">
      <div class="capabilities-panel-head"><div><strong id="capabilities-heading">Capability and cache alignment</strong><small>Read-only metadata from local harness configs and recorded usage.</small></div>
        <button type="button" class="secondary-button capabilities-refresh" ${loading ? "disabled" : ""}>${icon("refresh")}Refresh</button>
      </div>
      <section class="capabilities-section" aria-labelledby="capabilities-inventory-heading">
        <h3 id="capabilities-inventory-heading">Capability inventory</h3>
        ${inventoryTable(inventory, loading && !inventory, inventoryFailed)}
      </section>
      <section class="capabilities-section" aria-labelledby="capabilities-cache-heading">
        <h3 id="capabilities-cache-heading">Cache alignment</h3>
        ${cacheTable(cache, loading && !cache, cacheFailed)}
        <p class="capabilities-note">${preview ? "Browser preview values are samples." : "Counts are observed from local usage records."} No prompt text or cache key is shown.</p>
      </section>
    </div>`;
  };
  const refresh = async () => {
    if (disposed || loading && (inventory || cache)) return;
    loading = true;
    inventoryFailed = false;
    cacheFailed = false;
    const current = ++request;
    draw();
    const results = await Promise.allSettled([
      call("capabilities_inventory", args),
      call("cache_alignment", args)
    ]);
    if (disposed || current !== request) return;
    if (results[0].status === "fulfilled") inventory = results[0].value;
    else inventoryFailed = true;
    if (results[1].status === "fulfilled") cache = results[1].value;
    else cacheFailed = true;
    loading = false;
    draw();
  };
  const onClick = (event) => {
    if (event.target?.closest(".capabilities-refresh")) void refresh();
  };
  host.addEventListener("click", onClick);
  draw();
  void refresh();
  return () => {
    disposed = true;
    request++;
    host.removeEventListener("click", onClick);
  };
}
export {
  mount
};
