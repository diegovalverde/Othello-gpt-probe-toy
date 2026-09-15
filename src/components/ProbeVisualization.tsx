import type { CSSProperties } from "react";
import type { BoardSquareView } from "../types/probe";

type ProbeStage = "l4" | "post6" | "post7" | "logits";

interface ProbeVisualizationProps {
  activeStage: string;
  board: BoardSquareView[];
}

const stageCopy: Record<ProbeStage, { input: string; output: string; caption: string }> = {
  l4: { input: "L4 residual", output: "predicted board map", caption: "8 × 8 × {empty, mine, theirs}" },
  post6: { input: "post6 residual", output: "predicted legality map", caption: "8 × 8 × {N, S, E, W, …}" },
  post7: { input: "post7 residual", output: "predicted preference map", caption: "8 × 8 move scores" },
  logits: { input: "final residual", output: "final-logit map", caption: "8 × 8 diagnostic scores" },
};

function isProbeStage(stage: string): stage is ProbeStage {
  return stage === "l4" || stage === "post6" || stage === "post7" || stage === "logits";
}

function cellFor(stage: ProbeStage, square: BoardSquareView) {
  if (stage === "l4") {
    const scores = [square.boardScores.empty, square.boardScores.mine, square.boardScores.theirs];
    return { value: Math.max(...scores), label: square.probeState.slice(0, 1).toUpperCase() };
  }
  if (stage === "post6") {
    const direction = [...square.directionalScores].sort((a, b) => b.score - a.score)[0];
    return { value: direction.score, label: direction.direction };
  }
  if (stage === "post7") return { value: square.preferencePost7Score ?? 0, label: "" };
  return { value: square.finalLogit ?? 0, label: "" };
}

function normalise(values: number[], value: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max === min ? 0.5 : (value - min) / (max - min);
}

export function ProbeVisualization({ activeStage, board }: ProbeVisualizationProps) {
  if (!isProbeStage(activeStage)) return null;

  const copy = stageCopy[activeStage];
  const cells = board.map((square) => ({ square, ...cellFor(activeStage, square) }));
  const values = cells.map((cell) => cell.value);

  return (
    <section className={`probe-visualization probe-visualization-${activeStage}`} aria-label={`${copy.output} visualization`}>
      <div className="residual-module">
        <span className="probe-module-label">{copy.input}</span>
        <span className="probe-module-detail">512-d</span>
      </div>
      <span className="probe-flow-arrow" aria-hidden="true">→</span>
      <div className="linear-probe-module">
        <span>linear probe</span>
        <small>neural net</small>
      </div>
      <span className="probe-flow-arrow" aria-hidden="true">→</span>
      <div className="map-module">
        <span className="probe-module-label">{copy.output}</span>
        <div className="probe-output-grid" role="img" aria-label={copy.caption}>
          {cells.map(({ square, value, label }) => (
            <span
              className="probe-output-cell"
              key={square.square}
              style={{ "--cell-strength": normalise(values, value) } as CSSProperties}
              title={`${square.square}: ${label || value.toFixed(2)}`}
            >
              {activeStage === "post6" ? label : ""}
            </span>
          ))}
        </div>
        <span className="probe-module-detail">{copy.caption}</span>
      </div>
    </section>
  );
}
