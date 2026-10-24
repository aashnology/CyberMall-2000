import { describe, it, expect } from 'vitest';
import { THEATRES, FILMS, OTT_PLATFORMS, THEATRE_META, OTT_META, nearestTheatres } from '../src/data/mediaSnapshots';
import { parseIndiaPostCsv, PincodeDirectory } from '../src/data/indiaPost';
import { parsePincode, buildDirectory } from '../src/engine/pincode';
import { bannerAt, eligiblePromos, type BannerPromo } from '../src/engine/banners';
import { floorForWellnessSubcategory, repartitionWellness, normalizeSubcategory } from '../src/data/wellnessPartition';
import { FLOORS, type Pincode, type Store, type FloorId } from '../src/data/types';

const pin = (s: string): Pincode => { const r = parsePincode(s); if (!r.ok) throw new Error(s); return r.pincode; };
const store = (id: string, floorId: FloorId, subcategory: string, pins: string[] = ['400058'], promo?: Store['promo']): Store =>
  promo === undefined ? { id, name: id, floorId, subcategory, serviceablePincodes: pins }
    : { id, name: id, floorId, subcategory, serviceablePincodes: pins, promo };

describe('floor names (confirmed decisions)', () => {
  it('floors 5, 6 and 9 carry the confirmed names', () => {
    expect(FLOORS[5].name).toBe('Beauty, Cosmetics & Personal Grooming');
    expect(FLOORS[6].name).toBe('Theatre and OTT');
    expect(FLOORS[9].name).toBe('Pharmaceuticals, Clinical Wellness & Apothecaries');
  });
});

