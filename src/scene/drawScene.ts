/**
 * 2.5D scene renderer. Plan-view world with billboard sprites (banners, sculpture, chandeliers)
 * that rise up-screen, which gives depth without a 3D engine.
 *
 * Draws, back to front: coastline (sea, surf, beach) → glass curtain wall → storefront ring →
 * marble concourse → atrium overlook (waterfall on Floor 1) → ceiling beams → elevator core and
 * centerpiece → hanging banners → chandeliers → day/night grade.
 *
 * Pure with respect to its inputs: all animation derives from `timeMs`.
 */

import type { ConcourseSpec, FloorLayout } from '../spatial/concourse';
import { concourseToWorld } from '../spatial/concourse';
import type { DirectoryEntry } from '../engine/pincode';
import type { Pincode, FloorId } from '../data/types';
import type { SkyboxState } from './skybox';
import type { SkyState } from './timeOfDay';
import type { ParticleField } from './particles';
import { bannerAt, type BannerPromo, type BannerRotation } from '../engine/banners';
import { defaultLightPools } from '../render/marbleFloor';
import { type Camera, worldToScreen } from './camera';

export const BANNER_ROTATION: BannerRotation = { slots: 4, intervalMs: 5000 };
export const STORE_DEPTH = 6.5;
export const GLASS_GAP = 2.2;

export interface FloorLayer {
  readonly image: CanvasImageSource;
  /** World-space side length covered by the (square, centre-aligned) image. */
  readonly extent: number;
}

export interface SceneState {
  readonly width: number;
  readonly height: number;
  readonly camera: Camera;
  readonly spec: ConcourseSpec;
  readonly layout: FloorLayout;
  /** entries[i] belongs to layout.placements[i]. */
  readonly entries: readonly DirectoryEntry[];
  readonly floorId: FloorId;
  readonly pincode: Pincode | null;
  readonly floorLayer: FloorLayer | null;
  /** Seasonal + diurnal state from the device clock; `skybox.sky` carries the colours. */
  readonly skybox: SkyboxState;
  readonly particles: ParticleField | null;
  readonly timeMs: number;
  readonly banners: readonly BannerPromo[];
  readonly hoverIndex: number;
}

const FACADES = ['#4F6B5A', '#2B1E1A', '#58111A', '#2F3E6B'] as const;
const IVORY = '#FDFBF7';
const SAND = { winter: ['#E4E9EF', '#F3F6FA'], autumn: ['#CDA877', '#DDBE92'], coastal: ['#D9C49A', '#E8D7B0'] } as const;
const NEON = ['#FF4FA3', '#35E0FF', '#FFB347', '#B38BFF'] as const;
const SUN = { winter: '235,244,255', autumn: '255,214,150', coastal: '255,246,222' } as const;
const BRASS = '#C28D39';
const BRASS_HI = '#E9C77B';

type Ctx = CanvasRenderingContext2D;

