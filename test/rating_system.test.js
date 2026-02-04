import test from "node:test";
import assert from "node:assert/strict";

import { updateStarsDisplay } from "../src/rating/hysteresis.js";
import { percentileToRankScoreRawV1 } from "../src/rating/curve_v1.js";
import { recomputeDerived } from "../src/rating/recompute.js";

test("curve v1 anchors match spec", () => {
  assert.equal(percentileToRankScoreRawV1(0.0), 2.5);
  assert.equal(percentileToRankScoreRawV1(0.1), 3.25);
  assert.equal(percentileToRankScoreRawV1(0.5), 3.75);
  assert.equal(percentileToRankScoreRawV1(0.8), 4.25);
  assert.equal(percentileToRankScoreRawV1(0.92), 4.5);
  assert.equal(percentileToRankScoreRawV1(0.97), 4.75);
  assert.equal(percentileToRankScoreRawV1(0.995), 5.0);
});

test("hysteresis acceptance: upward move requires boundary + H", () => {
  const h = 0.06;
  const min = 6;

  // currentDisplay = 4.25, candidate = 4.50
  assert.equal(
    updateStarsDisplay(
      { currentDisplay: 4.25, raw: 4.42, candidate: 4.5, compsCount: 6 },
      { h, minCompsForStable: min }
    ),
    4.25
  );

  assert.equal(
    updateStarsDisplay(
      { currentDisplay: 4.25, raw: 4.44, candidate: 4.5, compsCount: 6 },
      { h, minCompsForStable: min }
    ),
    4.5
  );
});

test("hysteresis acceptance: downward move requires boundary - H", () => {
  const h = 0.06;
  const min = 6;

  // currentDisplay = 4.50, candidate = 4.25
  assert.equal(
    updateStarsDisplay(
      { currentDisplay: 4.5, raw: 4.33, candidate: 4.25, compsCount: 6 },
      { h, minCompsForStable: min }
    ),
    4.5
  );

  assert.equal(
    updateStarsDisplay(
      { currentDisplay: 4.5, raw: 4.3, candidate: 4.25, compsCount: 6 },
      { h, minCompsForStable: min }
    ),
    4.25
  );
});

test("hysteresis acceptance: early stage delight/resist", () => {
  const h = 0.06;
  const min = 6;

  assert.equal(
    updateStarsDisplay(
      { currentDisplay: 3.75, raw: 3.9, candidate: 4.0, compsCount: 3 },
      { h, minCompsForStable: min }
    ),
    4.0
  );

  assert.equal(
    updateStarsDisplay(
      { currentDisplay: 4.0, raw: 3.7, candidate: 3.75, compsCount: 3 },
      { h, minCompsForStable: min }
    ),
    4.0
  );
});

test("ordering stability: tie-breaks by item_id", () => {
  const libraryEntries = [
    { item_id: "a", status: "finished" },
    { item_id: "b", status: "finished" }
  ];
  const comparisons = []; // no signal => same Elo

  // Seed "scored" status via existing display state so both items participate.
  const priorDisplayByItemId = { a: 3.75, b: 3.75 };
  const { rankById } = recomputeDerived({ libraryEntries, comparisons, priorDisplayByItemId });
  assert.equal(rankById.get("a"), 1);
  assert.equal(rankById.get("b"), 2);
});

test("archived items do not influence Elo (comparisons filtered before replay)", () => {
  const comparisons = [
    { id: 1, created_at: 1, item_a_id: "a", item_b_id: "b", winner_item_id: "a" },
    { id: 2, created_at: 2, item_a_id: "a", item_b_id: "c", winner_item_id: "a" }
  ];

  const libraryArchivedB = [
    { item_id: "a", status: "finished" },
    { item_id: "b", status: "finished", archived_at: "2026-02-04T00:00:00.000Z" },
    { item_id: "c", status: "finished" }
  ];
  const r1 = recomputeDerived({ libraryEntries: libraryArchivedB, comparisons });
  assert.equal(r1.derivedById.has("b"), false);
  assert.equal(r1.derivedById.get("a").elo, 1512);
  assert.equal(r1.derivedById.get("c").elo, 1488);

  const libraryNotArchived = [
    { item_id: "a", status: "finished" },
    { item_id: "b", status: "finished", archived_at: null },
    { item_id: "c", status: "finished" }
  ];
  const r2 = recomputeDerived({ libraryEntries: libraryNotArchived, comparisons });
  assert.equal(r2.derivedById.has("b"), true);
  assert.ok(r2.derivedById.get("a").elo > 1512);
});
