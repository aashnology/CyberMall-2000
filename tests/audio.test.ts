import { describe, it, expect } from 'vitest';
import * as wa from 'node-web-audio-api';
import { SpatialAudio, computeBedMix, proximity, MUTE_KEY, PROXIMITY_RADIUS, ARCADE_RADIUS, MASTER_VOLUME, type ListenerContext, type Sfx } from '../src/audio/spatialAudio';

const SR = 44100;
const offline = (seconds: number): wa.OfflineAudioContext => new wa.OfflineAudioContext(1, Math.ceil(SR * seconds), SR);
const asCtx = (c: wa.OfflineAudioContext): BaseAudioContext => c as unknown as BaseAudioContext;
const rms = (d: Float32Array, a = 0, b = d.length): number => { let s = 0; for (let i = a; i < b; i += 1) s += (d[i] as number) ** 2; return Math.sqrt(s / Math.max(1, b - a)); };
const peak = (d: Float32Array): number => d.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
/** Energy of one frequency (Goertzel). */
function goertzel(d: Float32Array, f: number, a = 0, b = d.length): number {
  const w = (2 * Math.PI * f) / SR; const c = 2 * Math.cos(w); let s1 = 0; let s2 = 0;
  for (let i = a; i < b; i += 1) { const s = (d[i] as number) + c * s1 - s2; s2 = s1; s1 = s; }
  return (s1 * s1 + s2 * s2 - c * s1 * s2) / (b - a) ** 2;
}
const mem = (): { store: Pick<Storage, 'getItem' | 'setItem'>; data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, store: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } } };
};

async function renderBeds(seconds: number, l: ListenerContext, opts: { muted?: boolean } = {}): Promise<Float32Array> {
  const ctx = offline(seconds);
  const a = new SpatialAudio({ storage: null });
  if (opts.muted) a.setMuted(true);
  a.attach(asCtx(ctx));
  a.setListener(l);
  a.scheduleUntil(seconds);
  return new Float32Array((await ctx.startRendering()).getChannelData(0)); // copy out of native memory
}
/** The sound alone: render with the SFX, render without, subtract. The room tone is deterministic, so it cancels exactly. */
async function renderSfx(sfx: Sfx, seconds = 2): Promise<Float32Array> {
  const withCtx = offline(seconds); const base = offline(seconds);
  const a = new SpatialAudio({ storage: null }); const b = new SpatialAudio({ storage: null });
  a.attach(asCtx(withCtx)); b.attach(asCtx(base));
  expect(a.play(sfx, 0.05)).toBe(true);
  const [x, y] = await Promise.all([withCtx.startRendering(), base.startRendering()]);
  const dx = new Float32Array(x.getChannelData(0)); const dy = new Float32Array(y.getChannelData(0));
  return Float32Array.from(dx, (v, i) => v - (dy[i] as number));
}