/** World location of the elevator core (start of the C) and the centerpiece (end of the C). */
export function landmarkPositions(spec: ConcourseSpec, radius: number): {
  elevator: { x: number; y: number; angle: number };
  centerpiece: { x: number; y: number; angle: number };
} {
  const a0 = spec.startAngle;
  const a1 = spec.startAngle + spec.sweep;
  const s = concourseToWorld(spec, radius, 0, 0);
  const e = concourseToWorld(spec, radius, 1, 0);
  const push = spec.walkwayWidth * 0.75;
  return {
    elevator: { x: s.x + Math.sin(a0) * push, y: s.y - Math.cos(a0) * push, angle: a0 },
    centerpiece: { x: e.x - Math.sin(a1) * push, y: e.y + Math.cos(a1) * push, angle: a1 },
  };
}

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function drawScene(ctx: Ctx, st: SceneState): void {
  const { width: W, height: H, camera: cam, spec, layout } = st;
  const radius = layout.radius;
  const half = spec.walkwayWidth / 2;
  const z = cam.zoom;
  const P = (x: number, y: number): { sx: number; sy: number } => worldToScreen(cam, W, H, x, y);
  const c0 = P(spec.centerX, spec.centerY);
  const t = st.timeMs / 1000;

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  /* 1. coastline ------------------------------------------------------------------ */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, st.skybox.sky.zenith);
  sky.addColorStop(1, st.skybox.sky.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const outerStore = radius + half + STORE_DEPTH;
  const glassR = outerStore + GLASS_GAP;
  const beachR = glassR + 4.5;
  // sea fills everything beyond the beach
  ctx.fillStyle = st.skybox.sky.sea;
  ctx.fillRect(0, 0, W, H);
  // the sky is reflected on the water: horizon colour (sunset, golden hour, crisp blue) washes down from the top
  const reflect = ctx.createLinearGradient(0, 0, 0, H * 0.85);
  reflect.addColorStop(0, rgba(st.skybox.sky.horizon, 0.62));
  reflect.addColorStop(0.55, rgba(st.skybox.sky.horizon, 0.18));
  reflect.addColorStop(1, rgba(st.skybox.sky.horizon, 0));
  ctx.fillStyle = reflect; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = rgba('#FFFFFF', 0.05 + 0.12 * st.skybox.sky.daylight);
  ctx.lineWidth = 1.2;
  const lineStep = 34;
  for (let y = -lineStep; y < H + lineStep; y += lineStep) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const wy = y + Math.sin(x * 0.02 + t * 0.9 + y * 0.05) * 4 + Math.sin(x * 0.045 - t * 0.6) * 2;
      if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }
  if (st.skybox.sky.lamplight > 0.5 && st.skybox.season !== 'winter') {
    ctx.fillStyle = rgba('#FFFFFF', (st.skybox.sky.lamplight - 0.5) * 0.9);
    for (let i = 0; i < 70; i += 1) {
      const sx = ((i * 9301 + 49297) % 233280) / 233280 * W;
      const sy = ((i * 7919 + 12345) % 233280) / 233280 * H;
      ctx.fillRect(sx, sy, 1.4, 1.4);
    }
  }
  // surf foam + beach
  ctx.beginPath(); ctx.arc(c0.sx, c0.sy, (beachR + 2.2 + Math.sin(t * 0.8) * 0.5) * z, 0, Math.PI * 2);
  ctx.strokeStyle = rgba('#FFFFFF', 0.35 + 0.3 * st.skybox.sky.daylight); ctx.lineWidth = 0.9 * z; ctx.stroke();
  const sand = SAND[st.skybox.season];
  ctx.beginPath(); ctx.arc(c0.sx, c0.sy, beachR * z, 0, Math.PI * 2);
  ctx.fillStyle = sand[0]; ctx.fill();
  ctx.beginPath(); ctx.arc(c0.sx, c0.sy, (beachR - 1.5) * z, 0, Math.PI * 2);
  ctx.fillStyle = sand[1]; ctx.fill();

  // exterior particles (snow / foliage) fall across the backdrop, behind the glass
  if (st.particles !== null) st.particles.draw(ctx, { night: st.skybox.phase === 'night', parallaxX: -cam.cx * z * 0.25, parallaxY: -cam.cy * z * 0.25 });

  /* 2. building shell + interior base --------------------------------------------- */
  ctx.beginPath(); ctx.arc(c0.sx, c0.sy, glassR * z, 0, Math.PI * 2);
  ctx.fillStyle = '#E9E2D2'; ctx.fill();

  /* 3. storefront ring ------------------------------------------------------------ */
  for (let i = 0; i < layout.placements.length; i += 1) {
    const p = layout.placements[i];
    const e = st.entries[i];
    if (p === undefined || e === undefined) continue;
    drawStorefront(ctx, st, i, p, e, P);
  }

  /* 4. marble concourse ----------------------------------------------------------- */
  if (st.floorLayer !== null) {
    const ext = st.floorLayer.extent;
    const tl = P(spec.centerX - ext / 2, spec.centerY - ext / 2);
    ctx.drawImage(st.floorLayer.image, tl.sx, tl.sy, ext * z, ext * z);
  } else {
    // loading state: flat champagne band so the layout is already readable
    ctx.beginPath();
    ctx.arc(c0.sx, c0.sy, radius * z, spec.startAngle, spec.startAngle + spec.sweep);
    ctx.strokeStyle = '#EFE5D2'; ctx.lineWidth = spec.walkwayWidth * z; ctx.stroke();
  }

  drawSunWash(ctx, st, c0.sx, c0.sy, radius, half);
  drawNeonSpeculars(ctx, st);

  /* 5. atrium overlook ------------------------------------------------------------ */
  drawAtrium(ctx, st, c0.sx, c0.sy, (radius - half) * z);

  /* 6. glass curtain wall --------------------------------------------------------- */
  drawGlassWall(ctx, st, c0.sx, c0.sy, glassR * z);

  /* 7. ceiling beams -------------------------------------------------------------- */
  const beams = beamAngles(spec);
  for (const a of beams) {
    const a0 = P(spec.centerX + Math.cos(a) * (radius - half - 0.5), spec.centerY + Math.sin(a) * (radius - half - 0.5));
    const a1 = P(spec.centerX + Math.cos(a) * (radius + half + 0.5), spec.centerY + Math.sin(a) * (radius + half + 0.5));
    ctx.strokeStyle = rgba('#2B1E1A', 0.07); ctx.lineWidth = 0.6 * z;
    ctx.beginPath(); ctx.moveTo(a0.sx, a0.sy); ctx.lineTo(a1.sx, a1.sy); ctx.stroke();
    ctx.strokeStyle = rgba(BRASS, 0.55); ctx.lineWidth = 0.16 * z;
    ctx.beginPath(); ctx.moveTo(a0.sx, a0.sy); ctx.lineTo(a1.sx, a1.sy); ctx.stroke();
  }

  /* 8. landmarks + billboards ----------------------------------------------------- */
  const lm = landmarkPositions(spec, radius);
  drawElevatorCore(ctx, P(lm.elevator.x, lm.elevator.y), z, lm.elevator.angle, st);
  const billboards: Array<{ sy: number; draw: () => void }> = [];
  const cp = P(lm.centerpiece.x, lm.centerpiece.y);
  billboards.push({ sy: cp.sy, draw: () => drawCenterpiece(ctx, cp.sx, cp.sy, z, t, st.skybox.sky) });

  const slots = BANNER_ROTATION.slots;
  for (let s = 0; s < slots; s += 1) {
    const bt = (s + 0.5) / slots;
    const bp = concourseToWorld(spec, radius, 0.1 + bt * 0.8, -half + 0.9);
    const sp = P(bp.x, bp.y);
    const promo = bannerAt(st.banners, BANNER_ROTATION, s, st.timeMs);
    const phase = (st.timeMs % BANNER_ROTATION.intervalMs) / BANNER_ROTATION.intervalMs;
    billboards.push({ sy: sp.sy, draw: () => drawBanner(ctx, sp.sx, sp.sy, z, promo, Math.min(1, phase * 8), t + s) });
  }
  billboards.sort((a, b) => a.sy - b.sy);
  for (const b of billboards) b.draw();

  /* 9. day/night grade ------------------------------------------------------------ */
  ctx.fillStyle = rgba(st.skybox.sky.tint, st.skybox.sky.tintAlpha);
  ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(20,12,10,${0.28 + 0.2 * st.skybox.sky.lamplight})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // lamps sit on top of the grade so night does not dim them
  for (const L of defaultLightPools(spec, radius)) {
    const lp = P(L.x, L.y);
    drawChandelier(ctx, lp.sx, lp.sy - 3.2 * z, z, st.skybox.sky.lamplight, t);
  }

  ctx.restore();
}

