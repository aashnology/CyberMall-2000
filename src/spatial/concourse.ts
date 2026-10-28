/**
 * C-shaped concourse geometry.
 *
 * Coordinate system: screen-style, +x right, +y DOWN, angles in radians,
 * increasing angle = clockwise on screen. The C opens to the east:
 * the walkway runs from `startAngle` (lower-right, the elevator core)
 * clockwise through the bottom, west and top to `startAngle + sweep`
 * (upper-right, the focal art installation). The open central atrium
 * overlook sits at the arc's centre.
 *
 * Parametrisation: t ∈ [0,1] along the centerline, lateral ∈ [-w/2, +w/2]
 * across the walkway (positive = outward, toward the storefront wall).
 */

const TAU = Math.PI * 2;

export interface ConcourseSpec {
  readonly centerX: number;
  readonly centerY: number;
  /** Centerline radius used when the floor is not dense. */
  readonly baseRadius: number;
  readonly walkwayWidth: number;
  /** Angle of t = 0. */
  readonly startAngle: number;
  /** Angular extent of the C (< 2π). */
  readonly sweep: number;
  /** Frontage a storefront has when there is plenty of room. */
  readonly baseFrontage: number;
  /** Smallest legible compact-boutique frontage. */
  readonly minFrontage: number;
  /** Largest frontage; sparse floors space stores out instead of stretching them. */
  readonly maxFrontage: number;
  /** Fraction of the sweep kept free at EACH end for the elevator core and the centerpiece. */
  readonly endMargin: number;
}

export const DEFAULT_CONCOURSE: ConcourseSpec = {
  centerX: 0,
  centerY: 0,
  baseRadius: 40,
  walkwayWidth: 10,
  startAngle: Math.PI / 4,
  sweep: 1.5 * Math.PI,
  baseFrontage: 6,
  minFrontage: 2.2,
  maxFrontage: 8,
  endMargin: 0.045,
};

export type RowKind = 'outer' | 'inner';

export interface StorePlacement {
  /** Position in walking order (t ascending, outer before inner on ties). */
  readonly index: number;
  readonly row: RowKind;
  readonly t: number;
  readonly angle: number;
  readonly x: number;
  readonly y: number;
  /** Direction the facade faces, radians. Outer row faces the atrium; inner kiosks face outward. */
  readonly facing: number;
  readonly frontage: number;
  /** frontage / baseFrontage: multiply the storefront card's base size by this. */
  readonly scale: number;
}

export interface FloorLayout {
  /** Possibly enlarged radius: dense floors grow the C rather than dropping stores. */
  readonly radius: number;
  readonly placements: readonly StorePlacement[];
  readonly outerCount: number;
  readonly innerCount: number;
}

function validateSpec(spec: ConcourseSpec): void {
  const ok =
    spec.baseRadius > spec.walkwayWidth / 2 &&
    spec.walkwayWidth > 0 &&
    spec.sweep > 0 &&
    spec.sweep < TAU &&
    spec.minFrontage > 0 &&
    spec.minFrontage <= spec.baseFrontage &&
    spec.baseFrontage <= spec.maxFrontage &&
    spec.endMargin >= 0 &&
    spec.endMargin < 0.25;
  if (!ok) throw new RangeError('Invalid ConcourseSpec');
}

interface RowLengths {
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly outerLen: number;
  readonly innerLen: number;
}

function rowLengths(spec: ConcourseSpec, radius: number): RowLengths {
  const half = spec.walkwayWidth / 2;
  const outerRadius = radius + half;
  const innerRadius = radius - half;
  const usable = 1 - 2 * spec.endMargin;
  return {
    outerRadius,
    innerRadius,
    outerLen: spec.sweep * usable * outerRadius,
    innerLen: spec.sweep * usable * innerRadius,
  };
}

/** How many stores fit at `minFrontage` across both rows (integer capacity). */
function capacityAt(spec: ConcourseSpec, radius: number): number {
  const r = rowLengths(spec, radius);
  return Math.floor(r.outerLen / spec.minFrontage) + Math.floor(r.innerLen / spec.minFrontage);
}

/**
 * Lay out `count` storefronts. Invariant: `placements.length === count`.
 * No store is ever dropped; density is absorbed by (1) shrinking frontage
 * toward `minFrontage`, (2) adding an inner kiosk row, then (3) growing the radius.
 */
