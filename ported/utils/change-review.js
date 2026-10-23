import "./change-review.css";
import { call } from "./bridge";
import { escape, icon } from "./dom";
import { changeCounts, changeNotice } from "./turn-changes";
import { mountDiffViewer } from "./diff-viewer";
function mountChangeReview(host, sessionId, changes, initialPath, review) {
  let disposed = false, request = 0, controller;
  const notice = changeNotice(changes);
  host.innerHTML = `<div class="change-review-summary"><span>${changes.files.length} changed ${changes.files.length === 1 ? "file" : "files"}</span><span class="change-counts">${changeCounts(changes.additions, changes.deletions)}</span><small>Saved at turn completion</small></div>${notice ? `<p class="change-review-notice">${escape(notice)}</p>` : ""}<div class="change-review-workspace"><nav class="change-review-files" aria-label="Changed files">${changes.files.map((file) => `<button type="button" data-path="${escape(file.path)}" aria-label="View diff for ${escape(file.path)}" title="${escape(file.oldPath ? file.oldPath + " \u2192 " + file.path : file.path)}" aria-pressed="false">${icon("file")}<span class="change-review-path">${escape(file.path)}</span><span class="change-counts">${file.binary ? '<span class="change-count-unknown">Binary</span>' : changeCounts(file.additions, file.deletions)}</span></button>`).join("")}</nav><section class="change-review-content" aria-label="Saved file diff"><div class="change-review-filename"></div><div class="change-review-viewer"></div></section></div>`;
  const viewer = host.querySelector(".change-review-viewer");
  if (review) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button change-review-assist";
    button.innerHTML = `${icon("spark")}Review with Jev`;
    button.addEventListener("click", review);
    host.querySelector(".change-review-summary").append(button);
  }
  async function select(path) {
    if (disposed) return;
    const file = changes.files.find((file2) => file2.path === path);
    if (!file) return;
    const current = ++request;
    controller?.dispose();
    controller = void 0;
    host.querySelectorAll(".change-review-files button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.path === path)));
    host.querySelector(".change-review-filename").textContent = file.oldPath ? `${file.oldPath} \u2192 ${file.path}` : file.path;
    viewer.innerHTML = '<p class="change-review-loading" role="status">Loading saved diff\u2026</p>';
    try {
      const diff = await call("turn_change_diff", { sessionId, changeId: changes.id, path });
      if (disposed || current !== request) return;
      controller = mountDiffViewer(viewer, { ...diff, error: diff.error ?? void 0, layout: "unified" });
      await controller.ready;
    } catch (error) {
      if (disposed || current !== request) return;
      viewer.innerHTML = `<div class="change-review-error" role="alert"><p>${escape(error instanceof Error ? error.message : String(error))}</p><button type="button" class="secondary-button">Retry</button></div>`;
      viewer.querySelector("button").addEventListener("click", () => {
        void select(path);
      });
    }
  }
  const click = (event) => {
    const button = event.target.closest(".change-review-files button");
    if (button?.dataset.path) void select(button.dataset.path);
  };
  host.addEventListener("click", click);
  const first = changes.files.find((file) => file.path === initialPath) ?? changes.files[0];
  if (first) void select(first.path);
  return () => {
    disposed = true;
    request++;
    controller?.dispose();
    host.removeEventListener("click", click);
  };
}
export {
  mountChangeReview
};
