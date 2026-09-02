import { CheckCircle2, CircleAlert } from "lucide-react";
import type { RankedMove } from "../types/probe";

interface MoveRankingProps {
  moves: RankedMove[];
  probeChoice: string | null;
  finalLogitChoice: string | null;
  agrees: boolean | null;
  showDiagnostics: boolean;
  onSelectMove: (square: string) => void;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function MoveRanking({
  moves,
  probeChoice,
  finalLogitChoice,
  agrees,
  showDiagnostics,
  onSelectMove,
}: MoveRankingProps) {
  return (
    <section className="ranking-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">post7 preference probe</p>
          <h2>Probe ranking</h2>
        </div>
        {showDiagnostics && agrees != null && (
          <span className={`agreement-pill ${agrees ? "agree" : "disagree"}`}>
            {agrees ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
            {agrees ? "agrees" : "differs"}
          </span>
        )}
      </div>
      <div className="choice-summary">
        <div>
          <span className="summary-label">Probe choice</span>
          <strong>{probeChoice ?? "-"}</strong>
        </div>
        {showDiagnostics && (
          <div>
            <span className="summary-label">Final-logit diagnostic</span>
            <strong>{finalLogitChoice ?? "-"}</strong>
          </div>
        )}
      </div>
      <div className="ranking-list">
        {moves.map((move) => (
          <button
            className="ranking-row"
            key={move.square}
            onClick={() => onSelectMove(move.square)}
            type="button"
          >
            <span className="rank-number">{move.rank}</span>
            <span className="move-label">{move.square}</span>
            <div className="score-bar" aria-label={`Preference score ${move.preferencePost7Score}`}>
              <span style={{ width: pct(move.preferencePost7Score) }} />
            </div>
            <span className="score-text">{pct(move.preferencePost7Score)}</span>
            {showDiagnostics && (
              <span className={move.agreesWithFinalChoice ? "diag-match" : "diag-muted"}>
                logits {move.finalLogit.toFixed(2)}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
