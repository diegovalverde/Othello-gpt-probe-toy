import type {
  BoardSquareView,
  DirectionalProbeScore,
  LegalitySource,
  ProbeAnalysis,
  ProbeBoardState,
  RankedMove,
  SquareProbeScores,
} from "../types/probe";
import { parseMoveString, replayTokens, squareLabel } from "../othello/othello";

const DEFAULT_INPUT = "F5 D6 C3 D3 C4 F4 E3";

const preferenceFixture = new Map<string, number>([
  ["D3", 0.83],
  ["C3", 0.72],
  ["F3", 0.61],
  ["G5", 0.41],
  ["B3", 0.38],
  ["G6", 0.27],
  ["B6", 0.18],
  ["G3", 0.14],
]);

const directFixture = new Map<string, number>([
  ["D3", 0.98],
  ["C3", 0.96],
  ["F3", 0.94],
  ["G5", 0.91],
  ["B3", 0.9],
  ["G6", 0.86],
  ["B6", 0.83],
  ["G3", 0.79],
]);

const rayFixture = new Map<string, number>([
  ["D3", 0.94],
  ["C3", 0.92],
  ["F3", 0.9],
  ["G5", 0.84],
  ["B3", 0.82],
  ["G6", 0.79],
  ["B6", 0.75],
  ["G3", 0.71],
]);

const finalLogitFixture = new Map<string, number>([
  ["C3", 2.42],
  ["D3", 2.31],
  ["F3", 1.88],
  ["G5", 1.12],
  ["B3", 0.91],
  ["G6", 0.62],
  ["B6", 0.47],
  ["G3", 0.28],
]);

const DIRECTIONS: DirectionalProbeScore["direction"][] = ["NW", "N", "NE", "W", "E", "SW", "S", "SE"];

function seededScore(square: string, salt: number): number {
  let hash = salt;
  for (const char of square) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return Number(((hash % 100) / 100).toFixed(2));
}

function boardProbeFor(simulatorState: BoardSquareView["simulatorState"]): {
  probeState: ProbeBoardState;
  confidence: number;
  scores: SquareProbeScores;
} {
  if (simulatorState === "empty") {
    return {
      probeState: "empty",
      confidence: 0.96,
      scores: { empty: 3.2, mine: -1.4, theirs: -1.7 },
    };
  }
  if (simulatorState === "black") {
    return {
      probeState: "mine",
      confidence: 0.94,
      scores: { empty: -1.6, mine: 2.8, theirs: -0.9 },
    };
  }
  return {
    probeState: "theirs",
    confidence: 0.93,
    scores: { empty: -1.5, mine: -0.8, theirs: 2.7 },
  };
}

function scoreFor(
  square: string,
  legal: boolean,
  fixture: Map<string, number>,
  salt: number,
): number {
  if (fixture.has(square)) {
    return fixture.get(square) as number;
  }
  const base = legal ? 0.64 + seededScore(square, salt) * 0.28 : seededScore(square, salt) * 0.22;
  return Number(base.toFixed(2));
}

function directionalScoresFor(square: string, legal: boolean, rayMaxScore: number): DirectionalProbeScore[] {
  const activeIndex = Math.floor(seededScore(square, 71) * DIRECTIONS.length) % DIRECTIONS.length;
  return DIRECTIONS.map((direction, index) => {
    const active = legal && index === activeIndex;
    const base = active
      ? rayMaxScore
      : Math.max(0.03, Math.min(0.62, seededScore(`${square}${direction}`, 83) * 0.72));
    return {
      direction,
      score: Number(base.toFixed(2)),
      active,
    };
  });
}

export function analyzeWithFixtures(
  input: string,
  legalitySource: LegalitySource,
): ProbeAnalysis {
  const tokenIds = parseMoveString(input || DEFAULT_INPUT);
  const game = replayTokens(tokenIds);
  const simulatorLegal = new Set(game.legalSquares().map(squareLabel));

  const board: BoardSquareView[] = Array.from({ length: 64 }, (_, square) => {
    const label = squareLabel(square);
    const simulatorState = game.stateAt(square);
    const boardProbe = boardProbeFor(simulatorState);
    const isSimulatorLegal = simulatorLegal.has(label);
    const directPost6Score = scoreFor(label, isSimulatorLegal, directFixture, 17);
    const rayMaxScore = scoreFor(label, isSimulatorLegal, rayFixture, 29);
    const directPost6Legal = directPost6Score >= 0.72;
    const rayMaxLegal = rayMaxScore >= 0.7;
    const isCandidate =
      isSimulatorLegal &&
      (legalitySource === "simulator" ||
        (legalitySource === "direct_post6" && directPost6Legal) ||
        (legalitySource === "ray_max" && rayMaxLegal));

    return {
      square: label,
      row: Math.floor(square / 8),
      col: square % 8,
      simulatorState,
      probeState: boardProbe.probeState,
      probeConfidence: boardProbe.confidence,
      boardScores: boardProbe.scores,
      simulatorLegal: isSimulatorLegal,
      directPost6Score,
      directPost6Legal,
      rayMaxScore,
      rayMaxLegal,
      directionalScores: directionalScoresFor(label, isSimulatorLegal, rayMaxScore),
      preferencePost7Score: isCandidate ? scoreFor(label, true, preferenceFixture, 43) : null,
      finalLogit: isSimulatorLegal ? scoreFor(label, true, finalLogitFixture, 53) : null,
    };
  });

  const rankedMoves = board
    .filter((square) => square.preferencePost7Score != null)
    .map((square) => ({
      square: square.square,
      preferencePost7Score: square.preferencePost7Score as number,
      directPost6Score: square.directPost6Score,
      rayMaxScore: square.rayMaxScore,
      finalLogit: square.finalLogit ?? scoreFor(square.square, true, finalLogitFixture, 53),
    }))
    .sort((a, b) => b.preferencePost7Score - a.preferencePost7Score)
    .map<RankedMove>((move, index, allMoves) => {
      const finalChoice = [...allMoves].sort((a, b) => b.finalLogit - a.finalLogit)[0]?.square;
      return {
        rank: index + 1,
        ...move,
        agreesWithFinalChoice: move.square === finalChoice,
      };
    });

  const probeChoice = rankedMoves[0]?.square ?? null;
  const finalLogitChoice =
    rankedMoves.length > 0
      ? [...rankedMoves].sort((a, b) => b.finalLogit - a.finalLogit)[0].square
      : null;

  return {
    input,
    tokenIds,
    toPlay: game.toPlay,
    legalitySource,
    board,
    rankedMoves,
    probeChoice,
    finalLogitChoice,
    agreesWithFinalLogits:
      probeChoice == null || finalLogitChoice == null ? null : probeChoice === finalLogitChoice,
  };
}

export { DEFAULT_INPUT };
