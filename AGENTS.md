# AGENTS.md — checkcheck

This file is the single source of truth for how we build here. It applies to humans and agents.

## Read First
- CONTEXT.md (active phase, immediate blockers)
- docs/RATING_SYSTEM.md (rank score + stars + hysteresis; versioned curve)
- docs/UX_RULES.md (surface model + mobile/desktop rules)

## Brand shorthand (for copy + UI)
- “Mic check” = quick calibration session (10 comparisons).
- “Check-check” = head-to-head comparison flow.

## Invariants (do not violate)
- Library is source of truth: only explicitly added items participate in scoring.
- Persist raw comparisons as durable truth; recompute derived scores deterministically.
- Comparisons are the primitive user action; stars are derived presentation.
- Display uses quarter-star rounding (0.25) with hysteresis (no jitter).
- Show stacked rating: quarter stars + rank_score_raw (0.00–5.00, 2 decimals in detail) + rank/percentile.
- Version meaning: rating curve and taxonomy changes must be explicit (CURVE_VERSION / TAXONOMY_VERSION).

## Definition of Done
- Behavior changes have tests or a repeatable verification checklist.
- Hysteresis acceptance tests pass (see docs/RATING_SYSTEM.md).
- Ranking order is stable and consistent across refreshes.
- UI is responsive: on small screens, only one primary surface open at a time.
- Docs updated when invariants or curve parameters change.

## Diff Hygiene
- Separate behavior changes from formatting/regen.
- Keep curve parameters in one place; do not duplicate magic numbers across UI and server.
