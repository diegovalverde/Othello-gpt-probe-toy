import { useMemo, useState } from "react";
import { Activity, Play, SlidersHorizontal } from "lucide-react";
import { BoardView } from "../components/BoardView";
import { DirectionalProbePanel } from "../components/DirectionalProbePanel";
import { MoveRanking } from "../components/MoveRanking";
import { ProbeRail } from "../components/ProbeRail";
import { SquareInspector } from "../components/SquareInspector";
import { analyzeWithFixtures, DEFAULT_INPUT } from "../inference/fixtureAnalysis";
import type { BoardSquareView, LegalitySource } from "../types/probe";

export function App() {
  const [moveString, setMoveString] = useState(DEFAULT_INPUT);
  const [submittedMoveString, setSubmittedMoveString] = useState(DEFAULT_INPUT);
  const [legalitySource, setLegalitySource] = useState<LegalitySource>("direct_post6");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<BoardSquareView | null>(null);
  const [activeStage, setActiveStage] = useState("post7");
  const [error, setError] = useState<string | null>(null);

  const analysis = useMemo(() => {
    try {
      const result = analyzeWithFixtures(submittedMoveString, legalitySource);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to parse this move string.");
      return null;
    }
  }, [submittedMoveString, legalitySource]);

  const selected =
    selectedSquare && analysis?.board.find((square) => square.square === selectedSquare.square)
      ? analysis.board.find((square) => square.square === selectedSquare.square) ?? null
      : null;
  const probeChoiceSquare =
    analysis?.board.find((square) => square.square === analysis.probeChoice) ?? null;
  const directionalSquare = selected ?? probeChoiceSquare;

  function submitMoves() {
    setSubmittedMoveString(moveString);
    setSelectedSquare(null);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <h1>Othello-GPT</h1>
            <p>Probe Toy</p>
          </div>
        </div>
        <form
          className="move-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitMoves();
          }}
        >
          <label htmlFor="move-string">Move string</label>
          <div className="move-input-row">
            <input
              id="move-string"
              value={moveString}
              onChange={(event) => setMoveString(event.target.value)}
              spellCheck={false}
            />
            <button type="submit" aria-label="Run probes">
              <Play size={18} fill="currentColor" />
            </button>
          </div>
          {error && <p className="input-error">{error}</p>}
        </form>
        <div className="header-controls">
          <label className="select-label">
            <SlidersHorizontal size={16} />
            <select
              value={legalitySource}
              onChange={(event) => setLegalitySource(event.target.value as LegalitySource)}
            >
              <option value="direct_post6">direct post6</option>
              <option value="ray_max">ray max</option>
              <option value="simulator">simulator</option>
            </select>
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showDiagnostics}
              onChange={(event) => setShowDiagnostics(event.target.checked)}
            />
            logits diagnostic
          </label>
        </div>
      </header>

      {analysis && (
        <>
          <section className="status-strip">
            <span><Activity size={15} /> Fixture runtime</span>
            <span>{analysis.toPlay} to move</span>
            <span>{analysis.rankedMoves.length} probe-legal candidates</span>
            {showDiagnostics && (
              <span className={analysis.agreesWithFinalLogits ? "status-good" : "status-warn"}>
                {analysis.agreesWithFinalLogits ? "agrees with logits" : "differs from logits"}
              </span>
            )}
          </section>

          <div className="main-grid">
            <BoardView
              board={analysis.board}
              rankedMoves={analysis.rankedMoves}
              probeChoice={analysis.probeChoice}
              finalLogitChoice={analysis.finalLogitChoice}
              showDiagnostics={showDiagnostics}
              onSelectSquare={setSelectedSquare}
              selectedSquare={selected?.square ?? null}
            />
            <div className="side-stack">
              <MoveRanking
                moves={analysis.rankedMoves}
                probeChoice={analysis.probeChoice}
                finalLogitChoice={analysis.finalLogitChoice}
                agrees={analysis.agreesWithFinalLogits}
                showDiagnostics={showDiagnostics}
              />
              <SquareInspector square={selected} showDiagnostics={showDiagnostics} />
              {activeStage === "post6" && <DirectionalProbePanel square={directionalSquare} />}
            </div>
          </div>

          <ProbeRail activeStage={activeStage} onStageSelect={setActiveStage} />
        </>
      )}
    </main>
  );
}
