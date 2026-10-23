let database;
function db() {
  return database ?? (database = new Promise((resolve, reject) => {
    const request = indexedDB.open("pandacode-preview-moodboards", 1);
    request.onupgradeneeded = () => {
      const database2 = request.result;
      database2.createObjectStore("boards", { keyPath: "id" }).createIndex("project", "projectId");
      database2.createObjectStore("images", { keyPath: "id" }).createIndex("board", "boardId");
      database2.createObjectStore("data", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Moodboard storage is unavailable."));
  }));
}
function result(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not save moodboard."));
  });
}
async function read(store, id) {
  return result((await db()).transaction(store).objectStore(store).get(id));
}
async function find(store, index, id) {
  return result((await db()).transaction(store).objectStore(store).index(index).getAll(id));
}
async function write(operations) {
  const tx = (await db()).transaction([...new Set(operations.map((item) => item.store))], "readwrite");
  for (const item of operations) {
    if (item.remove !== void 0) tx.objectStore(item.store).delete(item.remove);
    else tx.objectStore(item.store).put(item.value);
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(new Error("Could not save moodboard."));
  });
}
async function board(projectId, boardId) {
  const board2 = await read("boards", boardId);
  if (!board2 || board2.projectId !== projectId) throw new Error("Moodboard is unavailable in this project.");
  return board2;
}
function name(value, max = 120) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max || /[\x00-\x1f]/.test(text)) throw new Error(`Use a name between 1 and ${max} characters.`);
  return text;
}
async function detail(projectId, boardId) {
  const selected = await board(projectId, boardId);
  const images = await find("images", "board", boardId);
  return { ...selected, imageCount: images.length, images: images.map(({ boardId: _, ...image }) => image).sort((a, b) => a.createdAt - b.createdAt) };
}
async function derivatives(dataUrl) {
  if (dataUrl.length > 12 * 1024 * 1024 * 4 / 3 + 128 || !/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) throw new Error("Choose PNG, JPEG or WebP images up to 12 MB each.");
  const response = await fetch(dataUrl), blob = await response.blob();
  const image = await createImageBitmap(blob);
  try {
    let resize2 = function(edge) {
      const scale = Math.min(1, edge / image.width, edge / image.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.85);
    };
    var resize = resize2;
    if (image.width > 8192 || image.height > 8192 || image.width * image.height > 32e6) throw new Error("Choose an image smaller than 8192 pixels per edge.");
    return { width: image.width, height: image.height, dataUrl: resize2(2048), thumbnail: resize2(480) };
  } finally {
    image.close();
  }
}
async function invokeMoodboards(command, args) {
  return await execute(command, args);
}
async function execute(command, args) {
  const projectId = String(args.projectId ?? ""), boardId = String(args.boardId ?? ""), imageId = String(args.imageId ?? "");
  if (!projectId) throw new Error("Choose a project first.");
  if (command === "list_moodboards") return (await find("boards", "project", projectId)).sort((a, b) => b.updatedAt - a.updatedAt);
  if (command === "create_moodboard") {
    const boards = await find("boards", "project", projectId);
    if (boards.length >= 24) throw new Error("This project has 24 moodboards. Remove one first.");
    const item = { id: crypto.randomUUID(), projectId, name: name(args.name), imageCount: 0, updatedAt: Date.now() };
    await write([{ store: "boards", value: item }]);
    return item;
  }
  const selected = await board(projectId, boardId);
  if (command === "read_moodboard") return detail(projectId, boardId);
  if (command === "rename_moodboard") {
    selected.name = name(args.name);
    selected.updatedAt = Date.now();
    await write([{ store: "boards", value: selected }]);
    return selected;
  }
  if (command === "delete_moodboard") {
    const images = await find("images", "board", boardId);
    await write([{ store: "boards", remove: boardId }, ...images.flatMap((image2) => [{ store: "images", remove: image2.id }, { store: "data", remove: image2.id }])]);
    return;
  }
  if (command === "add_moodboard_image") {
    if (selected.imageCount >= 64) throw new Error("A moodboard can hold up to 64 images.");
    const prepared = await derivatives(String(args.dataUrl ?? ""));
    const image2 = { id: crypto.randomUUID(), boardId, name: name(args.name, 200), caption: "", width: prepared.width, height: prepared.height, createdAt: Date.now() };
    selected.imageCount++;
    selected.updatedAt = Date.now();
    await write([{ store: "images", value: image2 }, { store: "data", value: { id: image2.id, dataUrl: prepared.dataUrl, thumbnail: prepared.thumbnail } }, { store: "boards", value: selected }]);
    return detail(projectId, boardId);
  }
  if (command === "import_moodboard_images") throw new Error("Choose image files in the browser preview.");
  const image = await read("images", imageId);
  if (!image || image.boardId !== boardId) throw new Error("Image is unavailable in this moodboard.");
  if (command === "moodboard_image") {
    const data = await read("data", imageId);
    if (!data) throw new Error("Image is no longer available.");
    return { dataUrl: args.thumbnail === false ? data.dataUrl : data.thumbnail };
  }
  if (command === "update_moodboard_image") {
    const caption = String(args.caption ?? "");
    if (caption.length > 2e3 || caption.includes("\0")) throw new Error("Captions must be under 2,000 characters.");
    image.caption = caption;
    selected.updatedAt = Date.now();
    await write([{ store: "images", value: image }, { store: "boards", value: selected }]);
    return;
  }
  if (command === "remove_moodboard_image") {
    selected.imageCount = Math.max(0, selected.imageCount - 1);
    selected.updatedAt = Date.now();
    await write([{ store: "images", remove: imageId }, { store: "data", remove: imageId }, { store: "boards", value: selected }]);
    return;
  }
  throw new Error("Unknown moodboard command.");
}
export {
  invokeMoodboards
};
