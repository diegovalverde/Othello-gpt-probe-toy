import type { LegalitySource, ProbeAnalysis } from "../types/probe";

export interface ProbeRuntime {
  id: string;
  label: string;
  description: string;
  analyze(input: string, legalitySource: LegalitySource): Promise<ProbeAnalysis>;
}

export interface AnalysisResult {
  analysis: ProbeAnalysis | null;
  error: string | null;
}

export async function runAnalysis(
  runtime: ProbeRuntime,
  input: string,
  legalitySource: LegalitySource,
): Promise<AnalysisResult> {
  try {
    const analysis = await runtime.analyze(input, legalitySource);
    return {
      analysis,
      error: null,
    };
  } catch (err) {
    return {
      analysis: null,
      error: err instanceof Error ? err.message : "Unable to parse this move string.",
    };
  }
}