describe('proximity crossfade maths', () => {
  it('proximity is 0 beyond the radius, 1 at the store, and strictly decreasing between', () => {
    expect(proximity(PROXIMITY_RADIUS)).toBe(0);
    expect(proximity(PROXIMITY_RADIUS * 3)).toBe(0);
    expect(proximity(0)).toBe(1);
    let prev = 1;
    for (let d = 0.5; d < PROXIMITY_RADIUS; d += 0.5) { const p = proximity(d); expect(p).toBeLessThan(prev); prev = p; }
    expect(proximity(-1)).toBe(0);
    expect(proximity(Number.NaN)).toBe(0);
  });
  it('is equal-power everywhere (Σ gain² = 1) so loudness does not dip mid-fade', () => {
    for (const floorId of [1, 5, 6, 8, 9] as const) for (const sub of ['cafe', 'bakery', 'theatre', 'ott', 'skincare']) for (let d = 0; d <= 20; d += 1.7) {
      const m = computeBedMix({ floorId, nearest: { subcategory: sub, distance: d } });
      expect(m.mall ** 2 + m.cafe ** 2 + m.cinema ** 2 + m.arcade ** 2).toBeCloseTo(1, 12);
      for (const g of Object.values(m)) { expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(1); }
    }
  });
  it('far from everything it is pure mall; walking toward a cafe fades the cafe in monotonically', () => {
    expect(computeBedMix({ floorId: 1, nearest: null })).toEqual({ mall: 1, cafe: 0, cinema: 0, arcade: 0 });
    expect(computeBedMix({ floorId: 1, nearest: { subcategory: 'cafe', distance: 30 } }).cafe).toBe(0);
    let prev = 0;
    for (let d = PROXIMITY_RADIUS; d >= 0; d -= 1) {
      const c = computeBedMix({ floorId: 1, nearest: { subcategory: 'cafe', distance: d } }).cafe;
      expect(c).toBeGreaterThanOrEqual(prev); prev = c;
    }
    expect(prev).toBeGreaterThan(0.9);
  });
  it('the arcade bed exists only on Floor 7, grows as you walk toward the arcade, and is equal-power throughout', () => {
    const at = (floorId: 1 | 7, d: number | null): ReturnType<typeof computeBedMix> => computeBedMix({ floorId, nearest: null, arcadeDistance: d });
    expect(at(1, 2).arcade).toBe(0);                 // not on other floors, however close
    expect(at(7, null).arcade).toBe(0);              // no distance known
    expect(at(7, ARCADE_RADIUS).arcade).toBe(0);     // outside the radius
    let prev = 0;
    for (let d = ARCADE_RADIUS; d >= 0; d -= 1) { const m = at(7, d); expect(m.arcade).toBeGreaterThanOrEqual(prev); prev = m.arcade; expect(m.mall ** 2 + m.cafe ** 2 + m.cinema ** 2 + m.arcade ** 2).toBeCloseTo(1, 12); }
    expect(prev).toBeGreaterThan(0.9);
  });
  it('the Cafes floor is acoustic lounge, the Theatre & OTT floor is cinematic, other wings do not leak', () => {
    expect(computeBedMix({ floorId: 8, nearest: null }).cafe).toBeGreaterThan(0.7);
    expect(computeBedMix({ floorId: 6, nearest: null }).cinema).toBeGreaterThan(0.7);
    expect(computeBedMix({ floorId: 6, nearest: null }).cafe).toBe(0);
    expect(computeBedMix({ floorId: 1, nearest: { subcategory: 'skincare', distance: 0 } })).toEqual({ mall: 1, cafe: 0, cinema: 0, arcade: 0 });
    expect(computeBedMix({ floorId: 1, nearest: { subcategory: 'theatre', distance: 1 } }).cinema).toBeGreaterThan(0.7);
  });
});

describe('mute and lifecycle', () => {
  it('persists the mute choice and restores it in a new instance', () => {
    const m = mem();
    const a = new SpatialAudio({ storage: m.store });
    expect(a.isMuted).toBe(false);
    expect(a.toggleMute()).toBe(true);
    expect(m.data.get(MUTE_KEY)).toBe('1');
    expect(new SpatialAudio({ storage: m.store }).isMuted).toBe(true);
    a.setMuted(false);
    expect(new SpatialAudio({ storage: m.store }).isMuted).toBe(false);
  });
  it('survives missing or throwing storage', () => {
    expect(new SpatialAudio({ storage: null }).isMuted).toBe(false);
    const bad = { getItem: (): string => { throw new Error('denied'); }, setItem: (): void => { throw new Error('quota'); } };
    const a = new SpatialAudio({ storage: bad });
    expect(a.isMuted).toBe(false);
    expect(() => a.setMuted(true)).not.toThrow();
    expect(a.isMuted).toBe(true);
  });
  it('makes no sound before start() and none while muted; notifies subscribers', () => {
    const a = new SpatialAudio({ storage: null });
    expect(a.isStarted).toBe(false);
    expect(a.play('click')).toBe(false);
    let n = 0; a.subscribe(() => { n += 1; });
    a.setMuted(true); a.setMuted(false);
    expect(n).toBe(2);
    const ctx = offline(1); a.attach(asCtx(ctx));
    expect(a.play('click')).toBe(true);
    a.setMuted(true);
    expect(a.play('click')).toBe(false);
  });
  it('refuses a double attach and reports unsupported environments without throwing', async () => {
    const a = new SpatialAudio({ storage: null }); a.attach(asCtx(offline(1)));
    expect(() => a.attach(asCtx(offline(1)))).toThrow(/already attached/);
    expect(await new SpatialAudio({ storage: null }).start()).toBe(false); // no AudioContext in Node
  });
  it('start() builds the graph, schedules ahead on a timer, and dispose() stops it', async () => {
    let tick: (() => void) | null = null; let cleared = false;
    const ctx = offline(1);
    // an offline context has no gesture lock, so report it as running
    Object.defineProperty(ctx, 'state', { value: 'running' });
    const a = new SpatialAudio({ storage: null, createContext: () => asCtx(ctx), setIntervalFn: (fn) => { tick = fn; return 1; }, clearIntervalFn: () => { cleared = true; } });
    expect(await a.start()).toBe(true);
    expect(a.isStarted).toBe(true);
    expect(tick).not.toBeNull();
    (tick as unknown as () => void)();
    a.dispose();
    expect(cleared).toBe(true);
    expect(a.isStarted).toBe(false);
  });
});

