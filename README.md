# Othello-GPT Probe Toy

A static browser prototype for exploring Othello-GPT probe readouts.

The app runs a real browser-side ONNX graph exported from Neel Nanda's Othello-GPT checkpoint. The graph returns final-token L4/post6/post7 activations, direct post6 legality scores, post6 capture-ray scores, post7 preference scores, and final logits. It does not use precomputed move-ranking result JSON.

## Current Prototype

The app shows:

- an Othello move-string input
- a large Othello board
- probe-legal move markers from learned post6 probes
- a post7 preference ranking from the learned preference probe
- a square inspector
- clickable probe stages for L4, post6, post7, and logits
- a post6 directional capture-ray drilldown

The move selected in the UI is the probe-selected move. Final logits are treated as a diagnostic comparison only.

## Export The ONNX Asset

Generate the local model artifact from the real TransformerLens checkpoint and probe checkpoints:

```bash
/Users/diegovalverdegarro/workspace/projects/TransformerLens/.venv/bin/python scripts/export_onnx_model.py
```

This writes `public/model/othello-gpt-activations.onnx`. The file is intentionally gitignored because it is about 98 MiB and is fully reproducible from the script. The exporter verifies the ONNX output against PyTorch with ONNX Runtime before it exits.

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build Static Assets

```bash
npm run build
```

The production build is written to `dist/`. The eventual target is a static webpage that runs browser-side inference with ONNX and static probe assets, with no hosted backend.

## Important Docs

- [Application design](docs/design.md)
- [Design bible](docs/design-bible.md)
- [Agent guidance](AGENTS.md)

## Next Implementation Steps

1. Export or recover the L4 board-state probe checkpoint and fold it into the ONNX graph.
2. Add a small Python reference command that emits parity rows for selected move strings.
3. Add a browser smoke test that confirms ONNX Runtime produces rankings for those move strings.
