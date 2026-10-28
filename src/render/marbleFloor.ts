/**
 * Polished pale-marble concourse floor (confirmed material spec):
 *  - high-gloss pale marble slab, ONE continuous slab (no tile grid, no alternating cells)
 *  - seamless dark marble borders on both walkway edges
 *  - brass inlay bands tracing the C-shaped concourse
 *  - soft specular pools where skylights / chandeliers / storefront windows reflect
 *
 * Pure function: returns RGBA bytes. In the browser wrap with `new ImageData(data, w, h)`
 * and `ctx.putImageData`. Pixels outside the walkway are fully transparent so the caller
 * can composite over the atrium / glass-wall scene.
 *
 * Palette tokens are used exactly as specified, including #F2F5E2.
 */

import { type ConcourseSpec, concourseToWorld } from '../spatial/concourse';

export const MARBLE_PALETTE = {
  champagne: '#EFE5D2',
  beige: '#F2F5E2',
  oliveWood: '#775533',
  antiqueGold: '#C28D39',
  gold: '#C5A059',
  espresso: '#2B1E1A',
  veinWarm: '#BFB39A',
} as const;

type RGB = readonly [number, number, number];

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const C = {
  champagne: hex(MARBLE_PALETTE.champagne),
  beige: hex(MARBLE_PALETTE.beige),
  olive: hex(MARBLE_PALETTE.oliveWood),
  antique: hex(MARBLE_PALETTE.antiqueGold),
  gold: hex(MARBLE_PALETTE.gold),
  espresso: hex(MARBLE_PALETTE.espresso),
  vein: hex(MARBLE_PALETTE.veinWarm),
};

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/* ───────────── deterministic value noise ───────────── */

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * valueNoise(x * f, y * f, seed + o * 101);
    amp *= 0.5;
    f *= 2.03;
  }
  return sum; // ≈ [0, 0.97]
}

/* ───────────── walkway sampling ───────────── */

export interface WalkwaySample {
  readonly inside: boolean;
  /** Signed distance to the nearest walkway boundary in world units (+ inside). */
  readonly sd: number;
  /** Distance from the nearest long edge (inner/outer wall), world units. */
  readonly edgeDist: number;
  /** true if the nearer long edge is the outer (storefront) wall. */
  readonly nearOuter: boolean;
}

export function sampleWalkway(spec: ConcourseSpec, radius: number, wx: number, wy: number): WalkwaySample {
  const half = spec.walkwayWidth / 2;
  const dx = wx - spec.centerX;
  const dy = wy - spec.centerY;
  const r = Math.hypot(dx, dy);
  const TAU = Math.PI * 2;
  const delta = (((Math.atan2(dy, dx) - spec.startAngle) % TAU) + TAU) % TAU;
  const lateral = r - radius;
  const radial = half - Math.abs(lateral);
  let endDist: number;
  if (delta <= spec.sweep) endDist = Math.min(delta, spec.sweep - delta) * r;
  else {
    const gap = TAU - spec.sweep;
    endDist = -Math.min(delta - spec.sweep, TAU - delta) * r - (gap > 0 ? 0 : 0);
  }
  const sd = Math.min(radial, endDist);
  return { inside: sd >= 0, sd, edgeDist: Math.max(0, radial), nearOuter: lateral >= 0 };
}

/* ───────────── lighting ───────────── */

export interface LightPool {
  readonly x: number;
  readonly y: number;
  /** World-unit radius of the glossy highlight. */
  readonly radius: number;
  /** 0..1 strength. */
  readonly strength: number;
}

/** Skylight/chandelier reflections spaced along the C, nudged toward the atrium side. */
export function defaultLightPools(spec: ConcourseSpec, radius: number): LightPool[] {
  const stops = [0.08, 0.22, 0.38, 0.52, 0.66, 0.8, 0.93];
  return stops.map((t, i) => {
    const p = concourseToWorld(spec, radius, t, i % 2 === 0 ? -1.2 : 1.0);
    return { x: p.x, y: p.y, radius: spec.walkwayWidth * 0.55, strength: i % 2 === 0 ? 0.34 : 0.24 };
  });
}

/* ───────────── renderer ───────────── */

export interface MarbleOptions {
  readonly width: number;
  readonly height: number;
  /** Pixels per world unit. */
  readonly pxPerUnit: number;
  readonly spec: ConcourseSpec;
  readonly radius: number;
  readonly seed?: number;
  readonly lights?: readonly LightPool[];
}

export interface MarbleImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, straight alpha. */
  readonly data: Uint8ClampedArray;
}

