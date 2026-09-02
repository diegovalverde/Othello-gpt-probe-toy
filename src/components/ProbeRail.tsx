const stages = [
  { id: "input", label: "Input", purpose: "tokens", tone: "neutral" },
  { id: "l0", label: "L0", purpose: "", tone: "neutral" },
  { id: "l1", label: "L1", purpose: "", tone: "neutral" },
  { id: "l2", label: "L2", purpose: "", tone: "neutral" },
  { id: "l3", label: "L3", purpose: "", tone: "neutral" },
  { id: "l4", label: "L4", purpose: "board probe", tone: "board" },
  { id: "l5", label: "L5", purpose: "", tone: "neutral" },
  { id: "post6", label: "post6", purpose: "legality probe", tone: "legality" },
  { id: "post7", label: "post7", purpose: "preference probe", tone: "preference" },
  { id: "logits", label: "logits", purpose: "diagnostic", tone: "logits" },
];

export function ProbeRail() {
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
            <div className={`rail-stage tone-${stage.tone}`}>
              <span>{stage.label}</span>
            </div>
            {stage.purpose && <p>{stage.purpose}</p>}
            {index < stages.length - 1 && <span className="rail-connector" />}
          </div>
        ))}
      </div>
    </section>
  );
}
