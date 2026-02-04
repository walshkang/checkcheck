export const CURVE_VERSION = "v1";

// Piecewise-linear anchors: percentile -> raw stars (0..5).
// See docs/RATING_SYSTEM.md
export const CURVE_V1_ANCHORS = [
  { p: 0.0, s: 2.5 },
  { p: 0.1, s: 3.25 },
  { p: 0.5, s: 3.75 },
  { p: 0.8, s: 4.25 },
  { p: 0.92, s: 4.5 },
  { p: 0.97, s: 4.75 },
  { p: 0.995, s: 5.0 }
];

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export function percentileToRankScoreRawV1(percentile) {
  const p = clamp(percentile, 0, 1);
  const anchors = CURVE_V1_ANCHORS;

  if (p <= anchors[0].p) return anchors[0].s;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a0 = anchors[i];
    const a1 = anchors[i + 1];
    if (p <= a1.p) {
      const t = (p - a0.p) / (a1.p - a0.p);
      const s = a0.s + (a1.s - a0.s) * t;
      return clamp(s, 0, 5);
    }
  }

  return anchors[anchors.length - 1].s;
}

