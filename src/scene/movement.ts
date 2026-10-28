/**
 * Avatar movement constrained to the C-shaped walkway.
 * WASD / arrow input is in SCREEN space (up = screen-up) and is projected back onto the
 * walkway, so the avatar slides along the curved walls instead of leaving the concourse.
 * Click-to-move walks in concourse coordinates (along the arc), never cutting across the atrium.
 */

import {
  type ConcourseSpec, type ConcourseCoord, concourseToWorld, worldToConcourse,
} from '../spatial/concourse';
import type { Facing } from '../avatar/config';

export interface Walker {
  readonly t: number;
  readonly lateral: number;
  readonly facing: Facing;
  readonly moving: boolean;
  /** Walk-cycle phase in [0,1). */
  readonly phase: number;
  readonly target: ConcourseCoord | null;
}

export interface KeyInput {
  readonly up: boolean;
  readonly down: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

export const NO_INPUT: KeyInput = { up: false, down: false, left: false, right: false };
export const WALK_SPEED = 9;    // world units per second
export const STRIDE = 5;        // world units per full walk cycle
const ARRIVE_EPS = 0.05;

export function initialWalker(_spec: ConcourseSpec, t = 0.04): Walker {
  return { t, lateral: 0, facing: 'right', moving: false, phase: 0, target: null };
}

function clampCoord(spec: ConcourseSpec, c: ConcourseCoord): ConcourseCoord {
  const half = spec.walkwayWidth / 2;
  return { t: Math.min(1, Math.max(0, c.t)), lateral: Math.min(half, Math.max(-half, c.lateral)) };
}

export function setTarget(spec: ConcourseSpec, radius: number, w: Walker, worldX: number, worldY: number): Walker {
  const c = worldToConcourse(spec, radius, { x: worldX, y: worldY });
  return { ...w, target: clampCoord(spec, c) };
}

export function stepWalker(w: Walker, input: KeyInput, dt: number, spec: ConcourseSpec, radius: number): Walker {
  if (!(dt >= 0)) throw new RangeError('dt must be >= 0');
  if (dt === 0) return w; // no time passed: no movement, no float round-trip drift
  const here = concourseToWorld(spec, radius, w.t, w.lateral);
  const kx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const ky = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const reach = WALK_SPEED * dt;

  let next: ConcourseCoord;
  let target = w.target;

  if (kx !== 0 || ky !== 0) {
    target = null; // keyboard overrides click-to-move
    const len = Math.hypot(kx, ky);
    const wantX = here.x + (kx / len) * reach;
    const wantY = here.y + (ky / len) * reach;
    next = clampCoord(spec, worldToConcourse(spec, radius, { x: wantX, y: wantY }));
  } else if (target !== null) {
    const arc = spec.sweep * radius;
    const dT = target.t - w.t;
    const dL = target.lateral - w.lateral;
    const dist = Math.hypot(dT * arc, dL);
    if (dist <= Math.max(ARRIVE_EPS, reach)) {
      next = target;
      target = null;
    } else {
      const k = reach / dist;
      next = { t: w.t + dT * k, lateral: w.lateral + dL * k };
    }
  } else {
    return { ...w, moving: false };
  }

  const there = concourseToWorld(spec, radius, next.t, next.lateral);
  const moved = Math.hypot(there.x - here.x, there.y - here.y);
  const facing: Facing = there.x - here.x > 1e-6 ? 'right' : there.x - here.x < -1e-6 ? 'left' : w.facing;
  const phase = (((w.phase + moved / STRIDE) % 1) + 1) % 1;
  return { t: next.t, lateral: next.lateral, facing, moving: moved > 1e-6, phase, target };
}
