export const DEFAULT_H = 0.06;
export const DEFAULT_MIN_COMPS_FOR_STABLE = 6;

export function boundaryUp(currentDisplay) {
  return currentDisplay + 0.125;
}

export function boundaryDown(currentDisplay) {
  return currentDisplay - 0.125;
}

export function roundQuarterStars(x) {
  // Nearest quarter step.
  return Math.round(x * 4) / 4;
}

/**
 * Apply checkcheck's star hysteresis rules.
 *
 * currentDisplay: number|null (quarter step)
 * raw: number (0..5)
 * candidate: number (quarter step)
 * compsCount: number (decided comparisons involving this item)
 */
export function updateStarsDisplay(
  { currentDisplay, raw, candidate, compsCount },
  {
    h = DEFAULT_H,
    minCompsForStable = DEFAULT_MIN_COMPS_FOR_STABLE,
    allowBootstrap = true
  } = {}
) {
  if (currentDisplay == null) return allowBootstrap ? candidate : null;
  if (candidate === currentDisplay) return currentDisplay;

  if (compsCount < minCompsForStable) {
    // Early stage delight: upward moves immediately; resist downward noise.
    //
    // However, allow *large* downward corrections so we don't show obviously-wrong
    // stars alongside the continuous score while the system is still calibrating.
    if (candidate > currentDisplay) return candidate;
    const drop = currentDisplay - candidate;
    if (drop >= 0.5) return candidate;
    return currentDisplay;
  }

  if (candidate > currentDisplay) {
    return raw >= boundaryUp(currentDisplay) + h ? candidate : currentDisplay;
  }

  // candidate < currentDisplay
  return raw <= boundaryDown(currentDisplay) - h ? candidate : currentDisplay;
}
