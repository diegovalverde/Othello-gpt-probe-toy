export type Player = "black" | "white";
export type DiscState = "empty" | "black" | "white";
export type ProbeBoardState = "empty" | "mine" | "theirs";
export type LegalitySource = "direct_post6" | "ray_max" | "simulator";

export interface SquareProbeScores {
  empty: number;
  mine: number;
  theirs: number;
}

export interface DirectionalProbeScore {
  direction: "NW" | "N" | "NE" | "W" | "E" | "SW" | "S" | "SE";
  score: number;
  active: boolean;
}

export interface BoardSquareView {
  square: string;
  row: number;
  col: number;
  simulatorState: DiscState;
  probeDiscState: DiscState;
  probeState: ProbeBoardState;
  probeConfidence: number;
  boardScores: SquareProbeScores;
  simulatorLegal: boolean;
  directPost6Score: number;
  directPost6Legal: boolean;
  rayMaxScore: number;
  rayMaxLegal: boolean;
  directionalScores: DirectionalProbeScore[];
  preferencePost7Score: number | null;
  finalLogit: number | null;
}

export interface RankedMove {
  rank: number;
  square: string;
  preferencePost7Score: number;
  directPost6Score: number;
  rayMaxScore: number;
  finalLogit: number;
  agreesWithFinalChoice: boolean;
}

export interface ProbeAnalysis {
  input: string;
  tokenIds: number[];
  toPlay: Player;
  legalitySource: LegalitySource;
  board: BoardSquareView[];
  rankedMoves: RankedMove[];
  probeChoice: string | null;
  finalLogitChoice: string | null;
  agreesWithFinalLogits: boolean | null;
}
