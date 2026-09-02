import type { LegalitySource, ProbeAnalysis } from "../types/probe";

export interface ProbeRuntime {
  id: string;
  label: string;
  description: string;
  analyze(input: string, legalitySource: LegalitySource): ProbeAnalysis;
}

export interface AnalysisResult {
  analysis: ProbeAnalysis | null;
  error: string | null;
}

export function runAnalysis(
  runtime: ProbeRuntime,
  input: string,
  legalitySource: LegalitySource,
): AnalysisResult {
  try {
    return {
      analysis: runtime.analyze(input, legalitySource),
      error: null,
    };
  } catch (err) {
    return {
      analysis: null,
      error: err instanceof Error ? err.message : "Unable to parse this move string.",
    };
  }
}
