/**
 * Vintage scrapbook stickers for the photostrip, drawn as vectors (no image assets), after the reference
 * template (image_721733.png): a pink hibiscus bloom, a thin seven-armed gold starfish, an antique clock with a
 * cream face and Roman numerals in a gold rim, and a sepia cassette tape.
 * Each sticker is authored in a local 100-unit box centred on (0,0) and gets a die-cut champagne edge + soft shadow.
 */

type Ctx = CanvasRenderingContext2D;

export type StickerKind = 'cassette' | 'clock' | 'starfish' | 'hibiscus';
export const STICKER_KINDS: readonly StickerKind[] = ['cassette', 'clock', 'starfish', 'hibiscus'];

const C = {
  gold: '#C28D39', goldHi: '#F1D58C', goldLo: '#8A5F22', champagne: '#EFE5D2', ink: '#2B1E1A',
  star: '#CDA249', starHi: '#E6C877', starLo: '#A67F2D',
  cream: '#EADFC5', creamLo: '#CDBF9F', sepia: '#8F7C66', sepiaLo: '#5C4B3B', sepiaDark: '#2A211A', tape: '#DDD2BC',
  coral: '#E5576B', pink: '#F6A9A0', sun: '#F2B84B', vein: '#B8334A',
} as const;

/** Draw `kind` centred at (cx, cy), `size` px across the local 100-unit box, rotated by `rot` radians. */
export function drawSticker(ctx: Ctx, kind: StickerKind, cx: number, cy: number, size: number, rot: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.save(); // die-cut edge with a soft shadow
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.champagne; ctx.strokeStyle = C.champagne; ctx.lineWidth = 3.2;
  silhouette(ctx, kind);
  ctx.restore();
  detail(ctx, kind);
  ctx.restore();
}

function silhouette(ctx: Ctx, kind: StickerKind): void {
  switch (kind) {
    case 'cassette': rr(ctx, -50, -32, 100, 64, 5); ctx.fill(); ctx.stroke(); break;
    case 'clock': ctx.beginPath(); ctx.arc(0, 0, 41, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case 'starfish': starfishPath(ctx); ctx.fill(); ctx.stroke(); break;
    case 'hibiscus': for (let i = 0; i < 5; i += 1) { ctx.save(); ctx.rotate(PETAL_ROT[i] as number); petalPath(ctx); ctx.fill(); ctx.stroke(); ctx.restore(); } break;
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

/* ── sepia cassette ── */
function cassette(ctx: Ctx): void {
  const body = ctx.createLinearGradient(0, -32, 0, 32); body.addColorStop(0, '#9B886F'); body.addColorStop(1, C.sepiaLo);
  ctx.fillStyle = body; rr(ctx, -50, -32, 100, 64, 5); ctx.fill();
  ctx.strokeStyle = C.sepiaDark; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = C.tape; rr(ctx, -41, -26, 82, 26, 3); ctx.fill(); // label
  ctx.strokeStyle = '#A99C82'; ctx.lineWidth = 0.8;
  for (const y of [-19, -13, -7]) { ctx.beginPath(); ctx.moveTo(-36, y); ctx.lineTo(36, y); ctx.stroke(); }
  ctx.fillStyle = C.sepiaDark; rr(ctx, -30, 3, 60, 22, 11); ctx.fill(); // tape window
  for (const x of [-16, 16]) { // reels
    ctx.fillStyle = C.tape; ctx.beginPath(); ctx.arc(x, 14, 8.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.sepiaDark; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, 14, 4.2, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 6; k += 1) { const a = (k * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 1.4, 14 + Math.sin(a) * 1.4); ctx.lineTo(x + Math.cos(a) * 4.2, 14 + Math.sin(a) * 4.2); ctx.stroke(); }
  }
  ctx.strokeStyle = '#4A3B2E'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-16, 22); ctx.lineTo(16, 22); ctx.stroke();
  ctx.fillStyle = C.sepiaDark; for (const [x, y] of [[-45, -27], [45, -27], [-45, 27], [45, 27]] as const) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(-34, 32); ctx.lineTo(-26, 26); ctx.lineTo(26, 26); ctx.lineTo(34, 32); ctx.closePath(); ctx.fill();
}

/* ── antique clock: gold rim, cream face, Roman numerals, crest ── */
const NUMERALS = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'] as const;
function clock(ctx: Ctx): void {
  const rim = ctx.createLinearGradient(-40, -40, 40, 40); rim.addColorStop(0, C.goldHi); rim.addColorStop(0.5, C.gold); rim.addColorStop(1, C.goldLo);
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(0, 0, 41, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.goldLo; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 36.5, 0, Math.PI * 2); ctx.stroke();
  const face = ctx.createRadialGradient(-6, -8, 4, 0, 0, 36); face.addColorStop(0, '#F3EBD5'); face.addColorStop(1, C.cream);
  ctx.fillStyle = face; ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(43,30,26,0.55)'; ctx.lineWidth = 0.6;
  for (let i = 0; i < 60; i += 1) { const a = (i * Math.PI) / 30; const r0 = i % 5 === 0 ? 30.6 : 32.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * 33.6, Math.sin(a) * 33.6); ctx.stroke(); }
  ctx.fillStyle = C.ink; ctx.font = "700 5.4px Georgia, 'Times New Roman', serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  NUMERALS.forEach((n, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 6; ctx.save(); ctx.translate(Math.cos(a) * 26, Math.sin(a) * 26); ctx.rotate(a + Math.PI / 2); ctx.fillText(n, 0, 0); ctx.restore(); });
  ctx.strokeStyle = '#8B6B3E'; ctx.fillStyle = '#8B6B3E'; ctx.lineWidth = 0.9; // ornate wreath crest in the middle
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 10; i += 1) { const a = (i * Math.PI * 2) / 10; ctx.save(); ctx.translate(Math.cos(a) * 11, Math.sin(a) * 11); ctx.rotate(a + 0.6); ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; // hands at 10:10
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-13, -10); ctx.stroke(); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, -11); ctx.stroke();
}

