import { rm } from "node:fs/promises";

await rm("dist/model/othello-gpt-activations.onnx", { force: true });