export function beamAngles(spec: ConcourseSpec): number[] {
  const n = 9;
  return Array.from({ length: n }, (_, i) => spec.startAngle + spec.sweep * ((i + 0.5) / n));
}

/* ───────────────────────── storefronts ───────────────────────── */

function drawStorefront(
  ctx: Ctx, st: SceneState, i: number,
  p: FloorLayout['placements'][number], e: DirectoryEntry,
  P: (x: number, y: number) => { sx: number; sy: number },
): void {
  const z = st.camera.zoom;
  const { sx, sy } = P(p.x, p.y);
  const w = Math.max(1.4, p.frontage - 0.35) * z;
  const d = STORE_DEPTH * Math.max(0.55, Math.min(1, p.scale + 0.15)) * z;
  const base = FACADES[i % FACADES.length] as string;
  const blocked = e.status === 'not-deliverable';
  const hover = st.hoverIndex === i;
  const lit = 0.25 + 0.75 * st.skybox.sky.lamplight;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.facing - Math.PI / 2);

  // body behind the facade line (local +y points to the walkway)
  ctx.fillStyle = base;
  ctx.fillRect(-w / 2, -d, w, d);
  // interior glow through the shopfront
  const glow = ctx.createLinearGradient(0, -d * 0.9, 0, -d * 0.2);
  glow.addColorStop(0, rgba('#FFE2A8', 0.0));
  glow.addColorStop(1, rgba('#FFD58A', 0.6 * lit));
  ctx.fillStyle = glow;
  ctx.fillRect(-w / 2 + w * 0.08, -d * 0.9, w * 0.84, d * 0.7);
  // glazing + brass mullions just behind the sign band
  ctx.fillStyle = rgba('#CFE6F0', 0.2);
  ctx.fillRect(-w / 2 + w * 0.08, -d * 0.58, w * 0.84, d * 0.38);
  ctx.strokeStyle = BRASS; ctx.lineWidth = Math.max(0.6, 0.12 * z);
  ctx.strokeRect(-w / 2 + w * 0.08, -d * 0.58, w * 0.84, d * 0.38);
  ctx.fillStyle = rgba(BRASS_HI, 0.45);
  ctx.fillRect(-w * 0.1, -d * 0.58, w * 0.2, d * 0.38);
  // sign band along the entrance edge
  ctx.fillStyle = rgba('#1A110E', 0.86);
  ctx.fillRect(-w / 2, -d * 0.2, w, d * 0.2);
  ctx.strokeStyle = BRASS; ctx.strokeRect(-w / 2, -d * 0.2, w, d * 0.2);

  if (st.skybox.neon > 0.04 && !blocked) {
    const col = NEON[i % NEON.length] as string;
    ctx.strokeStyle = rgba(col, 0.22 * st.skybox.neon); ctx.lineWidth = Math.max(2, 0.5 * z);
    ctx.strokeRect(-w / 2 - 1, -d * 0.2 - 1, w + 2, d * 0.2 + 2);
    ctx.strokeStyle = rgba(col, 0.95 * st.skybox.neon); ctx.lineWidth = Math.max(1, 0.12 * z);
    ctx.strokeRect(-w / 2, -d * 0.2, w, d * 0.2);
  }

  // store name, upright and fitted to the sign band
  ctx.save();
  ctx.translate(0, -d * 0.1);
  if (Math.cos(p.facing - Math.PI / 2) < 0) ctx.rotate(Math.PI);
  fitText(ctx, e.store.name.toUpperCase(), w * 0.92, Math.max(5, d * 0.14), IVORY, '600', 'Georgia, serif');
  ctx.restore();

  if (blocked) {
    ctx.fillStyle = 'rgba(70,66,62,0.68)';
    ctx.fillRect(-w / 2, -d, w, d);
    drawRibbon(ctx, w, d, st.pincode, z, Math.cos(p.facing - Math.PI / 2) < 0);
  }
  if (hover) { ctx.strokeStyle = BRASS_HI; ctx.lineWidth = 2.2; ctx.strokeRect(-w / 2 - 1, -d - 1, w + 2, d + 2); }
  ctx.restore();
}