describe('rendered ambience (offline Web Audio)', () => {
  it('mall bed is finite, quiet, never clips, and not silent', async () => {
    const d = await renderBeds(8, { floorId: 1, nearest: null });
    expect(d.every(Number.isFinite)).toBe(true);
    expect(peak(d)).toBeLessThan(0.6);
    expect(peak(d)).toBeGreaterThan(0.005);
    const r = rms(d, SR * 2);
    expect(r).toBeGreaterThan(0.002);
    expect(r).toBeLessThan(0.08); // "low-volume background"
  });
  it('has an HVAC rumble: low-frequency energy dominates the room tone', async () => {
    const d = await renderBeds(4, { floorId: 1, nearest: null });
    const low = goertzel(d, 58, SR, d.length); const high = goertzel(d, 6000, SR, d.length);
    expect(low).toBeGreaterThan(high * 50);
  });
  it('the HVAC hum is gentle: every bed is at least 2× (6 dB) louder than the room tone alone', async () => {
    const room = rms(await renderBeds(8, { floorId: 1, nearest: null }).then(async () => {
      const ctx = offline(8); const a = new SpatialAudio({ storage: null }); a.attach(asCtx(ctx)); // no music scheduled
      return new Float32Array((await ctx.startRendering()).getChannelData(0));
    }), SR * 2);
    for (const l of [{ floorId: 1, nearest: null }, { floorId: 8, nearest: null }, { floorId: 6, nearest: null }] as const) {
      const d = await renderBeds(8, l);
      expect(Math.sqrt(Math.max(0, rms(d, SR * 2) ** 2 - room ** 2))).toBeGreaterThan(room * 2);
    }
  });
  it('mute silences everything (below −120 dB)', async () => {
    const d = await renderBeds(4, { floorId: 8, nearest: null }, { muted: true });
    expect(rms(d, SR)).toBeLessThan(1e-6);
  });
  it('cafe, cinema and mall beds are audibly different signals at comparable loudness', async () => {
    const mall = await renderBeds(8, { floorId: 1, nearest: null });
    const cafe = await renderBeds(8, { floorId: 8, nearest: null });
    const cinema = await renderBeds(8, { floorId: 6, nearest: null });
    // distinctness = size of the difference signal relative to the reference (measured: 0.83–1.13; identical renders give 0)
    const distinct = (a: Float32Array, b: Float32Array): number => { const x = new Float32Array(a.length); for (let i = 0; i < a.length; i += 1) x[i] = (a[i] as number) - (b[i] as number); return rms(x, SR * 2) / rms(b, SR * 2); };
    expect(distinct(mall, mall)).toBe(0);
    expect(distinct(cafe, mall)).toBeGreaterThan(0.6);
    expect(distinct(cinema, mall)).toBeGreaterThan(0.6);
    expect(distinct(cinema, cafe)).toBeGreaterThan(0.6);
    for (const d of [cafe, cinema]) { const ratio = rms(d, SR * 2) / rms(mall, SR * 2); expect(ratio).toBeGreaterThan(0.5); expect(ratio).toBeLessThan(2); } // beds are level-matched within 6 dB
    // cinema is darker: more energy low than high compared with the cafe pluck bed
    const tilt = (d: Float32Array): number => goertzel(d, 130, SR * 2) / (goertzel(d, 1500, SR * 2) + 1e-18);
    expect(tilt(cinema)).toBeGreaterThan(tilt(cafe));
  });
  it('the arcade bed is 8-bit: audibly distinct, level-matched, and brighter (square-wave harmonics) than the cinema pad', async () => {
    const mall = await renderBeds(8, { floorId: 1, nearest: null });
    const arcade = await renderBeds(8, { floorId: 7, nearest: null, arcadeDistance: 0 });
    const cinema = await renderBeds(8, { floorId: 6, nearest: null });
    expect(arcade.every(Number.isFinite)).toBe(true);
    expect(peak(arcade)).toBeLessThan(0.7);
    const ratio = rms(arcade, SR * 2) / rms(mall, SR * 2);
    expect(ratio).toBeGreaterThan(0.5); expect(ratio).toBeLessThan(2);
    const x = new Float32Array(arcade.length); for (let i = 0; i < x.length; i += 1) x[i] = (arcade[i] as number) - (mall[i] as number);
    expect(rms(x, SR * 2) / rms(mall, SR * 2)).toBeGreaterThan(0.6);
    const bright = (d: Float32Array): number => goertzel(d, 2200, SR * 2) / (goertzel(d, 220, SR * 2) + 1e-18);
    expect(bright(arcade)).toBeGreaterThan(bright(cinema));
  });
  it('crossfading from mall to cafe mid-render is smooth: no jump, loudness stays within ±6 dB', async () => {
    const seconds = 14;
    const ctx = offline(seconds);
    const a = new SpatialAudio({ storage: null });
    a.attach(asCtx(ctx));
    a.scheduleUntil(seconds);
    const sus = ctx.suspend(6).then(() => { a.setListener({ floorId: 8, nearest: null }); return ctx.resume(); });
    const d = new Float32Array((await ctx.startRendering()).getChannelData(0));
    await sus;
    const win = (s: number): number => rms(d, Math.floor(s * SR), Math.floor((s + 0.5) * SR));
    const before = rms(d, 3 * SR, 6 * SR); const after = rms(d, 11 * SR, 14 * SR);
    expect(after / before).toBeGreaterThan(0.5); expect(after / before).toBeLessThan(2);
    for (let s = 5; s < 11; s += 0.5) { const r = win(s) / (win(s + 0.5) + 1e-9); expect(r).toBeLessThan(4); expect(r).toBeGreaterThan(0.25); }
    expect(d.every(Number.isFinite)).toBe(true);
    expect(peak(d)).toBeLessThan(0.7);
  });
});

