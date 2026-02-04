/**
 * Compute a stable percentile in [0,1] from a sorted order.
 *
 * We define percentile as position within the ordered list:
 * - Lowest item => 0.0
 * - Highest item => 1.0
 * - If n==1 => 0.5 (neutral).
 */
export function percentileFromIndex(i, n) {
  if (n <= 0) throw new Error("n must be positive");
  if (n === 1) return 0.5;
  return i / (n - 1);
}

