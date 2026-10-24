export interface Camera { readonly cx: number; readonly cy: number; readonly zoom: number }

export const MIN_ZOOM = 6;
export const MAX_ZOOM = 34;
export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function worldToScreen(cam: Camera, w: number, h: number, x: number, y: number): { sx: number; sy: number } {
  return { sx: w / 2 + (x - cam.cx) * cam.zoom, sy: h / 2 + (y - cam.cy) * cam.zoom };
}
export function screenToWorld(cam: Camera, w: number, h: number, sx: number, sy: number): { x: number; y: number } {
  return { x: cam.cx + (sx - w / 2) / cam.zoom, y: cam.cy + (sy - h / 2) / cam.zoom };
}
/** Zoom at which a circle of `worldRadius` fits the viewport. */
export function fitZoom(w: number, h: number, worldRadius: number): number {
  return clampZoomLoose((Math.min(w, h) / 2) / worldRadius);
}
const clampZoomLoose = (z: number): number => Math.max(1, z);
