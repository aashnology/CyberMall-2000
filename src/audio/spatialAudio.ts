/**
 * Spatial audio: everything is synthesised with the Web Audio API (no audio files).
 *
 *   room tone ─────────────────────────────────────────────► master ─► speakers
 *   mall bed  (lo-fi jazz + muffled chatter) ─┐
 *   cafe bed  (acoustic lounge plucks)        ├► bed gains ► music low-pass ─► master
 *   cinema bed(cinematic synth pad)           ┘      ▲ equal-power crossfade by proximity
 *   retro SFX (clicks, bloops, bell, chime) ─► sfx bus ─────► master
 *
 * Browsers only allow sound after a user gesture, so nothing plays until `start()` is called
 * from a click/keypress. Mute is persistent. The engine works on any BaseAudioContext, so the
 * same code is rendered offline in tests.
 */

import type { FloorId } from '../data/types';

export type BedId = 'mall' | 'cafe' | 'cinema';
export type Sfx = 'click' | 'bloop' | 'bell' | 'chime' | 'open';

export const CAFE_SUBCATEGORIES: readonly string[] = ['cafe', 'coffee roaster', 'bakery', 'tea room'];
export const CINEMA_SUBCATEGORIES: readonly string[] = ['theatre', 'ott'];
/** World units within which a nearby wing starts to bleed into the mix. */
export const PROXIMITY_RADIUS = 14;
export const MASTER_VOLUME = 0.32;
export const MUTE_KEY = 'cybermall2000.audio.muted';

export interface Nearest { readonly subcategory: string; readonly distance: number }
export interface ListenerContext { readonly floorId: FloorId; readonly nearest: Nearest | null }

const smoothstep = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** 0 outside the radius, rising smoothly to 1 at distance 0. */
export function proximity(distance: number, radius: number = PROXIMITY_RADIUS): number {
  if (!(distance >= 0)) return 0;
  return smoothstep(1 - distance / radius);
}

/**
 * Bed gains (equal-power: sum of squares = 1, so loudness stays constant through a crossfade).
 *   cafe   = 1 on the Cafes floor, else proximity to the nearest cafe-type store
 *   cinema = 1 on the Theatre & OTT floor, else proximity to the nearest theatre/OTT store
 *   mall   = 1 − 0.85·max(cafe, cinema)            (a trace of the mall always remains)
 *   gain_i = sqrt(w_i / Σw)
 */
export function computeBedMix(ctx: ListenerContext): Record<BedId, number> {
  const near = ctx.nearest;
  const sub = near?.subcategory.toLowerCase() ?? '';
  const nearW = near === null ? 0 : proximity(near.distance);
  const cafe = ctx.floorId === 8 ? 1 : CAFE_SUBCATEGORIES.includes(sub) ? nearW : 0;
  const cinema = ctx.floorId === 6 ? 1 : CINEMA_SUBCATEGORIES.includes(sub) ? nearW : 0;
  const mall = 1 - 0.85 * Math.max(cafe, cinema);
  const total = mall + cafe + cinema;
  return { mall: Math.sqrt(mall / total), cafe: Math.sqrt(cafe / total), cinema: Math.sqrt(cinema / total) };
}

const BED_CUTOFF_HZ: Record<BedId, number> = { mall: 2200, cafe: 3200, cinema: 1700 };
const BED_LEVEL: Record<BedId, number> = { mall: 1, cafe: 1, cinema: 1 };

/* ───────────────────────── musical material ───────────────────────── */

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

interface Chord { readonly bass: number; readonly tones: readonly number[] }
const MALL_PROGRESSION: readonly Chord[] = [
  { bass: 50, tones: [53, 57, 60, 64] },   // Dm9
  { bass: 43, tones: [53, 59, 62, 64] },   // G13
  { bass: 48, tones: [52, 59, 62, 67] },   // Cmaj9
  { bass: 45, tones: [55, 60, 64, 67] },   // Am7
];
const CAFE_PROGRESSION: readonly (readonly number[])[] = [
  [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59], // Fmaj7 Em7 Dm7 Cmaj7
];
const CAFE_PATTERN: readonly number[] = [0, 1, 2, 3, 2, 1, 2, 3];
const CINEMA_PAD: readonly number[] = [48, 55, 63, 74]; // C2-ish drone, G, Eb, D: Cm(add9)

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ───────────────────────── engine ───────────────────────── */

export interface AudioDeps {
  readonly createContext?: () => BaseAudioContext;
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly setIntervalFn?: (fn: () => void, ms: number) => unknown;
  readonly clearIntervalFn?: (h: unknown) => void;
}

