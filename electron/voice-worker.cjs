// Separate process: model loading and CPU inference never block the desktop window.
const path = require("node:path");
const { parentPort } = process;
const { pathToFileURL } = require("node:url");
const simplifiedChinese = require("opencc-js").Converter({ from: "t", to: "cn" });
let transcriber;
parentPort.on("message", async ({ data }) => {
  const { id, action, directory, audio, language } = data;
  const send = (value) => parentPort.postMessage({ id, ...value });
  try {
    if (action === "prepare") {
      const wasm = (process.platform === "darwin" && process.arch === "x64") || process.env.PEBBLE_TEST_VOICE_WASM === "1";
      const { pipeline, env } = wasm ? require("./vendor/voice-wasm.cjs") : await import("@huggingface/transformers");
      env.cacheDir = path.join(directory, "voice-models");
      env.allowLocalModels = false;
      if (wasm) {
        const dist = path.dirname(require.resolve("onnxruntime-web")).replace(/app\.asar([/\\])/, "app.asar.unpacked$1");
        env.backends.onnx.wasm.wasmBinary = require("node:fs").readFileSync(path.join(dist, "ort-wasm-simd-threaded.wasm"));
        env.backends.onnx.wasm.wasmPaths = {
          wasm: pathToFileURL(path.join(dist, "ort-wasm-simd-threaded.wasm")).href,
          mjs: pathToFileURL(path.join(dist, "ort-wasm-simd-threaded.mjs")).href,
        };
        env.backends.onnx.wasm.numThreads = 1;
        env.useWasmCache = false;
      }
      transcriber ||= await pipeline("automatic-speech-recognition", "onnx-community/whisper-small", {
        revision: "36050c46d777d46dc4b5f43f6d90574fc38f8732",
        dtype: "q8", device: wasm ? "wasm" : "cpu",
        session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
        progress_callback: (progress) => send({ progress: { status: progress.status, file: progress.file, progress: progress.progress } }),
      });
      send({ result: true });
    } else if (action === "transcribe" && transcriber) {
      const result = await transcriber(new Float32Array(audio), {
        language: language === "zh" ? "chinese" : "english", task: "transcribe",
        return_timestamps: false, max_new_tokens: 128,
      });
      send({ result: language === "zh" ? simplifiedChinese(result.text.trim()) : result.text.trim() });
    } else throw new Error("Voice model is not ready.");
  } catch (error) {
    if (process.env.PEBBLE_TEST_VOICE_DIAGNOSTICS === "1") console.error(error, error.cause);
    send({ error: String(error.message || error).slice(0, 500) });
  }
});
