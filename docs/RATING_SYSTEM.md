# Rating System (Rank Score + Quarter Stars + Hysteresis)

This document defines the deterministic scoring and display system for **checkcheck**.

## Summary
- **Truth**: raw comparisons between items.
- **Strength**: Elo-like score computed deterministically from comparisons.
- **Ordering**: a continuous **rank score** in the range **0.00–5.00** (used for sorting; shown in detail view).
- **Stars**: quarter-star display (0.25 increments) derived from rank score.
- **Stability**: **hysteresis** prevents stars from jittering near boundaries.
- **Versioning**: rating curve is versioned. No silent rewrites.

---

## Inputs (stored truth)
`comparisons` rows:
- user_id
- item_a_id
- item_b_id
- winner_item_id (nullable; null means Skip)
- created_at

`library_entries` rows:
- user_id
- item_id
- status (want | reading | finished)
- finished_at (optional)

---

## Outputs (derived)
Per user-item:
- `elo` (strength)
- `percentile` (within finished set)
- `rank_score_raw` (0.00–5.00 continuous; show 2 decimals in detail view)
- `stars_candidate` (rank_score rounded to nearest 0.25)
- `stars_display` (hysteresis-stabilized quarter stars)
- `comparisons_count` (for confidence)

Persist `stars_display` (and optionally last-update metadata) to keep UI stable across sessions.

---

## Step 1 — Compute Elo strength

Parameters (starting defaults):
- ELO_START = 1500
- K = 24

Update per comparison (winner/loser):
- expected_w = 1 / (1 + 10 ** ((elo_l - elo_w) / 400))
- elo_w += K * (1 - expected_w)
- elo_l += K * (0 - (1 - expected_w))

Skip:
- does not affect Elo (ignored in scoring).

Determinism requirements:
- Sort comparisons by (created_at, id) before replaying.
- Use stable tie-breakers.

---

## Step 2 — Convert Elo to percentile

Compute percentiles among **finished items only**:
- finished_items = items where library_entries.status == "finished"
- percentile in [0,1], stable tie-breaker by item_id.

---

## Step 3 — Percentile → Rank score (0.00–5.00)

This is the internal 'generosity slider' (tuned by us).

### CURVE_VERSION
CURVE_VERSION = "v1"

### Curve anchors
Piecewise-linear interpolation between anchors:

| Percentile (p) | Raw Stars |
|---:|---:|
| 0.00 | 2.50 |
| 0.10 | 3.25 |
| 0.50 | 3.75 |
| 0.80 | 4.25 |
| 0.92 | 4.50 |
| 0.97 | 4.75 |
| 0.995 | 5.00 |

Algorithm:
1. Find anchors bracketing p: (p0,s0), (p1,s1)
2. Interpolate: s = s0 + (s1-s0) * ((p - p0)/(p1 - p0))
3. Clamp to [0,5]

`rank_score_raw` is the continuous result.
- Detail view shows `rank_score_display = round(rank_score_raw, 2)`

---

## Step 4 — Stars candidate (quarter-stars)

`stars_candidate = round(rank_score_raw * 4) / 4`

List views should show quarter stars only (avoid false precision).

---

## Step 5 — Hysteresis (no jitter)

### Motivation
Without hysteresis, crossing boundaries causes frequent flips (e.g., 4.25 ↔ 4.50).

### Parameters
- H = 0.06  (hysteresis margin; tune 0.04–0.08)
- MIN_COMPS_FOR_STABLE = 6

### Boundary math
Between quarter steps:
- boundary_up(d)   = d + 0.125
- boundary_down(d) = d - 0.125

### Update rule
Given:
- currentDisplay = stars_display (quarter step)
- raw = rank_score_raw (continuous)
- candidate = stars_candidate
- compsCount = comparisons_count

Bootstrap:
- if currentDisplay is null, set it to candidate.

Early stage rule (compsCount < MIN_COMPS_FOR_STABLE):
- allow upward moves immediately (delight)
- resist downward moves (noise protection)

Stable rule:
- If candidate > currentDisplay:
  - require raw >= boundary_up(currentDisplay) + H
- If candidate < currentDisplay:
  - require raw <= boundary_down(currentDisplay) - H

Persist updated stars_display.

---

## Stacked rating UI (recommended)

Show:
- Primary: quarter stars (stars_display)
- Secondary: rank_score_display (e.g., 4.83 / 5.00), Rank (#7/120), Percentile (Top 6%), Confidence ("based on 14 comparisons")

---

## Acceptance tests

Assume H=0.06, MIN_COMPS_FOR_STABLE=6.

1) Upward hysteresis:
- currentDisplay = 4.25, compsCount >= 6
- raw = 4.42 → stays 4.25  (needs >= 4.435)
- raw = 4.44 → becomes 4.50

2) Downward hysteresis:
- currentDisplay = 4.50, compsCount >= 6
- raw = 4.33 → stays 4.50  (needs <= 4.315)
- raw = 4.30 → becomes 4.25

3) Early stage delight:
- compsCount = 3
- candidate > currentDisplay → allow
- candidate < currentDisplay → resist

4) Ordering consistency:
- Sorting by rank_score_raw yields stable ranks across refreshes.
