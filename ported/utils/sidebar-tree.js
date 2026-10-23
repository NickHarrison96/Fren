const FOLDER_LIMIT = 6;
const PROJECT_LIMIT = 20;
function folderGroups({ projects, tasks, activity, includeEmpty }) {
  const byProject = /* @__PURE__ */ new Map();
  for (const task of tasks) byProject.set(task.projectId, [...byProject.get(task.projectId) ?? [], task]);
  return projects.map((project) => {
    const own = byProject.get(project.id) ?? [];
    return { project, tasks: own, latest: Math.max(0, ...own.map((task) => activity(task) ?? task.createdAt)) };
  }).filter((group) => group.tasks.length || includeEmpty).sort((a, b) => Number(b.tasks.length > 0) - Number(a.tasks.length > 0) || b.latest - a.latest || a.project.name.localeCompare(b.project.name));
}
function shownTasks(tasks, expanded, selectedId, limit = FOLDER_LIMIT) {
  if (expanded || tasks.length <= limit) return [...tasks];
  const head = tasks.slice(0, limit);
  const selected = tasks.find((task) => task.id === selectedId);
  return selected && !head.includes(selected) ? [...head, selected] : head;
}
function readCollapsed(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === "string") : []);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
export {
  FOLDER_LIMIT,
  PROJECT_LIMIT,
  folderGroups,
  readCollapsed,
  shownTasks
};
