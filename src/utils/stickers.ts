/**
 * Vintage scrapbook stickers for the photostrip, drawn as vectors (no image assets):
 * a retro cassette tape, an antique gold pocket clock, a gold starfish with a sparkle, and a tropical hibiscus bloom.
 * Each sticker is authored in a local 100-unit box centred on (0,0) and has a die-cut champagne halo + soft shadow.
 */

type Ctx = CanvasRenderingContext2D;

export type StickerKind = 'cassette' | 'clock' | 'starfish' | 'hibiscus';
export const STICKER_KINDS: readonly StickerKind[] = ['cassette', 'clock', 'starfish', 'hibiscus'];

const C = { burgundy: '#710912', deep: '#4A0610', gold: '#C28D39', goldHi: '#F1D58C', goldLo: '#8A5F22', champagne: '#EFE5D2', ink: '#2B1E1A', leaf: '#2F6B3F', coral: '#E4572E' } as const;

/** Draw `kind` centred at (cx, cy), `size` px wide, rotated by `rot` radians. */
export function drawSticker(ctx: Ctx, kind: StickerKind, cx: number, cy: number, size: number, rot: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // die-cut halo with a soft shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.champagne; ctx.strokeStyle = C.champagne; ctx.lineWidth = 9;
  silhouette(ctx, kind);
  ctx.restore();
  detail(ctx, kind);
  ctx.restore();
}

function silhouette(ctx: Ctx, kind: StickerKind): void {
  switch (kind) {
    case 'cassette': rr(ctx, -50, -32, 100, 64, 6); ctx.fill(); ctx.stroke(); break;
    case 'clock':
      ctx.beginPath(); ctx.arc(0, 6, 38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -40, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      rr(ctx, -6, -36, 12, 10, 2); ctx.fill(); ctx.stroke(); break;
    case 'starfish': starfishPath(ctx, 42); ctx.fill(); ctx.stroke(); sparklePath(ctx, 40, -34, 14); ctx.fill(); ctx.stroke(); break;
    case 'hibiscus':
      for (let i = 0; i < 5; i += 1) { ctx.save(); ctx.rotate((i * Math.PI * 2) / 5); petalPath(ctx); ctx.fill(); ctx.stroke(); ctx.restore(); }
      break;
  }
}

function detail(ctx: Ctx, kind: StickerKind): void {
  if (kind === 'cassette') cassette(ctx);
  else if (kind === 'clock') clock(ctx);
  else if (kind === 'starfish') starfish(ctx);
  else hibiscus(ctx);
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function goldGrad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, C.goldHi); g.addColorStop(0.5, C.gold); g.addColorStop(1, C.goldLo);
  return g;
}

/* ── cassette ── */
function cassette(ctx: Ctx): void {
  const body = ctx.createLinearGradient(0, -32, 0, 32); body.addColorStop(0, '#8E1220'); body.addColorStop(1, C.deep);
  ctx.fillStyle = body; rr(ctx, -50, -32, 100, 64, 6); ctx.fill();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = C.champagne; rr(ctx, -41, -26, 82, 28, 3); ctx.fill(); // label
  ctx.strokeStyle = '#B7A98F'; ctx.lineWidth = 0.8;
  for (const y of [-14, -8]) { ctx.beginPath(); ctx.moveTo(-36, y); ctx.lineTo(36, y); ctx.stroke(); }
  ctx.fillStyle = C.burgundy; ctx.font = "italic 700 9px Georgia, 'Times New Roman', serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('MIX TAPE · 2000', 0, -19);
  ctx.fillStyle = '#120808'; rr(ctx, -29, 2, 58, 22, 11); ctx.fill(); // tape window
  for (const x of [-15, 15]) { // reels
    ctx.fillStyle = C.champagne; ctx.beginPath(); ctx.arc(x, 13, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = goldGrad(ctx, x - 5, 8, x + 5, 18); ctx.beginPath(); ctx.arc(x, 13, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#120808'; ctx.lineWidth = 1;
    for (let k = 0; k < 6; k += 1) { const a = (k * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 1.6, 13 + Math.sin(a) * 1.6); ctx.lineTo(x + Math.cos(a) * 4, 13 + Math.sin(a) * 4); ctx.stroke(); }
  }
  ctx.strokeStyle = '#6B3A1E'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-15, 19); ctx.lineTo(15, 19); ctx.stroke(); // tape run
  ctx.fillStyle = C.gold;
  for (const [x, y] of [[-45, -27], [45, -27], [-45, 27], [45, 27]] as const) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(-34, 32); ctx.lineTo(-26, 25); ctx.lineTo(26, 25); ctx.lineTo(34, 32); ctx.closePath(); ctx.fill(); // base trapezoid
}

/* ── antique gold pocket clock ── */
function clock(ctx: Ctx): void {
  ctx.strokeStyle = goldGrad(ctx, -12, -50, 12, -30); ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, -40, 8, 0, Math.PI * 2); ctx.stroke(); // bow
  ctx.fillStyle = goldGrad(ctx, -6, -36, 6, -26); rr(ctx, -6, -36, 12, 10, 2); ctx.fill(); // crown
  ctx.fillStyle = goldGrad(ctx, -38, -32, 38, 44); ctx.beginPath(); ctx.arc(0, 6, 38, 0, Math.PI * 2); ctx.fill(); // case
  ctx.strokeStyle = C.goldLo; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 6, 32.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#F7F0DF'; ctx.beginPath(); ctx.arc(0, 6, 30, 0, Math.PI * 2); ctx.fill(); // face
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i += 1) { const a = (i * Math.PI) / 6; const r0 = i % 3 === 0 ? 24 : 26.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, 6 + Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * 28.5, 6 + Math.sin(a) * 28.5); ctx.stroke(); }
  ctx.fillStyle = C.ink; ctx.font = "700 7px Georgia, 'Times New Roman', serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('XII', 0, -13); ctx.fillText('VI', 0, 25); ctx.fillText('III', 19, 6); ctx.fillText('IX', -19, 6);
  ctx.strokeStyle = C.burgundy; ctx.lineWidth = 2.4; // hands at 10:10
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-11, -6); ctx.stroke();
  ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(13, -9); ctx.stroke();
  ctx.fillStyle = goldGrad(ctx, -3, 3, 3, 9); ctx.beginPath(); ctx.arc(0, 6, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.6; // chain
  ctx.beginPath(); ctx.moveTo(8, -42); ctx.bezierCurveTo(30, -52, 46, -30, 40, -8); ctx.stroke();
  ctx.fillStyle = C.goldHi;
  for (let k = 0; k < 5; k += 1) { const t = k / 4; const x = (1 - t) ** 3 * 8 + 3 * (1 - t) ** 2 * t * 30 + 3 * (1 - t) * t ** 2 * 46 + t ** 3 * 40; const y = (1 - t) ** 3 * -42 + 3 * (1 - t) ** 2 * t * -52 + 3 * (1 - t) * t ** 2 * -30 + t ** 3 * -8; ctx.beginPath(); ctx.ellipse(x, y, 2.2, 1.3, t * 2, 0, Math.PI * 2); ctx.fill(); }
}

