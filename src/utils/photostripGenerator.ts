/**
 * Photostrip compositor: stacks four captured frames vertically inside a 35 mm celluloid filmstrip
 * (dark film base, sprocket holes down both rails, edge-print frame numbers), adds a title, a footer ribbon
 * and four vintage scrapbook stickers, and exports the result as PNG or JPEG.
 *
 * Pure drawing on a canvas you supply: runs in the browser (default) and headless (tests/previews).
 * Nothing is uploaded; the caller owns the canvas.
 */

import { drawSticker, type StickerKind } from './stickers';

type Ctx = CanvasRenderingContext2D;

/** Logical (1×) layout in px. The output canvas is this × `scale`. */
export const STRIP = {
  width: 760, railW: 80, frameW: 600, frameH: 450, gap: 34, top: 124, bottom: 156, frames: 4,
  holeW: 30, holeH: 42, holePitch: 76,
} as const;

export const STRIP_HEIGHT = STRIP.top + STRIP.frames * STRIP.frameH + (STRIP.frames - 1) * STRIP.gap + STRIP.bottom;

const COLORS = { film: '#17100C', filmHi: '#251A13', burgundy: '#710912', gold: '#C28D39', goldHi: '#F1D58C', champagne: '#EFE5D2', amber: '#D9A24A' } as const;

export interface StripFrame {
  readonly source: CanvasImageSource;
  /** Natural size of `source`, used for cover-fit cropping. */
  readonly width: number;
  readonly height: number;
}

/** Minimal canvas surface the generator needs (satisfied by HTMLCanvasElement, OffscreenCanvas and node-canvas). */
export interface StripCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): unknown;
}

export interface StripOptions {
  /** Output pixel density; 2 gives a 1520 × 4,656 px strip. */
  readonly scale?: number;
  readonly date?: Date;
  readonly createCanvas?: (width: number, height: number) => StripCanvas;
}

export const STICKER_PLACEMENTS: ReadonlyArray<{ readonly kind: StickerKind; readonly x: number; readonly y: number; readonly size: number; readonly rot: number }> = [
  { kind: 'cassette', x: 612, y: 150, size: 168, rot: -0.2 },
  { kind: 'clock', x: 94, y: 996, size: 150, rot: 0.2 },
  { kind: 'starfish', x: 652, y: 1700, size: 142, rot: 0.34 },
  { kind: 'hibiscus', x: 112, y: STRIP_HEIGHT - 128, size: 176, rot: -0.32 },
];

/** Source rectangle that fills `dw × dh` from an `sw × sh` image without distortion (CSS object-fit: cover). */
export function coverRect(sw: number, sh: number, dw: number, dh: number): { sx: number; sy: number; sw: number; sh: number } {
  if (!(sw > 0 && sh > 0 && dw > 0 && dh > 0)) throw new RangeError('sizes must be positive');
  const srcRatio = sw / sh; const dstRatio = dw / dh;
  if (srcRatio > dstRatio) { const w = sh * dstRatio; return { sx: (sw - w) / 2, sy: 0, sw: w, sh }; }
  const h = sw / dstRatio; return { sx: 0, sy: (sh - h) / 2, sw, sh: h };
}

export function frameTop(i: number): number { return STRIP.top + i * (STRIP.frameH + STRIP.gap); }
export function sprocketCount(): number { return Math.floor((STRIP_HEIGHT - 60) / STRIP.holePitch) + 1; }

