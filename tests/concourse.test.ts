import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONCOURSE as S, layoutFloor, concourseToWorld, worldToConcourse, advanceAlong, buildMapGeometry,
} from '../src/spatial/concourse';

describe('layoutFloor invariants', () => {
  it('returns exactly `count` placements for every count 0..1000 (never truncates)', () => {
    for (let n = 0; n <= 1000; n += 1) {
      const l = layoutFloor(n);
      expect(l.placements).toHaveLength(n);
      expect(l.outerCount + l.innerCount).toBe(n);
    }
  });

  it('keeps every frontage within [minFrontage, maxFrontage] and scale consistent', () => {
    for (const n of [1, 2, 3, 10, 25, 26, 60, 120, 400, 1000]) {
      for (const p of layoutFloor(n).placements) {
        expect(p.frontage).toBeGreaterThanOrEqual(S.minFrontage - 1e-9);
        expect(p.frontage).toBeLessThanOrEqual(S.maxFrontage + 1e-9);
        expect(p.scale).toBeCloseTo(p.frontage / S.baseFrontage, 12);
      }
    }
  });

  it('adjacent facades in a row never overlap (half-width ≤ r·tan(Δ/2))', () => {
    for (const n of [4, 10, 25, 26, 60, 120, 400]) {
      const l = layoutFloor(n);
      for (const row of ['outer', 'inner'] as const) {
        const ps = l.placements.filter((p) => p.row === row);
        if (ps.length < 2) continue;
        const r = Math.hypot(ps[0]!.x - S.centerX, ps[0]!.y - S.centerY);
        const delta = (S.sweep * (1 - 2 * S.endMargin)) / ps.length;
        expect(ps[0]!.frontage).toBeLessThanOrEqual(2 * r * Math.tan(delta / 2) + 1e-9);
      }
    }
  });

  it('small floors stay on one outer wall at base size; dense floors grow the C instead of dropping stores', () => {
    const small = layoutFloor(8);
    expect(small.innerCount).toBe(0);
    expect(small.radius).toBe(S.baseRadius);
    const huge = layoutFloor(1000);
    expect(huge.radius).toBeGreaterThan(S.baseRadius);
    expect(huge.placements).toHaveLength(1000);
  });

  it('placements are in walking order and facade orientation is correct', () => {
    const l = layoutFloor(60);
    l.placements.forEach((p, i) => {
      expect(p.index).toBe(i);
      if (i > 0) expect(p.t).toBeGreaterThanOrEqual(l.placements[i - 1]!.t);
    });
    const outer = l.placements.find((p) => p.row === 'outer')!;
    // outer facade faces the centre: a step along `facing` must reduce the distance to the centre
    const d0 = Math.hypot(outer.x, outer.y);
    const d1 = Math.hypot(outer.x + Math.cos(outer.facing), outer.y + Math.sin(outer.facing));
    expect(d1).toBeLessThan(d0);
    const inner = l.placements.find((p) => p.row === 'inner')!;
    const e0 = Math.hypot(inner.x, inner.y);
    const e1 = Math.hypot(inner.x + Math.cos(inner.facing), inner.y + Math.sin(inner.facing));
    expect(e1).toBeGreaterThan(e0);
  });

  it('keeps both end caps free for the elevator core and the centerpiece', () => {
    for (const n of [1, 10, 48, 400]) {
      const ps = layoutFloor(n).placements;
      expect(Math.min(...ps.map((p) => p.t))).toBeGreaterThanOrEqual(S.endMargin);
      expect(Math.max(...ps.map((p) => p.t))).toBeLessThanOrEqual(1 - S.endMargin);
    }
  });

  it('rejects bad input', () => {
    expect(() => layoutFloor(-1)).toThrow(RangeError);
    expect(() => layoutFloor(2.5)).toThrow(RangeError);
    expect(() => layoutFloor(5, { ...S, sweep: 2 * Math.PI })).toThrow(RangeError);
    expect(() => layoutFloor(5, { ...S, endMargin: 0.3 })).toThrow(RangeError);
  });
});

describe('walking coordinates', () => {
  const R = S.baseRadius;
  it('round-trips (t, lateral) ↔ world', () => {
    for (const t of [0, 0.1, 0.5, 0.9, 1]) for (const lat of [-5, 0, 3, 5]) {
      const back = worldToConcourse(S, R, concourseToWorld(S, R, t, lat));
      expect(back.t).toBeCloseTo(t, 9);
      expect(back.lateral).toBeCloseTo(lat, 9);
    }
  });
  it('clamps lateral to the walkway and t to [0,1]', () => {
    const p = concourseToWorld(S, R, 0.5, 999);
    expect(worldToConcourse(S, R, p).lateral).toBeCloseTo(S.walkwayWidth / 2, 9);
    expect(concourseToWorld(S, R, -3, 0)).toEqual(concourseToWorld(S, R, 0, 0));
  });
  it('points in the east opening snap to the nearer end', () => {
    const justBeforeStart = { x: R * Math.cos(S.startAngle - 0.1), y: R * Math.sin(S.startAngle - 0.1) };
    const justAfterEnd = { x: R * Math.cos(S.startAngle + S.sweep + 0.1), y: R * Math.sin(S.startAngle + S.sweep + 0.1) };
    expect(worldToConcourse(S, R, justBeforeStart).t).toBe(0);
    expect(worldToConcourse(S, R, justAfterEnd).t).toBe(1);
  });
  it('advanceAlong moves by arc length and clamps at both ends', () => {
    const arc = S.sweep * R;
    expect(advanceAlong(S, R, 0, arc / 4)).toBeCloseTo(0.25, 12);
    expect(advanceAlong(S, R, 0.9, arc)).toBe(1);
    expect(advanceAlong(S, R, 0.1, -arc)).toBe(0);
  });
});

describe('You Are Here map', () => {
  it('is a genuine C: 270° large arc, endpoints match the 3D scene, not a straight line', () => {
    const m = buildMapGeometry(S, S.baseRadius);
    expect(m.centerlinePath).toMatch(/^M [-\d.]+ [-\d.]+ A 40.000 40.000 0 1 1 [-\d.]+ [-\d.]+$/);
    expect(m.start).toEqual(concourseToWorld(S, S.baseRadius, 0, 0));
    expect(m.end).toEqual(concourseToWorld(S, S.baseRadius, 1, 0));
    // chord between the ends is ~2·R·sin(45°)·… much shorter than the arc ⇒ curved
    expect(Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y)).toBeLessThan(S.sweep * S.baseRadius * 0.5);
    // both ends sit on the east side (the C opens east)
    expect(m.start.x).toBeGreaterThan(0);
    expect(m.end.x).toBeGreaterThan(0);
  });
  it('viewBox contains the whole outer wall', () => {
    const m = buildMapGeometry(S, 55);
    const [x, y, w, h] = m.viewBox.split(' ').map(Number) as [number, number, number, number];
    expect(x).toBeLessThan(-(55 + S.walkwayWidth / 2));
    expect(y).toBeLessThan(-(55 + S.walkwayWidth / 2));
    expect(w).toBeGreaterThan(2 * (55 + S.walkwayWidth / 2));
    expect(h).toBe(w);
  });
  it('youAreHere sits on the centerline at t', () => {
    const m = buildMapGeometry(S, S.baseRadius);
    const p = m.youAreHere(0.5);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(S.baseRadius, 9);
    expect(p.x).toBeLessThan(0); // t=0.5 is the far west of the C
  });
});