function drawRibbon(ctx: Ctx, w: number, d: number, pincode: Pincode | null, z: number, flip: boolean): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(-w / 2, -d, w, d); ctx.clip();
  ctx.translate(0, -d * 0.55);
  if (flip) ctx.rotate(Math.PI);
  ctx.rotate(-0.3);
  const bandH = Math.max(10, d * 0.4);
  ctx.fillStyle = '#58111A';
  ctx.fillRect(-w, -bandH / 2, w * 2, bandH);
  ctx.strokeStyle = BRASS; ctx.lineWidth = Math.max(0.5, 0.08 * z);
  ctx.beginPath(); ctx.moveTo(-w, -bandH / 2); ctx.lineTo(w, -bandH / 2); ctx.moveTo(-w, bandH / 2); ctx.lineTo(w, bandH / 2); ctx.stroke();
  const maxW = w * 1.05;
  const line1 = 'DOES NOT DELIVER';
  const line2 = pincode === null ? '' : `TO ${pincode}`;
  ctx.save(); ctx.translate(0, line2 === '' ? 0 : -bandH * 0.2);
  fitText(ctx, line1, maxW, bandH * 0.34, IVORY, '700', 'Georgia, serif'); ctx.restore();
  if (line2 !== '') { ctx.save(); ctx.translate(0, bandH * 0.22); fitText(ctx, line2, maxW, bandH * 0.34, BRASS_HI, '700', 'Georgia, serif'); ctx.restore(); }
  ctx.restore();
}

function fitText(ctx: Ctx, text: string, maxW: number, size: number, color: string, weight: string, family: string): void {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  const wMeasured = ctx.measureText(text).width;
  if (wMeasured > maxW) px = Math.max(3, px * (maxW / wMeasured));
  ctx.font = `${weight} ${px}px ${family}`;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
}

