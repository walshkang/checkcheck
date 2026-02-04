import { replayElo } from "./elo.js";
import { percentileFromIndex } from "./percentile.js";
import { percentileToRankScoreRawV1 } from "./curve_v1.js";
import { roundQuarterStars, updateStarsDisplay } from "./hysteresis.js";

/**
 * libraryEntries: Array<{ item_id: string, status: "want"|"reading"|"finished" }>
 * comparisons: Array<{ id, created_at, item_a_id, item_b_id, winner_item_id|null }>
 * priorDisplayByItemId: Map<string, number> or plain object { [id]: number }
 */
export function recomputeDerived(
  { libraryEntries, comparisons, priorDisplayByItemId = {} },
  { curve = "v1", hysteresis = {}, bootstrapItemIds = null } = {}
) {
  if (curve !== "v1") throw new Error(`Unsupported curve version: ${curve}`);

  const activeFinishedIds = libraryEntries
    .filter((e) => e.status === "finished" && !e.archived_at)
    .map((e) => e.item_id);

  const activeFinishedSet = new Set(activeFinishedIds);

  // Only comparisons among active-finished items should influence Elo.
  const activeComparisons = comparisons.filter(
    (c) => activeFinishedSet.has(c.item_a_id) && activeFinishedSet.has(c.item_b_id)
  );

  const { elos, compsCount } = replayElo(activeComparisons);

  // Ensure finished items exist even if they have no comparisons yet.
  for (const id of activeFinishedIds) {
    if (!elos.has(id)) elos.set(id, 1500);
    if (!compsCount.has(id)) compsCount.set(id, 0);
  }

  const asMap =
    priorDisplayByItemId instanceof Map
      ? priorDisplayByItemId
      : new Map(Object.entries(priorDisplayByItemId));

  const bootstrapSet =
    bootstrapItemIds == null
      ? null
      : bootstrapItemIds instanceof Set
        ? bootstrapItemIds
        : new Set(bootstrapItemIds);

  // We can compute "scores" for items that have signal (decided comparisons),
  // but we only show ratings if stars_display exists or gets bootstrapped.
  const scoredIds = activeFinishedIds.filter((id) => {
    const cd = asMap.has(id) ? asMap.get(id) : null;
    return (compsCount.get(id) ?? 0) > 0 || cd != null;
  });

  // Stable ordering by (elo asc, item_id asc) for percentile (among scored items).
  const scoredOrdered = [...scoredIds].sort((a, b) => {
    const ea = elos.get(a);
    const eb = elos.get(b);
    if (ea < eb) return -1;
    if (ea > eb) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const n = scoredOrdered.length;
  const percentileById = new Map();
  // Handle Elo ties by assigning the *same* percentile to tied items (average rank),
  // which avoids inventing a fake spread when many items sit at the default Elo.
  for (let i = 0; i < n; ) {
    const id0 = scoredOrdered[i];
    const elo0 = elos.get(id0);
    let j = i;
    while (j + 1 < n) {
      const idN = scoredOrdered[j + 1];
      if (elos.get(idN) !== elo0) break;
      j++;
    }
    const avgIndex = (i + j) / 2;
    const p = percentileFromIndex(avgIndex, n);
    for (let k = i; k <= j; k++) percentileById.set(scoredOrdered[k], p);
    i = j + 1;
  }

  const derivedById = new Map();
  for (const id of activeFinishedIds) {
    const currentDisplay = asMap.has(id) ? asMap.get(id) : null;
    const comparisons_count = compsCount.get(id) ?? 0;

    const is_scored = percentileById.has(id);
    const percentile = is_scored ? percentileById.get(id) : null;
    const rank_score_raw = is_scored ? percentileToRankScoreRawV1(percentile) : null;
    const stars_candidate = is_scored ? roundQuarterStars(rank_score_raw) : null;

    const allowBootstrap =
      bootstrapSet != null &&
      bootstrapSet.has(id) &&
      comparisons_count > 0 &&
      currentDisplay == null;

    const stars_display =
      is_scored
        ? updateStarsDisplay(
            {
              currentDisplay,
              raw: rank_score_raw,
              candidate: stars_candidate,
              compsCount: comparisons_count
            },
            { ...hysteresis, allowBootstrap }
          )
        : null;

    derivedById.set(id, {
      item_id: id,
      elo: elos.get(id),
      comparisons_count,
      percentile,
      rank_score_raw,
      stars_candidate,
      stars_display,
      is_scored,
      is_rated: stars_display != null
    });
  }

  // Stable rank: only for scored items.
  const ranked = [...scoredIds].sort((a, b) => {
    const ra = derivedById.get(a).rank_score_raw;
    const rb = derivedById.get(b).rank_score_raw;
    if (ra > rb) return -1;
    if (ra < rb) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const rankById = new Map();
  for (let i = 0; i < ranked.length; i++) rankById.set(ranked[i], i + 1);

  return {
    curve_version: "v1",
    finished_count: activeFinishedIds.length,
    scored_count: scoredIds.length,
    derivedById,
    rankById
  };
}
