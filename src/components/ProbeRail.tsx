const stages = [
  { id: "input", label: "Input", purpose: "tokens", tone: "neutral", detail: "Move tokens enter the transformer." },
  { id: "l0", label: "L0", purpose: "", tone: "neutral" },
  { id: "l1", label: "L1", purpose: "", tone: "neutral" },
  { id: "l2", label: "L2", purpose: "", tone: "neutral" },
  { id: "l3", label: "L3", purpose: "", tone: "neutral" },
  {
    id: "l4",
    label: "L4",
    purpose: "board probe",
    tone: "board",
    detail: "L4 board probe — Board readout. Reconstructs empty, mine, and theirs states from the final-token layer-4 residual stream.",
  },
  { id: "l5", label: "L5", purpose: "", tone: "neutral" },
  {
    id: "post6",
    label: "post6",
    purpose: "legality probe",
    tone: "legality",
    detail: "post6 legality probe — Legal mask. Marks candidate moves after layer 6; the drilldown shows directional capture rays.",
  },
  {
    id: "post7",
    label: "post7",
    purpose: "preference probe",
    tone: "preference",
    detail: "post7 preference probe — Preference rank. Ranks legal moves; the probe-selected move comes from this ranking.",
  },
  {
    id: "logits",
    label: "logits",
    purpose: "diagnostic",
    tone: "logits",
    detail: "Final logits — Diagnostic only. They are compared with the probe choice and never select the move.",
  },
];

interface ProbeRailProps {
  activeStage: string;
  onStageSelect: (stageId: string) => void;
}

export function ProbeRail({ activeStage, onStageSelect }: ProbeRailProps) {
  return (
    <section className="probe-rail" aria-label="Transformer probe rail">
      <div className="wire-field" aria-hidden="true">
        <span className="wire wire-board" />
        <span className="wire wire-legality" />
        <span className="wire wire-preference" />
      </div>
      <div className="rail-track">
        {stages.map((stage, index) => (
          <div className="rail-stage-wrap" key={stage.id}>
            <button
              className={`rail-stage tone-${stage.tone} ${activeStage === stage.id ? "active" : ""}`}
              onClick={() => onStageSelect(stage.id)}
              type="button"
            >
              <span>{stage.label}</span>
            </button>
            {stage.purpose && <p>{stage.purpose}</p>}
            {stage.detail && (
              <span className="rail-tooltip" role="tooltip">
                {stage.detail}
              </span>
            )}
            {index < stages.length - 1 && <span className="rail-connector" />}
          </div>
        ))}
      </div>
    </section>
  );
}
