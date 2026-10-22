const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const ownedFiles = ["SKILL.md", "references/arguments.md", "scripts/pebble.cjs", "run.cmd", "run.sh"];
const manifestName = ".pebble-skill.json";
const conflict = "A different or edited Pebble Skill already exists. Back it up or rename it before installing.";
const shellQuote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
function launchers(executable, directory) {
  if (![executable, directory].every((value) => typeof value === "string" && path.isAbsolute(value) && !/[\r\n\x00"]/.test(value))) throw new Error("Invalid Pebble installation path.");
  const batch = (value) => value.replaceAll("%", "%%");
  return {
    "run.cmd": `@echo off\r\nsetlocal DisableDelayedExpansion\r\nchcp 65001 >nul\r\nset "ELECTRON_RUN_AS_NODE=1"\r\n"${batch(executable)}" "%~dp0scripts\\pebble.cjs" "--data-dir=${batch(directory)}" %*\r\nexit /b %errorlevel%\r\n`,
    "run.sh": `#!/bin/sh\nset -eu\npebble_skill_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec env ELECTRON_RUN_AS_NODE=1 ${shellQuote(executable)} "$pebble_skill_dir/scripts/pebble.cjs" ${shellQuote("--data-dir=" + directory)} "$@"\n`,
  };
}
async function absentOrRegular(file, directory = false) {
  try {
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error(conflict);
    return true;
  } catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
async function installSkill(client, { executable, directory, home = os.homedir(), source = path.join(__dirname, "../skills/pebble-todo") }) {
  const relative = { codex: [".agents", "skills"], "claude-code": [".claude", "skills"] }[client];
  if (!relative) throw new Error("Unknown Skill client.");
  const target = path.join(home, ...relative, "pebble-todo");
  const files = launchers(executable, directory);
  for (const name of ["SKILL.md", "references/arguments.md", "scripts/pebble.cjs"]) files[name] = await fs.readFile(path.join(source, name));
  const hashes = Object.fromEntries(Object.entries(files).map(([name, value]) => [name, hash(value)]));
  const exists = await absentOrRegular(target, true);
  if (exists) {
    let previous;
    try {
      await absentOrRegular(path.join(target, manifestName));
      previous = JSON.parse(await fs.readFile(path.join(target, manifestName), "utf8"));
    } catch { throw new Error(conflict); }
    if (previous.product !== "Pebble" || previous.version !== 1 || !previous.files || Object.keys(previous.files).sort().join() !== [...ownedFiles].sort().join()) throw new Error(conflict);
    for (const folder of ["references", "scripts"]) await absentOrRegular(path.join(target, folder), true);
    for (const name of ownedFiles) {
      const file = path.join(target, name);
      if (!(await absentOrRegular(file)) || hash(await fs.readFile(file)) !== previous.files[name]) throw new Error(conflict);
    }
  } else {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.mkdir(target); // Do not take ownership of a concurrently created directory.
  }
  for (const folder of ["references", "scripts"]) await fs.mkdir(path.join(target, folder), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(target, name);
    await fs.writeFile(file, content, { flag: exists ? "w" : "wx", mode: name === "run.sh" ? 0o755 : 0o644 });
  }
  await fs.writeFile(path.join(target, manifestName), JSON.stringify({ product: "Pebble", version: 1, files: hashes }, null, 2), { mode: 0o600 });
  return { client, path: target };
}
module.exports = { installSkill, launchers };
