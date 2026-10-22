// Record real Electron UI interactions using disposable demo data.
const { _electron: electron, expect } = require("playwright/test");
const { Client } = require("@modelcontextprotocol/client");
const { StdioClientTransport } = require("@modelcontextprotocol/client/stdio");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const D = require("../src/domain.js");
const root = path.resolve(__dirname, "..");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function record(name, seed, actions) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pebble-demo-"));
  const output = path.join(root, "test-results", "demo-frames", name);
  await fs.mkdir(output, { recursive: true });
  const state = D.createState();
  state.settings.pinned = true;
  await seed(state);
  await fs.writeFile(path.join(directory, "tasks.json"), JSON.stringify(state));
  let app,
    running = false,
    pump;
  let caption = "",
    sequence = 0;
  const frames = [];
  try {
    app = await electron.launch({
      args: [root, "--smoke-test", `--data-dir=${directory}`],
    });
    const page = await app.firstWindow();
    await expect(page.locator("#panel")).toBeVisible();
    // The pointer overlay follows real mouse events; it does not simulate app state.
    await page.evaluate(() => {
      const pointer = document.createElement("div");
      pointer.id = "demo-pointer";
      pointer.style.cssText =
        "position:fixed;left:-50px;top:-50px;width:16px;height:21px;z-index:2147483647;pointer-events:none;background:#343b43;clip-path:polygon(0 0,0 92%,29% 68%,49% 100%,65% 91%,46% 60%,84% 60%);filter:drop-shadow(0 0 1px white)";
      document.body.append(pointer);
      document.addEventListener("mousemove", (event) => {
        pointer.style.left = event.clientX + "px";
        pointer.style.top = event.clientY + "px";
      });
    });
    const move = async (locator) => {
      const box = await locator.boundingBox();
      if (!box) throw new Error("Demo target missing");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
        steps: 8,
      });
    };
    const click = async (locator) => {
      await move(locator);
      await pause(160);
      await locator.click();
    };
    const label = async (text) => {
      caption = text;
      await pause(450);
    };
    const capture = async () => {
      const file = String(sequence++).padStart(5, "0") + ".png";
      await page.screenshot({
        path: path.join(output, file),
        omitBackground: true,
        scale: "css",
        timeout: 10000,
      });
      frames.push({ file, time: Date.now(), caption });
    };
    running = true;
    pump = (async () => {
      while (running) {
        await capture();
        await pause(100);
      }
    })();
    await actions({ app, page, directory, move, click, label, pause });
    await pause(900);
    running = false;
    await pump;
    await fs.writeFile(
      path.join(output, "frames.json"),
      JSON.stringify({ name, frames }, null, 2),
    );
    console.log(`${name}: ${frames.length} actual UI frames`);
  } finally {
    running = false;
    if (pump) await pump.catch(() => {});
    if (app) await app.close().catch(() => {});
    await fs.rm(directory, { recursive: true, force: true });
  }
}
async function collapse(ctx) {
  await ctx.click(ctx.page.locator("#collapse"));
  await expect(ctx.page.locator("#panel")).toBeHidden();
  await ctx.pause(350);
}
async function expand(ctx) {
  await ctx.move(ctx.page.locator("#orb"));
  await expect(ctx.page.locator("#panel")).toBeVisible();
  await ctx.pause(500);
  await ctx.click(ctx.page.locator("#pin"));
}
async function add(ctx, title, category) {
  await ctx.page.locator("#quick-category").selectOption(category);
  await ctx.click(ctx.page.locator("#quick-title"));
  await ctx.page
    .locator("#quick-title")
    .pressSequentially(title, { delay: 55 });
  await ctx.pause(250);
  await ctx.page.locator("#quick-title").press("Enter");
  await expect(
    ctx.page.locator(".task-title").filter({ hasText: title }),
  ).toHaveCount(1);
  await ctx.pause(600);
}
(async () => {
  await record(
    "quick-start",
    async () => {},
    async (ctx) => {
      const { page, label, click, move, pause } = ctx;
      await label("Hover to open · a clear glass orb");
      await collapse(ctx);
      await pause(800);
      await expand(ctx);
      await label("Add a task and choose a category");
      await add(ctx, "Review CV", "study");
      await add(ctx, "Go swimming", "sport");
      await page.locator("#pin").focus();
      await label("Hover a task to bring it into focus");
      await move(page.locator(".task-body").filter({ hasText: "Review CV" }));
      await pause(1500);
      await label("To-do → Doing → Done");
      await click(
        page
          .locator(".task-card")
          .filter({ hasText: "Review CV" })
          .locator(".status-button"),
      );
      await click(page.locator('[data-tab="doing"]'));
      await pause(700);
      await click(page.locator(".status-button"));
      await click(page.locator('[data-tab="done"]'));
      await pause(850);
      await label("The orb shows the number of remaining To-do items");
      await collapse(ctx);
      await pause(1200);
    },
  );
  await record(
    "categories-language",
    async (state) => {
      state.tasks.push(
        D.makeTask({ title: "Read 20 pages", categoryId: "study" }),
        D.makeTask({ title: "Cook dinner", categoryId: "life" }),
      );
    },
    async (ctx) => {
      const { page, label, click, pause } = ctx;
      await label("Create your own categories");
      await click(page.locator("#manage-categories"));
      await page
        .locator("#category-name")
        .pressSequentially("Creative projects", { delay: 55 });
      await click(page.locator("#category-form button"));
      await expect(page.locator(".category-entry")).toHaveCount(4);
      await label("Optional English and Chinese names");
      const category = page.locator(".category-entry").last();
      await click(category.locator("summary"));
      await category.locator('[data-language="zh"]').fill("创作");
      await category.locator('[data-language="zh"]').press("Tab");
      await pause(650);
      const id = await category.getAttribute("data-category-id");
      await click(page.locator("#category-dialog .dialog-close"));
      await add(ctx, "Plan the next video", id);
      await label("Switch the entire interface to Chinese");
      await click(page.locator("#language-toggle"));
      await expect(
        page.locator('[data-group="' + id + '"] .group-heading'),
      ).toContainText("创作");
      await pause(1400);
      await label("Click the date to change its language independently");
      await click(page.locator("#date-toggle"));
      await pause(1200);
    },
  );
  await record(
    "time-and-ai",
    async (state) => {
      state.settings.aiEnabled = true;
    },
    async (ctx) => {
      const { page, label, click, pause, directory } = ctx;
      await label("Set a time range · Pebble calculates the duration");
      await page.locator("#quick-category").selectOption("study");
      await page.locator("#quick-title").fill("Review CV");
      await click(page.locator("#schedule-button"));
      await click(
        page.locator(".time-modes label").filter({ hasText: "Time range" }),
      );
      await page.locator("#time-start").fill("19:00");
      await page.locator("#time-end").fill("20:30");
      await click(page.locator("#today-button"));
      await expect(page.locator("#time-preview")).toContainText("1h 30m");
      await pause(1400);
      await click(page.locator("#save-task"));
      await pause(850);
      await collapse(ctx);
      await label("A real MCP tool call adds a second task");
      const client = new Client({
        name: "pebble-documentation-demo",
        version: "1.0.0",
      });
      try {
        await client.connect(
          new StdioClientTransport({
            command: process.execPath,
            args: [
              path.join(root, "mcp", "dist", "pebble-mcp.cjs"),
              `--data-dir=${directory}`,
            ],
            stderr: "pipe",
          }),
        );
        const result = await client.callTool({
          name: "pebble_add_task",
          arguments: {
            title: "Read 20 pages",
            categoryId: "study",
            time: { mode: "duration", durationMinutes: 30 },
            requestId: "readme-demo-add",
          },
        });
        if (result.isError) throw new Error("Demo MCP add failed");
        await expect(page.locator("#orb-count")).toHaveText("2");
        await pause(1100);
        await label("The counter and list update automatically");
        await expand(ctx);
        await expect(page.locator(".task-title")).toHaveCount(2);
        await pause(1200);
      } finally {
        await client.close();
      }
    },
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
