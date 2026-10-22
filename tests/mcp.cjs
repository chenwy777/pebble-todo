const { _electron: electron, expect } = require("playwright/test");
const { Client } = require("@modelcontextprotocol/client");
const { StdioClientTransport } = require("@modelcontextprotocol/client/stdio");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
async function legacy(script, directory, version) {
  const child = spawn(process.execPath, [script, `--data-dir=${directory}`], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const pending = new Map();
  let id = 0;
  const lines = readline.createInterface({ input: child.stdout });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  lines.on("line", (line) => {
    const message = JSON.parse(line);
    if (message.id !== undefined) {
      const entry = pending.get(message.id);
      if (entry) {
        pending.delete(message.id);
        clearTimeout(entry.timer);
        message.error
          ? entry.reject(new Error(JSON.stringify(message.error)))
          : entry.resolve(message.result);
      }
    }
  });
  child.on("exit", (code) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error(`MCP exited ${code}: ${stderr}`));
    }
    pending.clear();
  });
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Timeout: ${method}`));
      }, 10000);
      pending.set(requestId, { resolve, reject, timer });
      child.stdin.write(
        JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }) +
          "\n",
      );
    });
  try {
    const init = await request("initialize", {
      protocolVersion: version,
      capabilities: {},
      clientInfo: { name: "pebble-legacy-check", version: "1.0.0" },
    });
    assert.ok(init.capabilities.tools);
    child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) +
        "\n",
    );
    assert.equal((await request("tools/list", {})).tools.length, 4);
    const context = await request("tools/call", {
      name: "pebble_get_context",
      arguments: {},
    });
    assert.notEqual(context.isError, true);
  } finally {
    child.stdin.end();
    lines.close();
    child.kill();
  }
}
async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pebble-mcp-"));
  const executable = process.env.PEBBLE_TEST_EXECUTABLE;
  const script = executable
    ? path.join(path.dirname(executable), "resources", "mcp", "pebble-mcp.cjs")
    : path.join(root, "mcp", "dist", "pebble-mcp.cjs");
  let app, client;
  async function launch() {
    app = await electron.launch({
      ...(executable ? { executablePath: executable } : {}),
      args: [
        ...(executable ? [] : [root]),
        "--smoke-test",
        "--enable-ai",
        `--data-dir=${directory}`,
      ],
    });
    return app.firstWindow();
  }
  try {
    let page = await launch();
    await expect(page.locator("#panel")).toBeVisible();
    client = new Client({ name: "pebble-mcp-check", version: "1.0.0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [script, `--data-dir=${directory}`],
        stderr: "pipe",
      }),
    );
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 4);
    assert.equal(
      tools.tools.find((t) => t.name === "pebble_list_tasks").annotations
        .readOnlyHint,
      true,
    );
    const call = async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return result.structuredContent || JSON.parse(result.content[0].text);
    };
    const context = await call("pebble_get_context");
    assert.match(context.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(
      (await call("pebble_list_categories")).categories.find(
        (c) => c.id === "study",
      ).names.zh,
      "学习",
    );
    const arguments_ = {
      title: "MCP / 复习 CV",
      categoryId: "study",
      date: context.date,
      time: { mode: "range", start: "23:30", end: "01:00" },
      requestId: "integration-add",
    };
    const added = await call("pebble_add_task", arguments_);
    assert.equal(added.task.time.durationMinutes, 90);
    await expect(page.locator(".task-title")).toHaveText(arguments_.title);
    await expect(page.locator("#orb-count")).toHaveText("1");
    assert.equal(
      (await call("pebble_add_task", arguments_)).task.id,
      added.task.id,
    );
    assert.equal(
      (await call("pebble_list_tasks", { status: "todo" })).total,
      1,
    );
    const stale = (await page.evaluate(() => window.desktop.load())).state;
    await page.locator(".task-body").click();
    await page.locator("#task-title").fill("User draft / 用户草稿");
    await call("pebble_add_task", {
      title: "AI added while editor is open",
      requestId: "second-add",
    });
    await expect(page.locator("#task-title")).toHaveValue(
      "User draft / 用户草稿",
    );
    const conflict = await page.evaluate(async (snapshot) => {
      try {
        await window.desktop.save(snapshot);
        return "saved";
      } catch (error) {
        return error.message;
      }
    }, stale);
    assert.match(conflict, /list changed/);
    await page.locator("#save-task").click();
    await expect(page.locator(".task-title")).toHaveCount(2);
    await expect(page.locator("#orb-count")).toHaveText("2");
    assert.equal(
      (await call("pebble_list_tasks", { query: "用户草稿" })).total,
      1,
    );
    const invalid = await client.callTool({
      name: "pebble_add_task",
      arguments: { title: "Invalid", categoryId: "no-such-category" },
    });
    assert.equal(invalid.isError, true);
    assert.equal((await call("pebble_list_tasks")).total, 2);
    for (const version of ["2024-11-05", "2025-06-18", "2025-11-25"])
      await legacy(script, directory, version);
    await page.locator("#settings-button").click();
    await page.locator("#settings-ai").click();
    await expect(page.locator("#ai-enabled")).toBeChecked();
    await expect(page.locator("#ai-enabled")).toHaveCSS("width", "14px");
    // Inspect the outgoing configuration without replacing the user's system clipboard.
    await app.evaluate(({ clipboard }) => {
      clipboard.writeText = (value) => {
        globalThis.pebbleClipboardTest = value;
      };
    });
    await page.locator("#copy-codex").click();
    assert.match(
      await app.evaluate(() => globalThis.pebbleClipboardTest),
      /\[mcp_servers.pebble\]/,
    );
    await page.locator("#copy-claude").click();
    const config = JSON.parse(
      await app.evaluate(() => globalThis.pebbleClipboardTest),
    );
    assert.ok(config.mcpServers.pebble.args[0].endsWith(".cjs"));
    await page.locator("#ai-enabled").uncheck();
    await expect
      .poll(async () => {
        try {
          await fs.access(path.join(directory, "ai", "connection.json"));
          return true;
        } catch {
          return false;
        }
      })
      .toBe(false);
    assert.equal(
      (await client.callTool({ name: "pebble_list_tasks", arguments: {} }))
        .isError,
      true,
    );
    await page.locator("#ai-enabled").check();
    await expect
      .poll(async () => {
        try {
          return (await call("pebble_list_tasks")).total;
        } catch {
          return -1;
        }
      })
      .toBe(2);
    await page.screenshot({
      path: path.join(root, "test-results", "ai-connections.png"),
      omitBackground: true,
      scale: "css",
    });
    await app.close();
    assert.equal(
      (await client.callTool({ name: "pebble_list_tasks", arguments: {} }))
        .isError,
      true,
    );
    page = await launch();
    await expect(page.locator(".task-title")).toHaveCount(2);
    assert.equal((await call("pebble_list_tasks")).total, 2);
    assert.equal((await call("pebble_add_task", arguments_)).reused, true);
    await expect(page.locator("#orb-count")).toHaveText("2");
    console.log(
      "PASS: MCP v2 and three legacy revisions / live UI and count / category IDs / time range / idempotency / stale save protection / editor draft / disable and enable / restart / configuration clipboard",
    );
  } finally {
    if (client) await client.close().catch(() => {});
    if (app) await app.close().catch(() => {});
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
