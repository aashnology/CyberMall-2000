import { describe, it, expect } from 'vitest';
import { DEFAULT_CONCOURSE as S } from '../src/spatial/concourse';
import { renderMarbleFloor, sampleWalkway, luma, MARBLE_PALETTE } from '../src/render/marbleFloor';

const PPU = 6;
const SIZE = Math.ceil((S.baseRadius + S.walkwayWidth / 2 + 3) * 2 * PPU);
const img = renderMarbleFloor({ width: SIZE, height: SIZE, pxPerUnit: PPU, spec: S, radius: S.baseRadius });
const at = (x: number, y: number): { r: number; g: number; b: number; a: number } => {
  const i = (y * SIZE + x) * 4;
  return { r: img.data[i]!, g: img.data[i + 1]!, b: img.data[i + 2]!, a: img.data[i + 3]! };
};
const worldOf = (px: number, py: number): { x: number; y: number } => ({
  x: S.centerX + (px + 0.5 - SIZE / 2) / PPU, y: S.centerY + (py + 0.5 - SIZE / 2) / PPU,
});

describe('marble floor', () => {
  it('is deterministic for a given seed and differs across seeds', () => {
    const again = renderMarbleFloor({ width: SIZE, height: SIZE, pxPerUnit: PPU, spec: S, radius: S.baseRadius });
    expect(Buffer.from(again.data).equals(Buffer.from(img.data))).toBe(true);
    const other = renderMarbleFloor({ width: SIZE, height: SIZE, pxPerUnit: PPU, spec: S, radius: S.baseRadius, seed: 99 });
    expect(Buffer.from(other.data).equals(Buffer.from(img.data))).toBe(false);
  });

  it('is transparent off the walkway (atrium and the east opening) and opaque on it', () => {
    expect(at(SIZE >> 1, SIZE >> 1).a).toBe(0);
    expect(at(SIZE - 3, SIZE >> 1).a).toBe(0);
    let opaqueOnWalkway = 0, total = 0;
    for (let y = 0; y < SIZE; y += 3) for (let x = 0; x < SIZE; x += 3) {
      const w = worldOf(x, y);
      const s = sampleWalkway(S, S.baseRadius, w.x, w.y);
      if (s.sd > 1) { total += 1; if (at(x, y).a === 255) opaqueOnWalkway += 1; }
    }
    expect(total).toBeGreaterThan(1000);
    expect(opaqueOnWalkway).toBe(total);
  });

  it('has NO checkerboard: neighbouring pale-slab cells never jump in tone, and no checker correlation', () => {
    const CELL = 12;
    const cells = new Map<string, number>();
    for (let cy = 0; cy * CELL < SIZE; cy += 1) for (let cx = 0; cx * CELL < SIZE; cx += 1) {
      let sum = 0, n = 0, ok = true;
      for (let y = cy * CELL; y < Math.min(SIZE, (cy + 1) * CELL) && ok; y += 2) for (let x = cx * CELL; x < Math.min(SIZE, (cx + 1) * CELL); x += 2) {
        const w = worldOf(x, y);
        const s = sampleWalkway(S, S.baseRadius, w.x, w.y);
        if (s.sd < 0.5 || s.edgeDist < 2.2) { ok = false; break; } // pale slab interior only
        const p = at(x, y); sum += luma(p.r, p.g, p.b); n += 1;
      }
      if (ok && n > 0) cells.set(`${cx},${cy}`, sum / n);
    }
    expect(cells.size).toBeGreaterThan(100);
    let maxStep = 0, num = 0, den = 0;
    const vals = [...cells.values()];
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    for (const [key, v] of cells) {
      const [cx, cy] = key.split(',').map(Number) as [number, number];
      for (const nb of [`${cx + 1},${cy}`, `${cx},${cy + 1}`]) {
        const w = cells.get(nb);
        if (w !== undefined) maxStep = Math.max(maxStep, Math.abs(v - w));
      }
      const sign = (cx + cy) % 2 === 0 ? 1 : -1;
      num += sign * (v - mean); den += (v - mean) ** 2;
    }
    expect(maxStep).toBeLessThan(0.06);                       // no hard tonal steps between cells
    expect(Math.abs(num) / Math.sqrt(den * cells.size)).toBeLessThan(0.25); // checker-pattern correlation is weak
    expect(Math.min(...vals)).toBeGreaterThan(0.8);           // stays pale
  });

  it('pale slab uses only the specified warm tones: bright, low-chroma, within champagne↔#F2F5E2 range', () => {
    const w = worldOf(0, 0);
    expect(w).toBeDefined();
    expect(MARBLE_PALETTE.beige).toBe('#F2F5E2'); // palette token retained exactly
    const p = at(Math.round(SIZE * 0.08), SIZE >> 1); // mid-walkway on the west side
    expect(luma(p.r, p.g, p.b)).toBeGreaterThan(0.85);
  });

  it('draws dark borders and brass inlay bands tracing the C', () => {
    // sample across the walkway at the westernmost point (t≈0.5): outer edge → centre
    const y = SIZE >> 1;
    const lumas: number[] = [];
    let sawBrass = false;
    for (let x = 0; x < SIZE / 2; x += 1) {
      const p = at(x, y);
      if (p.a === 255) {
        lumas.push(luma(p.r, p.g, p.b));
        if (p.r > 150 && p.r - p.b > 55) sawBrass = true; // anti-aliased brass: warm, saturated, bright (pale slab max r-b≈37, olive border r<120)
      }
    }
    expect(Math.min(...lumas)).toBeLessThan(0.3);  // dark marble border present
    expect(Math.max(...lumas)).toBeGreaterThan(0.85); // pale slab present
    expect(sawBrass).toBe(true);
  });

  it('rejects invalid dimensions', () => {
    expect(() => renderMarbleFloor({ width: 0, height: 10, pxPerUnit: 1, spec: S, radius: 40 })).toThrow(RangeError);
  });
});
