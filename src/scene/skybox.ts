/**
 * Seasonal + diurnal skybox, driven only by the device clock (`Date`).
 * No hard-coded "today": every function takes the date, so tests and previews are exact.
 *
 *   Day   06:00–17:59 · Night 18:00–05:59 (local time)
 *   Winter/Holiday  Dec 1 – Jan 15    (Christmas week = Dec 20–26)  → falling snow
 *   Autumn          Sep 1 – Nov 30                                     → golden-hour grade + drifting foliage
 *   Coastal         Jan 16 – Aug 31 (spring/summer)                    → crisp blue skies, sunset gradients
 */

import { skyAt, type SkyState } from './timeOfDay';

export type SeasonId = 'winter' | 'autumn' | 'coastal';
export type DayPhase = 'day' | 'night';
export type ParticleKind = 'snow' | 'leaves';

export interface SkyboxState {
  readonly season: SeasonId;
  readonly phase: DayPhase;
  readonly christmasWeek: boolean;
  /** Diurnal colours with the seasonal grade applied. */
  readonly sky: SkyState;
  readonly particles: { readonly kind: ParticleKind | null; readonly intensity: number };
  /** Winter nights: warm/red/green string lights along the glass. */
  readonly holidayLights: boolean;
  /** 0..1 strength of facade lights and neon storefront glow (ramps ±15 min around 18:00 / 06:00). */
  readonly neon: number;
}

export const DAY_START_HOUR = 6;
export const NIGHT_START_HOUR = 18;

export function seasonAt(date: Date): { readonly season: SeasonId; readonly christmasWeek: boolean } {
  const m = date.getMonth(); // 0 = Jan, local time
  const d = date.getDate();
  const christmasWeek = m === 11 && d >= 20 && d <= 26;
  if (m === 11 || (m === 0 && d <= 15)) return { season: 'winter', christmasWeek };
  if (m >= 8 && m <= 10) return { season: 'autumn', christmasWeek: false };
  return { season: 'coastal', christmasWeek: false };
}

export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function phaseAt(date: Date): DayPhase {
  const h = hourOf(date);
  return h >= DAY_START_HOUR && h < NIGHT_START_HOUR ? 'day' : 'night';
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 0 by day, 1 by night, ramping across a 30-minute window centred on each boundary. */
export function neonAt(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 12) return smooth(NIGHT_START_HOUR - 0.25, NIGHT_START_HOUR + 0.25, h);
  return 1 - smooth(DAY_START_HOUR - 0.25, DAY_START_HOUR + 0.25, h);
}

/* ───────── seasonal grading ───────── */

const hex = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c: readonly number[]): string => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const toward = (from: string, to: string, amount: number): string => {
  const a = hex(from), b = hex(to);
  return toHex([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount]);
};

/** Colour targets and how strongly each season pulls the diurnal colours toward them (scaled by daylight). */
const GRADE = {
  winter: { horizon: '#CBD6E2', zenith: '#7C92AB', sea: '#62798F', tint: '#BFD3EA', amount: 0.62, tintAdd: 0.06 },
  autumn: { horizon: '#F5B35C', zenith: '#D9904E', sea: '#2F6F83', tint: '#FFB35A', amount: 0.5, tintAdd: 0.11 },
  coastal: { horizon: '#BDE8FF', zenith: '#2E8BE6', sea: '#1E8FD0', tint: '#FFFFFF', amount: 0.3, tintAdd: 0 },
} as const;

export function gradeSky(base: SkyState, season: SeasonId): SkyState {
  const g = GRADE[season];
  // Grade by daylight so a night sky stays dark in every season (a little residual keeps it from looking flat).
  const k = g.amount * (0.15 + 0.85 * base.daylight);
  return {
    horizon: toward(base.horizon, g.horizon, k),
    zenith: toward(base.zenith, g.zenith, k * 0.8),
    sea: toward(base.sea, g.sea, k),
    daylight: base.daylight,
    lamplight: base.lamplight,
    tint: toward(base.tint, g.tint, k),
    tintAlpha: Math.min(0.5, base.tintAlpha + g.tintAdd * base.daylight),
  };
}

export function skyboxAt(date: Date): SkyboxState {
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
  const { season, christmasWeek } = seasonAt(date);
  const hour = hourOf(date);
  const phase = phaseAt(date);
  const sky = gradeSky(skyAt(hour), season);
  const particles =
    season === 'winter' ? { kind: 'snow' as const, intensity: christmasWeek ? 1 : 0.7 }
    : season === 'autumn' ? { kind: 'leaves' as const, intensity: 0.6 }
    : { kind: null, intensity: 0 };
  return { season, phase, christmasWeek, sky, particles, holidayLights: season === 'winter' && phase === 'night', neon: neonAt(hour) };
}

/** The visitor's clock, optionally with the hour overridden by the manual time slider (season always follows the real date). */
export function skyboxFor(now: Date, hourOverride: number | null): SkyboxState {
  if (hourOverride === null) return skyboxAt(now);
  const d = new Date(now.getTime());
  const h = ((hourOverride % 24) + 24) % 24;
  d.setHours(Math.floor(h), Math.floor((h % 1) * 60), 0, 0);
  return skyboxAt(d);
}
