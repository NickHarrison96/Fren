import "./coordination-message.css";
import { icon } from "./dom";
function renderCoordination(message) {
  const label = message.coordinationKind === "worker_review" ? "Reviewing worker results" : message.coordinationKind === "worker_update" ? "Checking worker updates" : message.coordinationKind === "continue" ? "Continuing the plan" : message.coordinationKind === "worker_failed" ? "Handling a failed worker" : "Coordinating team";
  return `<div class="coordination-status" role="note" aria-label="Team status">${icon("worktree")}<strong>Team</strong><span>${label}</span></div>`;
}
export {
  renderCoordination
};
