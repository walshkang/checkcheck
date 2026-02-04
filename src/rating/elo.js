export const ELO_START = 1500;
export const ELO_K = 24;

function expectedScore(eloA, eloB) {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}

/**
 * Deterministically replay comparisons to compute Elo and per-item decided comparison counts.
 *
 * comparisons: Array<{
 *   id: string|number,
 *   created_at: string|number, // sortable
 *   item_a_id: string,
 *   item_b_id: string,
 *   winner_item_id: string|null
 * }>
 */
export function replayElo(comparisons, { eloStart = ELO_START, k = ELO_K } = {}) {
  const elos = new Map();
  const compsCount = new Map(); // decided comparisons only

  function ensure(itemId) {
    if (!elos.has(itemId)) elos.set(itemId, eloStart);
    if (!compsCount.has(itemId)) compsCount.set(itemId, 0);
  }

  const sorted = [...comparisons].sort((a, b) => {
    if (a.created_at < b.created_at) return -1;
    if (a.created_at > b.created_at) return 1;
    // Stable tie-breaker.
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  for (const c of sorted) {
    const a = c.item_a_id;
    const b = c.item_b_id;
    ensure(a);
    ensure(b);

    if (c.winner_item_id == null) continue; // Skip: no Elo change.

    const winner = c.winner_item_id;
    const loser = winner === a ? b : a;

    const eloW = elos.get(winner);
    const eloL = elos.get(loser);
    const expectedW = expectedScore(eloW, eloL);
    const expectedL = 1 - expectedW;

    elos.set(winner, eloW + k * (1 - expectedW));
    elos.set(loser, eloL + k * (0 - expectedL));

    compsCount.set(a, compsCount.get(a) + 1);
    compsCount.set(b, compsCount.get(b) + 1);
  }

  return { elos, compsCount };
}

