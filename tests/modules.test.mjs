import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const UTILS = path.resolve("/mnt/c/Users/nick/Documents/GitHub/PePe-Fren/work/pepe-fren-port/ported/utils");

async function load(name) {
  return import(pathToFileURL(path.join(UTILS, name + ".js")).href);
}

test("token-saver: exports present", async () => {
  const m = await load("token-saver");
  for (const k of ["contextFor", "estimate", "updateThread", "threadSaver", "defaults", "guidance", "PACKS", "LEVELS"]) {
    assert.ok(k in m, `missing export ${k}`);
  }
});

test("token-saver: contextFor returns guidance after updateThread", async () => {
  const m = await load("token-saver");
  m.updateThread("t1", { packs: ["caveman"], level: "full" });
  const ctx = m.contextFor("t1", { rtk: false });
  assert.ok(typeof ctx === "string" && ctx.length > 0);
});

test("message-queue: queuePanel renders", async () => {
  const m = await load("message-queue");
  const view = { entries: [{ id: "1", sessionId: "s", position: 0, text: "hi", attachments: [], createdAt: 1, updatedAt: 1 }], hold: null, running: false, steerable: false, sendable: true, editingId: null, busy: false, steering: new Set() };
  const html = m.queuePanel(view);
  assert.ok(html.includes("Queued"));
});

test("thread-find: exports present", async () => {
  const m = await load("thread-find");
  assert.equal(typeof m.findRanges, "function");
  assert.equal(typeof m.createThreadFind, "function");
});

test("all 152 modules pass syntax check", async () => {
  const fs = await import("node:fs");
  const cp = await import("node:child_process");
  const dir = UTILS;
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
  assert.equal(files.length, 152, `expected 152, got ${files.length}`);
  for (const f of files) {
    const r = cp.spawnSync(process.execPath, ["--check", path.join(dir, f)], { encoding: "utf8" });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
});
