import { BrainCircuit, CircleDot, ListOrdered, SquareStack } from "lucide-react";

interface StageDetailsProps {
  activeStage: string;
}

const details = {
  l4: {
    eyebrow: "L4 activation",
    title: "Board hook",
    body: "The ONNX graph exposes the final-token layer-4 residual stream. The learned board-state head is still pending.",
    tone: "board",
    Icon: SquareStack,
  },
  post6: {
    eyebrow: "post6 legality probe",
    title: "Legal mask",
    body: "A direct legal-square probe marks candidate moves after layer 6; the drilldown shows directional capture rays.",
    tone: "legality",
    Icon: CircleDot,
  },
  post7: {
    eyebrow: "post7 preference probe",
    title: "Preference rank",
    body: "A legal-vs-legal preference probe ranks candidate moves. The selected move comes from this ranking.",
    tone: "preference",
    Icon: ListOrdered,
  },
  logits: {
    eyebrow: "final logits",
    title: "Diagnostic only",
    body: "The output logits are shown only to compare against the probe choice; they do not select the move.",
    tone: "logits",
    Icon: BrainCircuit,
  },
} as const;

export function StageDetails({ activeStage }: StageDetailsProps) {
  const detail = details[activeStage as keyof typeof details] ?? details.post7;
  const Icon = detail.Icon;

  return (
    <section className={`stage-details tone-${detail.tone}`}>
      <Icon size={22} />
      <div>
        <p className={`eyebrow ${detail.tone === "legality" ? "legality" : ""}`}>
          {detail.eyebrow}
        </p>
        <h2>{detail.title}</h2>
        <p>{detail.body}</p>
      </div>
    </section>
  );
}
