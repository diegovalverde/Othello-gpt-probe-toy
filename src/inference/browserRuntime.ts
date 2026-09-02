import type { LegalitySource, ProbeAnalysis } from "../types/probe";
import type { ProbeRuntime } from "./runtime";

export class BrowserOnnxRuntime implements ProbeRuntime {
  id = "browser-onnx";
  label = "Browser ONNX runtime";
  description = "Runs Othello-GPT and static probe tensors fully in the browser.";

  analyze(_input: string, _legalitySource: LegalitySource): ProbeAnalysis {
    throw new Error("Browser ONNX runtime is not wired yet; use the fixture runtime for now.");
  }
}
