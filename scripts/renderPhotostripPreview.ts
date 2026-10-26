/** Renders a full photostrip from the avatar-pose fallback so the filmstrip design can be inspected. */
import { writeFileSync } from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { Resvg } from '@resvg/resvg-js';
import { DEFAULT_AVATAR } from '../src/avatar/config';
import { AVATAR_POSES, avatarPoseSvg, drawAvatarFrame, FRAME_W, FRAME_H } from '../src/photobooth/avatarFrames';
import { generatePhotostrip, type StripCanvas, type StripFrame } from '../src/utils/photostripGenerator';

async function main(): Promise<void> {
  const frames: StripFrame[] = [];
  for (let i = 0; i < AVATAR_POSES.length; i += 1) {
    const png = new Resvg(avatarPoseSvg(DEFAULT_AVATAR, i), { fitTo: { mode: 'height', value: 800 } }).render().asPng();
    const img = await loadImage(png);
    const c = createCanvas(FRAME_W, FRAME_H);
    drawAvatarFrame(c.getContext('2d') as unknown as CanvasRenderingContext2D, img as unknown as CanvasImageSource, i);
    frames.push({ source: c as unknown as CanvasImageSource, width: FRAME_W, height: FRAME_H });
  }
  const strip = generatePhotostrip(frames, { scale: Number(process.argv[3] ?? 1), date: new Date('2026-10-24T18:12:00'), createCanvas: (w, h) => createCanvas(w, h) as unknown as StripCanvas });
  writeFileSync(process.argv[2] ?? '/tmp/strip.png', (strip as unknown as { toBuffer(m: string): Buffer }).toBuffer('image/png'));
  writeFileSync('/tmp/strip.txt', `${strip.width}x${strip.height}`);
}
main().then(() => process.exit(0), (e) => { writeFileSync('/tmp/strip.txt', `ERROR ${String(e)}`); process.exit(1); });
