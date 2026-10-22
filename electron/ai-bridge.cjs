const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes, timingSafeEqual } = require("node:crypto");
const { methods } = require("./task-service.cjs");

async function startBridge(directory, execute) {
  const token = randomBytes(32).toString("hex");
  const folder = path.join(directory, "ai");
  const file = path.join(folder, "connection.json");
  let port;
  const server = http.createServer(async (req, res) => {
    const reply = (code, value) => {
      if (res.destroyed) return;
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        Connection: "close",
      });
      res.end(JSON.stringify(value));
    };
    // Browsers cannot use this private app-to-bridge endpoint, even with a leaked URL.
    if (
      req.headers.origin !== undefined ||
      req.headers.host !== `127.0.0.1:${port}`
    )
      return reply(403, { error: "Forbidden." });
    const supplied = Buffer.from(req.headers.authorization || "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return reply(401, { error: "Unauthorized." });
    if (req.method !== "POST" || req.url !== "/rpc")
      return reply(404, { error: "Not found." });
    if (
      (req.headers["content-type"] || "").split(";")[0] !== "application/json"
    )
      return reply(415, { error: "JSON required." });
    let size = 0;
    const chunks = [];
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65536) {
          reply(413, { error: "Request too large." });
          return;
        }
        chunks.push(chunk);
      }
      const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!value || !methods.includes(value.method))
        return reply(400, { error: "Unknown Pebble tool." });
      const result = await execute(value.method, value.args ?? {});
      reply(200, { result });
    } catch (error) {
      reply(400, {
        error: error instanceof SyntaxError ? "Invalid JSON." : error.message,
      });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxConnections = 32;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  port = server.address().port;
  try {
    await fs.mkdir(folder, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      file + ".tmp",
      JSON.stringify({ version: 1, port, token }),
      { mode: 0o600 },
    );
    await fs.rename(file + ".tmp", file);
  } catch (error) {
    server.close();
    server.closeAllConnections();
    throw error;
  }
  return {
    port,
    async close() {
      await new Promise((resolve) => {
        server.close(resolve);
      });
      try {
        const current = JSON.parse(await fs.readFile(file, "utf8"));
        if (current.token === token) await fs.rm(file);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
  };
}
module.exports = { startBridge };
