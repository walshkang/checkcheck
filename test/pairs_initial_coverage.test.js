import test from "node:test";
import assert from "node:assert/strict";
import { pickPair } from "../src/app/pairs.js";

function withFakeRandom(seq, fn) {
  const orig = Math.random;
  let i = 0;
  Math.random = () => {
    const v = seq[i] ?? seq[seq.length - 1] ?? 0;
    i++;
    return v;
  };
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

test("pickPair: initial mic check biases toward least-compared coverage", () => {
  const finishedIds = ["a", "b", "c", "d", "e"];
  const derivedById = new Map([
    ["a", { comparisons_count: 2 }],
    ["b", { comparisons_count: 2 }],
    ["c", { comparisons_count: 2 }],
    ["d", { comparisons_count: 2 }],
    ["e", { comparisons_count: 0 }]
  ]);

  const pair = withFakeRandom([0], () =>
    pickPair({
      finishedIds,
      comparisons: [],
      derivedById,
      mode: "mic_check",
      isInitial: true,
      recentWindow: 0
    })
  );

  assert.ok(pair);
  assert.ok(pair.a !== pair.b);
  assert.ok(pair.a === "e" || pair.b === "e");
});