describe('retro UI sounds (offline Web Audio)', () => {
  it.each(['click', 'bloop', 'bell', 'chime', 'open', 'shutter', 'beep'] as const)('%s is audible, finite and unclipped', async (sfx) => {
    const d = await renderSfx(sfx);
    expect(d.every(Number.isFinite)).toBe(true);
    expect(peak(d)).toBeGreaterThan(0.02);
    expect(peak(d)).toBeLessThan(0.95);
  });
  it('click is crisp: most energy in the first 60 ms, silent by 0.5 s', async () => {
    const d = await renderSfx('click');
    const start = Math.floor(0.05 * SR);
    expect(rms(d, start, start + Math.floor(0.06 * SR))).toBeGreaterThan(rms(d, Math.floor(0.5 * SR), Math.floor(0.6 * SR)) * 50);
  });
  it('elevator bell rings at E6 (1318.5 Hz) and sustains for over a second', async () => {
    const d = await renderSfx('bell', 3);
    const a = Math.floor(0.06 * SR); const b = Math.floor(0.5 * SR);
    const at = goertzel(d, 1318.5, a, b);
    for (const off of [700, 1000, 1800, 2400]) expect(at).toBeGreaterThan(goertzel(d, off, a, b) * 10);
    expect(rms(d, Math.floor(0.9 * SR), Math.floor(1.1 * SR))).toBeGreaterThan(0.002);
    expect(rms(d, Math.floor(2.6 * SR), Math.floor(2.9 * SR))).toBeLessThan(rms(d, a, b) * 0.1);
  });
  it('bloop rises: the second blip sits higher than the first', async () => {
    const d = await renderSfx('bloop', 1);
    const s = Math.floor(0.05 * SR);
    const first = [420, 840].map((f) => goertzel(d, f, s, s + Math.floor(0.08 * SR)));
    const second = [840, 1280].map((f) => goertzel(d, f, s + Math.floor(0.1 * SR), s + Math.floor(0.2 * SR)));
    expect(Math.max(...first)).toBeGreaterThan(0);
    expect(Math.max(...second)).toBeGreaterThan(0);
  });
  it('SFX master level matches the configured volume ceiling', () => { expect(MASTER_VOLUME).toBeLessThanOrEqual(0.4); });
});
