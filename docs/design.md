# Othello Probe Toy Design

## Goal

Build a local, static webpage that accepts an Othello move string, reconstructs the board from Othello-GPT internals, highlights legal moves from probes, ranks legal moves by the late preference probe, and optionally compares the probe-selected move with the model's final-logit choice.

The application must not require a hosted backend or a long-running local Python server. After build/export, it should run as static browser assets.

## User Experience

The first screen is the tool itself:

- A move input accepting prompts such as `C4 C3 D3 E3 B2`.
- An 8x8 Othello board with coordinates.
- Disc colors for reconstructed board state relative to the next player to move.
- Legal move markers over candidate squares.
- A selected next move marker from the preference probe.
- A ranked legal-move table showing probe score, direct-legality score, and optional final-logit score.
- A diagnostic toggle for showing final-logit agreement or disagreement.

The key story shown in the UI is:

1. The prompt determines a real Othello position.
2. The model's residual stream is decoded into board state and legality.
3. The next move is selected from a probe, not from output logits.
4. Final logits are available only as a diagnostic comparison.

## Recommended Stack

Use a static frontend:

- Vite
- React
- TypeScript
- CSS modules or plain scoped CSS
- `onnxruntime-web` for browser-side model inference

Avoid FastAPI, Streamlit, Gradio, or any backend process in the first version. They are useful for fast demos but violate the no-server constraint.

## Runtime Architecture

```text
User move string
  -> TypeScript parser/tokenizer
  -> TypeScript Othello simulator validation
  -> ONNX Othello-GPT inference in browser
  -> Extract final-token activations, probe scores, and logits
  -> Render board, legal moves, ranked probe choice, and diagnostics
```

The browser loads generated static runtime assets:

- `model/othello-gpt-activations.onnx`
- `ort/ort-wasm-simd-threaded.*` from `onnxruntime-web`

## Model Export

Create a small PyTorch export wrapper around Othello-GPT that returns only the tensors needed by the UI:

- `blocks.4.hook_resid_post[:, -1, :]`
- `blocks.6.hook_resid_post[:, -1, :]`
- `blocks.7.hook_resid_post[:, -1, :]`
- learned post6 direct-legality scores
- learned post6 capture-ray scores
- learned post7 preference scores
- `logits[:, -1, :]`

Export that wrapper to ONNX with dynamic sequence length up to Othello-GPT's context limit.

The exported graph should not expose the full cache. Returning only required activations keeps the browser artifact smaller and the UI contract stable.

## Probe Heads

Fold PyTorch probe checkpoints into the ONNX graph when the checkpoints are available. Do not ship fabricated result JSON.

Required probes:

- L4 board-state probe: `Linear(512, 64 * 3)` for `empty`, `mine`, `theirs`.
- Post6 direct-legality probe: `Linear(512, 64)`.
- Post7 preference probe: `Linear(512, 64)`.

For every standardized probe head, preserve:

- `mean`
- `std`
- `weight`
- `bias`
- hook/site metadata
- score semantics

The frontend computes:

```text
h_std = (h - mean) / std
score = weight @ h_std + bias
```

For preference probes that already include `raw_weight` and `raw_bias`, we can either use the raw residual-space parameters directly or standardize consistently with the saved `state_dict`. Pick one convention and encode it in metadata.

## Move Parsing And Board Simulation

Implement the Othello token convention in TypeScript:

- Board files: `A` through `H`.
- Board ranks: `1` through `8`.
- Starting center squares are not move tokens.
- Pass is represented as `pass` or `0`.
- Token `0` means pass.
- Non-center board moves map to Othello-GPT token IDs `1..60`.

The frontend simulator should:

- Validate the move string before model inference.
- Reject illegal moves with a precise message.
- Track `to_play`.
- Produce simulator board state and simulator legal moves.
- Provide simulator legality as a sanity overlay, even when the displayed legality source is probe-based.

## Legality Modes

The UI should support three legality sources:

- `simulator`: exact Othello rules, useful for sanity checks.
- `direct_post6`: direct linear legal-square probe, best exact-mask probe result.
- `ray_max`: directional capture probe with max over eight directions, best for explaining the directional-probe story.