/* ───────────────────────── atrium & glass ───────────────────────── */

function drawAtrium(ctx: Ctx, st: SceneState, cx: number, cy: number, r: number): void {
  const z = st.camera.zoom;
  const t = st.timeMs / 1000;
  ctx.save();
  // brass balustrade
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = st.floorId === 1 ? '#CFC6B4' : '#9A948A'; ctx.fill();
  const inner = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  inner.addColorStop(0, rgba('#FFFFFF', st.floorId === 1 ? 0.35 : 0.12));
  inner.addColorStop(1, rgba('#2B1E1A', st.floorId === 1 ? 0.18 : 0.42));
  ctx.fillStyle = inner; ctx.fill();
  ctx.lineWidth = 0.35 * z; ctx.strokeStyle = BRASS; ctx.stroke();
  ctx.lineWidth = 0.1 * z; ctx.strokeStyle = BRASS_HI;
  ctx.beginPath(); ctx.arc(cx, cy, r - 0.5 * z, 0, Math.PI * 2); ctx.stroke();
  const posts = Math.max(24, Math.floor(r / (1.1 * z) * 2));
  ctx.fillStyle = BRASS;
  for (let k = 0; k < posts; k += 1) {
    const a = (k / posts) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.17 * z, 0, Math.PI * 2); ctx.fill();
  }
  // ground-floor fountain: functional waterfall (Floor 1), seen below on other floors
  const fr = r * 0.46;
  ctx.globalAlpha = st.floorId === 1 ? 1 : 0.55;
  ctx.beginPath(); ctx.arc(cx, cy, fr, 0, Math.PI * 2);
  ctx.fillStyle = '#7ED3E6'; ctx.fill();
  ctx.lineWidth = 0.5 * z; ctx.strokeStyle = '#D9C49A'; ctx.stroke();
  for (let k = 0; k < 4; k += 1) {
    const rr = ((t * 0.35 + k / 4) % 1) * fr;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = rgba('#FFFFFF', (1 - rr / fr) * 0.6); ctx.lineWidth = 0.12 * z; ctx.stroke();
  }
  // tiers + falling water
  for (const [rad, col] of [[0.55, '#B8A178'], [0.34, '#CDB98F'], [0.15, '#E3D3AA']] as const) {
    ctx.beginPath(); ctx.arc(cx, cy, fr * rad, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 0.18 * z; ctx.strokeStyle = '#7A5230'; ctx.stroke();
  }
  ctx.strokeStyle = rgba('#FFFFFF', 0.75); ctx.lineWidth = 0.1 * z;
  for (let k = 0; k < 28; k += 1) {
    const a = (k / 28) * Math.PI * 2;
    const flow = ((t * 1.6 + k * 0.137) % 1);
    const r0 = fr * (0.55 - flow * 0.0);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0 * 0.98, cy + Math.sin(a) * r0 * 0.98);
    ctx.lineTo(cx + Math.cos(a) * (r0 + fr * 0.14 * flow), cy + Math.sin(a) * (r0 + fr * 0.14 * flow));
    ctx.stroke();
  }
  // plume
  ctx.fillStyle = rgba('#FFFFFF', 0.85);
  for (let k = 0; k < 10; k += 1) {
    const h = ((t * 1.2 + k * 0.1) % 1);
    ctx.beginPath(); ctx.arc(cx + Math.sin(k * 2.1 + t) * fr * 0.05, cy - h * fr * 0.45, (1 - h) * 0.28 * z + 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawGlassWall(ctx: Ctx, st: SceneState, cx: number, cy: number, r: number): void {
  const z = st.camera.zoom;
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.01);
  g.addColorStop(0, rgba('#BFE6F2', 0.0));
  g.addColorStop(1, rgba('#BFE6F2', 0.5 * (0.35 + 0.65 * st.skybox.sky.daylight)));
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.arc(cx, cy, r - 1.6 * z, 0, Math.PI * 2, true);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 0.22 * z; ctx.strokeStyle = BRASS;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 1.6 * z, 0, Math.PI * 2); ctx.stroke();
  // mullions between floor-to-ceiling panes
  const n = Math.max(48, Math.round((r / z) * 1.7));
  ctx.lineWidth = 0.12 * z; ctx.strokeStyle = rgba('#7A5230', 0.9);
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 1.6 * z), cy + Math.sin(a) * (r - 1.6 * z));
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  drawFacadeLights(ctx, st, cx, cy, r);
  // sun/moon glint sweeping across the glass
  const a = (st.timeMs / 60000) * Math.PI * 2;
  const gx = cx + Math.cos(a) * r, gy = cy + Math.sin(a) * r;
  const glint = ctx.createRadialGradient(gx, gy, 0, gx, gy, 6 * z);
  glint.addColorStop(0, rgba('#FFFFFF', 0.55)); glint.addColorStop(1, rgba('#FFFFFF', 0));
  ctx.fillStyle = glint; ctx.fillRect(gx - 6 * z, gy - 6 * z, 12 * z, 12 * z);
  ctx.restore();
}

