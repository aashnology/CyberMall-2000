import { describe, it, expect } from 'vitest';
import { parsePincode, buildDirectory, deliveryStatus, validateCatalog, ribbonText } from '../src/engine/pincode';
import { mergeZones, pincodeRange, pincodesFor, validateZones, zonesContaining, ZONE_DEFINITIONS, ZONE_BUNDLES } from '../src/data/pincodeZones';

const ZONES = {
  MUMBAI_WEST: pincodesFor('mumbai-western-suburbs'),
  MUMBAI_SOUTH: pincodesFor('mumbai-south'),
  DELHI_CENTRAL: pincodesFor('delhi-central'),
  BANGALORE_CENTRAL: pincodesFor(...ZONE_BUNDLES.BENGALURU_ALL),
};
import type { Pincode, Store, FloorId } from '../src/data/types';
import { FLOOR_IDS } from '../src/data/types';

const pin = (raw: string): Pincode => {
  const r = parsePincode(raw);
  if (!r.ok) throw new Error(`bad test pin ${raw}`);
  return r.pincode;
};

const mk = (id: string, floorId: FloorId, pins: readonly string[]): Store => ({
  id, name: id, floorId, subcategory: 'test', serviceablePincodes: pins,
});

describe('parsePincode', () => {
  it('accepts six digits and strips whitespace', () => {
    expect(parsePincode('400058')).toEqual({ ok: true, pincode: '400058' });
    expect(parsePincode(' 400 058 ')).toEqual({ ok: true, pincode: '400058' });
  });
  it.each([
    ['', 'empty'], ['   ', 'empty'], ['40005', 'incomplete'], ['4000581', 'too-long'],
    ['40005a', 'non-numeric'], ['-40005', 'non-numeric'], ['012345', 'invalid-leading-digit'],
  ])('rejects %j as %s', (raw, reason) => {
    expect(parsePincode(raw)).toEqual({ ok: false, reason });
  });
});

describe('zones', () => {
  it('builds inclusive zero-padded ranges and rejects bad ones', () => {
    expect(pincodeRange(400001, 400003)).toEqual(['400001', '400002', '400003']);
    expect(() => pincodeRange(5, 1)).toThrow(RangeError);
  });
  it('passes the structural self-check and ships as unverified seed data', () => {
    expect(validateZones()).toEqual([]);
    expect(ZONE_DEFINITIONS.every((z) => z.provenance === 'seed-unverified')).toBe(true);
  });
  it('catches malformed zones', () => {
    const bad = [{ ...ZONE_DEFINITIONS[0], id: 'x', pincodes: ['12', '400058', '400058'] }, { ...ZONE_DEFINITIONS[1], id: 'x', pincodes: [] }];
    const msgs = validateZones(bad);
    expect(msgs).toContain('x: malformed pincode 12');
    expect(msgs).toContain('x: duplicate pincodes');
    expect(msgs).toContain('x: duplicate zone id');
    expect(msgs).toContain('x: empty zone');
  });
  it('the cited demo PIN 400058 is in the Western Suburbs zone only', () => {
    expect(zonesContaining('400058').map((z) => z.id)).toEqual(['mumbai-western-suburbs']);
  });
  it('Mumbai, Delhi and Bengaluru bundles never share a PIN across cities', () => {
    const m = new Set(pincodesFor(...ZONE_BUNDLES.MUMBAI_ALL));
    const d = new Set(pincodesFor(...ZONE_BUNDLES.DELHI_ALL));
    const b = new Set(pincodesFor(...ZONE_BUNDLES.BENGALURU_ALL));
    for (const p of m) { expect(d.has(p)).toBe(false); expect(b.has(p)).toBe(false); }
    for (const p of d) expect(b.has(p)).toBe(false);
  });
  it('mergeZones de-duplicates', () => {
    expect(mergeZones(['400001', '400002'], ['400002'])).toEqual(['400001', '400002']);
  });
});

