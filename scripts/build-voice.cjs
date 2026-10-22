const fs = require("node:fs/promises");
const path = require("node:path");
const esbuild = require("esbuild");
// ONNX Runtime no longer supplies Intel macOS native binaries. Build a WASM
// variant from the same pinned Transformers source, without loading native ORT.
// Keep Node file caching and all model/tokenizer logic unchanged.
async function main() {
  const entry = path.resolve("node_modules/@huggingface/transformers/src/transformers.js");
  await esbuild.build({
    entryPoints: [entry], outfile: "electron/vendor/voice-wasm.cjs",
    platform: "node", target: "node22", format: "cjs", bundle: true, minify: true,
    external: ["sharp", "onnxruntime-web/*"],
    logOverride: { "empty-import-meta": "silent" },
    plugins: [{ name: "intel-macos-wasm", setup(build) {
      build.onLoad({ filter: /backends[/\\]onnx\.js$/ }, async (args) => {
        let contents = await fs.readFile(args.path, "utf8");
        const nativeImport = "import ONNX_NODE from './onnx-node.js';";
        const nativeBranch = "} else if (apis.IS_NODE_ENV) {";
        if (!contents.includes(nativeImport) || !contents.includes(nativeBranch)) throw new Error("Review the voice WASM adapter after upgrading Transformers.");
        contents = contents.replace(nativeImport, "const ONNX_NODE = null;").replace(nativeBranch, "} else if (false) {");
        // The Node model loader returns cached file paths; ORT Web accepts bytes.
        contents = "import { readFile as readVoiceModel } from 'node:fs/promises';\n" + contents.replace("await ensureWasmLoaded();", "await ensureWasmLoaded();\nif (typeof buffer_or_path === 'string') buffer_or_path = await readVoiceModel(buffer_or_path);");
        return { contents, loader: "js" };
      });
    } }],
  });
  await fs.copyFile("node_modules/@huggingface/transformers/LICENSE", "electron/vendor/TRANSFORMERS-LICENSE");
  console.log("Built local speech WASM fallback for Intel macOS.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
