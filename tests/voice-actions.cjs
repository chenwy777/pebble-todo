const { _electron: electron, expect } = require("playwright/test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const D = require("../src/domain.js");
const root = path.resolve(__dirname, "..");
async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pebble-intents-"));
  const state = D.createState();
  state.settings.pinned = true;
  state.tasks = [
    D.makeTask({ title: "meeting" }),
    D.makeTask({ title: "team meeting", status: "doing" }),
    D.makeTask({ title: "morning standup" }),
    D.makeTask({ title: "afternoon standup", status: "doing" }),
    D.makeTask({ title: "already", status: "done" }),
  ];
  await fs.writeFile(path.join(directory, "tasks.json"), JSON.stringify(state));
  const executable = process.env.PEBBLE_TEST_EXECUTABLE;
  const app = await electron.launch({ ...(executable ? { executablePath: executable } : {}), args: [...(executable ? [] : [root]), "--smoke-test", `--data-dir=${directory}`] });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(page.locator("#panel")).toBeVisible();
    const saved = () => page.evaluate(async () => (await window.desktop.load()).state);
    async function review(text) {
      await page.locator("#voice-button").click();
      await page.locator("#voice-transcript").fill(text);
      await page.locator("#voice-review").click();
    }
    async function apply() {
      await page.locator("#voice-apply").click();
      await expect(page.locator("#voice-dialog")).not.toBeVisible();
    }
    await review("Complete the meeting.");
    await expect(page.locator("#voice-preview strong")).toHaveText("Move to Done");
    await expect(page.locator('input[name="voice-target"]')).toHaveCount(1);
    await expect(page.locator("#voice-category")).toHaveCount(0);
    await page.screenshot({ path: path.join(root, "test-results/voice-complete-preview.png") });
    await apply();
    let data = await saved();
    assert.equal(data.tasks.length, 5, "complete must not insert another task");
    assert.equal(data.tasks.find((task) => task.title === "meeting").status, "done");
    assert.equal(data.tasks.find((task) => task.title === "team meeting").status, "doing");
    await expect(page.locator('[data-tab="done"]')).toHaveClass(/active/);
    await review("Complete the meeting");
    await expect(page.locator("#voice-preview")).toHaveText("Matching tasks are already in Done.");
    await expect(page.locator("#voice-apply")).toBeHidden();
    await page.locator("#voice-dialog .dialog-close").click();
    await review("Start the meeting");
    await expect(page.locator("#voice-preview strong")).toHaveText("Move to Doing");
    await apply();
    data = await saved();
    assert.equal(data.tasks.find((task) => task.title === "meeting").status, "doing");
    assert.equal(data.tasks.find((task) => task.title === "meeting").completedAt, null);
    await page.locator('[data-tab="done"]').click();
    await review("Reopen the meeting");
    await expect(page.locator("#voice-preview strong")).toHaveText("Move to To-do");
    await apply();
    assert.equal((await saved()).tasks.find((task) => task.title === "meeting").status, "todo");
    await review("Complete the nonexistent meeting");
    await expect(page.locator("#voice-preview")).toHaveText("No matching task found. No task will be added.");
    await expect(page.locator("#voice-apply")).toBeHidden();
    await page.locator("#voice-dialog .dialog-close").click();
    await page.locator('[data-tab="doing"]').click();
    await review("standup");
    await page.locator("#voice-action").selectOption("done");
    await expect(page.locator('input[name="voice-target"]')).toHaveCount(2);
    await page.locator("#voice-apply").click();
    await expect(page.locator("#voice-status")).toHaveText("Choose the task you finished.");
    await page.locator('input[name="voice-target"]').first().check();
    await apply();
    await review("Add a task review notes");
    await expect(page.locator("#voice-preview strong")).toHaveText("Add to To-do");
    await apply();
    data = await saved();
    assert.equal(data.tasks.find((task) => task.title === "review notes").status, "todo");
    assert.equal(data.tasks.length, 6);
    await review("Add reporting to done");
    await expect(page.locator("#voice-preview strong")).toHaveText("Add to Done");
    await apply();
    data = await saved();
    assert.equal(data.tasks.find((task) => task.title === "reporting").status, "done");
    assert.ok(data.tasks.find((task) => task.title === "reporting").completedAt);
    await review("Finish book");
    await page.locator("#voice-action").selectOption("add");
    await expect(page.locator("#voice-preview strong")).toHaveText("Add to To-do");
    await page.locator("#voice-dialog .dialog-close").click();
    await page.locator("#language-toggle").click();
    await review("完成会议");
    await expect(page.locator("#voice-preview strong")).toHaveText("移到已完成");
    await expect(page.locator('#voice-action option[value="auto"]')).toHaveText("自动识别");
    assert.deepEqual(errors, []);
    console.log("PASS: Complete the meeting from To-do / cross-tab start and reopen / already done / no-match no insertion / ambiguity / explicit add target / manual action / Chinese UI");
  } finally { await app.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
