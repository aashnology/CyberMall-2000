/** Day/night lighting engine: one pure function from clock hour to colours and intensities. */

export interface SkyState {
  /** Sky colour at the horizon and zenith, #RRGGBB. */
  readonly horizon: string;
  readonly zenith: string;
  /** Sea surface base colour. */
  readonly sea: string;
  /** 0 (night) .. 1 (noon): scales skylight pools and daylight through the glass. */
  readonly daylight: number;
  /** 0 (day) .. 1 (night): scales chandelier/spotlight glow. */
  readonly lamplight: number;
  /** Warm interior tint overlay colour and its alpha. */
  readonly tint: string;
  readonly tintAlpha: number;
}

interface Key { readonly h: number; readonly horizon: string; readonly zenith: string; readonly sea: string; readonly daylight: number; readonly tint: string; readonly tintAlpha: number }

const KEYS: readonly Key[] = [
  { h: 0,  horizon: '#1B2340', zenith: '#070B1A', sea: '#0E1B33', daylight: 0.0,  tint: '#101A38', tintAlpha: 0.38 },
  { h: 5,  horizon: '#3A3F6B', zenith: '#101733', sea: '#17294A', daylight: 0.1,  tint: '#1B2347', tintAlpha: 0.30 },
  { h: 7,  horizon: '#F4B98A', zenith: '#6C8FC4', sea: '#3A7CA5', daylight: 0.55, tint: '#FFC58F', tintAlpha: 0.10 },
  { h: 12, horizon: '#CDEBFA', zenith: '#4E9BE0', sea: '#1F8FC4', daylight: 1.0,  tint: '#FFFFFF', tintAlpha: 0.0 },
  { h: 17, horizon: '#F9D7A2', zenith: '#6FA2D9', sea: '#2A86B5', daylight: 0.75, tint: '#FFD9A0', tintAlpha: 0.07 },
  { h: 19, horizon: '#F08A5D', zenith: '#4A4E8F', sea: '#2D5C86', daylight: 0.3,  tint: '#F2A26B', tintAlpha: 0.16 },
  { h: 21, horizon: '#3B3260', zenith: '#12163A', sea: '#13264A', daylight: 0.05, tint: '#171F44', tintAlpha: 0.32 },
  { h: 24, horizon: '#1B2340', zenith: '#070B1A', sea: '#0E1B33', daylight: 0.0,  tint: '#101A38', tintAlpha: 0.38 },
];

const hex = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c: readonly number[]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const lerpHex = (a: string, b: string, t: number): string => {
  const x = hex(a), y = hex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};

export function skyAt(hourRaw: number): SkyState {
  if (!Number.isFinite(hourRaw)) throw new RangeError('hour must be finite');
  const hour = ((hourRaw % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && hour >= (KEYS[i + 1] as Key).h) i += 1;
  const a = KEYS[i] as Key;
  const b = KEYS[i + 1] as Key;
  const t = (hour - a.h) / (b.h - a.h);
  const daylight = a.daylight + (b.daylight - a.daylight) * t;
  return {
    horizon: lerpHex(a.horizon, b.horizon, t),
    zenith: lerpHex(a.zenith, b.zenith, t),
    sea: lerpHex(a.sea, b.sea, t),
    daylight,
    lamplight: 1 - daylight,
    tint: lerpHex(a.tint, b.tint, t),
    tintAlpha: a.tintAlpha + (b.tintAlpha - a.tintAlpha) * t,
  };
}
