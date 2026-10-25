/**
 * Floor 7 art: the retro Gaming Arcade facade ("Coming Soon in V3") and the vintage photobooth kiosk.
 * Both are billboard sprites that rise up-screen from a base point (sx, sy), sized in world units × zoom.
 * The kiosk uses the mall's luxury palette: Deep Burgundy #710912, Antique Gold #C28D39, Warm Champagne #EFE5D2.
 */

type Ctx = CanvasRenderingContext2D;

export const BOOTH_PALETTE = { burgundy: '#710912', gold: '#C28D39', champagne: '#EFE5D2' } as const;

/* ───────────────────────── 5×7 pixel font ───────────────────────── */

export const GLYPH_W = 5;
export const GLYPH_H = 7;
const g = (...rows: string[]): readonly string[] => rows;
export const PIXEL_FONT: Readonly<Record<string, readonly string[]>> = {
  A: g('01110', '10001', '10001', '11111', '10001', '10001', '10001'),
  C: g('01110', '10001', '10000', '10000', '10000', '10001', '01110'),
  D: g('11110', '10001', '10001', '10001', '10001', '10001', '11110'),
  E: g('11111', '10000', '10000', '11110', '10000', '10000', '11111'),
  G: g('01110', '10001', '10000', '10111', '10001', '10001', '01111'),
  I: g('01110', '00100', '00100', '00100', '00100', '00100', '01110'),
  M: g('10001', '11011', '10101', '10101', '10001', '10001', '10001'),
  N: g('10001', '11001', '10101', '10011', '10001', '10001', '10001'),
  O: g('01110', '10001', '10001', '10001', '10001', '10001', '01110'),
  R: g('11110', '10001', '10001', '11110', '10100', '10010', '10001'),
  S: g('01111', '10000', '10000', '01110', '00001', '00001', '11110'),
  V: g('10001', '10001', '10001', '10001', '10001', '01010', '00100'),
  '3': g('11110', '00001', '00001', '01110', '00001', '00001', '11110'),
  ' ': g('00000', '00000', '00000', '00000', '00000', '00000', '00000'),
};

export const ARCADE_SIGNS = { marquee: 'GAMING ARCADE', soon: 'COMING SOON', version: 'IN V3' } as const;

/** Width in px of `text` at `px` pixels per font cell (one blank column between letters). */
export function pixelTextWidth(text: string, px: number): number {
  return text.length === 0 ? 0 : (text.length * (GLYPH_W + 1) - 1) * px;
}

