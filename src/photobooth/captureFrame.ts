import type { StripCanvas, StripFrame } from '../utils/photostripGenerator';

export interface VideoLike { readonly videoWidth: number; readonly videoHeight: number; readonly readyState: number }

function defaultCanvas(w: number, h: number): StripCanvas {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/**
 * Copy the current video frame into its own canvas. Mirrored by default, like a real booth mirror,
 * so what you see in the viewfinder is what you get. Throws if the camera has not produced a frame yet.
 */
export function captureVideoFrame(video: (VideoLike & CanvasImageSource) | null, mirror = true, createCanvas: (w: number, h: number) => StripCanvas = defaultCanvas): StripFrame {
  if (video === null || video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) throw new Error('The camera is not ready yet.');
  const w = video.videoWidth; const h = video.videoHeight;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (ctx === null) throw new Error('2D canvas is not available.');
  if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, w, h);
  return { source: canvas as unknown as CanvasImageSource, width: w, height: h };
}