/* ── gold starfish + sparkle ── */
function starfishPath(ctx: Ctx, R: number): void {
  const n = 5; const pts: Array<[number, number]> = [];
  for (let i = 0; i < n * 2; i += 1) { const a = -Math.PI / 2 + (i * Math.PI) / n; const r = i % 2 === 0 ? R : R * 0.4; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 1) {
    const [x, y] = pts[i] as [number, number]; const [nx, ny] = pts[(i + 1) % pts.length] as [number, number];
    const mx = (x + nx) / 2, my = (y + ny) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(nx, ny, (nx + (pts[(i + 2) % pts.length] as [number, number])[0]) / 2, (ny + (pts[(i + 2) % pts.length] as [number, number])[1]) / 2);
  }
  ctx.closePath();
}
function sparklePath(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.12, cy - r * 0.12, cx + r, cy); ctx.quadraticCurveTo(cx + r * 0.12, cy + r * 0.12, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.12, cy + r * 0.12, cx - r, cy); ctx.quadraticCurveTo(cx - r * 0.12, cy - r * 0.12, cx, cy - r); ctx.closePath();
}
function starfish(ctx: Ctx): void {
  starfishPath(ctx, 42); ctx.fillStyle = goldGrad(ctx, -40, -40, 40, 40); ctx.fill();
  ctx.strokeStyle = C.goldLo; ctx.lineWidth = 1.2; ctx.stroke();
  for (let i = 0; i < 5; i += 1) { // textured dots running down each arm
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    ctx.strokeStyle = 'rgba(138,95,34,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); ctx.stroke();
    ctx.fillStyle = C.champagne;
    for (let k = 1; k <= 4; k += 1) { ctx.beginPath(); ctx.arc(Math.cos(a) * k * 8.5, Math.sin(a) * k * 8.5, 1.5 - k * 0.2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = C.goldLo; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  sparklePath(ctx, 40, -34, 14); ctx.fillStyle = goldGrad(ctx, 26, -48, 54, -20); ctx.fill(); ctx.strokeStyle = C.goldLo; ctx.lineWidth = 0.9; ctx.stroke();
  sparklePath(ctx, -36, 34, 7); ctx.fillStyle = C.goldHi; ctx.fill();
}

/* ── tropical hibiscus ── */
function petalPath(ctx: Ctx): void {
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-20, -8, -30, -34, -8, -46); ctx.bezierCurveTo(-2, -50, 2, -50, 8, -46);
  ctx.bezierCurveTo(30, -34, 20, -8, 0, 0); ctx.closePath();
}
function hibiscus(ctx: Ctx): void {
  ctx.fillStyle = C.leaf; // two leaves behind the bloom
  for (const a of [-2.3, -0.85]) { ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-12, -22, -6, -44, 0, -52); ctx.bezierCurveTo(6, -44, 12, -22, 0, 0); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -46); ctx.stroke(); ctx.restore(); }
  for (let i = 0; i < 5; i += 1) {
    ctx.save(); ctx.rotate((i * Math.PI * 2) / 5);
    const g = ctx.createRadialGradient(0, -2, 2, 0, -30, 42); g.addColorStop(0, C.deep); g.addColorStop(0.28, C.burgundy); g.addColorStop(0.75, C.coral); g.addColorStop(1, '#F59B72');
    ctx.fillStyle = g; petalPath(ctx); ctx.fill();
    ctx.strokeStyle = 'rgba(74,6,16,0.45)'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,210,0.35)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -40); ctx.moveTo(-4, -12); ctx.lineTo(-8, -36); ctx.moveTo(4, -12); ctx.lineTo(8, -36); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.goldHi; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(10, -10, 20, -22, 30, -30); ctx.stroke(); // stamen column
  ctx.fillStyle = C.gold; for (const [x, y] of [[27, -34], [32, -29], [24, -28], [30, -36], [34, -33]] as const) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#C0152A'; ctx.beginPath(); ctx.arc(31, -31, 2.6, 0, Math.PI * 2); ctx.fill();
}
