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

function chooseNeighborByElo(targetId, candidateIds, derivedById, { recent, recentCheck } = {}) {
  const targetElo = derivedById?.get(targetId)?.elo ?? 1500;
  const ranked = candidateIds
    .map((id) => {
      const d = derivedById?.get(id);
      const elo = d?.elo ?? 1500;
      const diff = Math.abs(elo - targetElo);
      const comps = d?.comparisons_count ?? 0;
      return { id, diff, comps };
    })
    .sort((a, b) => {
      if (a.diff < b.diff) return -1;
      if (a.diff > b.diff) return 1;
      if (a.comps > b.comps) return -1;
      if (a.comps < b.comps) return 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  if (!recentCheck) return ranked.length ? ranked[0].id : null;

  for (const r of ranked) {
    if (!recentCheck(targetId, r.id)) return r.id;
  }
  return ranked.length ? ranked[0].id : null;
}

function chooseMedianAnchor(targetId, candidateIds, derivedById, { recentCheck } = {}) {
  // Prefer anchors that are already rated; otherwise fall back to any candidate.
  const rated = candidateIds.filter((id) => derivedById?.get(id)?.is_rated);
  const pool = rated.length ? rated : candidateIds;
  if (!pool.length) return null;

  const sorted = pool
    .map((id) => ({ id, elo: derivedById?.get(id)?.elo ?? 1500, comps: derivedById?.get(id)?.comparisons_count ?? 0 }))
    .sort((a, b) => {
      if (a.elo < b.elo) return -1;
      if (a.elo > b.elo) return 1;
      if (a.comps > b.comps) return -1;
      if (a.comps < b.comps) return 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const mid = Math.floor(sorted.length / 2);
  const candidates = [sorted[mid], sorted[mid - 1], sorted[mid + 1]].filter(Boolean);
  if (!recentCheck) return candidates[0].id;
  for (const c of candidates) {
    if (!recentCheck(targetId, c.id)) return c.id;
  }
  return candidates[0].id;
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
  mode = "mic_check",
  isInitial = false,
  targetId = null,
  stepIndex = 0,
  usedOpponentIds = null,
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

  function pickCoveragePair() {
    const scored = finishedIds
      .map((id) => ({ id, c: derivedById?.get(id)?.comparisons_count ?? 0 }))
      .sort((a, b) => (a.c - b.c) || (a.id < b.id ? -1 : 1));
    if (scored.length < 2) return null;

    const minC = scored[0].c;
    const mins = scored.filter((x) => x.c === minC).map((x) => x.id);
    const a = randomPick(mins);

    const opponentPool = scored.filter((x) => x.id !== a).map((x) => x.id);
    for (const b of opponentPool) {
      if (!isRecent(a, b)) return { a, b };
    }
    return opponentPool.length ? { a, b: opponentPool[0] } : null;
  }

  if ((mode === "after_finish" || mode === "recheck") && targetId && finishedIds.includes(targetId)) {
    const used = usedOpponentIds instanceof Set ? usedOpponentIds : new Set(usedOpponentIds || []);
    let candidates = finishedIds.filter((id) => id !== targetId && !used.has(id));
    if (!candidates.length) candidates = finishedIds.filter((id) => id !== targetId);

    let opponent = null;
    if (stepIndex === 0) {
      opponent = chooseMedianAnchor(targetId, candidates, derivedById, { recentCheck: isRecent });
    } else {
      opponent = chooseNeighborByElo(targetId, candidates, derivedById, { recent, recentCheck: isRecent });
    }
    if (!opponent) return null;

    // Deterministic side swap to reduce "always left" bias.
    const flip = stepIndex % 2 === 1;
    return flip ? { a: opponent, b: targetId } : { a: targetId, b: opponent };
  }

  // Initial mic check: bias hard toward coverage so every finished item is likely
  // to appear at least once (avoids "still unplaced after ranking" confusion).
  if (mode === "mic_check" && isInitial) {
    const p = pickCoveragePair();
    if (p) return p;
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
