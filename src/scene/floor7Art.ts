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

/**
 * The kiosk follows the reference line art (image_721660.png), drawn in the reference's own pixel space
 * (735 × 750) and scaled into the world:
 *   a wide three-bay body · "PHOTOBOOTH" sign on two posts over the left two-thirds · framed window of
 *   featured strips + hand-lettered label · coin/starter unit · wavy curtain with an "enter →" plaque ·
 *   stool visible under the hem · tall window with glint marks · small cup icon.
 * Colours: Deep Burgundy body, Antique Gold linework, Warm Champagne curtain / strips / lettering.
 */
export const KIOSK_REF = { bodyLeft: 62, bodyRight: 672, bodyTop: 177, bodyBottom: 637, signTop: 76 } as const;
/** Width of the kiosk in world units (matches PHOTOBOOTH_HALF_WIDTH × 2 in spatial/landmarks.ts). */
export const KIOSK_WORLD_WIDTH = 8.6;

/** Letter-spaced text centred on (cx, cy), shrunk uniformly if it would be wider than `maxWidth`. */
function spacedText(ctx: Ctx, text: string, cx: number, cy: number, spacing: number, maxWidth: number): void {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  const k = total > maxWidth ? maxWidth / total : 1;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.textAlign = 'left';
  let x = -total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x, 0); x += (widths[i] as number) + spacing; });
  ctx.restore();
}