export function drawPixelText(ctx: Ctx, text: string, x: number, y: number, px: number, color: string | readonly string[], halo = 0): void {
  let cx = x;
  for (let i = 0; i < text.length; i += 1) {
    const glyph = PIXEL_FONT[text[i] as string];
    if (glyph === undefined) throw new RangeError(`No pixel glyph for "${text[i]}"`);
    const col = typeof color === 'string' ? color : (color[i % color.length] as string);
    for (let r = 0; r < GLYPH_H; r += 1) for (let c = 0; c < GLYPH_W; c += 1) {
      if (glyph[r]?.[c] !== '1') continue;
      if (halo > 0) { ctx.fillStyle = withAlpha(col, 0.22); ctx.fillRect(cx + c * px - halo, y + r * px - halo, px + halo * 2, px + halo * 2); }
      ctx.fillStyle = col;
      ctx.fillRect(cx + c * px, y + r * px, px, px);
    }
    cx += (GLYPH_W + 1) * px;
  }
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ───────────────────────── Gaming Arcade ───────────────────────── */

const NEON_PINK = '#FF4FA3', NEON_CYAN = '#35E0FF', NEON_AMBER = '#FFB347', NEON_VIOLET = '#B38BFF', NEON_LIME = '#9DFF5B';

export function drawArcadeWing(ctx: Ctx, sx: number, sy: number, z: number, t: number): void {
  const W = 15 * z, H = 11.5 * z;
  const x0 = sx - W / 2, y0 = sy - H;
  ctx.save();
  // wall
  const wall = ctx.createLinearGradient(0, y0, 0, sy);
  wall.addColorStop(0, '#0E0722'); wall.addColorStop(1, '#2B1052');
  ctx.fillStyle = wall; ctx.fillRect(x0, y0, W, H);
  // twinkling pixel stars (deterministic positions)
  for (let i = 0; i < 26; i += 1) {
    const px = x0 + ((i * 7919) % 1000) / 1000 * W; const py = y0 + 3.2 * z + ((i * 104729) % 1000) / 1000 * (H - 7 * z);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * Math.abs(Math.sin(t * 1.7 + i))})`;
    ctx.fillRect(px, py, Math.max(1, 0.18 * z), Math.max(1, 0.18 * z));
  }
  // neon frame
  ctx.lineWidth = Math.max(2, 0.28 * z);
  ctx.strokeStyle = withAlpha(NEON_CYAN, 0.28); ctx.strokeRect(x0 - 0.2 * z, y0 - 0.2 * z, W + 0.4 * z, H + 0.4 * z);
  ctx.lineWidth = Math.max(1, 0.12 * z);
  ctx.strokeStyle = NEON_CYAN; ctx.strokeRect(x0, y0, W, H);

  // marquee: pixel neon letters alternating pink / cyan, with a halo
  ctx.fillStyle = '#05020F'; ctx.fillRect(x0 + 0.4 * z, y0 + 0.5 * z, W - 0.8 * z, 2.5 * z);
  const mpx = Math.floor(((W - 1.6 * z) / ((ARCADE_SIGNS.marquee.length * (GLYPH_W + 1)) - 1)) * 10) / 10;
  const mw = pixelTextWidth(ARCADE_SIGNS.marquee, mpx);
  drawPixelText(ctx, ARCADE_SIGNS.marquee, sx - mw / 2, y0 + 0.5 * z + (2.5 * z - GLYPH_H * mpx) / 2, mpx, [NEON_PINK, NEON_CYAN], Math.max(0.6, mpx * 0.35));
  // chase bulbs along the marquee edge
  for (let i = 0; i < 18; i += 1) {
    const on = Math.floor(t * 6) % 3 === i % 3;
    ctx.fillStyle = on ? NEON_AMBER : withAlpha(NEON_AMBER, 0.25);
    ctx.fillRect(x0 + 0.6 * z + i * ((W - 1.2 * z) / 18), y0 + 3.15 * z, 0.3 * z, 0.3 * z);
  }

  // glowing cabinet silhouettes
  const cabs = [NEON_PINK, NEON_CYAN, NEON_LIME, NEON_VIOLET];
  const cw = 2.8 * z, ch = 4.1 * z, gap = (W - cabs.length * cw) / (cabs.length + 1);
  cabs.forEach((col, i) => {
    const cx = x0 + gap + i * (cw + gap); const cy = sy - ch - 0.3 * z;
    const glow = ctx.createRadialGradient(cx + cw / 2, cy + ch * 0.35, 0, cx + cw / 2, cy + ch * 0.35, ch);
    glow.addColorStop(0, withAlpha(col, 0.35)); glow.addColorStop(1, withAlpha(col, 0));
    ctx.fillStyle = glow; ctx.fillRect(cx - ch * 0.4, cy - ch * 0.2, cw + ch * 0.8, ch * 1.4);
    ctx.fillStyle = '#07040F'; // body: slanted top, wider base
    ctx.beginPath(); ctx.moveTo(cx + 0.35 * z, cy); ctx.lineTo(cx + cw - 0.35 * z, cy); ctx.lineTo(cx + cw, cy + ch); ctx.lineTo(cx, cy + ch); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, 0.1 * z); ctx.stroke();
    const flick = 0.55 + 0.45 * Math.abs(Math.sin(t * (2.1 + i * 0.7) + i)); // screen
    ctx.fillStyle = withAlpha(col, flick); ctx.fillRect(cx + 0.45 * z, cy + 0.6 * z, cw - 0.9 * z, 1.7 * z);
    ctx.fillStyle = '#07040F'; ctx.fillRect(cx + 0.7 * z, cy + 1.1 * z, 0.5 * z, 0.5 * z); ctx.fillRect(cx + cw - 1.5 * z, cy + 1.7 * z, 0.45 * z, 0.45 * z); // pixel sprites on screen
    ctx.fillStyle = '#1C1233'; ctx.fillRect(cx + 0.3 * z, cy + 2.7 * z, cw - 0.6 * z, 0.8 * z); // control deck
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + 0.9 * z, cy + 3.1 * z, 0.2 * z, 0, Math.PI * 2); ctx.arc(cx + cw - 0.9 * z, cy + 3.1 * z, 0.16 * z, 0, Math.PI * 2); ctx.fill();
  });

  // "coming soon" banner
  const bw = W * 0.74, bh = 3.0 * z, bx = sx - bw / 2, by = y0 + 3.75 * z;
  ctx.fillStyle = withAlpha('#05020F', 0.88); ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = withAlpha(NEON_AMBER, 0.55 + 0.35 * Math.sin(t * 3)); ctx.lineWidth = Math.max(1, 0.1 * z); ctx.strokeRect(bx, by, bw, bh);
  const spx = Math.floor(((bw - 1.2 * z) / ((ARCADE_SIGNS.soon.length * (GLYPH_W + 1)) - 1)) * 10) / 10;
  drawPixelText(ctx, ARCADE_SIGNS.soon, sx - pixelTextWidth(ARCADE_SIGNS.soon, spx) / 2, by + 0.35 * z, spx, NEON_AMBER, Math.max(0.5, spx * 0.3));
  const vpx = spx * 0.92;
  drawPixelText(ctx, ARCADE_SIGNS.version, sx - pixelTextWidth(ARCADE_SIGNS.version, vpx) / 2, by + 0.35 * z + GLYPH_H * spx + 0.22 * z, vpx, NEON_LIME, Math.max(0.5, vpx * 0.3));
  ctx.restore();
}

/* ───────────────────────── Photobooth kiosk ───────────────────────── */

export function drawPhotoboothKiosk(ctx: Ctx, sx: number, sy: number, z: number, t: number, near: boolean): void {
  const { burgundy, gold, champagne } = BOOTH_PALETTE;
  const W = 5.4 * z, H = 8.6 * z, x0 = sx - W / 2, y0 = sy - H;
  ctx.save();
  if (near) { // pulsing welcome glow on the floor
    const r = (4 + 0.5 * Math.sin(t * 4)) * z;
    const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    gl.addColorStop(0, 'rgba(194,141,57,0.55)'); gl.addColorStop(1, 'rgba(194,141,57,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx - r, sy - r * 0.6, r * 2, r * 1.2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(sx, sy, W * 0.6, 0.7 * z, 0, 0, Math.PI * 2); ctx.fill(); // contact shadow
  // body
  const body = ctx.createLinearGradient(x0, 0, x0 + W, 0);
  body.addColorStop(0, '#5A0710'); body.addColorStop(0.5, burgundy); body.addColorStop(1, '#4C060D');
  ctx.fillStyle = body; ctx.fillRect(x0, y0 + 2.2 * z, W, H - 2.2 * z);
  ctx.fillStyle = gold; ctx.fillRect(x0 - 0.15 * z, sy - 0.5 * z, W + 0.3 * z, 0.5 * z); // gold plinth
  ctx.strokeStyle = gold; ctx.lineWidth = Math.max(1, 0.12 * z); ctx.strokeRect(x0, y0 + 2.2 * z, W, H - 2.7 * z);

  // marquee box with retro lettering and chase bulbs
  ctx.fillStyle = burgundy; ctx.fillRect(x0 - 0.2 * z, y0, W + 0.4 * z, 2.3 * z);
  ctx.strokeStyle = gold; ctx.lineWidth = Math.max(1.5, 0.16 * z); ctx.strokeRect(x0 - 0.2 * z, y0, W + 0.4 * z, 2.3 * z);
  ctx.fillStyle = champagne; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(8, 0.82 * z)}px Georgia, 'Times New Roman', serif`;
  const label = 'PHOTOBOOTH';
  const fit = Math.min(1, (W - 0.8 * z) / ctx.measureText(label).width);
  ctx.font = `700 ${Math.max(6, 0.82 * z * fit)}px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = gold; ctx.fillText(label, sx, y0 + 1.15 * z);
  for (let i = 0; i < 14; i += 1) {
    const on = Math.floor(t * 5) % 2 === i % 2;
    ctx.fillStyle = on ? champagne : withAlpha(champagne, 0.3);
    ctx.beginPath(); ctx.arc(x0 - 0.05 * z + i * ((W + 0.1 * z) / 13), y0 + 0.2 * z, Math.max(1, 0.14 * z), 0, Math.PI * 2); ctx.fill();
  }

  // curtain doorway
  const dx0 = x0 + 1.3 * z, dw = 2.1 * z, dy0 = y0 + 3 * z, dh = 4.6 * z;
  ctx.fillStyle = '#1A0608'; ctx.fillRect(dx0, dy0, dw, dh);
  ctx.strokeStyle = gold; ctx.lineWidth = Math.max(1, 0.1 * z); ctx.strokeRect(dx0 - 0.1 * z, dy0 - 0.1 * z, dw + 0.2 * z, dh + 0.2 * z);
  const sway = Math.sin(t * 1.2) * 0.04 * z;
  for (const [cxl, dir] of [[dx0, 1], [dx0 + dw, -1]] as const) { // two champagne drapes with folds, tied back
    ctx.fillStyle = champagne; ctx.beginPath();
    ctx.moveTo(cxl, dy0); ctx.lineTo(cxl + dir * (dw * 0.62 + sway), dy0);
    ctx.quadraticCurveTo(cxl + dir * (dw * 0.45), dy0 + dh * 0.5, cxl + dir * (dw * 0.55 + sway), dy0 + dh * 0.82);
    ctx.lineTo(cxl, dy0 + dh * 0.82); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withAlpha(burgundy, 0.35); ctx.lineWidth = Math.max(1, 0.07 * z);
    for (let k = 1; k <= 3; k += 1) { ctx.beginPath(); ctx.moveTo(cxl + dir * dw * 0.14 * k, dy0); ctx.lineTo(cxl + dir * dw * 0.12 * k, dy0 + dh * 0.82); ctx.stroke(); }
  }
  ctx.fillStyle = gold; ctx.fillRect(dx0 - 0.15 * z, dy0 - 0.35 * z, dw + 0.3 * z, 0.3 * z); // curtain rail
  ctx.fillStyle = withAlpha(burgundy, 0.85); ctx.fillRect(dx0, dy0 + dh * 0.82, dw, dh * 0.18); // valance under the drapes

  // sample strips gallery (right)
  const gx = x0 + 3.7 * z, gy = y0 + 3.1 * z, gw = 1.45 * z, gh = 3.9 * z;
  ctx.fillStyle = '#2A0408'; ctx.fillRect(gx, gy, gw, gh);
  ctx.strokeStyle = gold; ctx.lineWidth = Math.max(1, 0.08 * z); ctx.strokeRect(gx, gy, gw, gh);
  for (let s = 0; s < 3; s += 1) {
    const sx0 = gx + 0.12 * z + s * 0.46 * z;
    ctx.fillStyle = champagne; ctx.fillRect(sx0, gy + 0.2 * z, 0.38 * z, gh - 0.4 * z);
    ctx.fillStyle = withAlpha(burgundy, 0.8);
    for (let f = 0; f < 4; f++) ctx.fillRect(sx0 + 0.05 * z, gy + 0.3 * z + f * ((gh - 0.8 * z) / 4), 0.28 * z, (gh - 0.8 * z) / 4 - 0.1 * z);
  }
  // coin / starter slot (left)
  const px0 = x0 + 0.25 * z, py0 = y0 + 3.3 * z;
  ctx.fillStyle = gold; ctx.fillRect(px0, py0, 0.82 * z, 2.2 * z);
  ctx.fillStyle = '#1A0608'; ctx.fillRect(px0 + 0.3 * z, py0 + 0.35 * z, 0.22 * z, 0.8 * z); // the slot
  ctx.fillStyle = burgundy; ctx.beginPath(); ctx.arc(px0 + 0.41 * z, py0 + 1.6 * z, 0.22 * z, 0, Math.PI * 2); ctx.fill(); // start button
  ctx.fillStyle = champagne; ctx.beginPath(); ctx.arc(px0 + 0.41 * z, py0 + 1.6 * z, 0.09 * z, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
