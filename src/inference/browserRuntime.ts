import type { LegalitySource, ProbeAnalysis, ProbeBoardState } from "../types/probe";
import type { ProbeRuntime } from "./runtime";
import type { DirectionalProbeScore, RankedMove } from "../types/probe";
import {
  SQUARE_TO_TOKEN,
  parseMoveString,
  replayTokens,
  squareLabel,
} from "../othello/othello";
import * as ort from "onnxruntime-web/wasm";

const MODEL_URL = "/model/othello-gpt-activations.onnx";
const DEFAULT_INPUT = "F5 D6 C3 D3 C4 F4 E3";
const DIRECT_POST6_THRESHOLD = 0.9969209432601929;
const RAY_MAX_POST6_THRESHOLD = 0.8941226601600647;
const DIRECTIONS: DirectionalProbeScore["direction"][] = [
  "NW",
  "N",
  "NE",
  "W",
  "E",
  "SW",
  "S",
  "SE",
];

let sessionPromise: Promise<ort.InferenceSession> | null = null;
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = {
  wasm: "/ort/ort-wasm-simd-threaded.wasm",
};

function getSession(): Promise<ort.InferenceSession> {
  if (sessionPromise == null) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
    });
  }
  return sessionPromise;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function softmax3(a: number, b: number, c: number): [number, number, number] {
  const max = Math.max(a, b, c);
  const expA = Math.exp(a - max);
  const expB = Math.exp(b - max);
  const expC = Math.exp(c - max);
  const total = expA + expB + expC;
  return [expA / total, expB / total, expC / total];
}

function probeStateFromIndex(index: number): ProbeBoardState {
  if (index === 0) {
    return "empty";
  }
  if (index === 1) {
    return "mine";
  }
  return "theirs";
}

function probeDiscState(probeState: ProbeBoardState, toPlay: "black" | "white"): "empty" | "black" | "white" {
  if (probeState === "empty") {
    return "empty";
  }
  const otherPlayer = toPlay === "black" ? "white" : "black";
  return probeState === "mine" ? toPlay : otherPlayer;
}

function tensorData(output: ort.InferenceSession.OnnxValueMapType, name: string): Float32Array {
  const value = output[name];
  if (!(value instanceof ort.Tensor) || !(value.data instanceof Float32Array)) {
    throw new Error(`ONNX output ${name} was not a float32 tensor.`);
  }
  return value.data;
}

function finalLogitForSquare(finalLogits: Float32Array, squareIndex: number): number | null {
  const tokenId = SQUARE_TO_TOKEN.get(squareIndex);
  return tokenId == null ? null : finalLogits[tokenId];
}

export class BrowserOnnxRuntime implements ProbeRuntime {
  id = "browser-onnx";
  label = "Browser ONNX runtime";
  description =
    "Runs Othello-GPT, post6 legality probes, post6 ray probes, post7 preference, and final logits in the browser.";