export function drawPhotoboothKiosk(ctx: Ctx, sx: number, sy: number, z: number, t: number, near: boolean): void {
  const { burgundy, gold, champagne } = BOOTH_PALETTE;
  const bodyW = KIOSK_REF.bodyRight - KIOSK_REF.bodyLeft;
  const k = (KIOSK_WORLD_WIDTH * z) / bodyW;            // reference px → screen px
  const lw = Math.max(3.4, 1.3 / k);                     // keep the linework at least ~1.3 screen px
  ctx.save();
  if (near) { // welcome glow on the floor in front of the door
    const r = (5 + 0.5 * Math.sin(t * 4)) * z;
    const gl = ctx.createRadialGradient(sx + 0.9 * z, sy, 0, sx + 0.9 * z, sy, r);
    gl.addColorStop(0, 'rgba(194,141,57,0.55)'); gl.addColorStop(1, 'rgba(194,141,57,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx - r, sy - r * 0.55, r * 2.4, r * 1.1);
  }
  ctx.translate(sx - ((KIOSK_REF.bodyLeft + KIOSK_REF.bodyRight) / 2) * k, sy - KIOSK_REF.bodyBottom * k);
  ctx.scale(k, k);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = gold;
  const rect = (x0: number, y0: number, x1: number, y1: number): void => { ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); };

  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(367, 641, 345, 15, 0, 0, Math.PI * 2); ctx.fill(); // contact shadow

  // body + roof band
  const body = ctx.createLinearGradient(62, 0, 672, 0);
  body.addColorStop(0, '#5A0710'); body.addColorStop(0.5, burgundy); body.addColorStop(1, '#4C060D');
  ctx.fillStyle = body; rect(62, 177, 672, 637); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4C060D'; rect(62, 177, 672, 205); ctx.fill(); ctx.stroke();

  // sign on two posts, over the left two-thirds
  ctx.fillStyle = gold; rect(104, 158, 124, 178); ctx.fill(); rect(398, 158, 418, 178); ctx.fill();
  ctx.fillStyle = burgundy; rect(62, 76, 485, 160); ctx.fill(); ctx.stroke();
  ctx.lineWidth = lw * 0.55; rect(75, 88, 472, 148); ctx.stroke(); ctx.lineWidth = lw;
  ctx.fillStyle = champagne; ctx.textBaseline = 'middle';
  ctx.font = "500 50px 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";
  spacedText(ctx, 'PHOTOBOOTH', 273, 120, 6, 372); // fits inside the inner border (397 px)

  // bay dividers
  ctx.beginPath(); ctx.moveTo(358, 205); ctx.lineTo(358, 637); ctx.moveTo(548, 205); ctx.lineTo(548, 637); ctx.stroke();

  // window of featured strips
  ctx.fillStyle = '#2A0408'; rect(107, 223, 321, 358); ctx.fill(); ctx.stroke();
  ctx.lineWidth = lw * 0.55; rect(119, 234, 309, 346); ctx.stroke(); ctx.lineWidth = lw;
  [[149, 252, 78, -0.03], [179, 250, 82, 0.02], [207, 256, 76, 0], [238, 249, 82, 0.03], [265, 252, 80, -0.02]].forEach(([x, y, h, rot]) => {
    ctx.save(); ctx.translate(x as number + 8, (y as number) + (h as number) / 2); ctx.rotate(rot as number);
    ctx.fillStyle = champagne; ctx.fillRect(-8, -(h as number) / 2, 16, h as number);
    ctx.fillStyle = 'rgba(113,9,18,0.85)';
    for (let f = 0; f < 4; f += 1) ctx.fillRect(-5.5, -(h as number) / 2 + 3 + f * ((h as number) - 6) / 4, 11, ((h as number) - 6) / 4 - 3);
    ctx.restore();
  });
  // hand-lettered label with a curved arrow up to the window
  ctx.fillStyle = champagne; ctx.strokeStyle = champagne; ctx.lineWidth = lw * 0.5;
  ctx.font = "italic 24px Georgia, 'Times New Roman', serif"; ctx.textAlign = 'center';
  ctx.fillText('featured', 301, 412); ctx.fillText('strips', 301, 438);
  ctx.beginPath(); ctx.moveTo(298, 398); ctx.quadraticCurveTo(326, 392, 308, 368); ctx.moveTo(308, 368); ctx.lineTo(318, 374); ctx.moveTo(308, 368); ctx.lineTo(304, 380); ctx.stroke();
  ctx.strokeStyle = gold; ctx.lineWidth = lw;

  // coin / starter unit
  ctx.fillStyle = gold; rect(198, 424, 234, 458); ctx.fill(); ctx.strokeStyle = '#4C060D'; ctx.lineWidth = lw * 0.6; ctx.stroke();
  ctx.fillStyle = '#4C060D'; for (const [dx, dy] of [[205, 431], [227, 431], [205, 451], [227, 451]] as const) { ctx.beginPath(); ctx.arc(dx, dy, 2.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(210, 437); ctx.lineTo(216, 446); ctx.lineTo(222, 437); ctx.stroke();
  ctx.fillStyle = gold; rect(197, 462, 233, 548); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2A0408'; rect(205, 471, 225, 540); ctx.fill(); ctx.fillStyle = '#12090A'; rect(211, 480, 219, 524); ctx.fill();
  ctx.strokeStyle = gold; ctx.lineWidth = lw;

  // door: dark interior, stool, then the curtain over it
  ctx.fillStyle = '#1A0608'; rect(360, 206, 546, 637); ctx.fill();
  ctx.fillStyle = gold;
  ctx.beginPath(); ctx.ellipse(488, 607, 38, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(479, 520, 18, 86);
  ctx.beginPath(); ctx.ellipse(473, 505, 50, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8A5F22'; ctx.lineWidth = lw * 0.6; ctx.beginPath(); ctx.ellipse(473, 505, 50, 17, 0, 0, Math.PI); ctx.stroke(); ctx.strokeStyle = gold; ctx.lineWidth = lw;

  const sway = Math.sin(t * 1.1) * 3;
  ctx.fillStyle = champagne;
  ctx.beginPath(); ctx.moveTo(415, 205); ctx.lineTo(548, 205); ctx.lineTo(548, 494);
  for (let i = 0; i < 6; i += 1) { const x1 = 548 - (i + 1) * ((548 - 428) / 6); ctx.quadraticCurveTo(548 - (i + 0.5) * ((548 - 428) / 6), i % 2 === 0 ? 506 : 484, x1, 496 + (i % 2) * 4); }
  ctx.bezierCurveTo(424 + sway, 420, 434 - sway, 330, 415, 205); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(113,9,18,0.42)'; ctx.lineWidth = lw * 0.7;
  for (let i = 0; i < 6; i += 1) {
    const x0 = 432 + i * 20;
    ctx.beginPath(); ctx.moveTo(x0, 208);
    ctx.bezierCurveTo(x0 + 9 + sway * 0.5, 280, x0 - 9, 360, x0 + 4 + sway * 0.4, 420);
    ctx.bezierCurveTo(x0 + 8, 450, x0 - 3, 470, x0 + 2, 492); ctx.stroke();
  }
  ctx.strokeStyle = gold; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(405, 205); ctx.lineTo(548, 205); ctx.stroke(); // curtain rail

  // "enter →" plaque
  ctx.fillStyle = champagne; ctx.strokeStyle = near ? gold : burgundy; ctx.lineWidth = lw * 1.3;
  ctx.beginPath(); ctx.roundRect?.(387, 353, 140, 58, 5); if (ctx.roundRect === undefined) ctx.rect(387, 353, 140, 58); ctx.fill(); ctx.stroke();
  ctx.fillStyle = burgundy; ctx.textAlign = 'center'; ctx.font = "600 31px 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif"; ctx.fillText('enter', 436, 383);
  ctx.strokeStyle = burgundy; ctx.lineWidth = lw * 0.9;
  ctx.beginPath(); ctx.moveTo(496, 370); ctx.lineTo(509, 370); ctx.lineTo(509, 394); ctx.lineTo(496, 394);
  ctx.moveTo(476, 382); ctx.lineTo(504, 382); ctx.moveTo(495, 373); ctx.lineTo(504, 382); ctx.lineTo(495, 391); ctx.stroke();

  // tall window with glint marks
  const glass = ctx.createLinearGradient(570, 224, 648, 386);
  glass.addColorStop(0, '#2B0F14'); glass.addColorStop(1, '#14080A');
  ctx.fillStyle = glass; ctx.strokeStyle = gold; ctx.lineWidth = lw; rect(570, 224, 648, 386); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(239,229,210,0.75)'; ctx.lineWidth = lw * 0.7;
  ctx.beginPath(); ctx.moveTo(589, 247); ctx.lineTo(609, 234); ctx.moveTo(593, 254); ctx.lineTo(612, 241); ctx.moveTo(609, 368); ctx.lineTo(628, 356); ctx.moveTo(613, 375); ctx.lineTo(631, 363); ctx.stroke();

  // little cup icon, bottom right
  ctx.strokeStyle = 'rgba(239,229,210,0.65)'; ctx.lineWidth = lw * 0.6;
  ctx.beginPath(); ctx.moveTo(632, 596); ctx.lineTo(656, 596); ctx.lineTo(652, 626); ctx.lineTo(636, 626); ctx.closePath(); ctx.moveTo(630, 590); ctx.lineTo(658, 590); ctx.stroke();
  ctx.restore();
}
