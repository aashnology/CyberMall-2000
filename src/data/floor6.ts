/**
 * Floor 6 "Theatre and OTT" storefronts. Not subject to delivery filtering (you watch, not receive):
 * entries carry status 'unknown' so no ribbon is ever drawn. Built from snapshot fixtures.
 */
import type { DirectoryEntry } from '../engine/pincode';
import type { Pincode, Store } from './types';
import { nearestTheatres, OTT_PLATFORMS, THEATRES, type NearestResult, type Theatre } from './mediaSnapshots';
import type { PincodeDirectory } from './indiaPost';

export interface Floor6Model {
  readonly entries: readonly DirectoryEntry[];
  readonly nearest: NearestResult;
}

const virtual = (id: string, name: string, subcategory: string, merchantUrl?: string): Store => ({
  id, name, floorId: 6, subcategory, serviceablePincodes: [], ...(merchantUrl === undefined ? {} : { merchantUrl }),
});

export function buildFloor6(
  pincode: Pincode | null,
  directory: PincodeDirectory | null = null,
  theatreLimit = 5,
  theatres: readonly Theatre[] = THEATRES,
): Floor6Model {
  const nearest: NearestResult = pincode === null
    ? { basis: 'pin-similarity', ranked: theatres.slice(0, theatreLimit).map((t) => ({ theatre: t, score: 0 })) }
    : nearestTheatres(pincode, theatres, directory, theatreLimit);
  const theatreEntries = nearest.ranked.map((r): DirectoryEntry => ({
    store: virtual(r.theatre.id, `${r.theatre.chain} ${r.theatre.locality}`, 'theatre'), status: 'unknown', ribbon: null,
  }));
  const ottEntries = OTT_PLATFORMS.map((p): DirectoryEntry => ({
    store: virtual(`ott-${p.id}`, p.name, 'ott', p.deepLink), status: 'unknown', ribbon: null,
  }));
  return { entries: [...theatreEntries, ...ottEntries], nearest };
}
