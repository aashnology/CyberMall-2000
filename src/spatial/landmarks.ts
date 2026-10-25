import { type ConcourseSpec, concourseToWorld } from './concourse';

export interface Landmark { readonly x: number; readonly y: number; readonly angle: number }

/** World location of the elevator core (start of the C) and the centerpiece / arcade (end of the C). */
export function landmarkPositions(spec: ConcourseSpec, radius: number): { elevator: Landmark; centerpiece: Landmark } {
  const a0 = spec.startAngle;
  const a1 = spec.startAngle + spec.sweep;
  const s = concourseToWorld(spec, radius, 0, 0);
  const e = concourseToWorld(spec, radius, 1, 0);
  const push = spec.walkwayWidth * 0.75;
  return {
    elevator: { x: s.x + Math.sin(a0) * push, y: s.y - Math.cos(a0) * push, angle: a0 },
    centerpiece: { x: e.x - Math.sin(a1) * push, y: e.y + Math.cos(a1) * push, angle: a1 },
  };
}

/** The booth's "Enter Photobooth" prompt appears within this many world units of its kiosk. */
export const PHOTOBOOTH_TRIGGER_RADIUS = 4.6;
/** Half the kiosk's footprint, used to keep it clear of storefronts. */
export const PHOTOBOOTH_HALF_WIDTH = 2.6;

export interface Floor7Landmarks {
  /** The Gaming Arcade wing occupies the far end of the concourse (where other floors have the centerpiece). */
  readonly arcade: Landmark;
  /** The photobooth kiosk: at the threshold between the last food stall and the arcade, against the outer wall. */
  readonly photobooth: Landmark;
}

export function floor7Landmarks(spec: ConcourseSpec, radius: number): Floor7Landmarks {
  const half = spec.walkwayWidth / 2;
  const t = 1 - spec.endMargin / 2; // middle of the free end cap: no storefront is ever placed here
  const p = concourseToWorld(spec, radius, t, half - 1.8);
  return {
    arcade: landmarkPositions(spec, radius).centerpiece,
    photobooth: { x: p.x, y: p.y, angle: spec.startAngle + spec.sweep * t },
  };
}

export function nearPhotobooth(walker: { x: number; y: number }, booth: Landmark, radius: number = PHOTOBOOTH_TRIGGER_RADIUS): boolean {
  return Math.hypot(walker.x - booth.x, walker.y - booth.y) <= radius;
}
