const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
(async () => {
  const directory = path.resolve(process.argv[2] || "release");
  const files = fs
    .readdirSync(directory)
    .filter((name) => /\.(exe|zip|dmg)$/.test(name))
    .sort();
  if (!files.length) throw new Error("No release assets found.");
  const lines = [];
  for (const name of files) {
    const hash = createHash("sha256");
    for await (const chunk of fs.createReadStream(path.join(directory, name)))
      hash.update(chunk);
    lines.push(`${hash.digest("hex")}  ${name}`);
  }
  fs.writeFileSync(
    path.join(directory, "SHA256SUMS.txt"),
    lines.join("\n") + "\n",
  );
  console.log(`Checksums written for ${files.length} installers / archives.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
