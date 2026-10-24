import { describe, it, expect } from 'vitest';
import { SAMPLE_CATALOG } from '../src/data/catalog.sample';
import { validateCatalog, buildDirectory, parsePincode } from '../src/engine/pincode';
import { floorForWellnessSubcategory } from '../src/data/wellnessPartition';
import { FLOOR_IDS, type Pincode } from '../src/data/types';

const pin = (s: string): Pincode => { const r = parsePincode(s); if (!r.ok) throw new Error(s); return r.pincode; };

describe('sample catalog', () => {
  it('is structurally valid with unique ids and names per floor', () => {
    expect(validateCatalog(SAMPLE_CATALOG)).toEqual([]);
    for (const f of FLOOR_IDS) {
      const names = SAMPLE_CATALOG.filter((s) => s.floorId === f).map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
  it('fills every floor except 6 (built from media snapshots) and keeps Floor 1 dense (>25)', () => {
    for (const f of FLOOR_IDS) {
      const n = SAMPLE_CATALOG.filter((s) => s.floorId === f).length;
      if (f === 6) expect(n).toBe(0); else expect(n).toBeGreaterThan(0);
    }
    expect(SAMPLE_CATALOG.filter((s) => s.floorId === 1).length).toBeGreaterThan(25);
  });
  it('respects the Floor 5 / Floor 9 partition rule', () => {
    for (const s of SAMPLE_CATALOG) {
      if (s.floorId === 5 || s.floorId === 9) expect(floorForWellnessSubcategory(s.subcategory)).toBe(s.floorId);
    }
  });
  it('different pincodes give genuinely different directories, and no pincode serves everything', () => {
    const sets = ['400058', '400001', '110001', '560034'].map((p) => {
      const d = buildDirectory(SAMPLE_CATALOG, { pincode: pin(p), onlyDeliverable: true });
      return new Set(FLOOR_IDS.flatMap((f) => d.byFloor[f].map((e) => e.store.id)));
    });
    for (let i = 0; i < sets.length; i += 1) {
      expect(sets[i]!.size).toBeGreaterThan(0);
      expect(sets[i]!.size).toBeLessThan(SAMPLE_CATALOG.length);
      for (let j = i + 1; j < sets.length; j += 1) expect([...sets[i]!].sort()).not.toEqual([...sets[j]!].sort());
    }
  });
  it('has featured promos for banners', () => {
    expect(SAMPLE_CATALOG.filter((s) => s.promo !== undefined).length).toBeGreaterThanOrEqual(8);
  });
});
