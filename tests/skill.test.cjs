const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { promisify } = require("node:util");
const execFile = promisify(require("node:child_process").execFile);
const { installSkill } = require("../electron/skill-install.cjs");
const { main } = require("../skills/pebble-todo/scripts/pebble.cjs");
const { Store } = require("../electron/store.cjs");
const { TaskService } = require("../electron/task-service.cjs");
const { startBridge } = require("../electron/ai-bridge.cjs");
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pebble-skill-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
test("Skill helper uses authorized local service, handles retries, and does not leak credentials", async (t) => {
  const directory = await fixture(t), store = new Store(directory), state = await store.load();
  state.settings.aiEnabled = true;
  const service = new TaskService(store, state);
  const bridge = await startBridge(directory, (method, args) => service.execute(method, args));
  t.after(() => bridge.close());
  const connection = JSON.parse(await fs.readFile(path.join(directory, "ai/connection.json"), "utf8"));
  const prefix = ["--data-dir", directory];
  const context = await main([...prefix, "context"]);
  assert.equal(context.ok, true);
  assert.ok(context.result.timeZone);
  const categories = await main([...prefix, "categories"]);
  assert.equal(categories.result.categories[0].id, "study");
  const file = path.join(directory, "输入 & 参数.json");
  const title = '复习 CV / $(do not execute) "quotes"';
  await fs.writeFile(file, JSON.stringify({ title, categoryId: "study", time: { mode: "start", start: "15:00" }, requestId: "skill-test-request" }));
  const add = await main([...prefix, "add", "--input-file", file]);
  assert.equal(add.ok, true);
  assert.equal(add.result.task.title, title);
  assert.equal(add.result.task.time.start, "15:00");
  assert.equal((await main([...prefix, "add", "--input-file", file])).result.reused, true);
  assert.equal(service.state.tasks.length, 1);
  await fs.writeFile(file, JSON.stringify({ query: "复习" }));
  const list = await main([...prefix, "tasks", "--input-file", file]);
  assert.equal(list.result.total, 1);
  await service.update((current) => { current.settings.aiEnabled = false; return current; });
  const disabled = await main([...prefix, "context"]);
  assert.equal(disabled.ok, false);
  assert.match(disabled.error, /access is off/);
  assert.equal(JSON.stringify([context, categories, add, list, disabled]).includes(connection.token), false);
});
test("installing a Skill preserves MCP settings and protects user modifications", async (t) => {
  const home = await fixture(t);
  await fs.mkdir(path.join(home, ".codex"));
  const configPath = path.join(home, ".codex/config.toml");
  await fs.writeFile(configPath, "# existing MCP configuration\n");
  const options = { home, executable: process.execPath, directory: path.join(home, "Pebble data") };
  for (const client of ["codex", "claude-code"]) {
    const result = await installSkill(client, options);
    assert.equal(await fs.readFile(configPath, "utf8"), "# existing MCP configuration\n");
    assert.ok((await fs.readFile(path.join(result.path, "SKILL.md"), "utf8")).startsWith("---"));
    assert.equal((await installSkill(client, options)).path, result.path);
    await fs.appendFile(path.join(result.path, "SKILL.md"), "\nMy own changes\n");
    await assert.rejects(() => installSkill(client, options), /edited Pebble Skill/);
    assert.match(await fs.readFile(path.join(result.path, "SKILL.md"), "utf8"), /My own changes/);
  }
  await assert.rejects(() => installSkill("unknown", options), /Unknown Skill client/);
});
test("installed launcher runs without a separate Node command and safely handles Unicode paths", async (t) => {
  const home = await fixture(t), directory = path.join(home, "数据 & 100% ready");
  const store = new Store(directory), state = await store.load();
  state.settings.aiEnabled = true;
  const service = new TaskService(store, state);
  const bridge = await startBridge(directory, (method, args) => service.execute(method, args));
  t.after(() => bridge.close());
  const { path: folder } = await installSkill("codex", { home, executable: require("electron"), directory });
  const result = process.platform === "win32"
    ? await execFile(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `""${path.join(folder, "run.cmd")}" context"`], { windowsHide: true, windowsVerbatimArguments: true, timeout: 15000 })
    : await execFile("/bin/sh", [path.join(folder, "run.sh"), "context"], { timeout: 15000 });
  assert.equal(JSON.parse(result.stdout).ok, true);
});
