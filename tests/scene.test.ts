import { describe, it, expect } from 'vitest';
import { DEFAULT_CONCOURSE as S, concourseToWorld, layoutFloor } from '../src/spatial/concourse';
import { initialWalker, stepWalker, setTarget, NO_INPUT, WALK_SPEED, type Walker, type KeyInput } from '../src/scene/movement';
import { skyAt } from '../src/scene/timeOfDay';
import { nearestPlacement } from '../src/scene/interaction';

const R = S.baseRadius;
const half = S.walkwayWidth / 2;
const world = (w: Walker): { x: number; y: number } => concourseToWorld(S, R, w.t, w.lateral);

describe('movement', () => {
  it('never leaves the walkway under random keyboard input (property)', () => {
    let seed = 12345;
    const rnd = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let run = 0; run < 40; run += 1) {
      let w = initialWalker(S, rnd());
      for (let i = 0; i < 400; i += 1) {
        const k: KeyInput = { up: rnd() < 0.4, down: rnd() < 0.4, left: rnd() < 0.4, right: rnd() < 0.4 };
        w = stepWalker(w, k, 1 / 30 + rnd() * 0.05, S, R);
        expect(w.t).toBeGreaterThanOrEqual(0); expect(w.t).toBeLessThanOrEqual(1);
        expect(Math.abs(w.lateral)).toBeLessThanOrEqual(half + 1e-9);
        expect(w.phase).toBeGreaterThanOrEqual(0); expect(w.phase).toBeLessThan(1);
      }
    }
  });

  it('screen-space keys move the right way and diagonals are not faster', () => {
    const w0 = initialWalker(S, 0.5); // far west of the C
    const p0 = world(w0);
    const dt = 0.1;
    const right = world(stepWalker(w0, { ...NO_INPUT, right: true }, dt, S, R));
    expect(right.x).toBeGreaterThan(p0.x - 1e-9);
    const up = world(stepWalker(w0, { ...NO_INPUT, up: true }, dt, S, R));
    expect(up.y).toBeLessThan(p0.y);
    const diag = world(stepWalker(w0, { up: true, down: false, left: false, right: true }, dt, S, R));
    expect(Math.hypot(diag.x - p0.x, diag.y - p0.y)).toBeLessThanOrEqual(WALK_SPEED * dt * 1.02);
    expect(stepWalker(w0, { ...NO_INPUT, left: true }, dt, S, R).facing).toBe('left');
  });

  it('click-to-move walks along the arc, arrives, and stops', () => {
    const tgt = concourseToWorld(S, R, 0.8, 2);
    let w = setTarget(S, R, initialWalker(S, 0.1), tgt.x, tgt.y);
    expect(w.target).not.toBeNull();
    let steps = 0;
    while (w.target !== null && steps < 5000) { w = stepWalker(w, NO_INPUT, 1 / 30, S, R); steps += 1; }
    expect(w.target).toBeNull();
    expect(w.t).toBeCloseTo(0.8, 6);
    expect(w.lateral).toBeCloseTo(2, 6);
    expect(stepWalker(w, NO_INPUT, 1 / 30, S, R).moving).toBe(false);
  });

  it('click targets outside the walkway are clamped onto it; keyboard cancels a click target', () => {
    const w = setTarget(S, R, initialWalker(S), 0, 0); // atrium centre
    expect(Math.abs(w.target!.lateral)).toBeLessThanOrEqual(half + 1e-9);
    expect(stepWalker(w, { ...NO_INPUT, up: true }, 0.05, S, R).target).toBeNull();
  });

  it('rejects negative dt; zero dt does not move', () => {
    const w = initialWalker(S);
    expect(() => stepWalker(w, NO_INPUT, -1, S, R)).toThrow(RangeError);
    const z = stepWalker(w, { ...NO_INPUT, right: true }, 0, S, R);
    expect(z.t).toBe(w.t);
  });
});

describe('time of day', () => {
  it('is continuous across midnight and periodic', () => {
    expect(skyAt(0)).toEqual(skyAt(24));
    expect(skyAt(-1)).toEqual(skyAt(23));
    expect(skyAt(26)).toEqual(skyAt(2));
  });
  it('noon is bright with no lamplight; midnight is dark with full lamplight', () => {
    expect(skyAt(12).daylight).toBe(1);
    expect(skyAt(12).lamplight).toBe(0);
    expect(skyAt(0).daylight).toBe(0);
    expect(skyAt(0).lamplight).toBe(1);
  });
  it('daylight stays in [0,1], colours are valid hex, and changes are gradual', () => {
    let prev = skyAt(0).daylight;
    for (let h = 0; h <= 24; h += 0.1) {
      const s = skyAt(h);
      expect(s.daylight).toBeGreaterThanOrEqual(0); expect(s.daylight).toBeLessThanOrEqual(1);
      for (const c of [s.horizon, s.zenith, s.sea, s.tint]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      expect(Math.abs(s.daylight - prev)).toBeLessThan(0.15);
      prev = s.daylight;
    }
    expect(() => skyAt(Number.NaN)).toThrow(RangeError);
  });
});

describe('interaction', () => {
  it('finds the nearest store within range, else -1', () => {
    const l = layoutFloor(10);
    const p = l.placements[4]!;
    expect(nearestPlacement(l.placements, p.x + 0.2, p.y, 3)).toBe(4);
    expect(nearestPlacement(l.placements, 0, 0, 3)).toBe(-1);
    expect(nearestPlacement([], 0, 0, 3)).toBe(-1);
  });
});