describe('Floor 6 fixtures', () => {
  it('are explicitly labelled as fixtures with a stated basis', () => {
    expect(THEATRE_META.isFixture).toBe(true);
    expect(OTT_META.isFixture).toBe(true);
    expect(THEATRE_META.basis.length).toBeGreaterThan(10);
  });
  it('every screening references a real film; times are valid and ascending; ids unique', () => {
    const films = new Set(FILMS.map((f) => f.id));
    expect(new Set(THEATRES.map((t) => t.id)).size).toBe(THEATRES.length);
    for (const t of THEATRES) {
      expect(parsePincode(t.pincode).ok).toBe(true);
      for (const s of t.screenings) {
        expect(films.has(s.filmId)).toBe(true);
        for (const time of s.times) expect(time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
        expect([...s.times].sort()).toEqual([...s.times]);
      }
    }
  });
  it('every OTT platform has titles and an https deep link; titles unique per platform', () => {
    for (const p of OTT_PLATFORMS) {
      expect(p.deepLink.startsWith('https://')).toBe(true);
      expect(p.hotAndTrending.length).toBeGreaterThan(0);
      expect(new Set(p.hotAndTrending.map((t) => t.id)).size).toBe(p.hotAndTrending.length);
    }
  });
});

describe('nearestTheatres', () => {
  it('without a directory it uses PIN similarity and says so', () => {
    const r = nearestTheatres(pin('400058'), THEATRES, null, 3);
    expect(r.basis).toBe('pin-similarity');
    expect(r.ranked[0]?.theatre.city).toBe('Mumbai');
    expect(r.ranked.every((x) => x.theatre.city === 'Mumbai')).toBe(true);
  });
  it('different cities give different nearest theatres', () => {
    const top = (p: string): string | undefined => nearestTheatres(pin(p), THEATRES, null, 1).ranked[0]?.theatre.city;
    expect(top('400058')).toBe('Mumbai');
    expect(top('110001')).toBe('Delhi');
    expect(top('560034')).toBe('Bengaluru');
  });
  it('uses real distance only when the PIN and ALL theatre PINs have coordinates', () => {
    const header = 'officename,pincode,delivery,district,statename,latitude,longitude';
    const rows = THEATRES.map((t, i) => `X${i},${t.pincode},Delivery,D,S,${19 + i * 0.01},${72 + i * 0.01}`);
    const full = new PincodeDirectory(parseIndiaPostCsv([header, 'H,400058,Delivery,D,S,19.0,72.0', ...rows].join('\n')));
    expect(nearestTheatres(pin('400058'), THEATRES, full, 2).basis).toBe('distance-km');
    const partial = new PincodeDirectory(parseIndiaPostCsv([header, 'H,400058,Delivery,D,S,19.0,72.0', ...rows.slice(1)].join('\n')));
    expect(nearestTheatres(pin('400058'), THEATRES, partial, 2).basis).toBe('pin-similarity');
  });
  it('limit 0 returns nothing and never throws', () => {
    expect(nearestTheatres(pin('400058'), THEATRES, null, 0).ranked).toEqual([]);
  });
});

describe('wellness partition (Floor 5 vs 9)', () => {
  it.each([
    ['Skincare', 5], ['Luxury Fragrance', null], ['perfume', 5], ['Hair Care', 5], ['Bath & Body', 5],
    ['Pharmacy', 9], ['OTC Medication', 9], ['Ayurvedic', 9], ['Diagnostics', 9], ['Vitamins', 9],
    ['wellness', null], ['ayurvedic skincare', null],
  ] as const)('%s → %s', (sub, floor) => expect(floorForWellnessSubcategory(sub)).toBe(floor));

  it('normalises punctuation and case', () => expect(normalizeSubcategory('  Bath & Body ')).toBe('bath-body'));

  it('moves misplaced stores, leaves ambiguous ones, and ignores other floors', () => {
    const input = [
      store('a', 5, 'pharmacy'), store('b', 9, 'skincare'), store('c', 5, 'skincare'),
      store('d', 9, 'wellness'), store('e', 1, 'pharmacy'),
    ];
    const r = repartitionWellness(input);
    expect(r.stores.map((s) => `${s.id}:${s.floorId}`)).toEqual(['a:9', 'b:5', 'c:5', 'd:9', 'e:1']);
    expect(r.moved).toEqual([{ storeId: 'a', from: 5, to: 9 }, { storeId: 'b', from: 9, to: 5 }]);
    expect(r.unclassified.map((s) => s.id)).toEqual(['d']);
    expect(input[0]?.floorId).toBe(5); // input not mutated
  });
});

describe('banners', () => {
  const P = (n: number): BannerPromo[] => Array.from({ length: n }, (_, i) => ({ storeId: `s${i}`, brand: `B${i}`, promo: { headline: `h${i}`, detail: 'd' } }));
  const rot = { slots: 4, intervalMs: 6000 };

  it('simultaneous slots are distinct when there are enough promos; deterministic', () => {
    for (const n of [4, 5, 7, 8, 13]) for (const tick of [0, 1, 2, 9]) {
      const ids = [0, 1, 2, 3].map((s) => bannerAt(P(n), rot, s, tick * rot.intervalMs)?.storeId);
      expect(new Set(ids).size).toBe(4);
      expect(ids).toEqual([0, 1, 2, 3].map((s) => bannerAt(P(n), rot, s, tick * rot.intervalMs)?.storeId));
    }
  });
  it('every promo appears within ceil(n/slots) ticks', () => {
    for (const n of [3, 4, 8, 9, 13]) {
      const seen = new Set<string>();
      for (let tick = 0; tick < Math.ceil(n / rot.slots); tick += 1) for (let s = 0; s < rot.slots; s += 1) {
        const b = bannerAt(P(n), rot, s, tick * rot.intervalMs); if (b) seen.add(b.storeId);
      }
      expect(seen.size).toBe(n);
    }
  });
  it('holds within an interval, handles empty lists and bad slots', () => {
    expect(bannerAt(P(5), rot, 1, 0)).toEqual(bannerAt(P(5), rot, 1, 5999));
    expect(bannerAt([], rot, 0, 0)).toBeNull();
    expect(() => bannerAt(P(5), rot, 4, 0)).toThrow(RangeError);
    expect(bannerAt(P(5), rot, 0, -50)?.storeId).toBe('s0');
  });
  it('never promotes a store that does not deliver to the active pincode', () => {
    const promo = { headline: 'x', detail: 'y' };
    const stores = [store('mum', 8, 'cafe', ['400058'], promo), store('del', 8, 'cafe', ['110001'], promo), store('nopromo', 8, 'cafe', ['400058'])];
    const d = buildDirectory(stores, { pincode: pin('400058'), onlyDeliverable: false });
    expect(eligiblePromos(d).map((p) => p.storeId)).toEqual(['mum']);
    const none = buildDirectory(stores, { pincode: null, onlyDeliverable: false });
    expect(eligiblePromos(none).map((p) => p.storeId)).toEqual(['mum', 'del']);
    expect(eligiblePromos(none, 1)).toHaveLength(1);
  });
});
