function workerQueueReason(worker, workers, maxParallel) {
  if (worker.status !== "queued") return;
  if (worker.dependsOn.some((id) => !workers.some((other) => other.id === id && other.status === "completed"))) return "Waiting for a dependency";
  const active = workers.filter((other) => other.status === "running" || other.status === "waiting");
  if (maxParallel > 0 && active.length >= maxParallel) return "Waiting for an available worker slot";
  if (worker.readOnly) return;
  const blocker = active.find((other) => !other.readOnly && (!worker.files.length || !other.files.length || worker.files.some((file) => other.files.some((scope) => {
    const path = file.toLowerCase(), root = scope.toLowerCase();
    return path === root || path.startsWith(`${root}/`) || root.startsWith(`${path}/`);
  }))));
  if (blocker) return `Waiting for ${blocker.name} to finish editing shared files`;
}
export {
  workerQueueReason
};
