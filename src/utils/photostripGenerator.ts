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

/**
 * Logical (1×) layout in px, measured from the reference template (image_721733.png):
 * 4:3-ish landscape windows stacked vertically, thin bars between them, wide rails with LANDSCAPE sprocket
 * holes (≈ 4.3 holes per frame), no title or footer: just film.
 */
export const STRIP = {
  width: 824, railW: 112, frameW: 600, frameH: 428, gap: 50, top: 50, bottom: 50, frames: 4,
  holeW: 68, holeH: 51, holePitch: 111, holeTop: 8, holeInner: 4,
} as const;
/** Backdrop around the film so stickers can overhang its edge, as they do in the template. */
export const STRIP_MARGIN = 64;

/** Height of the film itself (without the backdrop margin). */
export const STRIP_HEIGHT = STRIP.top + STRIP.frames * STRIP.frameH + (STRIP.frames - 1) * STRIP.gap + STRIP.bottom;

const COLORS = { film: '#1B1816', filmHi: '#2A241F', backdrop: '#EFE5D2', hole: '#D4CDC1', champagne: '#EFE5D2', amber: '#D9A441' } as const;

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
  /** Output pixel density; 2 gives a 1,904 × 4,180 px strip. */
  readonly scale?: number;
  readonly date?: Date;
  /** Print a small date in the bottom film margin. Off by default: the reference template has none. */
  readonly stamp?: boolean;
  readonly createCanvas?: (width: number, height: number) => StripCanvas;
}

/**
 * Sticker placement in film coordinates, mapped from the template: pink hibiscus top-right over the rail,
 * thin starfish top-left across the left rail and frame 1, clock bottom-left, cassette bottom-right.
 */
export const STICKER_PLACEMENTS: ReadonlyArray<{ readonly kind: StickerKind; readonly x: number; readonly y: number; readonly size: number; readonly rot: number }> = [
  { kind: 'hibiscus', x: 748, y: 138, size: 250, rot: 0.1 },
  { kind: 'starfish', x: 100, y: 430, size: 420, rot: -0.1 },
  { kind: 'clock', x: 72, y: 1384, size: 316, rot: 0 },
  { kind: 'cassette', x: 728, y: 1722, size: 350, rot: -1.2 },
];

/** Source rectangle that fills `dw × dh` from an `sw × sh` image without distortion (CSS object-fit: cover). */
export function coverRect(sw: number, sh: number, dw: number, dh: number): { sx: number; sy: number; sw: number; sh: number } {
  if (!(sw > 0 && sh > 0 && dw > 0 && dh > 0)) throw new RangeError('sizes must be positive');
  const srcRatio = sw / sh; const dstRatio = dw / dh;
  if (srcRatio > dstRatio) { const w = sh * dstRatio; return { sx: (sw - w) / 2, sy: 0, sw: w, sh }; }
  const h = sw / dstRatio; return { sx: 0, sy: (sh - h) / 2, sw, sh: h };
}

