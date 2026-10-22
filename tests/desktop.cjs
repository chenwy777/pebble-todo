const { _electron: electron, expect } = require("playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pebble-desktop-"));
  const results = path.join(root, "test-results");
  await fs.mkdir(results, { recursive: true });
  let app;
  const errors = [];
  async function nativeMenuLabels() {
    return app.evaluate(({ Menu, ipcMain }) => {
      const original = Menu.buildFromTemplate;
      let labels;
      try {
        Menu.buildFromTemplate = (items) => ({
          popup() {
            labels = items
              .filter((item) => item.label)
              .map((item) => item.label);
          },
        });
        ipcMain.emit("window:menu");
        return labels;
      } finally {
        Menu.buildFromTemplate = original;
      }
    });
  }
  async function launch() {
    const executable = process.env.PEBBLE_TEST_EXECUTABLE;
    app = await electron.launch({
      ...(executable ? { executablePath: executable } : {}),
      args: [
        ...(executable ? [] : [root]),
        "--smoke-test",
        `--data-dir=${directory}`,
      ],
    });
    const page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(page.locator("#panel")).toBeVisible();
    return page;
  }
  try {
    let page = await launch();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    assert.deepEqual(await nativeMenuLabels(), [
      "Collapse",
      "Pin open",
      "Quit Pebble",
    ]);
    await expect(page.locator("#quick-title")).toHaveAttribute(
      "placeholder",
      "Add a task…",
    );
    assert.equal(
      await page
        .locator("body")
        .innerText()
        .then((text) => /[\u4e00-\u9fff]/.test(text.replace("中文", ""))),
      false,
    );
    await expect(
      page.locator('#quick-category option[value="life"]'),
    ).toHaveText("Personal");
    await expect(
      page.locator('#quick-category option[value="career"]'),
    ).toHaveCount(0);
    await page.locator("#quick-title").fill("整理资料 / Review notes");
    await page.locator("#quick-category").selectOption("life");
    await page.locator("#schedule-button").click();
    await page
      .locator(".time-modes label")
      .filter({ hasText: "Time range" })
      .click();
    await page.locator("#time-start").fill("23:30");
    await page.locator("#time-end").fill("23:30");
    await page.locator("#save-task").click();
    await expect(page.locator("#task-error")).toHaveText(
      "Start and end times must be different.",
    );
    await page.locator("#time-end").fill("01:00");
    await expect(page.locator("#time-preview")).toContainText(
      "next day 01:00 · 1h 30m",
    );
    await page.locator("#today-button").click();
    await page.locator("#save-task").click();
    await expect(page.locator(".task-title")).toHaveText(
      "整理资料 / Review notes",
    );
    await expect(page.locator(".task-schedule")).toContainText(
      "next day 01:00",
    );
    await page.locator(".status-button").click();
    await page.locator('[data-tab="doing"]').click();
    await expect(page.locator(".task-title")).toHaveCount(1);
    await page.locator(".status-button").click();
    await page.locator('[data-tab="done"]').click();
    await expect(page.locator(".task-card.completed")).toHaveCount(1);
    await page.locator('[data-tab="templates"]').click();
    await page
      .locator('[data-template-id="swim"] [data-action="use-template"]')
      .click();
    await page.locator("#task-status").selectOption("doing");
    await expect(page.locator("#time-preview")).toContainText("1h");
    await page.locator("#save-task").click();
    await page.locator('[data-tab="doing"]').click();
    await expect(page.locator(".task-title")).toHaveText("Swimming");
    await page.locator(".task-body").click();
    await page
      .locator(".time-modes label")
      .filter({ hasText: "Time range" })
      .click();
    await page.locator("#time-start").fill("14:30");
    await page.locator("#calculate-toggle").click();
    await page.locator("#calc-hours").fill("1");
    await page.locator("#calc-minutes").fill("45");
    await page.locator("#apply-duration").click();
    await expect(page.locator("#time-end")).toHaveValue("16:15");
    await expect(page.locator("#time-preview")).toContainText("1h 45m");
    await page.screenshot({
      path: path.join(results, "time-editor.png"),
      omitBackground: true,
    });
    await page.locator("#save-task").click();
    await page.locator("#quick-category").selectOption("__new");
    await expect(page.locator("#category-dialog")).toBeVisible();
    await page.locator("#category-name").fill("创作");
    await page.locator("#category-form button").click();
    await expect(
      page.locator('#category-manager input[type="text"]'),
    ).toHaveCount(4);
    await expect(page.locator("#toast-message")).toHaveText("Category added");
    const study = page.locator('[data-category-id="study"] input[type="text"]');
    await study.fill("Research / 研究");
    await study.press("Tab");
    await expect(page.locator("#toast-message")).toHaveText("Category updated");
    await page.screenshot({
      path: path.join(results, "categories.png"),
      omitBackground: true,
      scale: "css",
    });
    await page.locator("#category-dialog .dialog-close").click();
    await expect(page.locator("#quick-category option:checked")).toHaveText(
      "创作",
    );
    await page.locator('[data-tab="todo"]').click();
    await page.locator("#quick-title").fill("<img src=x onerror=alert(1)>");
    await page.locator("#quick-form").evaluate((form) => form.requestSubmit());
    await expect(page.locator(".task-title")).toHaveText(
      "<img src=x onerror=alert(1)>",
    );
    assert.equal(await page.locator(".task-title img").count(), 0);
    await page.locator(".task-delete").click();
    await expect(page.locator(".task-title")).toHaveCount(0);
    await page.locator("#undo").click();
    await expect(page.locator(".task-title")).toHaveCount(1);
    await page.locator(".task-delete").click();
    await expect(page.locator(".task-title")).toHaveCount(0);
    for (const [title, category] of [
      ["整理资料 · Notes", "life"],
      ["读 20 页书", "study"],
      ["晚间散步 · Evening walk", "sport"],
    ]) {
      await page.locator("#quick-category").selectOption(category);
      await page.locator("#quick-title").fill(title);
      await page
        .locator("#quick-form")
        .evaluate((form) => form.requestSubmit());
      await expect(
        page.locator(".task-title").filter({ hasText: title }),
      ).toHaveCount(1);
    }
    await page.locator(".task-body").filter({ hasText: "整理资料" }).click();
    await page
      .locator(".time-modes label")
      .filter({ hasText: "Duration" })
      .click();
    await page.locator("#time-hours").fill("1");
    await page.locator("#time-minutes").fill("30");
    await page.locator("#today-button").click();
    await expect(page.locator("#time-preview")).toContainText("1h 30m");
    await page.locator("#save-task").click();
    await expect(
      page.locator(".task-schedule").filter({ hasText: "1h 30m" }),
    ).toHaveCount(1);
    await page.locator("#date-toggle").click();
    await expect(page.locator("#weekday")).toContainText("星期");
    await page.locator("#date-toggle").click();
    await expect(page.locator("#weekday")).not.toContainText("星期");
    await page.locator("#pin").click();
    await expect(page.locator("#pin")).toHaveAttribute("aria-pressed", "true");
    await page.locator("#dismiss-toast").click();
    const group = page.locator('[data-group="study"]');
    await group.locator('[data-action="toggle-group"]').click();
    await expect(group.locator(".task-group-items")).toBeHidden();
    await group.locator('[data-action="toggle-group"]').click();
    await expect(group.locator(".task-group-items")).toBeVisible();
    await page.locator("#pin").focus();
    await page.mouse.move(8, 8);
    await expect
      .poll(() =>
        page
          .locator(".task-card")
          .evaluateAll((rows) =>
            rows.every((row) => getComputedStyle(row).opacity === "1"),
          ),
      )
      .toBe(true);
    await page.screenshot({
      path: path.join(results, "desktop-expanded.png"),
      omitBackground: true,
      scale: "css",
    });
    const focusedRow = page.locator(".task-card").first();
    await focusedRow.hover();
    await expect
      .poll(() =>
        page
          .locator(".task-card")
          .nth(1)
          .evaluate((row) => Number(getComputedStyle(row).opacity)),
      )
      .toBeLessThan(0.6);
    await expect
      .poll(() =>
        focusedRow.evaluate(
          (row) => new DOMMatrixReadOnly(getComputedStyle(row).transform).a,
        ),
      )
      .toBeGreaterThan(1.01);
    await page.screenshot({
      path: path.join(results, "task-hover.png"),
      omitBackground: true,
      scale: "css",
    });
    await page.locator("#pin").hover();
    await expect
      .poll(() =>
        page
          .locator(".task-card")
          .evaluateAll((rows) =>
            rows.every((row) => getComputedStyle(row).opacity === "1"),
          ),
      )
      .toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await focusedRow.hover();
    await expect(focusedRow).toHaveCSS("transform", "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator('[data-tab="templates"]').click();
    await expect(page.locator('[data-template-id="cv"]')).toHaveCount(0);
    await page.screenshot({
      path: path.join(results, "templates.png"),
      omitBackground: true,
      scale: "css",
    });
    await page.locator('[data-tab="todo"]').click();
    await page.locator("#language-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    assert.deepEqual(await nativeMenuLabels(), [
      "收起",
      "固定展开",
      "退出 Pebble",
    ]);
    await expect(page.locator("#manage-categories")).toHaveText("管理分类");
    await expect(page.locator("#quick-title")).toHaveAttribute(
      "placeholder",
      "添加事项…",
    );
    await expect(
      page.locator('#quick-category option[value="study"]'),
    ).toHaveText("Research / 研究");
    await expect(
      page.locator('#quick-category option[value="life"]'),
    ).toHaveText("生活");
    await page.screenshot({
      path: path.join(results, "desktop-zh.png"),
      omitBackground: true,
      scale: "css",
    });
    // Native bounds, isolated preload and on-disk state are verified through the actual Electron process.
    const native = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      return {
        bounds: w.getBounds(),
        top: w.isAlwaysOnTop(),
        preferences: w.webContents.getLastWebPreferences(),
      };
    });
    assert.equal(native.top, true);
    assert.equal(native.preferences.nodeIntegration, false);
    assert.equal(native.preferences.contextIsolation, true);
    assert.ok(
      Math.abs(native.bounds.width - 448) <= 1,
      "native size accounts for display scaling rounding",
    );
    const saved = JSON.parse(
      await fs.readFile(path.join(directory, "tasks.json"), "utf8"),
    );
    assert.equal(saved.tasks.length, 5);
    assert.equal(saved.settings.dateLanguage, "zh");
    assert.equal(saved.settings.language, "zh");
    await app.close();
    page = await launch();
    await expect(page.locator(".task-title")).toHaveCount(3);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.locator("#weekday")).toContainText("星期");
    await page.locator("#collapse").click();
    await expect(page.locator("#panel")).toBeHidden();
    const bounds = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getBounds(),
    );
    assert.ok(Math.abs(bounds.width - 80) <= 1);
    assert.ok(Math.abs(bounds.height - 80) <= 1);
    await page.screenshot({
      path: path.join(results, "desktop-orb.png"),
      omitBackground: true,
      scale: "css",
    });
    await page.locator("#orb").hover();
    await expect(page.locator("#panel")).toBeVisible();
    // Exercise real file import/export while replacing only the native file pickers.
    const D = require("../src/domain.js");
    const imported = D.createState();
    imported.settings.pinned = true;
    imported.tasks.push(
      D.makeTask({ title: "从备份恢复的事项", categoryId: "study" }),
    );
    const importPath = path.join(directory, "import.json");
    const exportPath = path.join(directory, "export.json");
    await fs.writeFile(importPath, JSON.stringify(imported));
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [paths.importPath],
        });
        dialog.showMessageBox = async () => ({ response: 1 });
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: paths.exportPath,
        });
      },
      { importPath, exportPath },
    );
    await page.locator("#settings-button").click();
    await page.locator("#import-data").click();
    await expect(page.locator("#toast-message")).toHaveText("Backup imported");
    await expect(page.locator(".task-title")).toHaveText("从备份恢复的事项");
    await expect(page.locator("#pin")).toHaveAttribute("aria-pressed", "true");
    await page.locator("#export-data").click();
    await expect(page.locator("#toast-message")).toHaveText("Backup exported");
    assert.equal(
      JSON.parse(await fs.readFile(exportPath, "utf8")).tasks[0].title,
      "从备份恢复的事项",
    );
    await app.close();
    page = await launch();
    await expect(page.locator(".task-title")).toHaveText("从备份恢复的事项");
    await expect(page.locator("#pin")).toHaveAttribute("aria-pressed", "true");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: desktop add / edit / status / time / templates / categories / undo / safe text / restart / native collapse / hover / import / export / English defaults / Chinese switch / custom category edits",
    );
    console.log(`Screenshots: ${results}`);
  } catch (error) {
    if (app) {
      const page = await app.firstWindow().catch(() => null);
      if (page)
        await page
          .screenshot({
            path: path.join(results, "failure.png"),
            omitBackground: true,
          })
          .catch(() => {});
    }
    throw error;
  } finally {
    if (app) await app.close().catch(() => {});
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
