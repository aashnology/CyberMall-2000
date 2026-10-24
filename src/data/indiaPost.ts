/**
 * India Post directory ingestion and zone auditing.
 *
 * Feed it the official "All India Pincode Directory" CSV (data.gov.in).
 * Expected columns (case-insensitive): officename, pincode, officetype,
 * delivery, district, statename, latitude, longitude. Extra columns are ignored.
 */

import type { ZoneDefinition } from './pincodeZones';
import { parsePincode } from '../engine/pincode';

export interface PostOffice {
  readonly officeName: string;
  readonly pincode: string;
  readonly district: string;
  readonly state: string;
  /** null when the source says NA or the value is not a finite coordinate. */
  readonly lat: number | null;
  readonly lng: number | null;
  readonly delivers: boolean;
}

/** RFC-4180-style CSV parser (quotes, escaped quotes, CRLF). Small and dependency-free. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

function coord(raw: string | undefined, lo: number, hi: number): number | null {
  if (raw === undefined) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n >= lo && n <= hi && raw.trim() !== '' ? n : null;
}

export function parseIndiaPostCsv(text: string): PostOffice[] {
  const [header, ...body] = parseCsv(text);
  if (header === undefined) return [];
  const col = new Map(header.map((h, i) => [h.trim().toLowerCase(), i] as const));
  const need = ['officename', 'pincode', 'district', 'statename'];
  const missing = need.filter((n) => !col.has(n));
  if (missing.length > 0) throw new Error(`India Post CSV is missing columns: ${missing.join(', ')}`);
  const get = (r: string[], name: string): string => (r[col.get(name) ?? -1] ?? '').trim();

  const out: PostOffice[] = [];
  for (const r of body) {
    const pin = get(r, 'pincode');
    if (!parsePincode(pin).ok) continue;
    // Real coordinates in India lie roughly within lat 6–38, lng 68–98.
    out.push({
      officeName: get(r, 'officename'),
      pincode: pin,
      district: get(r, 'district'),
      state: get(r, 'statename'),
      lat: coord(r[col.get('latitude') ?? -1], 6, 38),
      lng: coord(r[col.get('longitude') ?? -1], 68, 98),
      delivers: col.has('delivery') ? get(r, 'delivery').toLowerCase() === 'delivery' : true,
    });
  }
  return out;
}

/* ───────────────────── Directory + distance ───────────────────── */

export interface Centroid { readonly lat: number; readonly lng: number }

export class PincodeDirectory {
  private readonly offices = new Map<string, PostOffice[]>();
  private readonly centroids = new Map<string, Centroid>();

  constructor(rows: readonly PostOffice[]) {
    for (const r of rows) {
      const list = this.offices.get(r.pincode);
      if (list === undefined) this.offices.set(r.pincode, [r]);
      else list.push(r);
    }
    for (const [pin, list] of this.offices) {
      const pts = list.filter((o): o is PostOffice & { lat: number; lng: number } => o.lat !== null && o.lng !== null);
      if (pts.length > 0) {
        this.centroids.set(pin, {
          lat: pts.reduce((s, o) => s + o.lat, 0) / pts.length,
          lng: pts.reduce((s, o) => s + o.lng, 0) / pts.length,
        });
      }
    }
  }

  has(pincode: string): boolean { return this.offices.has(pincode); }
  officesFor(pincode: string): readonly PostOffice[] { return this.offices.get(pincode) ?? []; }
  centroid(pincode: string): Centroid | null { return this.centroids.get(pincode) ?? null; }
  get size(): number { return this.offices.size; }

  /** Great-circle km between two PIN centroids, or null if either has no coordinates. */
  distanceKm(a: string, b: string): number | null {
    const ca = this.centroid(a);
    const cb = this.centroid(b);
    return ca === null || cb === null ? null : haversineKm(ca, cb);
  }
}

export function haversineKm(a: Centroid, b: Centroid): number {
  const R = 6371.0088;
  const rad = (d: number): number => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ───────────────────── Zone audit ───────────────────── */

export interface ZoneAudit {
  readonly zoneId: string;
  /** PINs in the zone that do not exist in the directory at all. */
  readonly unknownPins: readonly string[];
  /** PINs that exist but whose district is not in the zone's expectedDistricts. */
  readonly districtMismatches: readonly { readonly pincode: string; readonly districts: readonly string[] }[];
  /** PINs that exist but have no delivery post office. */
  readonly nonDelivery: readonly string[];
  readonly clean: boolean;
}

const norm = (s: string): string => s.trim().toLowerCase();

export function auditZone(zone: ZoneDefinition, dir: PincodeDirectory): ZoneAudit {
  const expected = new Set(zone.expectedDistricts.map(norm));
  const unknownPins: string[] = [];
  const districtMismatches: { pincode: string; districts: string[] }[] = [];
  const nonDelivery: string[] = [];

  for (const pin of zone.pincodes) {
    if (!dir.has(pin)) { unknownPins.push(pin); continue; }
    const offices = dir.officesFor(pin);
    const districts = [...new Set(offices.map((o) => o.district))];
    if (!districts.some((d) => expected.has(norm(d)))) districtMismatches.push({ pincode: pin, districts });
    if (!offices.some((o) => o.delivers)) nonDelivery.push(pin);
  }
  return {
    zoneId: zone.id,
    unknownPins,
    districtMismatches,
    nonDelivery,
    clean: unknownPins.length === 0 && districtMismatches.length === 0 && nonDelivery.length === 0,
  };
}

export function auditZones(zones: readonly ZoneDefinition[], dir: PincodeDirectory): ZoneAudit[] {
  return zones.map((z) => auditZone(z, dir));
}
