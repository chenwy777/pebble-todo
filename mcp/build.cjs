const path = require("node:path");
const fs = require("node:fs");
require("esbuild").buildSync({
  entryPoints: [path.join(__dirname, "entry.cjs")],
  outfile: path.join(__dirname, "dist", "pebble-mcp.cjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  minify: false,
  banner: {
    js: "// Pebble MCP bridge. Requires Node.js 20+. Bundled for local stdio clients.",
  },
});
const notices = [
  "@modelcontextprotocol/server",
  "@modelcontextprotocol/core",
  "zod",
]
  .map((name) => {
    const directory = path.join(__dirname, "..", "node_modules", name);
    const info = JSON.parse(
      fs.readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    return `${name} ${info.version}\n\n${fs.readFileSync(path.join(directory, "LICENSE"), "utf8")}`;
  })
  .join("\n\n----------------\n\n");
fs.writeFileSync(
  path.join(__dirname, "dist", "THIRD-PARTY-NOTICES.txt"),
  notices,
);
fs.copyFileSync(
  path.join(__dirname, "..", "docs", "ai.md"),
  path.join(__dirname, "dist", "README.md"),
);