interface ToneSpec {
  readonly freq: number; readonly start: number; readonly hold: number; readonly attack: number; readonly release: number;
  readonly gain: number; readonly type: OscillatorType; readonly dest: AudioNode; readonly detune?: number;
}

export class SpatialAudio {
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private musicLP: BiquadFilterNode | null = null;
  private sfxBus: GainNode | null = null;
  private beds: Record<BedId, GainNode> | null = null;
  private muted: boolean;
  private listener: ListenerContext = { floorId: 1, nearest: null };
  private timer: unknown = null;
  private readonly rand = mulberry32(2000);
  private readonly next: Record<BedId, { time: number; step: number }> = { mall: { time: 0, step: 0 }, cafe: { time: 0, step: 0 }, cinema: { time: 0, step: 0 } };
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private noise: AudioBuffer | null = null;

  constructor(private readonly deps: AudioDeps = {}) {
    this.muted = this.readMuted();
  }

  /* ---- state ---- */
  get isMuted(): boolean { return this.muted; }
  get isStarted(): boolean { return this.ctx !== null; }
  get isSupported(): boolean { return this.deps.createContext !== undefined || typeof AudioContext !== 'undefined'; }
  snapshot(): number { return this.version; }
  subscribe(l: () => void): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit(): void { this.version += 1; this.listeners.forEach((l) => l()); }

  private readMuted(): boolean {
    try { return this.deps.storage?.getItem(MUTE_KEY) === '1'; } catch { return false; }
  }

  /* ---- lifecycle ---- */

  /** Call from a user gesture. Resolves false if Web Audio is unavailable. */
  async start(): Promise<boolean> {
    if (this.ctx === null) {
      if (!this.isSupported) return false;
      const make = this.deps.createContext ?? ((): BaseAudioContext => new AudioContext());
      this.attach(make());
      const tick = (): void => { if (this.ctx !== null) this.scheduleUntil(this.ctx.currentTime + 2.5); };
      tick();
      this.timer = (this.deps.setIntervalFn ?? ((fn: () => void, ms: number): unknown => setInterval(fn, ms)))(tick, 500);
    }
    const c = this.ctx as AudioContext | null;
    if (c !== null && c.state === 'suspended' && typeof c.resume === 'function') await c.resume();
    this.emit();
    return true;
  }

  /** Build the audio graph on any context (real or offline). */
  attach(ctx: BaseAudioContext): void {
    if (this.ctx !== null) throw new Error('SpatialAudio is already attached');
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
    const musicLP = ctx.createBiquadFilter();
    musicLP.type = 'lowpass'; musicLP.frequency.value = BED_CUTOFF_HZ.mall; musicLP.Q.value = 0.6;
    musicLP.connect(master);
    const sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.55;
    sfxBus.connect(master);
    const mk = (): GainNode => { const g = ctx.createGain(); g.gain.value = 0; g.connect(musicLP); return g; };
    const beds = { mall: mk(), cafe: mk(), cinema: mk() };
    this.master = master; this.musicLP = musicLP; this.sfxBus = sfxBus; this.beds = beds;
    this.noise = this.makeBrownNoise(ctx, 4);

    // room tone: HVAC rumble, always on, independent of the crossfade
    const hvac = ctx.createBufferSource(); hvac.buffer = this.noise; hvac.loop = true;
    const hvacLP = ctx.createBiquadFilter(); hvacLP.type = 'lowpass'; hvacLP.frequency.value = 170;
    const hvacG = ctx.createGain(); hvacG.gain.value = 0.07;
    hvac.connect(hvacLP); hvacLP.connect(hvacG); hvacG.connect(master); hvac.start();
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 58;
    const humG = ctx.createGain(); humG.gain.value = 0.008; hum.connect(humG); humG.connect(master); hum.start();

    // muffled chatter lives in the mall bed: band-limited noise with slow tremolo
    const chat = ctx.createBufferSource(); chat.buffer = this.noise; chat.loop = true; chat.playbackRate.value = 3.1;
    const chatBP = ctx.createBiquadFilter(); chatBP.type = 'bandpass'; chatBP.frequency.value = 850; chatBP.Q.value = 0.5;
    const chatG = ctx.createGain(); chatG.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.27; const lfoG = ctx.createGain(); lfoG.gain.value = 0.03;
    lfo.connect(lfoG); lfoG.connect(chatG.gain);
    chat.connect(chatBP); chatBP.connect(chatG); chatG.connect(beds.mall); chat.start(); lfo.start();

    // cinema pad: detuned saws through a slowly breathing low-pass
    const padLP = ctx.createBiquadFilter(); padLP.type = 'lowpass'; padLP.frequency.value = 650; padLP.Q.value = 2;
    const padG = ctx.createGain(); padG.gain.value = 0.085;
    const breath = ctx.createOscillator(); breath.frequency.value = 0.06; const breathG = ctx.createGain(); breathG.gain.value = 260;
    breath.connect(breathG); breathG.connect(padLP.frequency); breath.start();
    padLP.connect(padG); padG.connect(beds.cinema);
    for (const m of CINEMA_PAD) for (const det of [-9, 9]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = m > 70 ? 0.25 : 0.55; o.connect(g); g.connect(padLP); o.start();
    }

    for (const b of ['mall', 'cafe', 'cinema'] as const) this.next[b] = { time: ctx.currentTime + 0.05, step: 0 };
    this.applyMix(true);
  }

