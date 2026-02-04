# CONTEXT.md — checkcheck

Last updated: 2026-02-03

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

## Immediate Work (next 1–2 slices)
1. Library scaffolding + manual add + statuses (want/reading/finished).
2. Compare session surface with persistence + Undo.
3. Scoring pipeline + stacked rating UI.

## Open Questions (intentionally deferred unless blocking)
- Work vs edition identity: do we de-dupe by title+author only (MVP), or support editions later?
- External catalog integration (Open Library / Google Books): behind a flag once MVP loop is validated.
- Skip vs Draw: MVP uses Skip; Draw can be added later if needed.

## Tuning Targets
- Most finished items land ~3.5–4.25.
- Top ~3–5% can reach 4.75–5.00.
- Star changes should be rare after ~8 comparisons per item (hysteresis + confidence gating).
