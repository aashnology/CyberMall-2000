/**
 * Fallback for visitors who deny (or cannot grant) camera access: four posed frames of their own
 * customised chibi avatar, staged against the booth's burgundy curtain.
 */

import { renderAvatarSvg, AVATAR_VIEWBOX } from '../avatar/renderAvatar';
import type { AvatarConfig, Pose } from '../avatar/config';

export const FRAME_W = 600;
export const FRAME_H = 450;

/** Four distinct poses: front, mid-stride, mid-stride mirrored, turned the other way. */
export const AVATAR_POSES: readonly Pose[] = [
  { phase: 0, walking: false, facing: 'right' },
  { phase: 0.25, walking: true, facing: 'right' },
  { phase: 0.75, walking: true, facing: 'left' },
  { phase: 0, walking: false, facing: 'left' },
];
/** Per-pose tilt (radians) and scale so the four frames feel like four different moments. */
const POSE_FRAMING: ReadonlyArray<{ rot: number; scale: number; dx: number }> = [
  { rot: 0, scale: 1, dx: 0 }, { rot: -0.05, scale: 1.04, dx: -14 }, { rot: 0.06, scale: 1.04, dx: 14 }, { rot: 0.02, scale: 0.98, dx: 0 },
];

export function avatarPoseSvg(config: AvatarConfig, index: number): string {
  const pose = AVATAR_POSES[index];
  if (pose === undefined) throw new RangeError(`pose index ${index} out of range`);
  return renderAvatarSvg(config, pose, `pb${index}`);
}

/** Paint one booth frame around an already-rasterised avatar image. */
export function drawAvatarFrame(ctx: CanvasRenderingContext2D, avatar: CanvasImageSource, index: number, w = FRAME_W, h = FRAME_H): void {
  const f = POSE_FRAMING[index];
  if (f === undefined) throw new RangeError(`pose index ${index} out of range`);
  // curtain backdrop
  const bg = ctx.createLinearGradient(0, 0, w, 0);
  bg.addColorStop(0, '#4C060D'); bg.addColorStop(0.5, '#710912'); bg.addColorStop(1, '#4C060D');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 6;
  for (let x = 20; x < w; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 8, h * 0.35, x - 8, h * 0.65, x, h); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(239,229,210,0.12)'; ctx.lineWidth = 2;
  for (let x = 43; x < w; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x - 6, h * 0.35, x + 6, h * 0.65, x, h); ctx.stroke(); }
  // spotlight + floor
  const spot = ctx.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, h * 0.8);
  spot.addColorStop(0, 'rgba(241,213,140,0.5)'); spot.addColorStop(1, 'rgba(241,213,140,0)');
  ctx.fillStyle = spot; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#EFE5D2'; ctx.fillRect(0, h * 0.86, w, h * 0.14);
  ctx.fillStyle = '#C28D39'; ctx.fillRect(0, h * 0.86, w, 4);
  // gold sparkles
  ctx.fillStyle = 'rgba(241,213,140,0.85)';
  for (const [sx, sy, r] of [[70, 70, 5], [530, 90, 4], [110, 250, 3], [500, 280, 4], [300, 40, 3]] as const) { ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); }
  // the avatar
  const ah = h * 0.9 * f.scale; const aw = ah * (AVATAR_VIEWBOX.width / AVATAR_VIEWBOX.height);
  ctx.save();
  ctx.translate(w / 2 + f.dx, h * 0.93); ctx.rotate(f.rot);
  ctx.drawImage(avatar, -aw / 2, -ah, aw, ah);
  ctx.restore();
}

/** Browser-only: rasterise an SVG string to an image. */
export function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not draw the avatar')); };
    img.src = url;
  });
}
