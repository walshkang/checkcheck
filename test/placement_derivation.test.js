import test from "node:test";
import assert from "node:assert/strict";
import { computePlacedAtByItemId } from "../src/app/placement.js";

function c({
  id,
  created_at,
  item_a_id,
  item_b_id,
  winner_item_id,
  session_id,
  mode
}) {
  return { id, created_at, item_a_id, item_b_id, winner_item_id, session_id, mode };
}

test("computePlacedAtByItemId derives placed_at from 3rd decided after_finish comparison", () => {
  const t = "target";
  const comparisons = [
    c({
      id: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "o1",
      winner_item_id: t,
      session_id: "s1",
      mode: "after_finish"
    }),
    c({
      id: 2,
      created_at: "2026-01-02T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "o2",
      winner_item_id: "o2",
      session_id: "s1",
      mode: "after_finish"
    }),
    c({
      id: 3,
      created_at: "2026-01-03T00:00:00.000Z",
      item_a_id: "o3",
      item_b_id: t,
      winner_item_id: t,
      session_id: "s1",
      mode: "after_finish"
    })
  ];

  const placedAt = computePlacedAtByItemId(comparisons);
  assert.equal(placedAt.get(t), "2026-01-03T00:00:00.000Z");
});

test("computePlacedAtByItemId keeps earliest successful placement when multiple sessions exist", () => {
  const t = "target";
  const comparisons = [
    // Later successful session
    c({
      id: 11,
      created_at: "2026-02-01T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "o1",
      winner_item_id: t,
      session_id: "s2",
      mode: "after_finish"
    }),
    c({
      id: 12,
      created_at: "2026-02-02T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "o2",
      winner_item_id: t,
      session_id: "s2",
      mode: "after_finish"
    }),
    c({
      id: 13,
      created_at: "2026-02-03T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "o3",
      winner_item_id: t,
      session_id: "s2",
      mode: "after_finish"
    }),
    // Earlier successful session
    c({
      id: 21,
      created_at: "2026-01-01T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "x1",
      winner_item_id: t,
      session_id: "s1",
      mode: "after_finish"
    }),
    c({
      id: 22,
      created_at: "2026-01-02T00:00:00.000Z",
      item_a_id: "x2",
      item_b_id: t,
      winner_item_id: "x2",
      session_id: "s1",
      mode: "after_finish"
    }),
    c({
      id: 23,
      created_at: "2026-01-03T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "x3",
      winner_item_id: t,
      session_id: "s1",
      mode: "after_finish"
    })
  ];

  const placedAt = computePlacedAtByItemId(comparisons);
  assert.equal(placedAt.get(t), "2026-01-03T00:00:00.000Z");
});

test("computePlacedAtByItemId ignores skips and requires 3 decided rows", () => {
  const t = "target";
  const comparisons = [
    c({
      id: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "o1",
      winner_item_id: null,
      session_id: "s1",
      mode: "after_finish"
    }),
    c({
      id: 2,
      created_at: "2026-01-02T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "o2",
      winner_item_id: t,
      session_id: "s1",
      mode: "after_finish"
    }),
    c({
      id: 3,
      created_at: "2026-01-03T00:00:00.000Z",
      item_a_id: "o3",
      item_b_id: t,
      winner_item_id: "o3",
      session_id: "s1",
      mode: "after_finish"
    }),
    c({
      id: 4,
      created_at: "2026-01-04T00:00:00.000Z",
      item_a_id: t,
      item_b_id: "o4",
      winner_item_id: t,
      session_id: "s1",
      mode: "after_finish"
    })
  ];

  const placedAt = computePlacedAtByItemId(comparisons);
  assert.equal(placedAt.get(t), "2026-01-04T00:00:00.000Z");
});

test("computePlacedAtByItemId ignores corrupt sessions where target inference is ambiguous", () => {
  const comparisons = [
    c({
      id: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      item_a_id: "a",
      item_b_id: "b",
      winner_item_id: "a",
      session_id: "s1",
      mode: "after_finish"
    }),
    c({
      id: 2,
      created_at: "2026-01-02T00:00:00.000Z",
      item_a_id: "a",
      item_b_id: "b",
      winner_item_id: "b",
      session_id: "s1",
      mode: "after_finish"
    }),
    c({
      id: 3,
      created_at: "2026-01-03T00:00:00.000Z",
      item_a_id: "a",
      item_b_id: "b",
      winner_item_id: "a",
      session_id: "s1",
      mode: "after_finish"
    })
  ];

  const placedAt = computePlacedAtByItemId(comparisons);
  assert.equal(placedAt.size, 0);
});

