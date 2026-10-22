const { _electron: electron, expect } = require("playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
async function main() {
  const directory = process.env.PEBBLE_TEST_VOICE_DATA || await fs.mkdtemp(path.join(os.tmpdir(), "pebble-features-"));
  await fs.mkdir(directory, { recursive: true });
  if (process.env.PEBBLE_TEST_MODEL_CACHE) await fs.cp(process.env.PEBBLE_TEST_MODEL_CACHE, path.join(directory, "voice-models"), { recursive: true });
  const executable = process.env.PEBBLE_TEST_EXECUTABLE;
  const app = await electron.launch({ ...(executable ? { executablePath: executable } : {}), args: [...(executable ? [] : [root]), "--smoke-test", `--data-dir=${directory}`, ...(process.env.PEBBLE_TEST_VOICE_AUDIO ? ["--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${process.env.PEBBLE_TEST_VOICE_AUDIO}`] : [])] });
  const errors = [];
  app.process().stderr.on("data", (data) => { if (/voice|error|exception|onnx/i.test(String(data))) console.log(String(data).slice(0, 1200)); });
  try {
    const page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await expect(page.locator("#panel")).toBeVisible();
    await page.locator("#pin").click();
    await page.locator("#manage-categories").click();
    await page.locator('[data-category-id="sport"] [data-field="emoji"]').fill("🏊");
    await page.locator('[data-category-id="sport"] [data-field="name"]').focus();
    await expect(page.locator("#toast-message")).toHaveText("Category updated");
    await page.locator('[data-palette-category="sport"][data-color="#43836a"]').click();
    await expect(page.locator('[data-palette-category="sport"][data-color="#43836a"]')).toHaveAttribute("aria-pressed", "true");
    assert.equal(await page.locator('[data-category-id="sport"] [data-field="name"]').evaluate((el) => getComputedStyle(el).color), "rgb(67, 131, 106)");
    await page.locator("#category-dialog .dialog-close").click();
    await page.locator("#quick-category").selectOption("sport");
    await page.locator("#quick-title").fill("swimming");
    await page.locator("#quick-title").press("Enter");
    await expect(page.locator(".group-heading")).toHaveText("›Exercise");
    if (await page.locator("#toast").isVisible()) await page.locator("#dismiss-toast").click();
    await page.locator('[data-select="quick-category"] .category-picker-trigger').click();
    await expect(page.locator('#category-popover [data-value="sport"]')).toHaveText("Exercise 🏊");
    assert.equal(await page.locator('#category-popover [data-value="sport"]').evaluate((el) => getComputedStyle(el).color), "rgb(67, 131, 106)");
    await page.screenshot({ path: path.join(root, "test-results/categories-popup.png"), omitBackground: true });
    await page.locator('#category-popover [data-value="sport"]').click();
    await expect(page.locator('[data-select="quick-category"] .category-picker-trigger')).toHaveText("Exercise");
    const colored = await page.locator(".task-title").evaluate((el) => getComputedStyle(el).color);
    assert.equal(colored, "rgb(41, 44, 43)", "main task text remains neutral");
    assert.equal(await page.locator(".group-heading").evaluate((el) => getComputedStyle(el).color), colored, "main category heading remains neutral");
    await page.locator("#voice-button").click();
    await page.locator("#voice-transcript").fill("我下午三点有一个会，帮我记录一下");
    await page.locator("#voice-review").click();
    await expect(page.locator("#voice-preview")).toContainText("15:00");
    await page.locator("#voice-apply").click();
    await expect(page.locator("#voice-dialog")).not.toBeVisible();
    await expect(page.locator(".task-schedule")).toContainText("15:00");
    await page.locator("#voice-button").click();
    await page.locator("#voice-transcript").fill("我现在游完泳了");
    await page.locator("#voice-review").click();
    await expect(page.locator("#voice-preview")).toContainText("swimming");
    await page.locator("#voice-apply").click();
    await expect(page.locator("#voice-dialog")).not.toBeVisible();
    await expect(page.locator(".task-title")).toHaveText("swimming");
    await expect(page.locator("#count-done")).toHaveText("1");
    // A duplicate completion must require explicit selection.
    await page.locator('[data-tab="todo"]').click();
    for (let i = 0; i < 2; i++) {
      await page.locator("#quick-title").fill("swimming");
      await page.locator("#quick-title").press("Enter");
      await expect(page.locator("#count-todo")).toHaveText(String(i + 2));
    }
    await page.locator("#voice-button").click();
    await page.locator("#voice-transcript").fill("I finished swimming");
    await page.locator("#voice-review").click();
    await expect(page.locator('input[name="voice-target"]')).toHaveCount(2);
    await page.locator("#voice-apply").click();
    await expect(page.locator("#voice-status")).toHaveText("Choose the task you finished.");
    await expect(page.locator("#count-done")).toHaveText("1");
    if (process.env.PEBBLE_TEST_VOICE_AUDIO) {
      await page.locator("#voice-transcript").fill("");
      await page.locator("#voice-language").selectOption(process.env.PEBBLE_TEST_VOICE_LANGUAGE || "en");
      await page.locator("#voice-record").click();
      await page.waitForFunction(() => document.getElementById("voice-record").dataset.recording === "true" || document.getElementById("voice-status").textContent.includes("unavailable"), null, { timeout: 180000 });
      console.log("Voice status:", await page.locator("#voice-status").textContent());
      await expect(page.locator("#voice-record")).toHaveAttribute("data-recording", "true");
      await page.waitForTimeout(3500);
      await page.locator("#voice-record").click();
      await page.waitForFunction(() => /Review the transcript|unavailable|No speech/.test(document.getElementById("voice-status").textContent), null, { timeout: 120000 });
      console.log("Recognition result:", await page.locator("#voice-status").textContent());
      await expect(page.locator("#voice-transcript")).toHaveValue(process.env.PEBBLE_TEST_VOICE_LANGUAGE === "zh" ? /游.*泳/ : /finished swimming/i);
      console.log("PASS: real local Whisper transcription:", await page.locator("#voice-transcript").inputValue());
    }
    await page.locator('input[name="voice-target"]').first().check();
    await page.locator("#voice-apply").click();
    await expect(page.locator("#count-done")).toHaveText("2");
    await page.locator("#language-toggle").click();
    await page.locator("#voice-button").click();
    await expect(page.locator("#voice-dialog h2")).toHaveText("语音输入");
    await page.locator("#voice-dialog .dialog-close").click();
    await page.locator('[data-tab="todo"]').click();
    await page.screenshot({ path: path.join(root, "test-results/features.png"), omitBackground: true });
    assert.deepEqual(errors, []);
    console.log("PASS: category palette / emoji / neutral main list / voice command preview / ambiguity / local time / Chinese UI");
  } catch (error) {
    console.error("Feature check failed:", error);
    const page = app.windows()[0];
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(root, "test-results/features-failure.png") }).catch(() => {});
    throw error;
  } finally { await app.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
