import type { BoardSquareView, RankedMove } from "../types/probe";

interface BoardViewProps {
  board: BoardSquareView[];
  rankedMoves: RankedMove[];
  probeChoice: string | null;
  finalLogitChoice: string | null;
  showDiagnostics: boolean;
  onSelectSquare: (square: BoardSquareView) => void;
  selectedSquare: string | null;
}

const FILES = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function BoardView({
  board,
  rankedMoves,
  probeChoice,
  finalLogitChoice,
  showDiagnostics,
  onSelectSquare,
  selectedSquare,
}: BoardViewProps) {
  const rankBySquare = new Map(rankedMoves.map((move) => [move.square, move.rank]));

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
            const rank = rankBySquare.get(square.square);
            const isProbeChoice = square.square === probeChoice;
            const isFinalChoice = showDiagnostics && square.square === finalLogitChoice;
            return (
              <button
                className={[
                  "board-cell",
                  square.probeDiscState !== "empty" ? "has-disc" : "",
                  isProbeChoice ? "is-probe-choice" : "",
                  isFinalChoice ? "is-final-choice" : "",
                  selectedSquare === square.square ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={square.square}
                onClick={() => onSelectSquare(square)}
                type="button"
                aria-label={`${square.square}: ${square.probeDiscState}`}
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
                {isProbeChoice && <span className="selected-label">probe</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="board-legend">
        <span><i className="legend-disc black" />Black</span>
        <span><i className="legend-disc white" />White</span>
        <span><i className="legend-dot" />Legal</span>
        <span><i className="legend-ring" />Probe choice</span>
      </div>
    </section>
  );
}
