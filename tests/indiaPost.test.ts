import { describe, it, expect } from 'vitest';
import { parseCsv, parseIndiaPostCsv, PincodeDirectory, auditZone, haversineKm } from '../src/data/indiaPost';
import type { ZoneDefinition } from '../src/data/pincodeZones';

// Hand-written FIXTURE in the official column layout. Not real India Post data.
const CSV = [
  'circlename,regionname,divisionname,officename,pincode,officetype,delivery,district,statename,latitude,longitude',
  'Maharashtra Circle,Mumbai,Mumbai West,"Andheri West S.O",400058,S.O,Delivery,Mumbai,MAHARASHTRA,19.12,72.83',
  'Maharashtra Circle,Mumbai,Mumbai West,"Versova, B.O",400058,B.O,Non Delivery,Mumbai,MAHARASHTRA,19.13,72.81',
  'Maharashtra Circle,Mumbai,Mumbai South,Fort S.O,400001,S.O,Delivery,Mumbai,MAHARASHTRA,18.93,72.83',
  'Delhi Circle,Delhi,New Delhi,Connaught Place S.O,110001,S.O,Delivery,New Delhi,DELHI,NA,NA',
  'Karnataka Circle,Bangalore,Bangalore South,Koramangala S.O,560034,S.O,Non Delivery,Bangalore,KARNATAKA,12.93,77.62',
  'Bad,Row,,Nowhere,12,S.O,Delivery,X,Y,0,0',
].join('\r\n');

const zone = (pincodes: string[], expectedDistricts: string[]): ZoneDefinition => ({
  id: 't', label: 't', city: 'Mumbai', expectedDistricts, pincodes, provenance: 'seed-unverified',
});

describe('parseCsv', () => {
  it('handles quotes, embedded commas, escaped quotes and CRLF', () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,2,3\n')).toEqual([['a', 'b,c', 'd "e"'], ['1', '2', '3']]);
  });
});

describe('parseIndiaPostCsv', () => {
  const rows = parseIndiaPostCsv(CSV);
  it('drops malformed pincodes and maps columns', () => {
    expect(rows).toHaveLength(5);
    expect(rows[1]?.officeName).toBe('Versova, B.O');
    expect(rows[1]?.delivers).toBe(false);
  });
  it('treats NA coordinates as null', () => {
    expect(rows[3]?.lat).toBeNull();
    expect(rows[0]?.lat).toBeCloseTo(19.12);
  });
  it('rejects a CSV without the required columns', () => {
    expect(() => parseIndiaPostCsv('a,b\n1,2')).toThrow(/missing columns/);
  });
});

describe('PincodeDirectory', () => {
  const dir = new PincodeDirectory(parseIndiaPostCsv(CSV));
  it('averages office coordinates into a centroid and measures real distance', () => {
    expect(dir.centroid('400058')?.lat).toBeCloseTo(19.125);
    expect(dir.centroid('110001')).toBeNull();
    const km = dir.distanceKm('400058', '400001');
    expect(km).not.toBeNull();
    expect(km!).toBeGreaterThan(15);
    expect(km!).toBeLessThan(25);
    expect(dir.distanceKm('400058', '110001')).toBeNull();
  });
  it('haversine sanity: Mumbai–Delhi ≈ 1150 km', () => {
    expect(haversineKm({ lat: 19.076, lng: 72.8777 }, { lat: 28.6139, lng: 77.209 })).toBeGreaterThan(1100);
    expect(haversineKm({ lat: 19.076, lng: 72.8777 }, { lat: 28.6139, lng: 77.209 })).toBeLessThan(1200);
  });
});

describe('auditZone', () => {
  const dir = new PincodeDirectory(parseIndiaPostCsv(CSV));
  it('reports unknown PINs, district mismatches and non-delivery PINs separately', () => {
    const a = auditZone(zone(['400058', '400001', '400099', '110001', '560034'], ['Mumbai']), dir);
    expect(a.unknownPins).toEqual(['400099']);
    expect(a.districtMismatches.map((m) => m.pincode)).toEqual(['110001', '560034']);
    expect(a.nonDelivery).toEqual(['560034']);
    expect(a.clean).toBe(false);
  });
  it('a PIN with at least one delivery office is not flagged, and a matching zone is clean', () => {
    const a = auditZone(zone(['400058', '400001'], ['mumbai']), dir);
    expect(a).toMatchObject({ unknownPins: [], districtMismatches: [], nonDelivery: [], clean: true });
  });
});
