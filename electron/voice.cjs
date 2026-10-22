const path = require("node:path");
const { utilityProcess } = require("electron");

class Voice {
  constructor(directory, onProgress) {
    this.directory = directory;
    this.onProgress = onProgress;
    this.pending = null;
    this.sequence = 0;
  }
  start() {
    if (this.worker) return;
    const worker = this.worker = utilityProcess.fork(path.join(__dirname, "voice-worker.cjs"), [], { serviceName: "Pebble local speech", stdio: "pipe" });
    worker.stderr.on("data", (data) => { if (process.env.PEBBLE_TEST_VOICE_DIAGNOSTICS === "1") console.error("Voice worker:", String(data)); });
    worker.on("message", (message) => {
      const pending = this.pending;
      if (!pending || pending.id !== message.id) return;
      if (message.progress) return this.onProgress(message.progress);
      this.pending = null;
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
    });
    worker.on("exit", (code) => {
      if (process.env.PEBBLE_TEST_VOICE_DIAGNOSTICS === "1") console.error("Voice worker exit:", code);
      if (this.worker !== worker) return;
      this.worker = null;
      this.reject("Voice process stopped. Please try again.");
    });
  }
  reject(message) {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending.reject(new Error(message));
    this.pending = null;
  }
  cancel() {
    this.reject("Voice operation cancelled.");
    const worker = this.worker;
    this.worker = null;
    worker?.kill();
  }
  call(action, data = {}) {
    if (this.pending) throw new Error("Voice is busy. Please wait.");
    if (action === "transcribe" && (!(data.audio instanceof Float32Array) || data.audio.length < 1600 || data.audio.length > 16000 * 30 || data.audio.some((value) => !Number.isFinite(value) || Math.abs(value) > 1.01)))
      throw new Error("Record between 0.1 and 30 seconds of audio.");
    this.start();
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      this.pending = { id, resolve, reject, timer: setTimeout(() => this.cancel(), action === "prepare" ? 600000 : 120000) };
      const worker = this.worker;
      const send = () => { if (this.pending?.id === id && this.worker === worker) worker.postMessage({ id, action, directory: this.directory, ...data }); };
      if (worker.pid) send();
      else worker.once("spawn", send);
    });
  }
}
module.exports = { Voice };
