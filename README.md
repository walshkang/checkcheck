# checkcheck

Mic-check your taste: comparisons-first personal ratings for books (Phase 1), expandable to films + restaurants (Phase 2+).

## What this is
A web-first app that learns your taste by asking quick A/B questions ("which did you like more?"), then derives:
- a stable personal ranking,
- quarter-star ratings (0.25) with hysteresis (no jitter),
- and a stacked score (0.00–5.00) for ordering + explanation.

## Read first
- AGENTS.md
- CONTEXT.md
- docs/RATING_SYSTEM.md
- docs/UX_RULES.md

## Dev loop (suggested)
1. Start with manual library add (no API dependency).
2. Implement Compare (A/B/Skip/Undo) with persistence.
3. Implement scoring + stacked rating display.
4. Add tuning harness and iterate curve/hysteresis.

## Run locally (static MVP)
1. `python3 -m http.server 8000`
2. Open `http://localhost:8000/public/`

## Phase 2 (later)
- Cross-domain taxonomy
- Similarity models (kNN, RF/GBDT baselines)
- Cross-domain recommendations
