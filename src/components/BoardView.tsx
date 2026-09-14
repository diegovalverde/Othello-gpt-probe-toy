import type { CSSProperties } from "react";
import type { BoardSquareView, RankedMove } from "../types/probe";

interface BoardViewProps {
  board: BoardSquareView[];
  rankedMoves: RankedMove[];
  probeChoice: string | null;
  finalLogitChoice: string | null;
  showDiagnostics: boolean;
  onSelectSquare: (square: BoardSquareView) => void;
  selectedSquare: string | null;
  directionalSquare: BoardSquareView | null;
  showPreference: boolean;
  showLogitRanks: boolean;
}

const FILES = ["A", "B", "C", "D", "E", "F", "G", "H"];
const DIRECTION_CELLS = [
  { direction: "NW", angle: -135 },
  { direction: "N", angle: -90 },
  { direction: "NE", angle: -45 },
  { direction: "W", angle: 180 },
  { direction: "target", angle: 0 },
  { direction: "E", angle: 0 },
  { direction: "SW", angle: 135 },
  { direction: "S", angle: 90 },
  { direction: "SE", angle: 45 },
] as const;

export function BoardView({
  board,
  rankedMoves,
  probeChoice,
  finalLogitChoice,
  showDiagnostics,
  onSelectSquare,
  selectedSquare,
  directionalSquare,
  showPreference,
  showLogitRanks,
}: BoardViewProps) {
  const rankBySquare = new Map(rankedMoves.map((move) => [move.square, move.rank]));
  const moveBySquare = new Map(rankedMoves.map((move) => [move.square, move]));
  const logitRankBySquare = new Map(
    [...rankedMoves]
      .sort((left, right) => right.finalLogit - left.finalLogit)
      .map((move, index) => [move.square, index + 1]),
  );
  const directionalScores = new Map(
    directionalSquare?.directionalScores.map((score) => [score.direction, score]),
  );

  return (
    <section className="board-panel" aria-label="Othello board">
      <div className="board-coordinates board-coordinates-top">
        <span />
        {FILES.map((file) => (
          <span key={file}>{file}</span>
        ))}
      </div>
      <div className="board-wrap">
        <div className="board-coordinates board-coordinates-left">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <div className="board-grid">
          {board.map((square) => {
            const rank = showPreference ? rankBySquare.get(square.square) : undefined;
            const move = moveBySquare.get(square.square);
            const logitRank = showLogitRanks ? logitRankBySquare.get(square.square) : undefined;
            const logitMatchesProbeRank = logitRank === rank;
            const isProbeChoice = showPreference && square.square === probeChoice;
            const isFinalChoice = showDiagnostics && square.square === finalLogitChoice;
            const isDirectionalTarget = square.square === directionalSquare?.square;
            return (
              <button
                className={[
                  "board-cell",
                  square.probeDiscState !== "empty" ? "has-disc" : "",
                  showDiagnostics && !square.boardProbeMatchesSimulator ? "has-board-mismatch" : "",
                  isProbeChoice ? "is-probe-choice" : "",
                  isFinalChoice ? "is-final-choice" : "",
                  selectedSquare === square.square ? "is-selected" : "",
                  isDirectionalTarget ? "is-directional-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={square.square}
                onClick={() => onSelectSquare(square)}
                type="button"
                aria-label={`${square.square}: ${square.probeDiscState}`}
                title={
                  showLogitRanks && rank != null && logitRank != null && move
                    ? `post7 preference score: ${move.preferencePost7Score.toFixed(3)}\nfinal logit: ${move.finalLogit.toFixed(3)}`
                    : undefined
                }
              >
                {square.probeDiscState !== "empty" && (
                  <span className={`disc disc-${square.probeDiscState}`} />
                )}
                {square.simulatorLegal && !rank && <span className="legal-dot simulator-dot" />}
                {rank && (
                  <span className="preference-marker">
                    <span className="preference-rank">{rank}</span>
                  </span>
                )}
                {logitRank != null && (
                  <span className={`logit-rank ${logitMatchesProbeRank ? "matches-probe" : "differs-from-probe"}`}>
                    {logitRank}
                  </span>
                )}
                {isProbeChoice && <span className="selected-label">probe</span>}
                {showDiagnostics && !square.boardProbeMatchesSimulator && (
                  <span className="mismatch-flag" title="L4 board probe differs from simulator" />
                )}
                {isDirectionalTarget && (
                  <span className="directional-overlay" aria-label="Directional capture-ray scores">
                    {DIRECTION_CELLS.map(({ direction, angle }) => {
                      if (direction === "target") {
                        return <span className="directional-target" key={direction} />;
                      }
                      const score = directionalScores.get(
                        direction as BoardSquareView["directionalScores"][number]["direction"],
                      );
                      return (
                        <span
                          className={`directional-score ${score?.active ? "active" : ""}`}
                          key={direction}
                          style={{
                            "--directional-score": score?.score ?? 0,
                            "--directional-angle": `${angle}deg`,
                          } as CSSProperties}
                        >
                          <i aria-hidden="true">➜</i>
                          <em>{score?.score.toFixed(2) ?? "-"}</em>
                        </span>
                      );
                    })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="board-legend">
        <span><i className="legend-disc black" />Black</span>
        <span><i className="legend-disc white" />White</span>
        <span><i className="legend-dot" />Legal</span>
        {showPreference && <span><i className="legend-ring" />Probe choice</span>}
        {showLogitRanks && <span className="logit-legend">Logit rank: gray matches post7, coral differs</span>}
        {directionalSquare && <span className="directional-legend">Coral tiles show post6 capture-ray scores</span>}
      </div>
    </section>
  );
}