export function layoutFloor(count: number, spec: ConcourseSpec = DEFAULT_CONCOURSE): FloorLayout {
  validateSpec(spec);
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`count must be a non-negative integer, got ${count}`);
  }

  let radius = spec.baseRadius;
  // Capacity grows monotonically with radius, so this terminates quickly.
  for (let guard = 0; capacityAt(spec, radius) < count; guard += 1) {
    if (guard > 10_000) throw new Error('layoutFloor: radius search did not converge');
    radius *= 1.01;
  }

  const lens = rowLengths(spec, radius);
  const fitsOuterAtBase = count * spec.baseFrontage <= lens.outerLen;

  let outerCount: number;
  if (fitsOuterAtBase) {
    outerCount = count;
  } else {
    const hi = Math.min(count, Math.floor(lens.outerLen / spec.minFrontage));
    const lo = Math.max(0, count - Math.floor(lens.innerLen / spec.minFrontage));
    const proportional = Math.round((count * lens.outerLen) / (lens.outerLen + lens.innerLen));
    outerCount = Math.min(hi, Math.max(lo, proportional));
  }
  const innerCount = count - outerCount;

  const raw: StorePlacement[] = [];
  const pushRow = (row: RowKind, n: number, rowRadius: number, rowLen: number): void => {
    if (n === 0) return;
    const pitch = rowLen / n;
    const frontage = Math.min(pitch, spec.maxFrontage);
    for (let i = 0; i < n; i += 1) {
      const t = spec.endMargin + (1 - 2 * spec.endMargin) * ((i + 0.5) / n);
      const angle = spec.startAngle + spec.sweep * t;
      const facing = row === 'outer' ? angle + Math.PI : angle;
      raw.push({
        index: -1,
        row,
        t,
        angle,
        x: spec.centerX + rowRadius * Math.cos(angle),
        y: spec.centerY + rowRadius * Math.sin(angle),
        facing,
        frontage,
        scale: frontage / spec.baseFrontage,
      });
    }
  };
  pushRow('outer', outerCount, lens.outerRadius, lens.outerLen);
  pushRow('inner', innerCount, lens.innerRadius, lens.innerLen);

  raw.sort((a, b) => a.t - b.t || (a.row === b.row ? 0 : a.row === 'outer' ? -1 : 1));
  const placements = raw.map((p, index) => ({ ...p, index }));

  return { radius, placements, outerCount, innerCount };
}

/* ───────────────────── Walking coordinates ───────────────────── */

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Concourse (t, lateral) → world. Both inputs are clamped to the walkable area. */
export function concourseToWorld(
  spec: ConcourseSpec,
  radius: number,
  t: number,
  lateral: number,
): WorldPoint {
  const half = spec.walkwayWidth / 2;
  const angle = spec.startAngle + spec.sweep * clamp(t, 0, 1);
  const r = radius + clamp(lateral, -half, half);
  return { x: spec.centerX + r * Math.cos(angle), y: spec.centerY + r * Math.sin(angle) };
}

export interface ConcourseCoord {
  readonly t: number;
  readonly lateral: number;
}

/** World → concourse. Points in the east opening snap to the nearer end of the C. */
export function worldToConcourse(spec: ConcourseSpec, radius: number, p: WorldPoint): ConcourseCoord {
  const dx = p.x - spec.centerX;
  const dy = p.y - spec.centerY;
  const delta = (((Math.atan2(dy, dx) - spec.startAngle) % TAU) + TAU) % TAU;
  let t: number;
  if (delta <= spec.sweep) {
    t = delta / spec.sweep;
  } else {
    const gap = TAU - spec.sweep;
    t = delta - spec.sweep < gap / 2 ? 1 : 0;
  }
  return { t, lateral: Math.hypot(dx, dy) - radius };
}

/** Advance along the centerline by arc distance (positive = toward the art feature). */
export function advanceAlong(spec: ConcourseSpec, radius: number, t: number, distance: number): number {
  return clamp(t + distance / (spec.sweep * radius), 0, 1);
}

/* ───────────────────── "You Are Here" map ───────────────────── */

export interface MapGeometry {
  readonly viewBox: string;
  /** SVG path for the walkway centerline (stroke it with `strokeWidth`). */
  readonly centerlinePath: string;
  readonly strokeWidth: number;
  readonly start: WorldPoint;
  readonly end: WorldPoint;
  readonly atrium: { readonly cx: number; readonly cy: number; readonly r: number };
  /** Project a world point into the same coordinate space as the path. */
  readonly youAreHere: (t: number, lateral?: number) => WorldPoint;
}

/** Blueprint for the (M) popup. Uses the same math as the 3D scene so the map cannot drift. */
export function buildMapGeometry(spec: ConcourseSpec, radius: number, margin = 8): MapGeometry {
  validateSpec(spec);
  const half = spec.walkwayWidth / 2;
  const reach = radius + half + margin;
  const start = concourseToWorld(spec, radius, 0, 0);
  const end = concourseToWorld(spec, radius, 1, 0);
  const largeArc = spec.sweep > Math.PI ? 1 : 0;
  const f = (n: number): string => n.toFixed(3);
  return {
    viewBox: `${f(spec.centerX - reach)} ${f(spec.centerY - reach)} ${f(reach * 2)} ${f(reach * 2)}`,
    centerlinePath: `M ${f(start.x)} ${f(start.y)} A ${f(radius)} ${f(radius)} 0 ${largeArc} 1 ${f(end.x)} ${f(end.y)}`,
    strokeWidth: spec.walkwayWidth,
    start,
    end,
    atrium: { cx: spec.centerX, cy: spec.centerY, r: Math.max(0, radius - half - margin) },
    youAreHere: (t, lateral = 0) => concourseToWorld(spec, radius, t, lateral),
  };
}
