/** Renders the kiosk large on a plain background for comparison against image_721660.png. */
import { writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { drawPhotoboothKiosk } from '../src/scene/floor7Art';
const c = createCanvas(735, 750); const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
ctx.fillStyle = '#F7F7F7'; ctx.fillRect(0, 0, 735, 750);
drawPhotoboothKiosk(ctx, 367, 640, 735 / 8.6 * 0.88, 0.3, false);
writeFileSync('/tmp/kiosk.png', (c as unknown as { toBuffer(m: string): Buffer }).toBuffer('image/png'));
