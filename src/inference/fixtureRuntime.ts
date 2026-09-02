import { analyzeWithFixtures, DEFAULT_INPUT } from "./fixtureAnalysis";
import type { ProbeRuntime } from "./runtime";

export const fixtureRuntime: ProbeRuntime = {
  id: "fixture",
  label: "Fixture runtime",
  description: "Deterministic placeholder scores for UI development before ONNX/probe assets land.",
  analyze: analyzeWithFixtures,
};

export { DEFAULT_INPUT };
