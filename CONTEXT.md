# CONTEXT.md — checkcheck

Last updated: 2026-02-06

## Active Phase
**Phase 1 — checkcheck MVP (Books Only)**

Goal: validate that reviewing against yourself via fast A/B comparisons is delightful and produces scores you trust.

## Locked Decisions
- **Comparisons-first**: the primitive action is choosing A vs B (or Skip).
- **Scoring**: deterministic Elo-like strength from comparisons.
- **Display**:
  - Quarter-star rounding (0.25) for list views.
  - 0.00–5.00 rank score (2 decimals) in detail view and for ordering.
  - Percentile-based, versioned generosity curve (see docs/RATING_SYSTEM.md).
  - Hysteresis to prevent star jitter.

## UX Surface Model
- **Library**: browse, add, set status (want/reading/finished).
- **Compare (“Mic check”)**: A wins / B wins / Skip / Undo.
- **Detail**: stacked rating + explanation + history + trust tools.

Mobile rule: **only one primary surface at a time** (Compare > Detail > Library).

## Current Shape (shipped)
- Library has three sub-views: **Want to read** (saved queue), **Unplaced** (finished but not yet rated), and **Finished** (rated history).
- Compare is gated until **5 active finished** items exist.
- Initial mic check hides stars during comparisons; stars render after initiation.
- Stars display uses quarter steps (0.25) and is rendered via SVG for clarity.

## Immediate Work (next 1–2 slices)
1. Compare sleekness: tap-to-choose cards + calm commit motion + pending-lock (see docs/COMPARE_SLEEK_PHASE1.md).
2. Detail trust tools polish: “Place this book” loop, explanation clarity, and fewer sharp edges.
3. Instrumentation: track tap-to-next latency, mic-check completion time, and after-finish usage.

## Open Questions (intentionally deferred unless blocking)
- Work vs edition identity: do we de-dupe by title+author only (MVP), or support editions later?
- External catalog integration (Open Library / Google Books): behind a flag once MVP loop is validated.
- Skip vs Draw: MVP uses Skip; Draw can be added later if needed.

## Tuning Targets
- Most finished items land ~3.5–4.25.
- Top ~3–5% can reach 4.75–5.00.
- Star changes should be rare after ~8 comparisons per item (hysteresis + confidence gating).
