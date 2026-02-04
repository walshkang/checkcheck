function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function recentPairKeys(comparisons, n) {
  const keys = new Set();
  const sorted = [...comparisons].sort((a, b) => {
    if (a.created_at < b.created_at) return -1;
    if (a.created_at > b.created_at) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const slice = sorted.slice(Math.max(0, sorted.length - n));
  for (const c of slice) keys.add(pairKey(c.item_a_id, c.item_b_id));
  return keys;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chooseNearNeighbor(targetId, finishedIds, derivedById) {
  const scored = finishedIds
    .map((id) => ({ id, score: derivedById.get(id)?.rank_score_raw ?? 0 }))
    .sort((a, b) => {
      if (a.score < b.score) return -1;
      if (a.score > b.score) return 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const idx = scored.findIndex((x) => x.id === targetId);
  if (idx === -1) return null;

  const candidates = [];
  for (const delta of [1, 2, 3]) {
    if (idx - delta >= 0) candidates.push(scored[idx - delta].id);
    if (idx + delta < scored.length) candidates.push(scored[idx + delta].id);
  }
  if (candidates.length === 0) return null;
  return randomPick(candidates);
}

function chooseFocusItem(finishedIds, derivedById) {
  // Bias toward least-compared items so calibration spreads.
  const weighted = finishedIds
    .map((id) => ({ id, c: derivedById.get(id)?.comparisons_count ?? 0 }))
    .sort((a, b) => (a.c - b.c) || (a.id < b.id ? -1 : 1));
  const top = weighted.slice(0, Math.min(6, weighted.length)).map((x) => x.id);
  return randomPick(top);
}

export function pickPair({
  finishedIds,
  comparisons,
  derivedById,
  targetId = null,
  recentWindow = 15
}) {
  if (finishedIds.length < 2) return null;

  const recent = recentPairKeys(comparisons, recentWindow);

  function isRecent(a, b) {
    return recent.has(pairKey(a, b));
  }

  function pickRandomPair() {
    for (let tries = 0; tries < 40; tries++) {
      const a = randomPick(finishedIds);
      const b = randomPick(finishedIds);
      if (a === b) continue;
      if (isRecent(a, b)) continue;
      return { a, b };
    }
    // Fall back: allow a repeat if the pool is small.
    const a = finishedIds[0];
    const b = finishedIds[1];
    return { a, b };
  }

  // Day-1 rule:
  // - <4 finished => random pairs (no recent repeats if possible)
  // - else 70% near-neighbor, 30% random
  if (finishedIds.length < 4) return pickRandomPair();

  const r = Math.random();
  if (r < 0.7 && derivedById) {
    const focus = targetId ?? chooseFocusItem(finishedIds, derivedById);
    const neighbor = chooseNearNeighbor(focus, finishedIds, derivedById);
    if (neighbor && !isRecent(focus, neighbor)) return { a: focus, b: neighbor };
  }

  return pickRandomPair();
}

