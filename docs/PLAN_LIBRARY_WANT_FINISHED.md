# Plan: Library Want/Finished Views + Calibration at 5

Last updated: 2026-02-04

## Goal

Make the Library mental model crisp:

- **Want to Read** = saved queue (lightweight, no scores)
- **Finished** = rated history (scored + ranked)
- **Calibration** (“Mic check”) becomes an **initiation moment** prompted at **5 active finished** books, while Compare remains available as a utility surface.
- **After-finish placement** remains the default loop (“Do 3 more comparisons”).

## Scope (Phase 1 / Shippable Slice)

### Checklist (tracked)

- [x] Add `Library` sub-views (`Want` / `Finished`) driven by `library_entries.status`
- [x] Default Library view = `Want`
- [x] Show calibration banner **only** in `Finished` view when:
  - `activeFinishedCount >= 5`, and
  - `decidedComparisonsCount === 0` (`winner_item_id != null`)
- [x] Gate all Compare starts at **5 active finished** (no comparisons before 5)
- [x] Add “Already finished” option on manual add flow (add → then set status → reuse existing `after_finish` prompt)
- [x] Show after-finish “place this book” prompt only after initiation (requires `decidedComparisonsCount > 0`)
- [x] When an item becomes finished after initiation, auto-switch Library view to `Finished` so the inline after-finish prompt is visible
- [x] Reduce accidental “Finished → Want” moves: disable quick status toggle in `Finished` view (status changes via Detail only)
- [x] Update e2e to be “view-aware” and cover:
  - Want/Finished segmentation
  - 5-finished banner gating (decided comparisons)

## Non-goals (Phase 1)

- Removing the top-level **Mic check** nav surface
- Changing scoring, curve, hysteresis, or ranking mechanics
- Adding new data fields (notes, tags, sources) beyond what already exists

## Verification

### Manual QA

- Add book → appears in `Want`
- Toggle to `Finished` → does not show want items
- Mark a want item finished → moves to `Finished` and shows “Do 3 more comparisons” prompt
- At 5 active finished + 0 decided comps → `Finished` shows calibration banner
- After 1 decided comparison → banner no longer appears

### Tests

- Playwright specs updated/added for view switching and banner gating.
