const { _electron: electron, expect } = require("playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const execFile = promisify(require("node:child_process").execFile);
const root = path.resolve(__dirname, "..");
async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pebble-skill-ui-"));
  const home = path.join(directory, "Home with spaces");
  await fs.mkdir(path.join(home, ".codex"), { recursive: true });
  const configPath = path.join(home, ".codex/config.toml");
  await fs.writeFile(configPath, "# Keep my MCP config\n");
  const executable = process.env.PEBBLE_TEST_EXECUTABLE;
  const app = await electron.launch({ ...(executable ? { executablePath: executable } : {}), args: [...(executable ? [] : [root]), "--smoke-test", `--data-dir=${directory}`] });
  try {
    const page = await app.firstWindow();
    await expect(page.locator("#panel")).toBeVisible();
    await app.evaluate((_, fakeHome) => { process.getBuiltinModule("os").homedir = () => fakeHome; }, home);
    await page.locator("#settings-button").click();
    await page.locator("#settings-ai").click();
    await expect(page.locator("#copy-codex")).toBeVisible();
    await expect(page.locator("#copy-claude")).toBeVisible();
    for (const button of ["install-codex-skill", "install-claude-skill"]) {
      await page.locator("#" + button).click();
      await expect(page.locator("#skill-install-status")).toContainText("Skill installed.");
    }
    await expect(page.locator("#ai-enabled")).not.toBeChecked();
    await page.locator("#ai-enabled").check();
    await expect(page.locator("body")).not.toHaveClass(/save-busy/);
    const folder = path.join(home, ".agents/skills/pebble-todo");
    async function run(command, file) {
      const args = [command, ...(file ? ["--input-file", file] : [])];
      const output = process.platform === "win32"
        ? await execFile(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `""${path.join(folder, "run.cmd")}" ${args.map((x) => '"' + x + '"').join(" ")}"`], { windowsHide: true, windowsVerbatimArguments: true, timeout: 15000 })
        : await execFile("/bin/sh", [path.join(folder, "run.sh"), ...args], { timeout: 15000 });
      return JSON.parse(output.stdout);
    }
    assert.equal((await run("context")).ok, true);
    const input = path.join(directory, "事项 参数.json");
    await fs.writeFile(input, JSON.stringify({ title: "Skill integration / 中文", categoryId: "study", requestId: "ui-skill-once" }));
    assert.equal((await run("add", input)).ok, true);
    assert.equal((await run("add", input)).result.reused, true);
    await expect(page.locator("#count-todo")).toHaveText("1");
    await expect(page.locator("#orb-count")).toHaveText("1");
    assert.equal(await fs.readFile(configPath, "utf8"), "# Keep my MCP config\n");
    assert.ok(await fs.readFile(path.join(home, ".claude/skills/pebble-todo/SKILL.md"), "utf8"));
    await page.screenshot({ path: path.join(root, "test-results/skill-connections.png") });
    await page.locator("#ai-enabled").uncheck();
    await expect(page.locator("body")).not.toHaveClass(/save-busy/);
    let unavailable;
    try { await run("context"); } catch (error) { unavailable = JSON.parse(error.stderr); }
    assert.equal(unavailable.ok, false);
    await page.locator("#ai-dialog .dialog-close").click();
    await page.locator("#settings-dialog .dialog-close").click();
    await page.locator("#language-toggle").click();
    await page.locator("#settings-button").click();
    await page.locator("#settings-ai").click();
    await expect(page.locator("#install-codex-skill")).toHaveText("安装 Codex Skill");
    console.log("PASS: Skill install buttons / real bundled runtime / authorized live additions / retry dedup / unchanged MCP settings / permission off / Chinese UI");
  } finally { await app.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
