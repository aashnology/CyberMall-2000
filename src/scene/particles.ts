/**
 * Lightweight exterior particles (snow / autumn leaves).
 * Fixed pool in typed arrays: no allocation per frame, one path per colour class, so cost stays flat.
 */

import { mulberry32 } from '../utils/prng';
import type { ParticleKind } from './skybox';

const LEAF_COLORS = ['#C7791F', '#A8431C', '#D9A21E'] as const;

export interface DrawOptions {
  readonly night: boolean;
  /** Screen-space parallax offsets (px) so particles shift slowly as the camera moves. */
  readonly parallaxX: number;
  readonly parallaxY: number;
}

export class ParticleField {
  readonly capacity: number;
  private readonly x: Float32Array; private readonly y: Float32Array;
  private readonly vx: Float32Array; private readonly vy: Float32Array;
  private readonly size: Float32Array; private readonly phase: Float32Array;
  private readonly rot: Float32Array; private readonly spin: Float32Array;
  private readonly cls: Uint8Array;
  private readonly rand: () => number;
  private kind: ParticleKind | null = null;
  private active = 0;
  private w = 800; private h = 600; private clock = 0;

  constructor(capacity = 140, seed = 2000) {
    this.capacity = capacity;
    this.x = new Float32Array(capacity); this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity); this.vy = new Float32Array(capacity);
    this.size = new Float32Array(capacity); this.phase = new Float32Array(capacity);
    this.rot = new Float32Array(capacity); this.spin = new Float32Array(capacity);
    this.cls = new Uint8Array(capacity);
    this.rand = mulberry32(seed);
    for (let i = 0; i < capacity; i += 1) this.respawn(i, true);
  }

  get activeCount(): number { return this.active; }
  get currentKind(): ParticleKind | null { return this.kind; }

  /** Set what falls and how much of the pool is in use (intensity 0..1). */
  configure(kind: ParticleKind | null, intensity: number): void {
    const next = kind === null ? 0 : Math.round(this.capacity * Math.min(1, Math.max(0, intensity)));
    if (kind !== this.kind) for (let i = 0; i < this.capacity; i += 1) this.respawn(i, true);
    this.kind = next === 0 ? null : kind;
    this.active = next;
  }

  /** Bounding box of the active particles (for tests and debugging). */
  extent(): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < this.active; i += 1) {
      const x = this.x[i] as number; const y = this.y[i] as number;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY };
  }

  resize(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    const sx = w / this.w; const sy = h / this.h;
    for (let i = 0; i < this.capacity; i += 1) { this.x[i] = (this.x[i] as number) * sx; this.y[i] = (this.y[i] as number) * sy; }
    this.w = w; this.h = h;
  }

  step(dt: number, wind = 0): void {
    if (this.active === 0 || !(dt > 0)) return;
    const d = Math.min(dt, 0.05);
    this.clock += d;
    const leaves = this.kind === 'leaves';
    for (let i = 0; i < this.active; i += 1) {
      const sway = Math.sin(this.clock * (leaves ? 1.4 : 0.9) + (this.phase[i] as number)) * (leaves ? 38 : 14);
      this.x[i] = (this.x[i] as number) + ((this.vx[i] as number) + sway + wind) * d;
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * d;
      if (leaves) this.rot[i] = (this.rot[i] as number) + (this.spin[i] as number) * d;
      if ((this.y[i] as number) > this.h + 12) this.respawn(i, false);
      if ((this.x[i] as number) > this.w + 12) this.x[i] = -12;
      else if ((this.x[i] as number) < -12) this.x[i] = this.w + 12;
    }
  }

  draw(ctx: CanvasRenderingContext2D, o: DrawOptions): void {
    if (this.active === 0) return;
    const { w, h } = this;
    const wrap = (v: number, m: number): number => ((v % m) + m) % m;
    if (this.kind === 'snow') {
      ctx.fillStyle = o.night ? 'rgba(235,242,255,0.85)' : 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      for (let i = 0; i < this.active; i += 1) {
        const px = wrap((this.x[i] as number) + o.parallaxX * (0.4 + (this.size[i] as number) * 0.15), w);
        const py = wrap((this.y[i] as number) + o.parallaxY * 0.3, h);
        const r = this.size[i] as number;
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, Math.PI * 2);
      }
      ctx.fill();
    } else if (this.kind === 'leaves') {
      for (let c = 0; c < LEAF_COLORS.length; c += 1) {
        ctx.fillStyle = LEAF_COLORS[c] as string;
        ctx.globalAlpha = o.night ? 0.55 : 0.92;
        ctx.beginPath();
        for (let i = 0; i < this.active; i += 1) {
          if ((this.cls[i] as number) !== c) continue;
          const px = wrap((this.x[i] as number) + o.parallaxX * 0.5, w);
          const py = wrap((this.y[i] as number) + o.parallaxY * 0.3, h);
          const rx = (this.size[i] as number) * 1.9;
          ctx.moveTo(px + rx, py);
          ctx.ellipse(px, py, rx, rx * 0.5, this.rot[i] as number, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  private respawn(i: number, anywhere: boolean): void {
    const r = this.rand;
    const leaves = this.kind === 'leaves';
    this.x[i] = r() * this.w;
    this.y[i] = anywhere ? r() * this.h : -12 - r() * 40;
    this.size[i] = leaves ? 3 + r() * 2.6 : 1 + r() * 2.4;
    this.vy[i] = leaves ? 28 + r() * 32 : 34 + r() * 46 + (this.size[i] as number) * 8;
    this.vx[i] = leaves ? 18 + r() * 34 : -6 + r() * 12;
    this.phase[i] = r() * Math.PI * 2;
    this.rot[i] = r() * Math.PI * 2;
    this.spin[i] = (r() - 0.5) * 3.2;
    this.cls[i] = Math.floor(r() * LEAF_COLORS.length);
  }
}
