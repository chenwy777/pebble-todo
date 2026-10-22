const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const methods = { context: "pebble_get_context", categories: "pebble_list_categories", tasks: "pebble_list_tasks", add: "pebble_add_task" };
const unavailable = "Pebble is not running or AI access is off. Open Pebble → Settings → AI connections and allow AI access.";
async function call(directory, command, args) {
  let connection;
  try { connection = JSON.parse(await fs.readFile(path.join(directory, "ai", "connection.json"), "utf8")); }
  catch { throw new Error(unavailable); }
  if (connection.version !== 1 || !Number.isInteger(connection.port) || connection.port < 1 || connection.port > 65535 || typeof connection.token !== "string" || !/^[a-f0-9]{64}$/.test(connection.token)) throw new Error("Invalid Pebble connection. Restart Pebble.");
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ method: methods[command], args });
    if (Buffer.byteLength(body) > 65536) return reject(new Error("Request is too large."));
    const request = http.request({ hostname: "127.0.0.1", port: connection.port, path: "/rpc", method: "POST", headers: { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (response) => {
      let size = 0;
      const chunks = [];
      response.on("data", (chunk) => { size += chunk.length; if (size > 2097152) request.destroy(new Error("Response is too large.")); else chunks.push(chunk); });
      response.on("error", reject);
      response.on("end", () => {
        try {
          const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (response.statusCode !== 200 || value.error) reject(new Error(value.error || "Pebble request failed."));
          else resolve(value.result);
        } catch { reject(new Error("Invalid Pebble response.")); }
      });
    });
    request.setTimeout(8000, () => request.destroy(new Error("Pebble timed out. Check the list before retrying and reuse the requestId.")));
    request.on("error", (error) => reject(new Error(error.code === "ECONNREFUSED" ? unavailable : error.message)));
    request.end(body);
  });
}
async function main(argv) {
  let directory = path.join(process.platform === "win32" ? process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming") : process.platform === "darwin" ? path.join(os.homedir(), "Library", "Application Support") : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "Pebble");
  const flags = {};
  let command;
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    const flag = value.split("=", 1)[0];
    if (["--data-dir", "--input-file"].includes(flag)) {
      if (Object.hasOwn(flags, flag)) throw new Error("Duplicate option.");
      flags[flag] = value.includes("=") ? value.slice(value.indexOf("=") + 1) : argv[++i];
      if (!flags[flag]) throw new Error("Missing option value.");
    } else if (!command && Object.hasOwn(methods, value)) command = value;
    else throw new Error("Use context, categories, tasks or add, with optional --input-file JSON-path.");
  }
  if (!command) throw new Error("Choose context, categories, tasks or add.");
  if (flags["--data-dir"]) directory = path.resolve(flags["--data-dir"]);
  let args = {};
  if (flags["--input-file"]) {
    const file = flags["--input-file"];
    if ((await fs.stat(file)).size > 65536) throw new Error("Input file is too large.");
    args = JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""));
    if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Input must be a JSON object.");
  }
  if (command === "add") args.requestId ||= randomUUID();
  try {
    const result = await call(directory, command, args);
    return { ok: true, result, ...(command === "add" ? { requestId: args.requestId } : {}) };
  } catch (error) {
    return { ok: false, error: error.message, ...(command === "add" ? { requestId: args.requestId } : {}) };
  }
}
if (require.main === module) main(process.argv.slice(2)).then((value) => { (value.ok ? process.stdout : process.stderr).write(JSON.stringify(value) + "\n"); if (!value.ok) process.exitCode = 1; }).catch((error) => { process.stderr.write(JSON.stringify({ ok: false, error: error.message }) + "\n"); process.exitCode = 1; });
module.exports = { main };
