const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { Store } = require("../electron/store.cjs");
const { TaskService, conflict } = require("../electron/task-service.cjs");
const { startBridge } = require("../electron/ai-bridge.cjs");
const { configurations } = require("../electron/ai-config.cjs");
const D = require("../src/domain.js");
async function fixture(t, enabled = true) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pebble-ai-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new Store(directory),
    state = await store.load();
  state.settings.aiEnabled = enabled;
  return new TaskService(store, state);
}
test("AI is disabled by default and cannot mutate settings or invent categories", async (t) => {
  const service = await fixture(t, false);
  await assert.rejects(
    () => service.execute("pebble_add_task", { title: "No access" }),
    /access is off/,
  );
  await service.update((current) => {
    current.settings.aiEnabled = true;
    return current;
  });
  for (const args of [
    { title: "Bad", categoryId: "missing" },
    { title: "Bad", settings: { aiEnabled: false } },
    { title: "Bad", status: "unknown" },
    { title: "Bad", date: "2026-02-30" },
    { title: "Bad", time: { mode: "range", start: "12:00", end: "12:00" } },
  ])
    await assert.rejects(() => service.execute("pebble_add_task", args));
  assert.equal(service.state.tasks.length, 0);
});
test("concurrent AI additions are serialized, retries are durable, and pagination is bounded", async (t) => {
  const service = await fixture(t);
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      service.execute("pebble_add_task", {
        title: `Task ${i}`,
        requestId: `request-${i}`,
      }),
    ),
  );
  const retry = await service.execute("pebble_add_task", {
    title: "Task 0",
    requestId: "request-0",
  });
  assert.equal(retry.reused, true);
  assert.equal(service.state.tasks.length, 8);
  const reopened = new TaskService(service.store, await service.store.load());
  assert.equal(
    (
      await reopened.execute("pebble_add_task", {
        title: "Task 0",
        requestId: "request-0",
      })
    ).task.id,
    retry.task.id,
  );
  const first = await reopened.execute("pebble_list_tasks", { limit: 3 });
  const second = await reopened.execute("pebble_list_tasks", {
    limit: 3,
    offset: first.nextOffset,
  });
  assert.equal(first.total, 8);
  assert.equal(second.tasks.length, 3);
  assert.equal(
    new Set([...first.tasks, ...second.tasks].map((task) => task.id)).size,
    6,
  );
  await assert.rejects(() =>
    reopened.execute("pebble_list_tasks", { limit: 10001 }),
  );
});
test("stale GUI saves fail without losing AI tasks; position updates do not cause false conflicts", async (t) => {
  const service = await fixture(t);
  const stale = structuredClone(service.state);
  await service.execute("pebble_add_task", { title: "Saved by AI" });
  await assert.rejects(
    () => service.save(stale),
    (error) => error.message === conflict,
  );
  assert.equal(service.state.tasks[0].title, "Saved by AI");
  const next = structuredClone(service.state);
  await service.update(
    (current) => ({
      ...current,
      settings: { ...current.settings, position: { x: 20, y: 30 } },
    }),
    { bump: false },
  );
  next.tasks.push(D.makeTask({ title: "Saved by user" }));
  await service.save(next);
  assert.equal(service.state.tasks.length, 2);
  assert.deepEqual(service.state.settings.position, { x: 20, y: 30 });
  const imported = D.createState();
  imported.settings.aiEnabled = false;
  await service.save(imported, true);
  assert.equal(
    service.state.settings.aiEnabled,
    true,
    "backups do not change local AI access",
  );
});
test("AI context uses the machine timezone and category results include both languages", async (t) => {
  const service = await fixture(t);
  const context = await service.execute("pebble_get_context");
  assert.equal(context.date, D.localDate());
  assert.equal(
    context.timeZone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const categories = await service.execute("pebble_list_categories");
  assert.deepEqual(categories.categories.find((c) => c.id === "study").names, {
    en: "Study",
    zh: "学习",
  });
  const added = await service.execute("pebble_add_task", {
    title: "复习 CV",
    categoryId: "study",
    time: { mode: "range", start: "23:30", end: "01:00" },
  });
  assert.equal(added.task.time.durationMinutes, 90);
  assert.equal(added.task.time.overnight, true);
});
test("private bridge requires a token, rejects browser origins and invalid hosts, and removes discovery on stop", async (t) => {
  const service = await fixture(t);
  const bridge = await startBridge(service.store.directory, (method, args) =>
    service.execute(method, args),
  );
  t.after(() => bridge.close());
  const file = path.join(service.store.directory, "ai", "connection.json");
  const connection = JSON.parse(await fs.readFile(file, "utf8"));
  const url = `http://127.0.0.1:${connection.port}/rpc`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${connection.token}`,
  };
  const body = JSON.stringify({ method: "pebble_get_context", args: {} });
  assert.equal(
    (
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(url, {
        method: "POST",
        headers: { ...headers, Origin: "https://example.com" },
        body,
      })
    ).status,
    403,
  );
  const invalidHostStatus = await new Promise((resolve, reject) => {
    const request = http.request(
      url,
      { method: "POST", headers: { ...headers, Host: "attacker.example" } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    request.on("error", reject);
    request.end(body);
  });
  assert.equal(invalidHostStatus, 403);
  assert.equal(
    (await fetch(url, { method: "POST", headers, body: "{}" })).status,
    400,
  );
  assert.equal(
    (await fetch(url, { method: "POST", headers, body })).status,
    200,
  );
  assert.equal(
    (await fetch(url, { method: "POST", headers, body: " ".repeat(70000) }))
      .status,
    413,
  );
  await bridge.close();
  await assert.rejects(() => fs.access(file));
});
test(
  "bridge shutdown lets an accepted operation return before removing discovery",
  { timeout: 3000 },
  async (t) => {
    const service = await fixture(t);
    let accept, finish;
    const accepted = new Promise((resolve) => {
      accept = resolve;
    });
    const completed = new Promise((resolve) => {
      finish = resolve;
    });
    const bridge = await startBridge(service.store.directory, async () => {
      accept();
      await completed;
      return { saved: true };
    });
    t.after(() => bridge.close());
    const connection = JSON.parse(
      await fs.readFile(
        path.join(service.store.directory, "ai", "connection.json"),
        "utf8",
      ),
    );
    const response = fetch(`http://127.0.0.1:${connection.port}/rpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.token}`,
      },
      body: JSON.stringify({ method: "pebble_get_context" }),
    });
    await accepted;
    const closing = bridge.close();
    finish();
    assert.deepEqual(await (await response).json(), {
      result: { saved: true },
    });
    await closing;
  },
);

test("client configuration safely preserves Unicode and Windows paths without embedding a token", () => {
  const configs = configurations(
    "D:\\Work\\找工\\mcp\\pebble-mcp.cjs",
    "C:\\Users\\Test User\\Pebble",
  );
  assert.deepEqual(JSON.parse(configs.claude).mcpServers.pebble.args, [
    "D:/Work/找工/mcp/pebble-mcp.cjs",
    "--data-dir=C:/Users/Test User/Pebble",
  ]);
  assert.ok(configs.codex.startsWith("[mcp_servers.pebble]"));
  assert.equal(/token/i.test(configs.codex + configs.claude), false);
});
