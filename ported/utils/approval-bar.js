import "./approval-bar.css";
import { escape, icon } from "./dom";
function approvalSummary(text) {
  const line = text.split("\n").map((part) => part.replace(/`+/g, "").trim()).find(Boolean) ?? "Approval needed";
  return line.length > 240 ? `${line.slice(0, 240)}\u2026` : line;
}
function actions(id, busy) {
  const disabled = busy ? "disabled" : "";
  return `<span class="approval-actions"><button type="button" class="approval-deny" data-action="approval-deny" data-request="${escape(id)}" ${disabled}>Deny</button><button type="button" class="approval-allow" data-action="approval-allow" data-request="${escape(id)}" ${disabled}>Approve</button></span>`;
}
function row(approval, busy, open) {
  const summary = approvalSummary(approval.text), full = approval.text.trim();
  const more = full !== summary;
  return `<li class="approval-row${open ? " is-open" : ""}" data-approval="${escape(approval.id)}">
    <div class="approval-line">${icon("lock", "approval-mark")}${more ? `<button type="button" class="approval-summary" data-action="approval-details" data-request="${escape(approval.id)}" aria-expanded="${open}" title="${escape(full)}">${escape(summary)}</button>` : `<span class="approval-summary" title="${escape(full)}">${escape(summary)}</span>`}${actions(approval.id, busy)}</div>
    ${more && open ? `<pre class="approval-full">${escape(full)}</pre>` : ""}
  </li>`;
}
function approvalBarHtml(approvals, options) {
  if (!approvals.length) return "";
  if (approvals.length === 1) {
    const [only] = approvals;
    return `<section class="approval-bar" aria-label="Approval needed"><ul class="approval-list">${row(only, options.busy(only.id), options.details.has(only.id))}</ul></section>`;
  }
  const busy = approvals.some((approval) => options.busy(approval.id));
  return `<section class="approval-bar is-group${options.expanded ? " is-expanded" : ""}" aria-label="${approvals.length} approvals needed">
    <div class="approval-line approval-group">${icon("lock", "approval-mark")}<button type="button" class="approval-summary" data-action="approval-group" aria-expanded="${options.expanded}"><strong>${approvals.length} approvals needed</strong><span>${escape(approvalSummary(approvals[0].text))}${approvals.length > 1 ? ` and ${approvals.length - 1} more` : ""}</span>${icon("chevron", "approval-chevron")}</button>
      <span class="approval-actions"><button type="button" class="approval-deny" data-action="approval-deny-all" ${busy ? "disabled" : ""}>Deny all</button><button type="button" class="approval-allow" data-action="approval-allow-all" ${busy ? "disabled" : ""}>Approve all</button></span></div>
    ${options.expanded ? `<ul class="approval-list">${approvals.map((approval) => row(approval, options.busy(approval.id), options.details.has(approval.id))).join("")}</ul>` : ""}
  </section>`;
}
export {
  approvalBarHtml,
  approvalSummary
};