/* ───────────────────────── landmarks & sprites ───────────────────────── */

function drawElevatorCore(ctx: Ctx, p: { sx: number; sy: number }, z: number, angle: number, st: SceneState): void {
  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.rotate(angle);
  const w = 8 * z, h = 6 * z;
  ctx.fillStyle = '#3B2A22'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = BRASS; ctx.lineWidth = 0.25 * z; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = rgba(BRASS_HI, 0.85);
  for (const dx of [-1.9, 0.1]) ctx.fillRect(dx * z, -h / 2 - 0.1 * z, 1.8 * z, 0.5 * z);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = IVORY; ctx.font = `600 ${Math.max(8, 0.9 * z)}px Georgia, serif`; ctx.textAlign = 'center';
  ctx.fillText(`ELEVATOR · FLOOR ${st.floorId}`, p.sx, p.sy + 5.2 * z);
  ctx.restore();
}

function drawCenterpiece(ctx: Ctx, sx: number, sy: number, z: number, t: number, sky: SkyState): void {
  ctx.save();
  // rich wood panelling behind the sculpture
  const pw = 15 * z, ph = 15 * z, px = sx - pw / 2, py = sy - ph + 1.2 * z;
  ctx.fillStyle = '#3A2718'; ctx.fillRect(px, py, pw, ph);
  for (let c = 0; c < 3; c += 1) {
    const cw = pw / 3 - 0.9 * z, cx0 = px + 0.45 * z + c * (pw / 3);
    ctx.fillStyle = '#5A4029'; ctx.fillRect(cx0, py + 1.6 * z, cw, ph - 3 * z);
    ctx.strokeStyle = rgba(BRASS, 0.8); ctx.lineWidth = 0.1 * z; ctx.strokeRect(cx0, py + 1.6 * z, cw, ph - 3 * z);
    ctx.strokeStyle = rgba('#2B1E1A', 0.5); ctx.strokeRect(cx0 + 0.4 * z, py + 2.1 * z, cw - 0.8 * z, ph - 4 * z);
  }
  ctx.fillStyle = '#2B1E1A'; ctx.fillRect(px - 0.4 * z, py - 0.5 * z, pw + 0.8 * z, 1.2 * z);
  ctx.fillStyle = BRASS; ctx.fillRect(px - 0.4 * z, py + 0.7 * z, pw + 0.8 * z, 0.25 * z);
  // plinth
  ctx.fillStyle = '#4A3322'; ctx.beginPath(); ctx.ellipse(sx, sy, 5.2 * z, 3.1 * z, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = BRASS; ctx.lineWidth = 0.25 * z; ctx.stroke();
  ctx.fillStyle = '#775533'; ctx.beginPath(); ctx.ellipse(sx, sy, 3.6 * z, 2.1 * z, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(BRASS_HI, 0.6); ctx.stroke();
  // gilded kinetic mobile rising up-screen
  const top = sy - 11 * z;
  ctx.strokeStyle = BRASS; ctx.lineWidth = 0.28 * z;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, top); ctx.stroke();
  const gold = ctx.createLinearGradient(sx - 4 * z, 0, sx + 4 * z, 0);
  gold.addColorStop(0, '#9A6B22'); gold.addColorStop(0.5, '#F4DC96'); gold.addColorStop(1, '#B58230');
  const rings = [{ ry: 4.4, rx: 1.4, y: 0.30, s: 0.7 }, { ry: 3.6, rx: 1.2, y: 0.55, s: -1.0 }, { ry: 2.6, rx: 0.9, y: 0.78, s: 1.5 }];
  for (const r of rings) {
    const cy = sy - 11 * z + (sy - top) * r.y;
    const ang = t * r.s;
    ctx.save(); ctx.translate(sx, cy); ctx.rotate(Math.sin(ang) * 0.35);
    ctx.strokeStyle = gold; ctx.lineWidth = 0.75 * z;
    ctx.beginPath(); ctx.ellipse(0, 0, r.ry * z * Math.abs(Math.cos(ang * 0.8)) + 0.4 * z, r.rx * z + 0.9 * z, 0, 0, Math.PI * 2); ctx.stroke();
    const ox = Math.cos(ang * 1.4) * r.ry * z, oy = Math.sin(ang * 1.4) * r.rx * z;
    const orb = ctx.createRadialGradient(ox - 0.3 * z, oy - 0.3 * z, 0, ox, oy, 0.9 * z);
    orb.addColorStop(0, '#FFF4C8'); orb.addColorStop(1, '#B07A22');
    ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(ox, oy, 0.85 * z, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  const glow = ctx.createRadialGradient(sx, sy - 6 * z, 0, sx, sy - 6 * z, 9 * z);
  glow.addColorStop(0, rgba('#FFE9A8', 0.28 * (0.4 + sky.lamplight))); glow.addColorStop(1, rgba('#FFE9A8', 0));
  ctx.fillStyle = glow; ctx.fillRect(sx - 9 * z, sy - 15 * z, 18 * z, 18 * z);
  ctx.restore();
}

function wrapWords(ctx: Ctx, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const trial = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(trial).width <= maxW || line === '') line = trial;
    else { out.push(line); line = word; }
  }
  if (line !== '') out.push(line);
  return out;
}

function drawBanner(ctx: Ctx, sx: number, sy: number, z: number, promo: BannerPromo | null, fade: number, sway: number): void {
  const w = 3.3 * z, h = 8.2 * z;
  const x = sx - w / 2, y = sy - h;
  ctx.save();
  ctx.translate(sx, y);
  ctx.rotate(Math.sin(sway * 0.9) * 0.012);
  ctx.translate(-sx, -y);
  // brass hanging bar + cords
  ctx.fillStyle = BRASS; ctx.fillRect(x - 0.25 * z, y - 0.35 * z, w + 0.5 * z, 0.4 * z);
  ctx.strokeStyle = BRASS; ctx.lineWidth = 0.1 * z;
  ctx.beginPath(); ctx.moveTo(x + w * 0.2, y - 0.35 * z); ctx.lineTo(x + w * 0.2, y - 3 * z); ctx.moveTo(x + w * 0.8, y - 0.35 * z); ctx.lineTo(x + w * 0.8, y - 3 * z); ctx.stroke();
  // fabric with pennant tail
  const fab = ctx.createLinearGradient(x, y, x + w, y);
  fab.addColorStop(0, '#6E1A28'); fab.addColorStop(0.5, '#8E2638'); fab.addColorStop(1, '#58111A');
  ctx.fillStyle = fab;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(sx, y + h - 0.9 * z); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = BRASS; ctx.lineWidth = 0.14 * z; ctx.stroke();
  ctx.strokeStyle = rgba(BRASS_HI, 0.55); ctx.lineWidth = 0.07 * z; ctx.strokeRect(x + 0.3 * z, y + 0.3 * z, w - 0.6 * z, h - 1.6 * z);
  if (promo !== null) {
    ctx.globalAlpha = 0.15 + 0.85 * fade;
    ctx.fillStyle = IVORY; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const fs = Math.max(6, 0.72 * z);
    ctx.font = `700 ${fs}px Georgia, serif`;
    const lines = wrapWords(ctx, promo.promo.headline, w * 0.82);
    lines.slice(0, 7).forEach((ln, k) => ctx.fillText(ln, sx, y + 0.9 * z + k * fs * 1.2));
    ctx.save(); ctx.translate(sx, y + h - 2.1 * z); fitText(ctx, 'SAMPLE', w * 0.8, Math.max(5, 0.5 * z), BRASS_HI, '600', 'Georgia, serif'); ctx.restore();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawChandelier(ctx: Ctx, sx: number, sy: number, z: number, lamp: number, t: number): void {
  const glowR = (2.6 + lamp * 3.4) * z;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
  g.addColorStop(0, rgba('#FFE7A6', 0.5 + 0.35 * lamp)); g.addColorStop(1, rgba('#FFE7A6', 0));
  ctx.fillStyle = g; ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
  ctx.save(); ctx.translate(sx, sy);
  ctx.strokeStyle = BRASS; ctx.fillStyle = BRASS; ctx.lineWidth = 0.14 * z;
  const arms = 8;
  for (let k = 0; k < arms; k += 1) {
    const a = (k / arms) * Math.PI * 2 + Math.sin(t * 0.3) * 0.02;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 0.95 * z, Math.sin(a) * 0.42 * z); ctx.stroke();
    ctx.beginPath(); ctx.arc(Math.cos(a) * 0.95 * z, Math.sin(a) * 0.42 * z, 0.16 * z, 0, Math.PI * 2);
    ctx.fillStyle = lamp > 0.3 ? '#FFF0BF' : BRASS; ctx.fill();
  }
  ctx.fillStyle = BRASS_HI; ctx.beginPath(); ctx.arc(0, 0, 0.3 * z, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ───────────────────────── seasonal / diurnal passes ───────────────────────── */

/** Soft daylight diffusing across the marble, tinted by season. Off at night. */
function drawSunWash(ctx: Ctx, st: SceneState, cx: number, cy: number, radius: number, half: number): void {
  const day = st.skybox.sky.daylight;
  if (day < 0.04) return;
  const z = st.camera.zoom;
  const tone = SUN[st.skybox.season];
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = `rgba(${tone},${(0.16 * day).toFixed(3)})`;
  ctx.lineWidth = 3.2 * z;
  ctx.beginPath(); ctx.arc(cx, cy, (radius + half - 1.6) * z, st.spec.startAngle, st.spec.startAngle + st.spec.sweep); ctx.stroke();
  ctx.strokeStyle = `rgba(${tone},${(0.1 * day).toFixed(3)})`;
  ctx.lineWidth = 6.5 * z;
  ctx.beginPath(); ctx.arc(cx, cy, (radius + half - 3.2) * z, st.spec.startAngle, st.spec.startAngle + st.spec.sweep); ctx.stroke();
  ctx.restore();
}

/** At night each lit storefront throws a soft coloured glow onto the polished floor. */
function drawNeonSpeculars(ctx: Ctx, st: SceneState): void {
  const neon = st.skybox.neon;
  if (neon < 0.04) return;
  const z = st.camera.zoom;
  const margin = 80;
  ctx.save();
  for (let i = 0; i < st.layout.placements.length; i += 1) {
    const p = st.layout.placements[i];
    const e = st.entries[i];
    if (p === undefined || e === undefined || e.status === 'not-deliverable') continue;
    const sp = worldToScreen(st.camera, st.width, st.height, p.x + Math.cos(p.facing) * 2.2, p.y + Math.sin(p.facing) * 2.2);
    if (sp.sx < -margin || sp.sx > st.width + margin || sp.sy < -margin || sp.sy > st.height + margin) continue;
    const r = Math.max(2.4, p.frontage * 0.85) * z;
    const g = ctx.createRadialGradient(sp.sx, sp.sy, 0, sp.sx, sp.sy, r);
    const col = NEON[i % NEON.length] as string;
    g.addColorStop(0, rgba(col, 0.26 * neon)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(sp.sx - r, sp.sy - r, r * 2, r * 2);
  }
  ctx.restore();
}

/** Illuminated facade along the glass wall at night; red/green/gold string lights in the holiday season. */
function drawFacadeLights(ctx: Ctx, st: SceneState, cx: number, cy: number, r: number): void {
  const neon = st.skybox.neon;
  if (neon < 0.04) return;
  const z = st.camera.zoom;
  const t = st.timeMs / 1000;
  const n = Math.max(72, Math.round((r / z) * 1.5));
  const holiday = st.skybox.holidayLights;
  const palette = holiday ? ['#FF4D4D', '#FFD36B', '#4DFF88', '#FFFFFF'] : ['#FFD58A'];
  ctx.save();
  for (let c = 0; c < palette.length; c += 1) {
    ctx.fillStyle = palette[c] as string;
    ctx.beginPath();
    for (let k = c; k < n; k += palette.length) {
      const a = (k / n) * Math.PI * 2;
      const tw = holiday ? 0.55 + 0.45 * Math.sin(t * 2.4 + k * 1.7) : 1;
      ctx.globalAlpha = Math.min(1, neon * tw * 0.95);
      const x = cx + Math.cos(a) * (r - 0.8 * z); const y = cy + Math.sin(a) * (r - 0.8 * z);
      ctx.moveTo(x + 0.28 * z, y); ctx.arc(x, y, Math.max(1.2, 0.28 * z), 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
