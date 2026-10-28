/**
 * Delivery-zone graph.
 *
 * Zones are named clusters of PIN codes used to build each store's
 * `serviceablePincodes`. Zone membership shipped here is a SEED that has not
 * been checked against India Post data (`provenance: 'seed-unverified'`).
 * Run `auditZones()` (see ./indiaPost.ts) against the official All-India
 * Pincode Directory CSV, fix what it reports, then flip `provenance` to
 * 'india-post-verified'. Nothing downstream should present unverified zones
 * as authoritative.
 */

import { parsePincode } from '../engine/pincode';

/** Inclusive numeric range of PINs as six-digit strings. */
export function pincodeRange(start: number, end: number): string[] {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
    throw new RangeError(`Invalid PIN range ${start}-${end}`);
  }
  const out: string[] = [];
  for (let p = start; p <= end; p += 1) out.push(String(p));
  return out;
}

/** Merge into one de-duplicated, sorted list. */
export function mergeZones(...zones: ReadonlyArray<readonly string[]>): string[] {
  return [...new Set(zones.flat())].sort();
}

export type Provenance = 'seed-unverified' | 'india-post-verified';

export interface ZoneDefinition {
  readonly id: string;
  readonly label: string;
  readonly city: 'Mumbai' | 'Delhi' | 'Bengaluru';
  /** District name India Post is expected to list for these PINs (used by auditZones). */
  readonly expectedDistricts: readonly string[];
  readonly pincodes: readonly string[];
  readonly provenance: Provenance;
}

const seed = (z: Omit<ZoneDefinition, 'provenance'>): ZoneDefinition => ({ ...z, provenance: 'seed-unverified' });

export const ZONE_DEFINITIONS = [
  seed({
    id: 'mumbai-western-suburbs',
    label: 'Western Suburbs, Mumbai',
    city: 'Mumbai',
    expectedDistricts: ['Mumbai', 'Mumbai Suburban'],
    pincodes: pincodeRange(400049, 400069),
  }),
  seed({
    id: 'mumbai-south',
    label: 'South Mumbai',
    city: 'Mumbai',
    expectedDistricts: ['Mumbai'],
    pincodes: mergeZones(pincodeRange(400001, 400008), ['400018', '400020', '400021', '400026', '400030', '400034']),
  }),
  seed({
    id: 'delhi-central',
    label: 'Central Delhi',
    city: 'Delhi',
    expectedDistricts: ['Central Delhi', 'New Delhi'],
    pincodes: mergeZones(pincodeRange(110001, 110006), ['110011', '110021']),
  }),
  seed({
    id: 'delhi-south',
    label: 'South Delhi',
    city: 'Delhi',
    expectedDistricts: ['South Delhi', 'New Delhi', 'South West Delhi'],
    pincodes: ['110016', '110017', '110024', '110048', '110049'],
  }),
  seed({
    id: 'bengaluru-cbd',
    label: 'Central Bengaluru',
    city: 'Bengaluru',
    expectedDistricts: ['Bangalore', 'Bengaluru Urban', 'Bangalore Urban'],
    pincodes: mergeZones(pincodeRange(560001, 560008), ['560025']),
  }),
  seed({
    id: 'bengaluru-orr-tech-corridor',
    label: 'Outer Ring Road Tech Corridor, Bengaluru',
    city: 'Bengaluru',
    expectedDistricts: ['Bangalore', 'Bengaluru Urban', 'Bangalore Urban'],
    pincodes: ['560037', '560087', '560102', '560103'],
  }),
  seed({
    id: 'bengaluru-whitefield',
    label: 'Whitefield Tech Corridor, Bengaluru',
    city: 'Bengaluru',
    expectedDistricts: ['Bangalore', 'Bengaluru Urban', 'Bangalore Urban'],
    pincodes: ['560048', '560066', '560067'],
  }),
  seed({
    id: 'bengaluru-electronic-city',
    label: 'Electronic City Tech Corridor, Bengaluru',
    city: 'Bengaluru',
    expectedDistricts: ['Bangalore', 'Bengaluru Urban', 'Bangalore Urban'],
    pincodes: ['560099', '560100'],
  }),
  seed({
    id: 'bengaluru-koramangala',
    label: 'Koramangala–HSR, Bengaluru',
    city: 'Bengaluru',
    expectedDistricts: ['Bangalore', 'Bengaluru Urban', 'Bangalore Urban'],
    pincodes: ['560034', '560095', '560102'],
  }),
] as const satisfies readonly ZoneDefinition[];

export type ZoneId = (typeof ZONE_DEFINITIONS)[number]['id'];

const byId = new Map<string, ZoneDefinition>(ZONE_DEFINITIONS.map((z) => [z.id, z]));

export function getZone(id: ZoneId): ZoneDefinition {
  const z = byId.get(id);
  if (z === undefined) throw new Error(`Unknown zone ${id}`);
  return z;
}

/** Union of several zones' pincodes: the usual way to fill `serviceablePincodes`. */
export function pincodesFor(...ids: readonly ZoneId[]): string[] {
  return mergeZones(...ids.map((id) => getZone(id).pincodes));
}

/** Named bundles for catalog authoring. */
export const ZONE_BUNDLES = {
  MUMBAI_ALL: ['mumbai-western-suburbs', 'mumbai-south'],
  DELHI_ALL: ['delhi-central', 'delhi-south'],
  BENGALURU_ALL: [
    'bengaluru-cbd',
    'bengaluru-orr-tech-corridor',
    'bengaluru-whitefield',
    'bengaluru-electronic-city',
    'bengaluru-koramangala',
  ],
  PAN_METRO: [
    'mumbai-western-suburbs', 'mumbai-south', 'delhi-central', 'delhi-south',
    'bengaluru-cbd', 'bengaluru-orr-tech-corridor', 'bengaluru-whitefield',
    'bengaluru-electronic-city', 'bengaluru-koramangala',
  ],
} as const satisfies Record<string, readonly ZoneId[]>;

/** Which zones contain this PIN (a PIN may legitimately sit in overlapping zones). */
export function zonesContaining(pincode: string): ZoneDefinition[] {
  return ZONE_DEFINITIONS.filter((z) => z.pincodes.includes(pincode));
}

/** Structural self-check, run in CI: valid PINs, no duplicates inside a zone, unique ids. */
export function validateZones(zones: readonly ZoneDefinition[] = ZONE_DEFINITIONS): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const z of zones) {
    if (ids.has(z.id)) problems.push(`${z.id}: duplicate zone id`);
    ids.add(z.id);
    if (z.pincodes.length === 0) problems.push(`${z.id}: empty zone`);
    if (new Set(z.pincodes).size !== z.pincodes.length) problems.push(`${z.id}: duplicate pincodes`);
    for (const p of z.pincodes) if (!parsePincode(p).ok) problems.push(`${z.id}: malformed pincode ${p}`);
  }
  return problems;
}