  async analyze(input: string, legalitySource: LegalitySource): Promise<ProbeAnalysis> {
    const normalizedInput = input.trim() || DEFAULT_INPUT;
    const tokenIds = parseMoveString(normalizedInput);
    if (tokenIds.length === 0) {
      throw new Error("Enter at least one move token.");
    }
    if (tokenIds.length > 59) {
      throw new Error("Othello-GPT accepts at most 59 move tokens.");
    }

    const session = await getSession();
    const tokenTensor = new ort.Tensor(
      "int64",
      BigInt64Array.from(tokenIds.map((tokenId) => BigInt(tokenId))),
      [1, tokenIds.length],
    );
    const outputs = await session.run({ tokens: tokenTensor });
    const boardStateL4 = tensorData(outputs, "board_state_l4");
    const directPost6 = tensorData(outputs, "direct_legality_post6");
    const captureRayPost6 = tensorData(outputs, "capture_ray_post6");
    const preferencePost7 = tensorData(outputs, "preference_post7");
    const finalLogits = tensorData(outputs, "final_logits");

    const game = replayTokens(tokenIds);
    const simulatorLegalSquares = new Set(game.legalSquares());
    const simulatorLegalLabels = new Set([...simulatorLegalSquares].map(squareLabel));

    const board = Array.from({ length: 64 }, (_, squareIndex) => {
      const square = squareLabel(squareIndex);
      const simulatorState = game.stateAt(squareIndex);
      const boardOffset = squareIndex * 3;
      const emptyScore = boardStateL4[boardOffset];
      const mineScore = boardStateL4[boardOffset + 1];
      const theirsScore = boardStateL4[boardOffset + 2];
      const boardProbabilities = softmax3(emptyScore, mineScore, theirsScore);
      const boardStateIndex = boardProbabilities.indexOf(Math.max(...boardProbabilities));
      const probeState = probeStateFromIndex(boardStateIndex);
      const directPost6Score = sigmoid(directPost6[squareIndex]);
      const directionalScores = DIRECTIONS.map((direction, directionIndex) => ({
        direction,
        score: sigmoid(captureRayPost6[squareIndex * 8 + directionIndex]),
        active: false,
      }));
      const rayMaxScore = Math.max(...directionalScores.map((score) => score.score));
      const activeDirection = directionalScores.find((score) => score.score === rayMaxScore);
      if (activeDirection && rayMaxScore >= RAY_MAX_POST6_THRESHOLD) {
        activeDirection.active = true;
      }

      const directPost6Legal = directPost6Score >= DIRECT_POST6_THRESHOLD;
      const rayMaxLegal = rayMaxScore >= RAY_MAX_POST6_THRESHOLD;
      const simulatorLegal = simulatorLegalSquares.has(squareIndex);
      const preferenceScore =
        (legalitySource === "simulator" && simulatorLegal) ||
        (legalitySource === "direct_post6" && directPost6Legal) ||
        (legalitySource === "ray_max" && rayMaxLegal)
          ? preferencePost7[squareIndex]
          : null;

      const reconstructedDiscState = probeDiscState(probeState, game.toPlay);

      return {
        square,
        row: Math.floor(squareIndex / 8),
        col: squareIndex % 8,
        simulatorState,
        probeDiscState: reconstructedDiscState,
        boardProbeMatchesSimulator: reconstructedDiscState === simulatorState,
        probeState,
        probeConfidence: boardProbabilities[boardStateIndex],
        boardScores: { empty: emptyScore, mine: mineScore, theirs: theirsScore },
        simulatorLegal,
        directPost6Score,
        directPost6Legal,
        rayMaxScore,
        rayMaxLegal,
        directionalScores,
        preferencePost7Score: preferenceScore,
        finalLogit: finalLogitForSquare(finalLogits, squareIndex),
      };
    });

    const finalLogitChoice =
      [...simulatorLegalLabels]
        .map((square) => ({ square, finalLogit: board.find((item) => item.square === square)?.finalLogit }))
        .filter((move): move is { square: string; finalLogit: number } => move.finalLogit != null)
        .sort((a, b) => b.finalLogit - a.finalLogit)[0]?.square ?? null;

    const rankedMoves = board
      .filter((square) => square.preferencePost7Score != null)
      .map((square) => ({
        square: square.square,
        preferencePost7Score: square.preferencePost7Score as number,
        directPost6Score: square.directPost6Score,
        rayMaxScore: square.rayMaxScore,
        finalLogit: square.finalLogit ?? Number.NEGATIVE_INFINITY,
      }))
      .sort((a, b) => b.preferencePost7Score - a.preferencePost7Score)
      .map<RankedMove>((move, index) => ({
        rank: index + 1,
        ...move,
        agreesWithFinalChoice: move.square === finalLogitChoice,
      }));

    const probeChoice = rankedMoves[0]?.square ?? null;
    const boardProbeMismatchCount = board.filter(
      (square) => !square.boardProbeMatchesSimulator,
    ).length;

    return {
      input: normalizedInput,
      tokenIds,
      toPlay: game.toPlay,
      legalitySource,
      board,
      rankedMoves,
      boardProbeAgreement: 1 - boardProbeMismatchCount / board.length,
      boardProbeMismatchCount,
      probeChoice,
      finalLogitChoice,
      agreesWithFinalLogits:
        probeChoice == null || finalLogitChoice == null ? null : probeChoice === finalLogitChoice,
    };
  }
}

export { DEFAULT_INPUT };
