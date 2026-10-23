function migratePreferences(storage) {
  const marker = "pandacode.preferences-migrated";
  if (storage.getItem(marker) === "1") return;
  const legacy = "kingcode.";
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key?.startsWith(legacy)) continue;
    const next = "pandacode." + key.slice(legacy.length);
    const value = storage.getItem(key);
    if (value !== null && storage.getItem(next) === null) storage.setItem(next, value);
  }
  storage.setItem(marker, "1");
}
export {
  migratePreferences
};