  dispose(): void {
    if (this.timer !== null) { (this.deps.clearIntervalFn ?? ((h: unknown): void => clearInterval(h as ReturnType<typeof setInterval>)))(this.timer); this.timer = null; }
    const c = this.ctx as AudioContext | null;
    this.ctx = null; this.master = null; this.musicLP = null; this.sfxBus = null; this.beds = null;
    if (c !== null && typeof c.close === 'function' && c.state !== 'closed') void c.close();
    this.emit();
  }

  /* ---- mute ---- */
  setMuted(m: boolean): void {
    this.muted = m;
    try { this.deps.storage?.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* storage unavailable: mute still applies for this page */ }
    if (this.ctx !== null && this.master !== null) this.master.gain.setTargetAtTime(m ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.04);
    this.emit();
  }
  toggleMute(): boolean { this.setMuted(!this.muted); return this.muted; }

  /* ---- proximity crossfade ---- */
  setListener(l: ListenerContext): void {
    this.listener = l;
    this.applyMix(false);
  }
  currentMix(): Record<BedId, number> { return computeBedMix(this.listener); }

  private applyMix(immediate: boolean): void {
    if (this.ctx === null || this.beds === null || this.musicLP === null) return;
    const mix = computeBedMix(this.listener);
    const now = this.ctx.currentTime;
    let cutoff = 0;
    for (const b of ['mall', 'cafe', 'cinema'] as const) {
      const g = this.beds[b].gain;
      const target = mix[b] * BED_LEVEL[b];
      if (immediate) g.setValueAtTime(target, now); else g.setTargetAtTime(target, now, 0.7);
      cutoff += mix[b] ** 2 * BED_CUTOFF_HZ[b]; // equal-power weights sum to 1
    }
    if (immediate) this.musicLP.frequency.setValueAtTime(cutoff, now); else this.musicLP.frequency.setTargetAtTime(cutoff, now, 0.7);
  }

  /* ---- music scheduling ---- */

  /** Schedule every bed's notes up to context time `t`. Idempotent for already-scheduled time. */
  scheduleUntil(t: number): void {
    if (this.ctx === null || this.beds === null) return;
    const beds = this.beds;
    // mall: lo-fi jazz, 68 bpm, one chord per bar
    const beat = 60 / 68;
    for (const st = this.next.mall; st.time < t; st.time += 4 * beat, st.step += 1) {
      const c = MALL_PROGRESSION[st.step % MALL_PROGRESSION.length] as Chord;
      this.tone({ freq: mtof(c.bass), start: st.time, hold: 3 * beat, attack: 0.04, release: 1.2, gain: 0.16, type: 'sine', dest: beds.mall });
      c.tones.forEach((m, i) => {
        const det = (this.rand() - 0.5) * 16; // lo-fi pitch wobble, ±8 cents
        this.tone({ freq: mtof(m), start: st.time + i * 0.022, hold: 2.2 * beat, attack: 0.05, release: 1.6, gain: 0.07, type: 'triangle', dest: beds.mall, detune: det });
        this.tone({ freq: mtof(m - 12), start: st.time + i * 0.022, hold: 1.6 * beat, attack: 0.05, release: 1.2, gain: 0.03, type: 'sine', dest: beds.mall, detune: -det });
      });
    }
    // cafe: acoustic lounge, 84 bpm, eighth-note plucks over four chords (8 plucks per chord)
    const eighth = 60 / 84 / 2;
    for (const st = this.next.cafe; st.time < t; st.time += eighth, st.step += 1) {
      const chord = CAFE_PROGRESSION[Math.floor(st.step / 8) % CAFE_PROGRESSION.length] as readonly number[];
      const m = (chord[CAFE_PATTERN[st.step % 8] as number] as number) + (st.step % 8 > 3 ? 12 : 0);
      this.tone({ freq: mtof(m), start: st.time, hold: 0.02, attack: 0.004, release: 0.9, gain: 0.17, type: 'triangle', dest: beds.cafe, detune: (this.rand() - 0.5) * 6 });
      if (st.step % 8 === 0) this.tone({ freq: mtof(chord[0] as number - 12), start: st.time, hold: 0.4, attack: 0.01, release: 1.4, gain: 0.18, type: 'sine', dest: beds.cafe });
    }
    // cinema: slow sub-bass pulse every 8 s over the pad
    for (const st = this.next.cinema; st.time < t; st.time += 8, st.step += 1) {
      this.tone({ freq: mtof(36), start: st.time, hold: 0.3, attack: 0.25, release: 3.2, gain: 0.3, type: 'sine', dest: beds.cinema });
    }
  }

