const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../electron/store.cjs");
const D = require("../src/domain.js");

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pebble-store-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return new Store(directory);
}
test("first launch starts empty and saved multilingual tasks survive a restart", async (t) => {
  const store = await fixture(t),
    state = await store.load();
  assert.equal(state.tasks.length, 0);
  state.tasks.push(
    D.makeTask({ title: "复习 CV / Review résumé", categoryId: "career" }),
  );
  await store.save(state);
  const reopened = new Store(store.directory);
  assert.equal(
    (await reopened.load()).tasks[0].title,
    "复习 CV / Review résumé",
  );
});
test("concurrent writes are serialized and backup retains prior valid state", async (t) => {
  const store = await fixture(t),
    a = D.createState(),
    b = D.createState();
  b.tasks.push(D.makeTask({ title: "Latest task" }));
  await Promise.all([store.save(a), store.save(b)]);
  assert.equal((await store.load()).tasks.length, 1);
  assert.equal(
    JSON.parse(await fs.readFile(store.file + ".backup", "utf8")).tasks.length,
    0,
  );
});
test("corruption recovers from backup and preserves damaged original", async (t) => {
  const store = await fixture(t),
    state = D.createState();
  state.tasks.push(D.makeTask({ title: "Recover me" }));
  await store.save(state);
  await store.save(state);
  await fs.writeFile(store.file, "broken JSON");
  const reopened = new Store(store.directory),
    recovered = await reopened.load();
  assert.equal(recovered.tasks[0].title, "Recover me");
  assert.ok(reopened.recoveryNotice);
  assert.ok(
    (await fs.readdir(store.directory)).some((name) =>
      name.includes(".damaged-"),
    ),
  );
  await reopened.save(recovered);
});
test("unrecoverable corruption is surfaced instead of silently discarding tasks", async (t) => {
  const store = await fixture(t);
  await store.load();
  await fs.writeFile(store.file, "broken JSON");
  await assert.rejects(() => store.load(), /原文件已保留/);
  assert.equal(await fs.readFile(store.file, "utf8"), "broken JSON");
});
