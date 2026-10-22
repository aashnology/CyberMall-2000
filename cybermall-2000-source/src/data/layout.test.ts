import { describe, expect, it } from 'vitest';
import { BRANDS, FLOORS } from './catalog';
import { HALF_D, HALF_W, WING_ORDER, placeStores } from './layout';

describe('layout', () => {
  it('places every brand on the perimeter and clear of the elevator', () => {
    for (const { floor } of FLOORS) {
      const placed = placeStores(floor);
      expect(placed.length).toBe(BRANDS.filter((b) => b.floor === floor).length);
      for (const { slot } of placed) {
        expect(Math.abs(slot.x) === HALF_W || Math.abs(slot.z) === HALF_D).toBe(true);
        expect(slot.z > HALF_D - 4 && Math.abs(slot.x) < 5).toBe(false);
      }
    }
  });
  it('keeps each wing contiguous', () => {
    const order = WING_ORDER[1] ?? [];
    const idx = placeStores(1).map((p) => order.indexOf(p.brand.category));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
  it('gives every brand valid metadata', () => {
    for (const b of BRANDS) {
      expect(b.url.startsWith('https://')).toBe(true);
      expect(b.moods.length).toBeGreaterThan(0);
      expect([1, 2]).toContain(b.floor);
    }
  });
});