/* ── thin seven-armed starfish ── */
const ARMS: ReadonlyArray<{ readonly a: number; readonly len: number }> = [
  { a: -92, len: 50 }, { a: -36, len: 29 }, { a: 10, len: 44 }, { a: 60, len: 51 }, { a: 120, len: 31 }, { a: 170, len: 45 }, { a: 220, len: 30 },
];
function armPath(ctx: Ctx, a: number, len: number, w0: number): void {
  const r = (a * Math.PI) / 180; const dx = Math.cos(r), dy = Math.sin(r); const nx = -dy, ny = dx;
  ctx.moveTo(nx * w0, ny * w0);
  ctx.quadraticCurveTo(dx * len * 0.55 + nx * w0 * 0.55, dy * len * 0.55 + ny * w0 * 0.55, dx * len, dy * len);
  ctx.quadraticCurveTo(dx * len * 0.55 - nx * w0 * 0.55, dy * len * 0.55 - ny * w0 * 0.55, -nx * w0, -ny * w0);
  ctx.closePath();
}
function starfishPath(ctx: Ctx): void {
  ctx.beginPath();
  for (const { a, len } of ARMS) armPath(ctx, a, len, 5.6);
  ctx.moveTo(8, 0); ctx.arc(0, 0, 8, 0, Math.PI * 2);
}
function starfish(ctx: Ctx): void {
  starfishPath(ctx);
  const g = ctx.createLinearGradient(-40, -40, 40, 50); g.addColorStop(0, C.starHi); g.addColorStop(0.5, C.star); g.addColorStop(1, C.starLo);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.starLo; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = C.starHi;
  for (const { a, len } of ARMS) { const r = (a * Math.PI) / 180; for (let k = 1; k <= 5; k += 1) { const d = (len * k) / 6; ctx.beginPath(); ctx.arc(Math.cos(r) * d, Math.sin(r) * d, Math.max(0.5, 1.5 - k * 0.22), 0, Math.PI * 2); ctx.fill(); } }
  ctx.fillStyle = C.starLo; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
}

/* ── pink hibiscus ── */
const PETAL_ROT: readonly number[] = [0.05, 1.31, 2.55, 3.8, 5.07];
function petalPath(ctx: Ctx): void {
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-24, -8, -44, -36, -22, -50); ctx.bezierCurveTo(-14, -56, -6, -52, 0, -56);
  ctx.bezierCurveTo(6, -52, 14, -56, 22, -50); ctx.bezierCurveTo(44, -36, 24, -8, 0, 0); ctx.closePath();
}
function hibiscus(ctx: Ctx): void {
  for (let i = 0; i < 5; i += 1) {
    ctx.save(); ctx.rotate(PETAL_ROT[i] as number);
    const g = ctx.createRadialGradient(0, -4, 1, 0, -30, 40); g.addColorStop(0, C.sun); g.addColorStop(0.22, '#EE8A5A'); g.addColorStop(0.55, C.coral); g.addColorStop(1, C.pink);
    ctx.fillStyle = g; petalPath(ctx); ctx.fill();
    ctx.strokeStyle = 'rgba(150,40,60,0.5)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.strokeStyle = 'rgba(184,51,74,0.55)'; ctx.lineWidth = 0.7;
    for (const [x, y] of [[0, -46], [-10, -40], [10, -40], [-18, -28], [18, -28]] as const) { ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(x * 0.4, y * 0.5, x, y); ctx.stroke(); }
    ctx.restore();
  }
  ctx.fillStyle = '#A5243A'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.sun; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(8, -8, 16, -20, 24, -26); ctx.stroke(); // stamen column
  ctx.fillStyle = '#F2C94C'; for (const [x, y] of [[22, -29], [26, -25], [19, -24], [25, -31], [29, -28]] as const) { ctx.beginPath(); ctx.arc(x, y, 1.9, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#C0152A'; ctx.beginPath(); ctx.arc(26, -27, 2.1, 0, Math.PI * 2); ctx.fill();
}