export function formatStripDate(d: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function defaultCanvas(w: number, h: number): StripCanvas {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

export function generatePhotostrip(frames: readonly StripFrame[], opts: StripOptions = {}): StripCanvas {
  if (frames.length !== STRIP.frames) throw new RangeError(`A photostrip needs exactly ${STRIP.frames} frames, got ${frames.length}`);
  const scale = opts.scale ?? 2;
  if (!(scale > 0 && scale <= 4)) throw new RangeError('scale must be in (0, 4]');
  const date = opts.date ?? new Date();
  const canvas = (opts.createCanvas ?? defaultCanvas)(Math.round(STRIP.width * scale), Math.round(STRIP_HEIGHT * scale));
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (ctx === null) throw new Error('2D canvas is not available');
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';

  // film base
  const base = ctx.createLinearGradient(0, 0, STRIP.width, 0);
  base.addColorStop(0, COLORS.filmHi); base.addColorStop(0.08, COLORS.film); base.addColorStop(0.92, COLORS.film); base.addColorStop(1, COLORS.filmHi);
  ctx.fillStyle = base; ctx.fillRect(0, 0, STRIP.width, STRIP_HEIGHT);
  ctx.strokeStyle = 'rgba(239,229,210,0.18)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, STRIP.width - 2, STRIP_HEIGHT - 2);

  // sprocket holes down both rails
  const n = sprocketCount();
  for (const x of [26, STRIP.width - 26 - STRIP.holeW]) {
    for (let k = 0; k < n; k += 1) {
      const y = 30 + k * STRIP.holePitch;
      ctx.fillStyle = '#F2E8D6'; roundRect(ctx, x, y, STRIP.holeW, STRIP.holeH, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; roundRect(ctx, x + 1, y + 1, STRIP.holeW - 2, STRIP.holeH - 2, 7); ctx.stroke();
    }
  }
  // edge print running down each rail
  ctx.fillStyle = 'rgba(217,162,74,0.55)'; ctx.font = "600 11px 'Courier New', monospace"; ctx.textAlign = 'center';
  for (const [x, dir] of [[66, -1], [STRIP.width - 66, 1]] as const) {
    ctx.save(); ctx.translate(x, STRIP_HEIGHT / 2); ctx.rotate((dir * Math.PI) / 2);
    ctx.fillText('CYBERMALL 2000  ·  SAFETY FILM  ·  400', 0, 0); ctx.restore();
  }

  // title
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold; ctx.font = "700 44px Georgia, 'Times New Roman', serif";
  ctx.fillText('CYBERMALL 2000', STRIP.width / 2, 48);
  ctx.fillStyle = COLORS.champagne; ctx.font = "600 17px 'Courier New', monospace";
  ctx.fillText('★  P H O T O B O O T H  ★', STRIP.width / 2, 84);
  ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(STRIP.railW + 40, 102); ctx.lineTo(STRIP.width - STRIP.railW - 40, 102); ctx.stroke();

  // frames
  frames.forEach((f, i) => {
    const x = STRIP.railW; const y = frameTop(i);
    const c = coverRect(f.width, f.height, STRIP.frameW, STRIP.frameH);
    ctx.save();
    roundRect(ctx, x, y, STRIP.frameW, STRIP.frameH, 6); ctx.clip();
    ctx.drawImage(f.source, c.sx, c.sy, c.sw, c.sh, x, y, STRIP.frameW, STRIP.frameH);
    ctx.fillStyle = 'rgba(239,229,210,0.07)'; ctx.fillRect(x, y, STRIP.frameW, STRIP.frameH); // warm film cast
    const vg = ctx.createRadialGradient(x + STRIP.frameW / 2, y + STRIP.frameH / 2, STRIP.frameH * 0.45, x + STRIP.frameW / 2, y + STRIP.frameH / 2, STRIP.frameW * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,8,4,0.38)');
    ctx.fillStyle = vg; ctx.fillRect(x, y, STRIP.frameW, STRIP.frameH);
    ctx.restore();
    ctx.strokeStyle = COLORS.champagne; ctx.lineWidth = 3; roundRect(ctx, x, y, STRIP.frameW, STRIP.frameH, 6); ctx.stroke();
    // 35 mm edge numbers in the gap above each frame
    ctx.fillStyle = COLORS.amber; ctx.font = "700 14px 'Courier New', monospace";
    ctx.textAlign = 'left'; ctx.fillText(`▶ ${i + 1}`, x + 2, y - 13);
    ctx.textAlign = 'right'; ctx.fillText(`${i + 1}A`, x + STRIP.frameW - 2, y - 13);
  });

  // footer ribbon
  const fy = frameTop(STRIP.frames - 1) + STRIP.frameH + 30;
  ctx.fillStyle = COLORS.burgundy; ctx.fillRect(STRIP.railW, fy, STRIP.frameW, 64);
  ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; ctx.strokeRect(STRIP.railW + 4, fy + 4, STRIP.frameW - 8, 56);
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.goldHi; ctx.font = "700 22px Georgia, 'Times New Roman', serif";
  ctx.fillText(formatStripDate(date), STRIP.width / 2, fy + 24);
  ctx.fillStyle = COLORS.champagne; ctx.font = "600 13px 'Courier New', monospace";
  ctx.fillText('FLOOR 7  ·  FOOD COURT & ARCADE', STRIP.width / 2, fy + 46);

  for (const s of STICKER_PLACEMENTS) drawSticker(ctx, s.kind, s.x, s.y, s.size, s.rot);
  ctx.restore();
  return canvas;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ───────────────────────── export ───────────────────────── */

export type StripFormat = 'png' | 'jpeg';
export const MIME: Readonly<Record<StripFormat, string>> = { png: 'image/png', jpeg: 'image/jpeg' };

export function stripFilename(format: StripFormat, now: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `cybermall_photostrip_${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}

export interface BlobCanvas { toBlob(cb: (b: Blob | null) => void, type?: string, quality?: number): void }

export function canvasToBlob(canvas: BlobCanvas, format: StripFormat, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b === null ? reject(new Error(`Could not encode the strip as ${format.toUpperCase()}`)) : resolve(b)), MIME[format], format === 'jpeg' ? quality : undefined);
  });
}
