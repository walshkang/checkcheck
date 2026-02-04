export function formatStars(starsDisplay) {
  if (starsDisplay == null) return "";
  const whole = Math.floor(starsDisplay);
  const frac = Math.round((starsDisplay - whole) * 100) / 100;
  const full = "★".repeat(Math.max(0, Math.min(5, whole)));
  const quarter =
    frac === 0.25 ? "¼" : frac === 0.5 ? "½" : frac === 0.75 ? "¾" : "";
  return `${full}${quarter}` || "";
}

export function formatTopPct(percentile) {
  const p = Math.max(0, Math.min(1, percentile));
  let top = Math.round((1 - p) * 100);
  if (top < 1) top = 1;
  if (top > 100) top = 100;
  return `Top ${top}%`;
}

