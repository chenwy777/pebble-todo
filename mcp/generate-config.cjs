const fs = require("node:fs");
const path = require("node:path");
const { configurations } = require("../electron/ai-config.cjs");
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const script = option("script"),
  directory = option("data-dir"),
  output = option("out");
if (!script || !directory || !output)
  throw new Error(
    "Use --script=ABSOLUTE_PATH --data-dir=ABSOLUTE_PATH --out=FOLDER",
  );
const node = option("node") || process.execPath;
const config = configurations(
  path.resolve(script),
  path.resolve(directory),
  node,
);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "codex.toml"), config.codex);
fs.writeFileSync(path.join(output, "claude.json"), config.claude + "\n");
const quote = (value) =>
  process.platform === "win32"
    ? `'${value.replaceAll("'", "''")}'`
    : `'${value.replaceAll("'", "'\"'\"'")}'`;
const command = [
  node,
  path.resolve(script),
  `--data-dir=${path.resolve(directory)}`,
]
  .map(quote)
  .join(" ");
fs.writeFileSync(
  path.join(output, "setup-commands.txt"),
  `codex mcp add pebble -- ${command}\n\nclaude mcp add --transport stdio --scope user pebble -- ${command}\n`,
);
console.log(`Configuration files written to ${path.resolve(output)}`);