The default should be `direct_post6` for clean behavior. The `ray_max` mode should remain available because it better exposes the mechanistic directional story.

## Move Selection

The selected next move is:

```text
legal_candidates = squares marked legal by selected legality source
probe_choice = argmax preference_probe_post7(square) over legal_candidates
```

The final-logit choice is diagnostic only:

```text
final_logit_choice = argmax final_vocab_logit(token(square)) over simulator-legal board moves
```

The UI should explicitly separate these:

- "Probe choice"
- "Final-logit diagnostic"
- "Agreement"

This avoids implying that the probe is a perfect reconstruction of the output head computation.

## Frontend Components

Suggested component structure:

- `MoveInput`: prompt text field, parse errors, example prompts.
- `BoardView`: 8x8 board, discs, legal markers, selected move marker, hover details.
- `MoveRanking`: ranked legal candidates with probe, legality, and diagnostic scores.
- `DiagnosticsPanel`: model/probe metadata, agreement flags, top-k comparison.
- `Legend`: compact visual key for discs and markers.

The board should be the visual center of the app. The ranking and diagnostics should sit beside it on desktop and below it on mobile.

## Runtime Data Contract

Internally, the frontend normalizes ONNX output to this TypeScript shape:

See `src/types/probe.ts`. The current implementation computes board state from the simulator, post6 legality from ONNX probe heads, post7 ranking from the ONNX preference head, and final-logit comparison from the ONNX model logits.

This can be produced entirely client-side after ONNX inference.

## Build Steps

1. Create a Python export script in the source repo that loads Othello-GPT and emits an ONNX model with the required outputs.
2. Fold available learned probe heads into that ONNX export.
3. Build the Vite React app.
4. Implement TypeScript Othello parsing and simulation.
5. Implement ONNX inference and probe math.
6. Build the board UI and ranking table.
7. Verify several known prefixes against the existing Python script/notebook outputs.

## Verification Plan

Use a small reference set of move strings:

- Opening prefix
- Midgame prefix with several legal moves
- Position where probe choice agrees with final logits
- Position where probe choice disagrees with final logits
- Illegal input
- Pass input, if a pass position is available

For each valid reference prefix, compare browser output against Python reference output:

- Token IDs
- Simulator board
- Simulator legal mask
- L4 activation shape and, once available, board-probe argmax labels
- Post6 direct-legality scores within tolerance
- Post7 preference ranking within tolerance
- Final-logit legal ranking within tolerance

## Main Risks

ONNX export may be the hardest part because `HookedTransformer.run_with_cache` is Python-hook oriented. The likely solution is to export a purpose-built wrapper that reproduces the Othello-GPT forward path and directly returns intermediate tensors.

Browser performance should be acceptable because Othello-GPT is small: 8 layers, `d_model=512`, short context. Still, the ONNX artifact size and first-load time should be measured.

Probe fidelity depends on using the exact same token convention, final-token activation, standardization stats, and hook sites as the original experiments.

## Milestones

### Milestone 1: Browser Model Runtime

Export Othello-GPT to ONNX, load it with `onnxruntime-web`, and return required activations/logits for arbitrary valid move strings.

### Milestone 2: Integrated Probe Heads

Fold available post6 and post7 learned probe heads into the ONNX graph and use them for legal markers and ranking.

### Milestone 3: L4 Board Probe

Recover or train the L4 board-state probe checkpoint and fold it into ONNX.

## Open Questions

- Should the default preference site be `post7` or `post6/pre7`? `post7` is marginally better, while `post6/pre7` emphasizes that the ranking is already mostly present before Layer 7.
- Should default legality source be `direct_post6` for accuracy or `ray_max` for interpretability?
- Should final-logit diagnostics be hidden by default to keep the story focused on probe-derived behavior?
- Should the app permit simulator legality as the candidate mask while showing probe legality as an overlay, to avoid invalid probe-selected moves in demos?

## Recommended First Version

Use:

- `direct_post6` as the default legal mask.
- `post7` as the default preference ranking.
- final logits hidden behind a diagnostics toggle.
- simulator legality always available as a thin outline or warning when it differs from probe legality.

This gives a robust static webpage while preserving the mechanistic distinction between probe-derived board/legality/preference and ordinary output-logit decoding.