export function frameTop(i: number): number { return STRIP.top + i * (STRIP.frameH + STRIP.gap); }
/** Whole holes that fit on each rail (the last one stays clear of the bottom edge). */
export function sprocketCount(): number { return Math.floor((STRIP_HEIGHT - 4 - STRIP.holeH - STRIP.holeTop) / STRIP.holePitch) + 1; }
/** Top of sprocket hole `k` (the same on both rails). */
export function sprocketTop(k: number): number { return STRIP.holeTop + k * STRIP.holePitch; }

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
  const canvas = (opts.createCanvas ?? defaultCanvas)(Math.round((STRIP.width + 2 * STRIP_MARGIN) * scale), Math.round((STRIP_HEIGHT + 2 * STRIP_MARGIN) * scale));
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (ctx === null) throw new Error('2D canvas is not available');
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.backdrop; ctx.fillRect(0, 0, STRIP.width + 2 * STRIP_MARGIN, STRIP_HEIGHT + 2 * STRIP_MARGIN);
  ctx.translate(STRIP_MARGIN, STRIP_MARGIN);
  ctx.textBaseline = 'middle';

  // film base
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
  ctx.fillStyle = COLORS.film; roundRect(ctx, 0, 0, STRIP.width, STRIP_HEIGHT, 6); ctx.fill(); ctx.restore();
  const base = ctx.createLinearGradient(0, 0, STRIP.width, 0);
  base.addColorStop(0, COLORS.filmHi); base.addColorStop(0.1, COLORS.film); base.addColorStop(0.9, COLORS.film); base.addColorStop(1, COLORS.filmHi);
  ctx.fillStyle = base; roundRect(ctx, 0, 0, STRIP.width, STRIP_HEIGHT, 6); ctx.fill();

  // landscape sprocket holes down both rails
  const n = sprocketCount();
  for (const x of [STRIP.railW - STRIP.holeInner - STRIP.holeW, STRIP.width - STRIP.railW + STRIP.holeInner]) {
    for (let k = 0; k < n; k += 1) {
      const y = sprocketTop(k);
      ctx.fillStyle = COLORS.hole; roundRect(ctx, x, y, STRIP.holeW, STRIP.holeH, 9); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; roundRect(ctx, x + 1, y + 1, STRIP.holeW - 2, STRIP.holeH - 2, 8); ctx.stroke();
    }
  }

  // frames
  frames.forEach((f, i) => {
    const x = STRIP.railW; const y = frameTop(i);
    const c = coverRect(f.width, f.height, STRIP.frameW, STRIP.frameH);
    ctx.save();
    roundRect(ctx, x, y, STRIP.frameW, STRIP.frameH, 4); ctx.clip();
    ctx.drawImage(f.source, c.sx, c.sy, c.sw, c.sh, x, y, STRIP.frameW, STRIP.frameH);
    ctx.fillStyle = 'rgba(239,229,210,0.06)'; ctx.fillRect(x, y, STRIP.frameW, STRIP.frameH); // warm film cast
    const vg = ctx.createRadialGradient(x + STRIP.frameW / 2, y + STRIP.frameH / 2, STRIP.frameH * 0.45, x + STRIP.frameW / 2, y + STRIP.frameH / 2, STRIP.frameW * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,8,4,0.34)');
    ctx.fillStyle = vg; ctx.fillRect(x, y, STRIP.frameW, STRIP.frameH);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3; roundRect(ctx, x, y, STRIP.frameW, STRIP.frameH, 4); ctx.stroke();

    // 35 mm edge print in the outer margin of each rail, as in the template: frame number, and a "▷ nA" half-frame marker
    ctx.fillStyle = COLORS.amber; ctx.strokeStyle = COLORS.amber; ctx.textAlign = 'center';
    ctx.font = "700 34px 'Arial Narrow', Arial, sans-serif";
    ctx.save(); ctx.translate(STRIP.width - 21, y + STRIP.frameH * 0.62); ctx.rotate(Math.PI / 2); ctx.fillText(String(i + 1), 0, 0); ctx.restore();
    ctx.save(); ctx.translate(21, y + STRIP.frameH * 0.62); ctx.rotate(-Math.PI / 2); ctx.fillText(String(i + 1), 0, 0); ctx.restore();
    ctx.font = "700 24px 'Arial Narrow', Arial, sans-serif";
    ctx.save(); ctx.translate(STRIP.width - 21, y + STRIP.frameH * 0.22); ctx.rotate(Math.PI / 2);
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-34, -9); ctx.lineTo(-34, 9); ctx.lineTo(-18, 0); ctx.closePath(); ctx.stroke();
    ctx.fillText(`${i + 1}A`, 12, 0); ctx.restore();
  });

  if (opts.stamp === true) {
    ctx.fillStyle = COLORS.amber; ctx.font = "700 22px 'Courier New', monospace"; ctx.textAlign = 'center';
    ctx.fillText(formatStripDate(opts.date ?? new Date()), STRIP.width / 2, STRIP_HEIGHT - STRIP.bottom / 2);
  }

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
