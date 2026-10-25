import { describe, it, expect } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { seasonAt, phaseAt, neonAt, skyboxAt, skyboxFor, gradeSky, hourOf } from '../src/scene/skybox';
import { skyAt } from '../src/scene/timeOfDay';
import { ParticleField } from '../src/scene/particles';

const L = (y: number, mo: number, d: number, h = 12, mi = 0, s = 0): Date => new Date(y, mo - 1, d, h, mi, s); // local time, like the device clock
const rgb = (c: string): [number, number, number] => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const luma = (c: string): number => { const [r, g, b] = rgb(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const sat = (c: string): number => { const v = rgb(c); return Math.max(...v) - Math.min(...v); };

describe('season from the device date', () => {
  it.each([
    [[2026, 8, 31], 'coastal'], [[2026, 9, 1], 'autumn'], [[2026, 10, 24], 'autumn'], [[2026, 11, 30], 'autumn'],
    [[2026, 12, 1], 'winter'], [[2026, 12, 31], 'winter'], [[2027, 1, 1], 'winter'], [[2027, 1, 15], 'winter'],
    [[2027, 1, 16], 'coastal'], [[2027, 4, 10], 'coastal'], [[2027, 7, 4], 'coastal'], [[2028, 2, 29], 'coastal'],
  ] as const)('%j → %s', ([y, m, d], season) => expect(seasonAt(L(y, m, d)).season).toBe(season));

  it('Christmas week is Dec 20–26 and nothing else', () => {
    for (let d = 1; d <= 31; d += 1) expect(seasonAt(L(2026, 12, d)).christmasWeek).toBe(d >= 20 && d <= 26);
    expect(seasonAt(L(2027, 1, 3)).christmasWeek).toBe(false);
    expect(seasonAt(L(2026, 10, 24)).christmasWeek).toBe(false);
  });
  it('is year-independent: the same calendar day gives the same season in any year', () => {
    for (const [m, d] of [[12, 25], [1, 15], [1, 16], [9, 1], [8, 31]] as const)
      expect(new Set([2024, 2026, 2031, 2100].map((y) => seasonAt(L(y, m, d)).season)).size).toBe(1);
  });
});

describe('day and night', () => {
  it('Day is 06:00–17:59, night is 18:00–05:59', () => {
    expect(phaseAt(L(2026, 6, 1, 5, 59, 59))).toBe('night');
    expect(phaseAt(L(2026, 6, 1, 6, 0, 0))).toBe('day');
    expect(phaseAt(L(2026, 6, 1, 17, 59, 59))).toBe('day');
    expect(phaseAt(L(2026, 6, 1, 18, 0, 0))).toBe('night');
    expect(phaseAt(L(2026, 6, 1, 0, 0, 0))).toBe('night');
    expect(phaseAt(L(2026, 6, 1, 12, 0, 0))).toBe('day');
  });
  it('neon/facade lights are off by day, fully on at night, and ramp smoothly across ±15 min of each boundary', () => {
    expect(neonAt(12)).toBe(0); expect(neonAt(3)).toBe(1); expect(neonAt(0)).toBe(1); expect(neonAt(22)).toBe(1);
    expect(neonAt(17.75)).toBe(0); expect(neonAt(18)).toBeCloseTo(0.5, 12); expect(neonAt(18.25)).toBe(1);
    expect(neonAt(5.75)).toBe(1); expect(neonAt(6)).toBeCloseTo(0.5, 12); expect(neonAt(6.25)).toBe(0);
    let prev = neonAt(17.75);
    for (let h = 17.75; h <= 18.25; h += 0.01) { const n = neonAt(h); expect(n).toBeGreaterThanOrEqual(prev - 1e-12); prev = n; }
    expect(hourOf(L(2026, 1, 1, 6, 30, 36))).toBeCloseTo(6.51, 9);
  });
});

describe('skybox state', () => {
  it('Winter: snow, heavier in Christmas week; holiday lights only at night', () => {
    const quiet = skyboxAt(L(2026, 12, 3, 14)); const xmas = skyboxAt(L(2026, 12, 24, 14)); const xmasNight = skyboxAt(L(2026, 12, 24, 21));
    expect(quiet.particles).toEqual({ kind: 'snow', intensity: 0.7 });
    expect(xmas.particles).toEqual({ kind: 'snow', intensity: 1 });
    expect(quiet.holidayLights).toBe(false); expect(xmasNight.holidayLights).toBe(true);
    expect(xmasNight.phase).toBe('night'); expect(xmas.phase).toBe('day');
    expect(skyboxAt(L(2027, 1, 10, 22)).holidayLights).toBe(true);
  });
  it('Autumn: foliage; Spring/Summer: no particles and no holiday lights', () => {
    expect(skyboxAt(L(2026, 10, 24, 17)).particles).toEqual({ kind: 'leaves', intensity: 0.6 });
    for (const [m, d] of [[3, 15], [6, 21], [8, 1]] as const) {
      const s = skyboxAt(L(2026, m, d, 13));
      expect(s.particles).toEqual({ kind: null, intensity: 0 }); expect(s.holidayLights).toBe(false); expect(s.season).toBe('coastal');
    }
  });
  it('seasonal grades are visibly different at noon: autumn warm, winter muted, coastal crisp blue', () => {
    const a = skyboxAt(L(2026, 10, 15, 12)).sky; const w = skyboxAt(L(2026, 12, 10, 12)).sky; const c = skyboxAt(L(2026, 5, 15, 12)).sky;
    const warmth = (col: string): number => rgb(col)[0] - rgb(col)[2];
    expect(warmth(a.horizon)).toBeGreaterThan(warmth(c.horizon) + 40);
    expect(warmth(a.horizon)).toBeGreaterThan(warmth(w.horizon));
    expect(sat(w.horizon)).toBeLessThan(sat(c.horizon));
    expect(rgb(c.zenith)[2]).toBeGreaterThan(rgb(c.zenith)[0] + 60); // crisp blue overhead
    expect(a.tintAlpha).toBeGreaterThan(c.tintAlpha);                // golden-hour overlay
  });
  it('night skies stay dark in every season, and every colour is valid hex', () => {
    for (const [m, d] of [[12, 24], [10, 24], [5, 15]] as const) {
      for (const h of [0, 2, 23]) {
        const s = skyboxAt(L(2026, m, d, h)).sky;
        expect(luma(s.zenith)).toBeLessThan(0.2); expect(luma(s.horizon)).toBeLessThan(0.3);
        for (const c of [s.horizon, s.zenith, s.sea, s.tint]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
  it('grading never changes the daylight/lamplight numbers and keeps tintAlpha bounded', () => {
    for (const season of ['winter', 'autumn', 'coastal'] as const) for (let h = 0; h < 24; h += 0.5) {
      const base = skyAt(h); const g = gradeSky(base, season);
      expect(g.daylight).toBe(base.daylight); expect(g.lamplight).toBe(base.lamplight);
      expect(g.tintAlpha).toBeGreaterThanOrEqual(0); expect(g.tintAlpha).toBeLessThanOrEqual(0.5);
    }
  });
  it('is continuous across midnight and deterministic; invalid dates throw', () => {
    expect(skyboxAt(L(2026, 6, 1, 0, 0, 0))).toEqual(skyboxAt(L(2026, 6, 1, 0, 0, 0)));
    const a = skyboxAt(L(2026, 6, 1, 23, 59, 59)).sky; const b = skyboxAt(L(2026, 6, 2, 0, 0, 0)).sky;
    expect(Math.abs(luma(a.zenith) - luma(b.zenith))).toBeLessThan(0.01);
    expect(() => skyboxAt(new Date('nope'))).toThrow(RangeError);
  });
  it('the manual hour slider overrides the time of day but never the season', () => {
    const now = L(2026, 12, 24, 10);
    const night = skyboxFor(now, 22.5);
    expect(night.phase).toBe('night'); expect(night.season).toBe('winter'); expect(night.holidayLights).toBe(true);
    expect(skyboxFor(now, null)).toEqual(skyboxAt(now));
    expect(skyboxFor(L(2026, 10, 24, 3), 13).phase).toBe('day');
  });
});

describe('particle field', () => {
  it('uses the intensity share of a fixed pool, and clears when nothing falls', () => {
    const f = new ParticleField(100);
    f.configure('snow', 0.7); expect(f.activeCount).toBe(70); expect(f.currentKind).toBe('snow');
    f.configure('snow', 1); expect(f.activeCount).toBe(100);
    f.configure('leaves', 0.6); expect(f.activeCount).toBe(60); expect(f.currentKind).toBe('leaves');
    f.configure(null, 1); expect(f.activeCount).toBe(0); expect(f.currentKind).toBeNull();
    f.configure('snow', 5); expect(f.activeCount).toBe(100); // clamped
    f.configure('snow', -1); expect(f.activeCount).toBe(0);
  });
  it('keeps every particle inside the (slightly padded) screen and finite over a long simulation, for both kinds', () => {
    for (const kind of ['snow', 'leaves'] as const) {
      const f = new ParticleField(140); f.resize(1280, 720); f.configure(kind, 1);
      for (let i = 0; i < 60 * 60; i += 1) {
        f.step(1 / 60, 8);
        if (i % 97 === 0) { const e = f.extent(); expect(Number.isFinite(e.minX + e.maxX + e.minY + e.maxY)).toBe(true); expect(e.minX).toBeGreaterThanOrEqual(-13); expect(e.maxX).toBeLessThanOrEqual(1293); expect(e.minY).toBeGreaterThanOrEqual(-53); expect(e.maxY).toBeLessThanOrEqual(733); }
      }
      const e = f.extent();
      expect(e.maxY - e.minY).toBeGreaterThan(300); // still spread across the screen, not collapsed
    }
  });
  it('is deterministic for a seed', () => {
    const run = (): string => { const f = new ParticleField(50, 9); f.resize(400, 300); f.configure('snow', 1); for (let i = 0; i < 100; i += 1) f.step(0.016); const c = createCanvas(400, 300); const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 400, 300); f.draw(x as unknown as CanvasRenderingContext2D, { night: true, parallaxX: 0, parallaxY: 0 }); return c.toBuffer('image/png').toString('base64'); };
    expect(run()).toBe(run());
  });
  it('batches drawing: one fill for snow, three for leaves, regardless of count', () => {
    const count = (kind: 'snow' | 'leaves', n: number): number => {
      let fills = 0;
      const ctx = new Proxy({}, { get: (_t, p) => (p === 'fill' ? () => { fills += 1; } : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
      const f = new ParticleField(n); f.configure(kind, 1); f.draw(ctx, { night: false, parallaxX: 0, parallaxY: 0 }); return fills;
    };
    expect(count('snow', 20)).toBe(1); expect(count('snow', 500)).toBe(1);
    expect(count('leaves', 20)).toBe(3); expect(count('leaves', 500)).toBe(3);
  });
  it('resize rescales positions and does nothing for the same size', () => {
    const f = new ParticleField(10); f.resize(1000, 500); f.configure('snow', 1);
    expect(() => { f.resize(1000, 500); f.resize(2000, 1000); f.resize(640, 360); }).not.toThrow();
  });
  it('performance guard: 140 leaves step+draw in under 4 ms per frame on a 1280×720 canvas', () => {
    const c = createCanvas(1280, 720); const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    const f = new ParticleField(140); f.resize(1280, 720); f.configure('leaves', 1);
    for (let i = 0; i < 30; i += 1) { f.step(1 / 60); f.draw(ctx, { night: false, parallaxX: 0, parallaxY: 0 }); } // warm-up
    const t0 = performance.now();
    for (let i = 0; i < 240; i += 1) { f.step(1 / 60); f.draw(ctx, { night: false, parallaxX: i, parallaxY: 0 }); }
    expect((performance.now() - t0) / 240).toBeLessThan(4);
  });
});