const BORDER_W = 1.1;      // dark marble border, world units
const BRASS_GAP = 0.14;    // dark → brass gap
const BRASS_W = 0.2;       // brass inlay width
const BRASS2_OFF = 1.45;   // fine secondary brass line
const BRASS2_W = 0.07;

export function renderMarbleFloor(opts: MarbleOptions): MarbleImage {
  const { width, height, pxPerUnit, spec, radius } = opts;
  if (!(width > 0 && height > 0 && pxPerUnit > 0)) throw new RangeError('Invalid image dimensions');
  const seed = opts.seed ?? 7;
  const lights = opts.lights ?? defaultLightPools(spec, radius);
  const data = new Uint8ClampedArray(width * height * 4);
  const aa = 1 / pxPerUnit; // one pixel in world units

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const wx = spec.centerX + (px + 0.5 - width / 2) / pxPerUnit;
      const wy = spec.centerY + (py + 0.5 - height / 2) / pxPerUnit;
      const s = sampleWalkway(spec, radius, wx, wy);
      const cover = smooth(-aa * 0.75, aa * 0.75, s.sd);
      if (cover <= 0) continue;

      // Veining: domain-warped, thin, low-contrast: reads as one continuous slab.
      const warp = fbm(wx * 0.11, wy * 0.11, seed, 4);
      const t1 = wx * 0.23 + wy * 0.14 + warp * 2.2;
      const v1 = Math.pow(1 - Math.abs(Math.sin(t1)), 30);
      const t2 = wx * -0.11 + wy * 0.31 + fbm(wx * 0.17 + 9, wy * 0.17, seed + 3, 3) * 1.8;
      const v2 = Math.pow(1 - Math.abs(Math.sin(t2)), 40) * 0.7;
      const vein = Math.min(1, v1 * 0.8 + v2);
      const cloud = fbm(wx * 0.05 + 3, wy * 0.05, seed + 11, 3);
      const grain = (hash2(px, py, seed) - 0.5) * 0.02;

      // Pale slab
      let col: RGB = mix(C.champagne, C.beige, smooth(0.25, 0.7, cloud));
      col = mix(col, C.vein, vein * 0.34);
      col = [col[0] + grain * 255, col[1] + grain * 255, col[2] + grain * 255];

      // Dark marble border along both long edges
      const u = s.edgeDist;
      const borderMask = 1 - smooth(BORDER_W - aa, BORDER_W + aa, u);
      if (borderMask > 0) {
        let dark: RGB = mix(C.espresso, C.olive, smooth(0.35, 0.8, cloud) * 0.35);
        dark = mix(dark, C.olive, vein * 0.55);
        col = mix(col, dark, borderMask);
      }

      // Brass inlay bands (primary + fine secondary), with a soft specular streak
      const brassBand = (centre: number, w: number): number =>
        1 - smooth(w / 2 - aa, w / 2 + aa, Math.abs(u - centre));
      const b1 = brassBand(BORDER_W + BRASS_GAP + BRASS_W / 2, BRASS_W);
      const b2 = brassBand(BRASS2_OFF, BRASS2_W);
      const brass = Math.max(b1, b2);
      if (brass > 0) {
        const across = clamp01(1 - Math.abs(u - (BORDER_W + BRASS_GAP + BRASS_W / 2)) / (BRASS_W / 2));
        const shine = 0.5 + 0.5 * Math.sin(wx * 0.9 + wy * 0.7);
        let b: RGB = mix(C.antique, C.gold, 0.35 + 0.35 * across * shine);
        b = mix(b, [255, 236, 190], 0.18 * across * shine);
        col = mix(col, b, brass);
      }

      // Gloss: warm spill from storefront windows on the outer side + skylight/chandelier pools
      let lit = 0;
      if (s.nearOuter) lit += 0.07 * Math.exp(-u / 2.6);
      for (const L of lights) {
        const d2 = (wx - L.x) ** 2 + (wy - L.y) ** 2;
        lit += L.strength * Math.exp(-d2 / (2 * (L.radius * 0.5) ** 2));
      }
      const glossK = (1 - brass * 0.6) * (1 - borderMask * 0.35);
      col = mix(col, [255, 250, 236], clamp01(lit * glossK) * 0.55);

      const i = (py * width + px) * 4;
      data[i] = col[0];
      data[i + 1] = col[1];
      data[i + 2] = col[2];
      data[i + 3] = Math.round(cover * 255);
    }
  }
  return { width, height, data };
}

export const luma = (r: number, g: number, b: number): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
