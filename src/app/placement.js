/**
 * Placement derivation (durable truth)
 *
 * We do not persist a mutable "placed" flag. Instead we derive placement from
 * persisted comparisons:
 * - A book is "placed" iff there exists an after_finish session whose first
 *   3 *decided* comparisons (winner_item_id != null) all include the same target
 *   item, and the session has at least 3 decided comparisons.
 * - placed_at is the created_at timestamp of the 3rd decided comparison in the
 *   earliest such successful session (by that timestamp).
 *
 * Assumptions:
 * - An after_finish session is intended to keep a single target across its
 *   comparisons.
 * - Each comparison row stores { session_id, mode } and includes the target as
 *   either item_a_id or item_b_id.
 *
 * Guards:
 * - Only mode === "after_finish" and winner_item_id != null contribute.
 * - Target inference requires exactly one item to appear in all first 3 decided
 *   rows for the session. Otherwise the session is ignored (prevents corrupt
 *   rows / future refactors causing "placed" artifacts).
 */

function cmpByCreatedAtThenId(a, b) {
  const ca = a?.created_at ?? "";
  const cb = b?.created_at ?? "";
  if (ca < cb) return -1;
  if (ca > cb) return 1;
  const ia = a?.id ?? 0;
  const ib = b?.id ?? 0;
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

function inferTargetIdFromThreeDecided(decided3) {
  if (!Array.isArray(decided3) || decided3.length !== 3) return null;
  const counts = new Map();
  for (const c of decided3) {
    if (!c) return null;
    counts.set(c.item_a_id, (counts.get(c.item_a_id) ?? 0) + 1);
    counts.set(c.item_b_id, (counts.get(c.item_b_id) ?? 0) + 1);
  }
  const candidates = [];
  for (const [id, n] of counts.entries()) {
    if (n === 3) candidates.push(id);
  }
  if (candidates.length !== 1) return null;
  return candidates[0];
}

/**
 * @param {Array<{id:number,created_at:string,item_a_id:string,item_b_id:string,winner_item_id:string|null,session_id:string|null,mode:string|null}>} comparisons
 * @returns {Map<string,string>} placedAtByItemId (item_id -> placed_at ISO string)
 */
export function computePlacedAtByItemId(comparisons) {
  const placedAtByItemId = new Map();
  const bestByItemId = new Map(); // item_id -> placed_at

  const bySession = new Map();
  for (const c of Array.isArray(comparisons) ? comparisons : []) {
    if (!c || c.mode !== "after_finish") continue;
    if (c.winner_item_id == null) continue;
    const sid = c.session_id;
    if (!sid) continue;
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid).push(c);
  }

  for (const [sessionId, decided] of bySession.entries()) {
    if (!Array.isArray(decided) || decided.length < 3) continue;
    decided.sort(cmpByCreatedAtThenId);
    const first3 = decided.slice(0, 3);
    const targetId = inferTargetIdFromThreeDecided(first3);
    if (!targetId) continue;

    const placedAt = first3[2]?.created_at ?? null;
    if (!placedAt) continue;

    const prior = bestByItemId.get(targetId);
    if (!prior || placedAt < prior) bestByItemId.set(targetId, placedAt);
  }

  for (const [id, ts] of bestByItemId.entries()) placedAtByItemId.set(id, ts);
  return placedAtByItemId;
}

