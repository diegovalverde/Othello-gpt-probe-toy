# AGENTS.md

Guidance for AI coding agents working on the Othello Probe Toy.

## Project Goal

Build a static browser app for exploring Othello-GPT probes. The app accepts an Othello move string, runs browser-side model inference, decodes board and legality probes, ranks legal moves with the preference probe, and optionally compares the probe choice to final logits as a diagnostic.

The app should not require a hosted backend or a long-running local Python server.

## Core Product Rules

- First screen is the tool, not a landing page.
- Keep the app usable as a static webpage.
- Prefer Vite, React, TypeScript, and `onnxruntime-web`.
- Keep PyTorch/Python only for export and verification scripts, not runtime UI.
- Do not call the selected move the "best move"; use "probe choice", "probe-selected move", or "preferred move".
- Final logits are diagnostic only. The move selector must come from the preference probe.

## Probe Semantics

Preserve these distinctions in code, UI labels, and docs:

- `L4 board probe`: reconstructs board state.
- `post6 legality probe`: predicts legal move mask.
- `post7 preference probe`: ranks legal moves.
- `final logits`: comparison only.

Default UI behavior:

- Legality source: `direct_post6`.
- Preference source: `post7`.
- Diagnostics collapsed.
- Show simulator mismatch warnings only when mismatches exist.

## Design Direction

Follow [docs/design-bible.md](docs/design-bible.md).

Visual tone:

- Clean research instrument.
- Playful through wire traces, probe rail states, and tactile board markers.
- No dark sci-fi dashboard.
- No decorative blobs, bokeh, or purple-gradient theme.
- Board is the main visual object.

Probe colors:

- Board reconstruction: amber.
- Legality: coral.
- Preference: teal.
- Final logits: neutral gray.

## Implementation Shape

Suggested structure:

```text
src/
  app/
  components/
  inference/
  othello/
  probes/
  styles/
  types/
```

Keep Othello parsing/simulation independent from UI components. Keep ONNX inference independent from probe math.

## Data Contract

Normalize runtime results around the contract in [docs/design.md](docs/design.md):

- input move string
- next player
- per-square board state and probe scores
- legal move scores
- probe ranking
- final-logit ranking when diagnostics are enabled
- agreement flag

## Verification

Before claiming probe runtime work is correct, compare browser or TypeScript outputs against Python references for fixture move strings:

- token IDs
- simulator board
- simulator legal mask
- L4 board probe labels
- post6 legality scores
- post7 preference ranking
- final-logit legal ranking

Use the repo venv for Python checks when working near TransformerLens artifacts.

## Git

Keep generated model artifacts out of git by default unless explicitly requested. Large exported files such as ONNX and WASM runtime assets should stay ignored or be handled through a documented artifact path.

