import type { BoardSquareView } from "../types/probe";

interface SquareInspectorProps {
  square: BoardSquareView | null;
  showDiagnostics: boolean;
}

export function SquareInspector({ square, showDiagnostics }: SquareInspectorProps) {
  if (!square) {
    return (
      <section className="inspector-card">
        <p className="eyebrow">square inspector</p>
        <h2>Select a square</h2>
        <p className="muted">Click a board square to inspect probe scores and simulator state.</p>
      </section>
    );
  }

  return (
    <section className="inspector-card">
      <p className="eyebrow">square inspector</p>
      <h2>{square.square}</h2>
      <dl className="score-grid">
        <div>
          <dt>Simulator</dt>
          <dd>{square.simulatorState}</dd>
        </div>
        <div>
          <dt>Board state</dt>
          <dd>{square.simulatorState}</dd>
        </div>
        <div>
          <dt>L4 board probe</dt>
          <dd>{square.probeState} ({Math.round(square.probeConfidence * 100)}%)</dd>
        </div>
        <div>
          <dt>post6 legality</dt>
          <dd>{square.directPost6Score.toFixed(2)}</dd>
        </div>
        <div>
          <dt>ray max</dt>
          <dd>{square.rayMaxScore.toFixed(2)}</dd>
        </div>
        <div>
          <dt>post7 preference</dt>
          <dd>{square.preferencePost7Score == null ? "-" : square.preferencePost7Score.toFixed(2)}</dd>
        </div>
        {showDiagnostics && (
          <div>
            <dt>final logits</dt>
            <dd>{square.finalLogit == null ? "-" : square.finalLogit.toFixed(2)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
