# Compare Screen Sleekness (Phase 1)

Last updated: 2026-02-04

Goal: make Compare feel premium (Beli-sleek) while staying faithful to Phase 1 invariants:

> Comparisons create judgment. Metadata provides context.

## Constraints (hard)
- No swipe.
- No custom keyboard shortcuts.
- No covers in Compare.
- Skip + Undo are first-class and guilt-free.
- Motion must be calm (fade / gentle slide). If it draws attention → fail.
- Mobile: only one primary surface at a time (Compare is focused).

## PR Plan

### PR1 — Tap-to-choose cards + calm commit motion (smallest needle-mover)

**A) Whole card is the control**
- Add `data-action="compare:win"` and `data-winner="a|b"` directly to each `.compareCard`.
- Keep the existing buttons (A wins / B wins / Skip / Undo) for now as secondary affordance + accessibility fallback.
- A11y: add `role="button"` and an `aria-label` for each card. Do **not** add `tabindex="0"` in PR1 (avoid implicit keyboard path until explicitly desired).

**B) Pending-lock + immediate feedback**
- Introduce a tiny UI-only pending state (e.g., `state.comparePending`).
- On tap:
  1) set pending state and `render()` immediately (so CSS feedback appears before any awaits)
  2) lock out all Compare actions while pending (A/B, Skip, Undo)
  3) perform async persistence + recompute
  4) clear pending and render next pair

**C) Calm motion**
- On press: subtle “pressed” state for chosen card; other card slightly fades.
- On commit: short crossfade to next pair (no bounce, no celebration).
- Respect `prefers-reduced-motion`.

**Acceptance**
- Tapping a card behaves exactly like pressing A wins / B wins.
- Rapid double-tap does not record two comparisons.
- While pending, Skip/Undo cannot interleave.

**Tests**
- Add a regression e2e asserting a rapid double-tap does not increment progress twice.
- Add (or update) a spec that clicks the `.compareCard` itself at least once (not just the buttons).

### PR2 — De-emphasize A/B buttons (optional)
Only after PR1 lands and feels good.

Options:
- Keep buttons but style as secondary (smaller / muted).
- Or remove A/B buttons from the primary grid and leave only Skip/Undo prominent, while retaining a discoverable fallback for accessibility.

Acceptance:
- New users still discover the interaction quickly (no confusion).

### PR3 — “Liked / Not for me / Skip” pre-step for `after_finish` (measure-first, optional)
Only if after-finish completion time still feels too slow after PR1/PR2.

- Add a tiny pre-step in `after_finish` that asks: “Quick check — did you like it?”
- Inputs: Liked / Not for me / Skip
- It must not change scoring; it only biases step-0 opponent selection (anchor slightly above/below median).

Metrics to validate:
- after_finish session completion time (median, p90)
- skip rate and undo rate changes

