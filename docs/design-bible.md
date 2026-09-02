# Othello Probe Toy Design Bible

## Product Feel

The app should feel like a clean research instrument with a playful neural layer. It is not a landing page, not a notebook, and not a dark sci-fi dashboard. The interface should make the probe pipeline legible at a glance:

```text
move string -> Othello-GPT residual stream -> L4 activation -> post6 legality -> post7 preference -> logits diagnostic
```

The user should immediately understand three things:

- The board is rendered from the move string until the real L4 board probe head is recovered.
- Legal moves are highlighted by probe-derived scores.
- The selected move comes from the preference probe, while final logits are only a comparison.

## Reference Concepts

Generated concept references:

- [Clean research UI](assets/concept-clean-research-ui.png)
- [Neural wire UI](assets/concept-neural-wire-ui.png)
- [Compact probe dashboard](assets/concept-compact-probe-dashboard.png)

Use the compact probe dashboard as the main implementation target. Borrow the delicate wire traces from the neural-wire concept, but keep them secondary.

## Design Principles

### Dense But Calm

This is an analysis tool. Avoid oversized hero areas, onboarding copy, and decorative cards. The default screen should show the board, move input, probe ranking, and layer pipeline without scrolling on desktop.

### Playful Through Systems, Not Decoration

Playfulness should come from:

- Smooth marker transitions.
- Tiny wire traces from board squares to probe stages.
- Layer nodes lighting up during inference.
- Disc and legal-move markers that feel tactile.

Do not use decorative blobs, bokeh, mascot art, or background gradients.

### Mechanistic Claims Stay Visible

Every visual cue must preserve the distinction between:

- `L4 activation`: exported model-internal state; board-state probe head pending.
- `post6 legality probe`: legal mask prediction.
- `post7 preference probe`: legal-move preference ranking.
- `final logits`: diagnostic comparison, not the selector.

## Layout

### Desktop

Use a two-zone layout with a compact probe rail:

```text
+----------------------------------------------------------------+
| Logo/title          Move string input              status       |
+--------------------------------+-------------------------------+
|                                | Legal moves / probe ranking    |
|  8x8 Othello board             | Final-logit diagnostic toggle  |
|                                | Hover details                  |
+--------------------------------+-------------------------------+
| Input -> L0 ... L4 -> L5 -> post6 -> post7 -> logits            |
+----------------------------------------------------------------+
```

Recommended proportions:

- Header/input: 72-96px tall.
- Board column: 45-55% of desktop width.
- Analysis column: 35-45% of desktop width.
- Probe rail: 160-220px tall.

### Mobile

Use a single-column stack:

```text
title
move input
board
probe choice summary
ranked moves
probe rail
diagnostics
```

The board must remain square and fully visible. Do not shrink labels until they become unreadable; hide secondary rail annotations first.

## Color System

Use color semantically and consistently.

### Core Colors

```css
:root {
  --bg: #fbfaf7;
  --surface: #ffffff;
  --text: #101820;
  --muted: #667085;
  --line: #d8ded8;

  --board: #2f8f55;
  --board-dark: #17603a;
  --board-grid: rgba(15, 55, 35, 0.42);

  --disc-black: #15191d;
  --disc-white: #f4f1ea;

  --probe-board: #e6a500;
  --probe-legality: #ff6655;
  --probe-preference: #13a99a;
  --probe-logits: #8a95a3;
}
```

### Probe Semantics

- Board reconstruction: warm yellow/amber.
- Legality: coral/red-orange.
- Preference: teal.
- Final logits: neutral gray.
- Agreement: teal when true, coral when false, gray when disabled.

Never reuse coral for preference or teal for illegality. The app depends on this color distinction.

## Typography

Use a modern sans-serif with excellent numeric readability.

Preferred stack:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Type scale:

- App title: 28-36px, weight 750.
- Section heading: 16-20px, weight 700.
- Body: 14-16px.
- Table values: 13-15px.
- Board coordinates: 14-16px, weight 650.
- Probe rail labels: 13-15px.

Letter spacing should be `0`.

## Board Design

The board is the main object. It should be crisp and tactile.

Board rules:

- Always square.
- 8x8 grid with stable cell dimensions.
- Coordinates shown on top and left, optionally mirrored on bottom/right for desktop.
- Rounded board corner radius: 8px max.
- Cells may have subtle variation in green, but no noisy texture.
- Discs use radial shading and a small shadow.

Cell overlays:

- Simulator legal move: small dark green dot.
- Direct legality probe legal move: coral ring or small coral dot.
- Preference score: teal ring intensity or small vertical score bar.
- Probe-selected move: strong teal outline plus subtle pulse.
- Final-logit diagnostic choice: gray outline or dashed ring.
- Disagreement: selected move remains teal; final-logit move gets dashed gray/coral outline.

Do not place long text inside board cells. Use hover details or the side panel.

## Probe Rail

The probe rail is the app's signature visual element.

It should show:

```text
Input tokens -> L0 -> L1 -> L2 -> L3 -> L4 -> L5 -> post6 -> post7 -> logits
```

Highlight these nodes:

- `L4 activation`
- `post6 legality probe`
- `post7 preference probe`
- `logits diagnostic`

Each highlighted node gets:

- A color-coded outline.
- A short label.
- A one-line purpose.
- Optional tiny sparkline or miniature board glyph.

Example labels:

