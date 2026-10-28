import type { StorePlacement } from '../spatial/concourse';

/** Index of the placement whose centre is nearest to (x, y) within `maxDist`, else -1. */
export function nearestPlacement(placements: readonly StorePlacement[], x: number, y: number, maxDist: number): number {
  let best = -1;
  let bestD = maxDist;
  for (let i = 0; i < placements.length; i += 1) {
    const p = placements[i] as StorePlacement;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bestD) { bestD = d; best = i; }
  }
  return best;
}