describe('buildDirectory: the "fake filtering" regression', () => {
  const stores: Store[] = [
    mk('west-only', 1, ZONES.MUMBAI_WEST),
    mk('south-only', 1, ZONES.MUMBAI_SOUTH),
    mk('both-mumbai', 2, mergeZones(ZONES.MUMBAI_WEST, ZONES.MUMBAI_SOUTH)),
    mk('delhi-only', 8, ZONES.DELHI_CENTRAL),
    mk('blr-only', 9, ZONES.BANGALORE_CENTRAL),
  ];

  it('different pincodes produce different directories', () => {
    const west = buildDirectory(stores, { pincode: pin('400058'), onlyDeliverable: true });
    const south = buildDirectory(stores, { pincode: pin('400001'), onlyDeliverable: true });
    const delhi = buildDirectory(stores, { pincode: pin('110001'), onlyDeliverable: true });
    const ids = (d: typeof west): string[] => FLOOR_IDS.flatMap((f) => d.byFloor[f].map((e) => e.store.id));
    expect(ids(west)).toEqual(['west-only', 'both-mumbai']);
    expect(ids(south)).toEqual(['south-only', 'both-mumbai']);
    expect(ids(delhi)).toEqual(['delhi-only']);
  });

  it('greys out instead of hiding when the checkbox is off, with the exact ribbon copy', () => {
    const d = buildDirectory(stores, { pincode: pin('400058'), onlyDeliverable: false });
    expect(d.totals).toEqual({ all: 5, delivering: 2, notDelivering: 3, unknown: 0, hidden: 0 });
    const south = d.byFloor[1].find((e) => e.store.id === 'south-only');
    expect(south?.status).toBe('not-deliverable');
    expect(south?.ribbon).toBe('DOES NOT DELIVER TO 400058');
    expect(south?.ribbon).toBe(ribbonText(pin('400058')));
    expect(d.byFloor[1].find((e) => e.store.id === 'west-only')?.ribbon).toBeNull();
  });

  it('hides and counts non-deliverable stores when the checkbox is on', () => {
    const d = buildDirectory(stores, { pincode: pin('400058'), onlyDeliverable: true });
    expect(d.totals.hidden).toBe(3);
    expect(d.totals.all).toBe(5);
    expect(d.byFloor[8]).toHaveLength(0);
  });

  it('with no pincode: nothing is hidden or ribboned, even with the checkbox on', () => {
    const d = buildDirectory(stores, { pincode: null, onlyDeliverable: true });
    expect(d.totals).toEqual({ all: 5, delivering: 0, notDelivering: 0, unknown: 5, hidden: 0 });
    for (const f of FLOOR_IDS) for (const e of d.byFloor[f]) {
      expect(e.status).toBe('unknown');
      expect(e.ribbon).toBeNull();
    }
  });

  it('never truncates: 500 stores on one floor all appear, in catalog order', () => {
    const many = Array.from({ length: 500 }, (_, i) => mk(`s${i}`, 7, ['400058']));
    const d = buildDirectory(many, { pincode: pin('400058'), onlyDeliverable: true });
    expect(d.byFloor[7]).toHaveLength(500);
    expect(d.byFloor[7].map((e) => e.store.id)).toEqual(many.map((s) => s.id));
  });

  it('keeps stable order when only the pincode changes (no storefront shuffling)', () => {
    const order = (p: string): string[] =>
      buildDirectory(stores, { pincode: pin(p), onlyDeliverable: false }).byFloor[1].map((e) => e.store.id);
    expect(order('400058')).toEqual(order('110001'));
  });

  it('deliveryStatus matches exact pincodes only (no prefix matching)', () => {
    const s = mk('x', 1, ['400058']);
    expect(deliveryStatus(s, pin('400058'))).toBe('delivers');
    expect(deliveryStatus(s, pin('400059'))).toBe('not-deliverable');
    expect(deliveryStatus(s, null)).toBe('unknown');
  });
});

describe('validateCatalog', () => {
  it('passes a clean catalog', () => {
    expect(validateCatalog([mk('a', 1, ['400058']), mk('b', 2, ['110001'])])).toEqual([]);
  });
  it('reports every problem', () => {
    const issues = validateCatalog([
      mk('a', 1, ['400058']),
      mk('a', 1, ['400058']),
      mk('empty', 3, []),
      mk('bad', 4, ['4000', '400058', '400058']),
      { ...mk('floor', 1, ['400058']), floorId: 10 as unknown as FloorId },
    ]);
    const msgs = issues.map((i) => `${i.storeId}:${i.message}`);
    expect(msgs).toContain('a:duplicate store id');
    expect(msgs).toContain('empty:serviceablePincodes is empty');
    expect(msgs).toContain('bad:malformed pincode "4000"');
    expect(msgs).toContain('bad:duplicate pincodes in serviceablePincodes');
    expect(msgs).toContain('floor:unknown floor 10');
  });
});
