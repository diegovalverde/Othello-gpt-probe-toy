import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { BoardView } from "../components/BoardView";
import { ProbeRail } from "../components/ProbeRail";
import { ProbeVisualization } from "../components/ProbeVisualization";
import { SquareInspector } from "../components/SquareInspector";
import { BrowserOnnxRuntime, DEFAULT_INPUT } from "../inference/browserRuntime";
import { runAnalysis } from "../inference/runtime";
import type { BoardSquareView, ProbeAnalysis } from "../types/probe";

export function App() {
  const [moveString, setMoveString] = useState(DEFAULT_INPUT);
  const showDiagnostics = true;
  const [selectedSquare, setSelectedSquare] = useState<BoardSquareView | null>(null);
  const [activeStage, setActiveStage] = useState("post7");
  const [analysis, setAnalysis] = useState<ProbeAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runtime = useMemo(() => new BrowserOnnxRuntime(), []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsRunning(true);
      runAnalysis(runtime, moveString, "direct_post6").then((result) => {
        if (cancelled) {
          return;
        }
        setAnalysis(result.analysis);
        setError(result.error);
        setIsRunning(false);
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [runtime, moveString]);

  const selected =
    selectedSquare && analysis?.board.find((square) => square.square === selectedSquare.square)
      ? analysis.board.find((square) => square.square === selectedSquare.square) ?? null
      : null;
  const probeChoiceSquare =
    analysis?.board.find((square) => square.square === analysis.probeChoice) ?? null;
  const directionalSquare = selected ?? probeChoiceSquare;

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
        <div className="move-form">
          <label htmlFor="move-string">Move string</label>
          <div className="move-input-row">
            <input
              id="move-string"
              value={moveString}
              onChange={(event) => {
                setMoveString(event.target.value);
                setSelectedSquare(null);
              }}
              spellCheck={false}
            />
          </div>
          {error && <p className="input-error">{error}</p>}
        </div>
      </header>

      {isRunning && <p className="runtime-loading">Loading ONNX runtime and running probes...</p>}

      {analysis && (
        <>
          <section className="status-strip">
            <span title={runtime.description}><Activity size={15} /> {runtime.label}</span>
            <span>{analysis.toPlay} to move</span>
            <span>{analysis.rankedMoves.length} probe-legal candidates</span>
            <span
              className={analysis.boardProbeMismatchCount === 0 ? "status-good" : "status-warn"}
              title="L4 board-probe reconstruction compared with simulator replay"
            >
              L4 board {Math.round(analysis.boardProbeAgreement * 100)}%
            </span>
            {showDiagnostics && (
              <span className={analysis.agreesWithFinalLogits ? "status-good" : "status-warn"}>
                {analysis.agreesWithFinalLogits ? "agrees with logits" : "differs from logits"}
              </span>
            )}
          </section>

          <ProbeRail activeStage={activeStage} onStageSelect={setActiveStage} />

          <div className="main-grid">
            <BoardView
              board={analysis.board}
              rankedMoves={analysis.rankedMoves}
              probeChoice={analysis.probeChoice}
              finalLogitChoice={analysis.finalLogitChoice}
              showDiagnostics={showDiagnostics}
              onSelectSquare={setSelectedSquare}
              selectedSquare={selected?.square ?? null}
              directionalSquare={activeStage === "post6" ? directionalSquare : null}
              showPreference={activeStage === "post7"}
              showLogitRanks={activeStage === "post7" && showDiagnostics}
            />
            <div className="side-stack">
              <ProbeVisualization activeStage={activeStage} board={analysis.board} />
              <SquareInspector square={selected} showDiagnostics={showDiagnostics} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
