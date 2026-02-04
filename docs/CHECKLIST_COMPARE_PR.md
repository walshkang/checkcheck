# Compare PR Checklist (Phase 1)

Last updated: 2026-02-04

Use this checklist before merging any Compare changes.

## Invariants
- ☐ No covers in Compare.
- ☐ Comparisons remain the primitive truth (no metadata affects scoring).
- ☐ Skip and Undo remain prominent and guilt-free.

## Input
- ☐ Whole card is tappable for A/B wins.
- ☐ Buttons remain as secondary affordance (unless explicitly removed in a follow-up PR).
- ☐ While saving/recomputing, **all** Compare actions are locked (A/B/Skip/Undo).

## Motion
- ☐ Calm only: press state + crossfade/gentle slide.
- ☐ No bounce/pulse/celebration.
- ☐ `prefers-reduced-motion` disables transitions.

## Reliability
- ☐ Rapid double-tap cannot create two comparisons.
- ☐ Undo always removes the most recent comparison.
- ☐ Skip never affects scoring.

## Tests
- ☐ E2E: at least one spec clicks a compare card (not only buttons).
- ☐ E2E: regression for rapid double-tap not incrementing progress twice.