- `L4 activation`: `board-state head pending`
- `post6 legality probe`: `predicts legal mask`
- `post7 preference probe`: `ranks legal moves`
- `logits diagnostic`: `comparison only`

Wire decoration:

- Use thin 1px lines.
- Keep opacity low, around 0.18-0.35.
- Route wires from board or input into the rail.
- Use teal for preference paths, coral for legality paths, amber for board paths.
- Avoid dense tangled wires behind text.

## Ranking Panel

The ranking panel should make top-k behavior obvious.

Columns:

- Rank
- Move
- Preference score
- Legality score
- Final-logit score, hidden unless diagnostics are on
- Agreement marker, hidden unless diagnostics are on

Default sorting:

```text
legal candidates sorted descending by post7 preference score
```

Use horizontal bars for scores. Bars should have stable widths and not resize the table.

Ranking colors:

- Top probe choice: teal fill.
- Legal but lower-ranked: muted teal.
- Low preference: coral only when useful to indicate weaker preference, not invalidity.
- Invalid/probe-illegal: gray or disabled, only shown when diagnostics demand it.

## Interaction States

### Input

The move string input should support:

- `C4 C3 D3 E3 B2`
- lower-case moves
- extra spaces
- `pass` and `0`

Invalid input should show a precise inline error:

```text
E3 is illegal after move 4.
```

Do not open a modal for input errors.

### Loading

Browser inference may take time on first load. Use a compact state:

- Probe rail nodes shimmer left to right.
- Board dims slightly.
- Text: `Loading model assets...` or `Running probes...`

Do not use a large spinner centered on an empty page.

### Hover

Hovering a board square should show:

- Square label.
- Simulator state.
- L4 activation metadata; once recovered, L4 board-probe state and confidence.
- Simulator legal yes/no.
- Direct post6 legality score.
- Ray-max legality score if enabled.
- Post7 preference score if legal.
- Final-logit score if diagnostics are on.

Use a small anchored panel. Keep it off the board when possible.

## Copy Rules

Keep labels literal and technical. Avoid explaining the whole project in prose.

Good:

- `Probe choice`
- `Final-logit diagnostic`
- `Legal mask`
- `Board readout`
- `Preference rank`
- `Agreement`
- `Simulator mismatch`

Avoid:

- `See how the model thinks`
- `AI brain magic`
- `The model understands Othello`
- `Best move`

Use `preferred move` or `probe-selected move`, not `best move`.

## Component Inventory

### `AppShell`

Owns global layout, header, and responsive columns.

### `MoveInput`

Text input, run button, parse status, examples menu.

### `BoardView`

Renders the main Othello board, discs, candidate markers, selected move marker, and hover targets.

### `ProbeRail`

Renders model stages and probe taps. Should be data-driven from a stage list.

### `MoveRankingTable`

Renders legal candidates and diagnostic comparisons.

### `SquareInspector`

Displays hover or selected-square details.

### `DiagnosticsPanel`

Shows final-logit comparison, agreement, probe metadata, and selected legality source.

### `Legend`

Small color and marker legend. Keep it compact.

## Motion

Use small motion to make the inference path understandable:

- On submit, pulse `Input`, then `L4`, then `post6`, then `post7`.
- Legal markers fade in after the post6 pulse.
- Preference rings expand lightly after the post7 pulse.
- Agreement badge updates last.

Timing:

- 120-180ms for marker fades.
- 240-400ms for rail pulse sequence.
- Respect `prefers-reduced-motion`.

Do not animate continuously except for a very subtle selected-move pulse, and disable that under reduced motion.

## Accessibility

The app must not rely on color alone.

- Legal moves need shape markers.
- Probe-selected move needs a distinct outline.
- Final-logit diagnostic needs dashed styling.
- Agreement status needs text.
- Board cells need aria labels.
- Ranking table must be keyboard-readable.

Minimum contrast:

- Body text: WCAG AA.
- Table labels: WCAG AA.
- Board markers: visible against green board in light and dim states.

## Implementation Notes

Use CSS custom properties for all semantic colors. Do not hardcode probe colors inside individual components.

Represent probe stages as data:

```ts
const PROBE_STAGES = [
  { id: "l4-activation", label: "L4 activation", color: "board", purpose: "board head pending" },
  { id: "post6-legality", label: "post6 legality probe", color: "legality", purpose: "predicts legal mask" },
  { id: "post7-preference", label: "post7 preference probe", color: "preference", purpose: "ranks legal moves" },
  { id: "logits", label: "logits diagnostic", color: "logits", purpose: "comparison only" },
];
```

Keep the board and probe rail independent. The rail explains the pipeline; the board shows the current position. Connecting wires are decoration and should not become layout dependencies.

## Default View

Default settings:

- Legality source: `direct_post6`.
- Preference source: `post7`.
- Diagnostics: collapsed.
- Final-logit marker: hidden until diagnostics are enabled.
- Simulator mismatch warnings: visible only when mismatches exist.

## Design QA Checklist

Before calling the design implemented:

- The board is visible above the fold on desktop and mobile.
- Text does not overlap or clip at narrow widths.
- Probe colors are consistent across board, rail, and ranking table.
- Final logits are visually secondary.
- The phrase `best move` does not appear in the UI.
- The app still works if there are only two legal moves.
- The app still works if the probe choice disagrees with final logits.
- The app still works with reduced motion enabled.
