const fs = require("node:fs/promises");
const path = require("node:path");
const { createState, validateState } = require("../src/domain.js");

class Store {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, "tasks.json");
    this.queue = Promise.resolve();
  }
  async load() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      return validateState(JSON.parse(await fs.readFile(this.file, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT") {
        // A failed prior write may still have left a valid backup.
        try {
          return validateState(
            JSON.parse(await fs.readFile(this.file + ".backup", "utf8")),
          );
        } catch (backupError) {
          if (backupError.code !== "ENOENT") throw backupError;
        }
        return createState();
      }
      try {
        const backup = validateState(
          JSON.parse(await fs.readFile(this.file + ".backup", "utf8")),
        );
        await fs.copyFile(this.file, this.file + `.damaged-${Date.now()}`);
        await fs.rm(this.file);
        this.recoveryNotice =
          "Task data was damaged. The previous backup was restored and the original file was kept.";
        return backup;
      } catch {
        throw new Error(
          "Unable to read tasks. The original file was kept. Back it up before checking it.",
          {
            cause: error,
          },
        );
      }
    }
  }
  save(input) {
    const state = validateState(input);
    const operation = this.queue.then(async () => {
      await fs.mkdir(this.directory, { recursive: true });
      const temp = this.file + ".tmp";
      await fs.writeFile(temp, JSON.stringify(state, null, 2), "utf8");
      try {
        await fs.copyFile(this.file, this.file + ".backup");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      await fs.rename(temp, this.file);
      return state;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
module.exports = { Store };
