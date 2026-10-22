import * as THREE from 'three';

/** Ivory/cream checkerboard marble with fine terrazzo speckle, drawn once on a canvas. */
export function marbleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    for (let i = 0; i < 4; i++) { g.fillStyle = (i % 3 === 0) ? '#f4eee2' : '#e4d9c6'; g.fillRect((i % 2) * 128, Math.floor(i / 2) * 128, 128, 128); }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},${60},0.18)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    g.strokeStyle = 'rgba(120,100,80,0.25)'; g.strokeRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(11, 8); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
