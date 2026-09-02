import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const sourceDir = "node_modules/onnxruntime-web/dist";
const targetDir = "public/ort";

mkdirSync(targetDir, { recursive: true });

for (const fileName of readdirSync(sourceDir)) {
  if (fileName === "ort-wasm-simd-threaded.wasm") {
    copyFileSync(join(sourceDir, fileName), join(targetDir, fileName));
  }
}
