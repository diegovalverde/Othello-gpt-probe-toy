# Othello-GPT Probe Toy

A static browser prototype for exploring Othello-GPT probe readouts.

The app is currently fixture-driven: it renders the intended interaction model and visual design before the ONNX model export and real probe tensor assets are connected.

## Current Prototype

The app shows:

- an Othello move-string input
- a large Othello board
- probe-legal move markers
- a post7 preference ranking
- a square inspector
- clickable probe stages for L4, post6, post7, and logits
- a post6 directional capture-ray drilldown

The move selected in the UI is the probe-selected move. Final logits are treated as a diagnostic comparison only.

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

1. Export Othello-GPT to an ONNX graph that returns the final-token L4, post6, post7 activations and final logits.
2. Convert PyTorch probe checkpoints to static frontend assets.
3. Replace the fixture runtime with the browser ONNX runtime.
4. Add parity fixtures comparing TypeScript/browser output against the Python reference scripts.

