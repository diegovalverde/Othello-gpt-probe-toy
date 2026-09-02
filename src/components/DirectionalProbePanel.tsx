import type { CSSProperties } from "react";
import type { BoardSquareView } from "../types/probe";

interface DirectionalProbePanelProps {
  square: BoardSquareView | null;
}

const directionLayout = [
  ["NW", "N", "NE"],
  ["W", "target", "E"],
  ["SW", "S", "SE"],
] as const;

export function DirectionalProbePanel({ square }: DirectionalProbePanelProps) {
  const scores = new Map(square?.directionalScores.map((item) => [item.direction, item]));
  const rayMax = square?.rayMaxScore ?? 0;

  return (
    <section className="direction-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow legality">post6 legality probe</p>
          <h2>Directional capture rays</h2>
        </div>
        <span className="ray-score">max {rayMax.toFixed(2)}</span>
      </div>
      <p className="muted direction-intro">
        {square
          ? `${square.square} decomposed into eight directional capture predicates.`
          : "Select a square or use the probe choice to inspect L6 directional scores."}
      </p>
      <div className="direction-compass" aria-label="Directional probe scores">
        {directionLayout.flatMap((row) =>
          row.map((direction) => {
            if (direction === "target") {
              return (
                <div className="direction-target" key="target">
                  <strong>{square?.square ?? "-"}</strong>
                  <span>target</span>
                </div>
              );
            }
            const item = scores.get(direction);
            const score = item?.score ?? 0;
            return (
              <div
                className={`direction-cell ${item?.active ? "active" : ""}`}
                key={direction}
                style={{ "--ray-fill": `${Math.round(score * 100)}%` } as CSSProperties}
              >
                <span>{direction}</span>
                <strong>{score.toFixed(2)}</strong>
                <i />
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}