  private tone(s: ToneSpec): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = s.type; o.frequency.value = s.freq; if (s.detune !== undefined) o.detune.value = s.detune;
    const peak = s.start + s.attack;
    g.gain.setValueAtTime(0, s.start);
    g.gain.linearRampToValueAtTime(s.gain, peak);
    g.gain.setValueAtTime(s.gain, peak + s.hold);
    g.gain.setTargetAtTime(0, peak + s.hold, s.release / 4);
    o.connect(g); g.connect(s.dest);
    o.start(s.start); o.stop(peak + s.hold + s.release + 0.1);
  }

  /* ---- retro UI sounds ---- */

  /** Returns true if a sound was scheduled (false when not started or muted). */
  play(sfx: Sfx, at?: number): boolean {
    const ctx = this.ctx; const bus = this.sfxBus;
    if (ctx === null || bus === null || this.muted) return false;
    const t = at ?? ctx.currentTime;
    const beep = (f0: number, f1: number, start: number, dur: number, gain: number, type: OscillatorType): void => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, start); o.frequency.exponentialRampToValueAtTime(f1, start + dur);
      g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + 0.003); g.gain.setTargetAtTime(0, start + 0.004, dur / 4);
      o.connect(g); g.connect(bus); o.start(start); o.stop(start + dur * 2 + 0.05);
    };
    const partial = (f: number, start: number, gain: number, decay: number): void => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + 0.002); g.gain.setTargetAtTime(0, start + 0.003, decay / 4);
      o.connect(g); g.connect(bus); o.start(start); o.stop(start + decay * 2 + 0.05);
    };
    switch (sfx) {
      case 'click': beep(1900, 1100, t, 0.03, 0.2, 'square'); beep(520, 380, t, 0.04, 0.12, 'sine'); break;
      case 'bloop': beep(420, 840, t, 0.1, 0.26, 'sine'); beep(640, 1280, t + 0.09, 0.12, 0.22, 'sine'); break;
      case 'bell': { const f = 1318.5; partial(f, t, 0.3, 1.6); partial(f * 2.76, t, 0.1, 0.7); partial(f * 5.4, t, 0.04, 0.3); break; }
      case 'chime': [1046.5, 1318.5, 1568, 2093].forEach((f, i) => { const s = t + i * 0.06; const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.16, s + 0.004); g.gain.setTargetAtTime(0, s + 0.005, 0.12); o.connect(g); g.connect(bus); o.start(s); o.stop(s + 0.7); }); break;
      case 'open': beep(700, 700, t, 0.045, 0.14, 'square'); beep(1000, 1000, t + 0.055, 0.06, 0.14, 'square'); break;
    }
    return true;
  }

  /** Brown noise whose loop point is seamless: the head is cross-faded with the discarded tail. */
  private makeBrownNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
    const total = Math.floor(ctx.sampleRate * seconds);
    const seam = Math.min(4096, Math.floor(total / 4));
    const base = new Float32Array(total);
    const r = mulberry32(7);
    let last = 0;
    for (let i = 0; i < total; i += 1) { last = (last + (r() * 2 - 1) * 0.04) / 1.02; base[i] = last * 3.2; }
    const len = total - seam;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      const k = i < seam ? i / seam : 1;
      d[i] = (base[i] as number) * k + (i < seam ? (base[len + i] as number) * (1 - k) : 0);
    }
    return buf;
  }
}
