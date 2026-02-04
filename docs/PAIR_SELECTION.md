# Pair Selection (Choosing which A/B comparisons to ask)

Goal: generate comparisons that are informative and feel meaningful, while minimizing jitter.

## Principles
- Prefer comparisons that reduce uncertainty quickly (near neighbors).
- Mix in a few anchors to keep scale stable (top favorite and mid-tier).
- Avoid repeating the same pair too often.
- Avoid comparing items the user marked 'want' vs 'finished' unless explicitly requested.

## Suggested algorithm (Phase 1)
Given a target item T (e.g., newly finished, or focus item in a sprint):
1. Build candidate pool = finished items excluding T.
2. Choose 60% of pairs from near-neighbors:
   - items with elo closest to T (±K neighborhood)
3. Choose 20% from anchors:
   - one from top decile, one from median band
4. Choose 20% exploratory:
   - items with high uncertainty (few comparisons) to improve overall library calibration

## Session modes
- **Mic check (10 comparisons)**: cycle through multiple target items, weighted toward newest/least-compared items.
- **After finish (3 comparisons)**: 2 near-neighbor + 1 anchor.

### Optional (measure-first): after_finish sentiment pre-step
If after-finish completion time remains high even after Compare input polish, consider a tiny pre-step:
- Prompt: “Quick check — did you like it?” (Liked / Not for me / Skip)
- Use it only to bias the **step-0 anchor** (slightly above/below median).
- Must not affect scoring.

## Avoid
- Pairing that compares items with huge gaps too often (it feels pointless).
- Generating the same pair within the last N comparisons (N≈15).
