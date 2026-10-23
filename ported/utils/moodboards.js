import "./moodboards.css";
import { call, preview } from "./bridge";
import { escape, icon } from "./dom";
const MAX_FILE = 12 * 1024 * 1024;
const supported = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp"]);
const captionWrites = /* @__PURE__ */ new Map();
function readData(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE || !supported.has(file.type)) {
      reject(new Error("Choose PNG, JPEG or WebP images up to 12 MB each."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
function mountMoodboards(host, options) {
  host.classList.add("moodboards");
  host.innerHTML = `<div class="moodboard-workspace"><aside class="moodboard-library"><div class="moodboard-library-heading"><span>Boards</span><button type="button" class="icon-button" data-mood-action="new" aria-label="New moodboard" title="New moodboard">${icon("plus")}</button></div><form class="moodboard-create" hidden><input name="name" aria-label="Moodboard name" placeholder="Name your board" maxlength="120" required><button class="icon-button" title="Create moodboard" aria-label="Create moodboard">${icon("check")}</button></form><nav class="moodboard-list" aria-label="Moodboards"></nav></aside><section class="moodboard-content" aria-label="Visual references"><header class="moodboard-toolbar" hidden><input class="moodboard-title" aria-label="Board name" maxlength="120"><button type="button" class="secondary-button" data-mood-action="add">${icon("plus")} Add images</button><button type="button" class="icon-button" data-mood-action="delete" title="Delete moodboard" aria-label="Delete moodboard">${icon("archive")}</button></header><div class="moodboard-delete-confirm" hidden><span>Delete this board and its images?</span><button type="button" class="secondary-button" data-mood-action="cancel-delete">Keep board</button><button type="button" class="secondary-button" data-mood-action="confirm-delete">Delete</button></div><div class="moodboard-canvas" tabindex="0" aria-label="Moodboard images. Paste or drop images here."><div class="moodboard-empty">${icon("camera")}<h3>Your visual starting point.</h3><p>Collect screenshots, layouts and ideas for your agents to reference.</p><button type="button" class="secondary-button" data-mood-action="new">Create a moodboard</button></div></div><footer class="moodboard-footer" hidden><span>Drop images or paste a screenshot</span><button type="button" class="primary-button" data-mood-action="attach" ${options.onAttach ? "" : "hidden"}>${icon("attach")} Attach to task</button></footer></section></div><p class="moodboard-status" role="status" aria-live="polite"></p><input class="moodboard-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden>`;
  const find = (selector) => host.querySelector(selector);
  const list = find(".moodboard-list"), canvas = find(".moodboard-canvas");
  const toolbar = find(".moodboard-toolbar"), footer = find(".moodboard-footer");
  const title = find(".moodboard-title"), createForm = find(".moodboard-create");
  const nameInput = createForm.querySelector("input"), status = find(".moodboard-status");
  const fileInput = find(".moodboard-file-input"), confirmDelete = find(".moodboard-delete-confirm");
  let disposed = false, boards = [], selected;
  let loading = 0, busy = false, nativeUnlisten;
  let thumbnailQueue = [], activeThumbnails = 0;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) {
      const image = entry.target;
      observer.unobserve(image);
      thumbnailQueue.push(image);
    }
    loadThumbnails();
  }, { root: canvas, rootMargin: "150px" });
  function report(message, error = false) {
    if (disposed) return;
    status.textContent = message instanceof Error ? message.message : String(message ?? "");
    status.dataset.error = String(error);
  }
  async function perform(action) {
    if (busy || disposed) return;
    busy = true;
    host.setAttribute("aria-busy", "true");
    host.querySelectorAll('[data-mood-action="add"],[data-mood-action="confirm-delete"],.moodboard-create button').forEach((button) => {
      button.disabled = true;
    });
    try {
      await action();
    } catch (error) {
      report(error, true);
    } finally {
      busy = false;
      if (!disposed) {
        host.removeAttribute("aria-busy");
        host.querySelectorAll('[data-mood-action="add"],[data-mood-action="confirm-delete"],.moodboard-create button').forEach((button) => {
          button.disabled = false;
        });
      }
    }
  }
  function renderList() {
    list.innerHTML = boards.map((board) => `<button type="button" class="moodboard-list-item" data-mood-board="${escape(board.id)}" aria-pressed="${board.id === selected?.id}">${icon("board")}<span class="moodboard-list-name">${escape(board.name)}</span> <small>${board.imageCount} ${board.imageCount === 1 ? "image" : "images"}</small></button>`).join("");
  }
  function updateBoard(board) {
    boards = [board, ...boards.filter((item) => item.id !== board.id)];
    renderList();
  }
  function renderImages() {
    observer.disconnect();
    thumbnailQueue = [];
    canvas.querySelectorAll("img").forEach((image) => image.removeAttribute("src"));
    if (!selected) return;
    const board = selected;
    toolbar.hidden = false;
    footer.hidden = false;
    confirmDelete.hidden = true;
    title.value = board.name;
    canvas.innerHTML = board.images.length ? `<div class="moodboard-image-grid">${board.images.map((image) => `<article class="moodboard-image-card" data-mood-image="${escape(image.id)}"><button type="button" class="moodboard-image-preview" data-mood-expand="${escape(image.id)}" aria-label="View ${escape(image.name)}"><img data-image-id="${escape(image.id)}" data-board-id="${escape(board.id)}" alt="${escape(image.name)}" decoding="async"></button><div class="moodboard-image-meta"><span title="${escape(image.name)}">${escape(image.name)}</span><button type="button" class="icon-button" data-mood-remove="${escape(image.id)}" aria-label="Remove ${escape(image.name)}" title="Remove image">${icon("close")}</button></div><textarea rows="2" maxlength="2000" data-mood-caption="${escape(image.id)}" aria-label="Caption for ${escape(image.name)}" placeholder="What should the agent notice?">${escape(image.caption)}</textarea></article>`).join("")}</div>` : `<div class="moodboard-empty">${icon("camera")}<h3>Give your agent a little inspiration.</h3><p>Drop images here, paste a screenshot, or choose files.</p><button type="button" class="secondary-button" data-mood-action="add">${icon("plus")} Add images</button><small>PNG, JPEG, WebP \xB7 up to 12 MB each</small></div>`;
    canvas.querySelectorAll("img").forEach((image) => observer.observe(image));
    renderList();
  }
  function loadThumbnails() {
    if (disposed) return;
    while (activeThumbnails < 2 && thumbnailQueue.length) {
      const image = thumbnailQueue.shift();
      if (!image.isConnected || !host.contains(image)) continue;
      activeThumbnails++;
      void call("moodboard_image", { projectId: options.projectId, boardId: image.dataset.boardId, imageId: image.dataset.imageId, thumbnail: true }).then((result) => {
        if (!disposed && host.contains(image)) image.src = result.dataUrl;
      }).catch(() => {
        if (!disposed && host.contains(image)) image.alt = "Preview unavailable";
      }).finally(() => {
        activeThumbnails--;
        loadThumbnails();
      });
    }
  }
  async function select(id) {
    if (disposed) return;
    const request = ++loading;
    report("Loading moodboard\u2026");
    await Promise.all([...captionWrites.values()]);
    if (disposed || request !== loading) return;
    const detail = await call("read_moodboard", { projectId: options.projectId, boardId: id });
    if (disposed || request !== loading) return;
    selected = detail;
    renderImages();
    report("");
  }
  async function reload(id) {
    const items = await call("list_moodboards", { projectId: options.projectId });
    if (disposed) return;
    boards = items;
    renderList();
    const next = items.find((board) => board.id === id) ?? items[0];
    if (next) await select(next.id);
    else {
      selected = void 0;
      toolbar.hidden = true;
      footer.hidden = true;
      confirmDelete.hidden = true;
      observer.disconnect();
      thumbnailQueue = [];
      canvas.innerHTML = `<div class="moodboard-empty">${icon("camera")}<h3>Your visual starting point.</h3><p>Collect screenshots, layouts and ideas for your agents to reference.</p><button type="button" class="secondary-button" data-mood-action="new">Create a moodboard</button></div>`;
    }
  }
  async function addFiles(files) {
    if (!selected) {
      report("Create a moodboard first.");
      return;
    }
    if (!files.length) return;
    if (files.length > 8) {
      report("Add up to eight images at a time.", true);
      return;
    }
    const boardId = selected.id;
    await perform(async () => {
      try {
        for (let i = 0; i < files.length; i++) {
          report(`Adding image ${i + 1} of ${files.length}\u2026`);
          const dataUrl = await readData(files[i]);
          const detail = await call("add_moodboard_image", { projectId: options.projectId, boardId, name: files[i].name || `Screenshot ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`, dataUrl });
          if (disposed) return;
          updateBoard(detail);
          if (selected?.id === boardId) selected = detail;
        }
      } finally {
        if (!disposed && selected?.id === boardId) renderImages();
      }
      report(`${files.length} ${files.length === 1 ? "image added" : "images added"}.`);
    });
  }
  async function addPaths(paths) {
    if (!selected || !paths.length) return;
    const boardId = selected.id;
    await perform(async () => {
      report("Adding images\u2026");
      const detail = await call("import_moodboard_images", { projectId: options.projectId, boardId, paths });
      if (disposed) return;
      updateBoard(detail);
      if (selected?.id === boardId) {
        selected = detail;
        renderImages();
      }
      report(`${paths.length} ${paths.length === 1 ? "image added" : "images added"}.`);
    });
  }
  function showCreate() {
    createForm.hidden = false;
    nameInput.focus();
  }
  async function chooseImages() {
    if (preview) {
      fileInput.click();
      return;
    }
    const result = await (await import("@tauri-apps/plugin-dialog")).open({ title: "Add images to moodboard", multiple: true, filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }] });
    if (!disposed && result) await addPaths(Array.isArray(result) ? result : [result]);
  }
  async function expand(imageId) {
    if (!selected) return;
    const boardId = selected.id, image = selected.images.find((item) => item.id === imageId);
    if (!image) return;
    host.querySelector(".moodboard-lightbox")?.remove();
    const box = document.createElement("div");
    box.className = "moodboard-lightbox";
    box.tabIndex = -1;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Image preview");
    box.setAttribute("aria-modal", "true");
    find(".moodboard-workspace").inert = true;
    box.innerHTML = `<button type="button" class="icon-button" data-mood-action="close-preview" aria-label="Close image preview">${icon("close")}</button><img alt="${escape(image.name)}"><p>${escape(image.caption || image.name)}</p>`;
    host.append(box);
    box.querySelector("button").focus();
    try {
      const result = await call("moodboard_image", { projectId: options.projectId, boardId, imageId, thumbnail: false });
      if (!disposed && host.contains(box)) box.querySelector("img").src = result.dataUrl;
    } catch (error) {
      closePreview();
      report(error, true);
    }
  }
  function closePreview() {
    host.querySelector(".moodboard-lightbox")?.remove();
    find(".moodboard-workspace").inert = false;
    canvas.focus();
  }
  function click(event) {
    const button = event.target.closest("button");
    if (!button || !host.contains(button)) return;
    if (button.dataset.moodBoard) {
      if (!busy) void select(button.dataset.moodBoard).catch((error) => report(error, true));
      return;
    }
    if (button.dataset.moodExpand) {
      void expand(button.dataset.moodExpand);
      return;
    }
    if (button.dataset.moodRemove && selected) {
      const boardId = selected.id, imageId = button.dataset.moodRemove;
      void perform(async () => {
        await call("remove_moodboard_image", { projectId: options.projectId, boardId, imageId });
        if (!disposed) await reload(boardId);
      });
      return;
    }
    switch (button.dataset.moodAction) {
      case "new":
        showCreate();
        break;
      case "add":
        void chooseImages().catch((error) => report(error, true));
        break;
      case "delete":
        confirmDelete.hidden = false;
        break;
      case "cancel-delete":
        confirmDelete.hidden = true;
        break;
      case "confirm-delete":
        if (selected) {
          const boardId = selected.id;
          void perform(async () => {
            await call("delete_moodboard", { projectId: options.projectId, boardId });
            if (!disposed) await reload();
          });
        }
        break;
      case "attach":
        if (selected) options.onAttach?.({ id: selected.id, name: selected.name, projectId: selected.projectId, imageCount: selected.imageCount, updatedAt: selected.updatedAt });
        break;
      case "close-preview":
        closePreview();
        break;
    }
  }
  function createBoard(event) {
    event.preventDefault();
    event.stopPropagation();
    const name = nameInput.value.trim();
    if (!name) return;
    void perform(async () => {
      const board = await call("create_moodboard", { projectId: options.projectId, name });
      if (disposed) return;
      nameInput.value = "";
      createForm.hidden = true;
      await reload(board.id);
      title.focus();
    });
  }
  async function saveTitle() {
    if (!selected || title.value.trim() === selected.name) return;
    const boardId = selected.id, name = title.value.trim();
    if (!name) {
      title.value = selected.name;
      return;
    }
    try {
      const board = await call("rename_moodboard", { projectId: options.projectId, boardId, name });
      if (!disposed && selected?.id === boardId) {
        Object.assign(selected, board);
        updateBoard(board);
        report("Board renamed.");
      }
    } catch (error) {
      report(error, true);
      if (selected?.id === boardId) title.value = selected.name;
    }
  }
  function saveCaption(boardId, imageId, caption) {
    const previous = captionWrites.get(imageId) ?? Promise.resolve();
    const next = previous.catch(() => {
    }).then(async () => {
      await call("update_moodboard_image", { projectId: options.projectId, boardId, imageId, caption });
      if (disposed) return;
      const image = selected?.id === boardId ? selected.images.find((image2) => image2.id === imageId) : void 0;
      if (image) image.caption = caption;
      report("Caption saved.");
    }).catch((error) => report(error, true)).finally(() => {
      if (captionWrites.get(imageId) === next) captionWrites.delete(imageId);
    });
    captionWrites.set(imageId, next);
  }
  function change(event) {
    const target = event.target;
    if (target === fileInput) {
      const files = Array.from(fileInput.files ?? []);
      fileInput.value = "";
      void addFiles(files);
    }
    if (target === title) void saveTitle();
    if (target instanceof HTMLTextAreaElement && target.dataset.moodCaption && selected) saveCaption(selected.id, target.dataset.moodCaption, target.value);
  }
  function paste(event) {
    const files = Array.from(event.clipboardData?.files ?? []).filter((file) => supported.has(file.type));
    if (files.length) {
      event.preventDefault();
      event.stopPropagation();
      void addFiles(files);
    }
  }
  function drag(event) {
    if (!selected || !event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    canvas.classList.add("is-dragging");
  }
  function leave(event) {
    if (!(event.relatedTarget instanceof Node) || !canvas.contains(event.relatedTarget)) canvas.classList.remove("is-dragging");
  }
  function drop(event) {
    event.preventDefault();
    event.stopPropagation();
    canvas.classList.remove("is-dragging");
    void addFiles(Array.from(event.dataTransfer?.files ?? []));
  }
  function key(event) {
    if (event.key === "Escape" && host.querySelector(".moodboard-lightbox")) {
      event.preventDefault();
      event.stopPropagation();
      closePreview();
    } else if (event.key === "Escape" && !createForm.hidden) {
      event.preventDefault();
      event.stopPropagation();
      createForm.hidden = true;
    } else if (event.key === "Enter" && event.target === title) {
      event.preventDefault();
      void saveTitle();
      title.blur();
    }
  }
  host.addEventListener("click", click);
  host.addEventListener("change", change);
  host.addEventListener("paste", paste);
  host.addEventListener("keydown", key);
  createForm.addEventListener("submit", createBoard);
  canvas.addEventListener("dragover", drag);
  canvas.addEventListener("dragleave", leave);
  canvas.addEventListener("drop", drop);
  if (!preview) void import("@tauri-apps/api/webview").then((module) => module.getCurrentWebview().onDragDropEvent((event) => {
    if (disposed || !selected) return;
    if (event.payload.type === "over") canvas.classList.add("is-dragging");
    else if (event.payload.type === "leave") canvas.classList.remove("is-dragging");
    else if (event.payload.type === "drop") {
      canvas.classList.remove("is-dragging");
      void addPaths(event.payload.paths);
    }
  })).then((unlisten) => {
    if (disposed) unlisten();
    else nativeUnlisten = unlisten;
  }).catch(() => {
  });
  void reload(options.initialBoardId).catch((error) => report(error, true));
  return () => {
    if (selected) {
      for (const field of host.querySelectorAll("[data-mood-caption]")) {
        const image = selected.images.find((image2) => image2.id === field.dataset.moodCaption);
        if (image && image.caption !== field.value) saveCaption(selected.id, image.id, field.value);
      }
      if (title.value.trim() && title.value.trim() !== selected.name) void saveTitle();
    }
    disposed = true;
    loading++;
    observer.disconnect();
    thumbnailQueue = [];
    nativeUnlisten?.();
    host.removeEventListener("click", click);
    host.removeEventListener("change", change);
    host.removeEventListener("paste", paste);
    host.removeEventListener("keydown", key);
    createForm.removeEventListener("submit", createBoard);
    canvas.removeEventListener("dragover", drag);
    canvas.removeEventListener("dragleave", leave);
    canvas.removeEventListener("drop", drop);
    host.querySelectorAll("img").forEach((image) => image.removeAttribute("src"));
    host.replaceChildren();
  };
}
export {
  mountMoodboards
};
