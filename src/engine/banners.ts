/**
 * Hanging-banner rotation. Static promotional copy only (external ad feeds are paused).
 * Deterministic: the banner shown in a slot is a pure function of (promos, slot, elapsedMs),
 * so the 3D scene, tests and screenshots always agree.
 */

import type { DirectoryResult } from './pincode';
import { FLOOR_IDS, type Promo, type Store } from '../data/types';

export interface BannerPromo {
  readonly storeId: string;
  readonly brand: string;
  readonly promo: Promo;
}

/**
 * Featured promos for this visitor. Stores that do not deliver to the active
 * pincode are excluded so a banner never advertises something the visitor can't get.
 */
export function eligiblePromos(directory: DirectoryResult, limit = Number.POSITIVE_INFINITY): BannerPromo[] {
  const out: BannerPromo[] = [];
  for (const floorId of FLOOR_IDS) {
    for (const e of directory.byFloor[floorId]) {
      const s: Store = e.store;
      if (s.promo !== undefined && e.status !== 'not-deliverable') {
        out.push({ storeId: s.id, brand: s.name, promo: s.promo });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

export interface BannerRotation {
  readonly slots: number;
  readonly intervalMs: number;
}

/**
 * Which promo a slot shows at `elapsedMs`. Each tick the visible window advances by `slots`
 * consecutive promos, so simultaneously visible banners are distinct whenever promos.length >= slots,
 * and every promo appears on some banner within ceil(promos.length / slots) ticks.
 * (A given slot may see only a subset of promos when gcd(slots, promos.length) > 1.)
 * Returns null if there are no promos.
 */
export function bannerAt(
  promos: readonly BannerPromo[],
  rotation: BannerRotation,
  slot: number,
  elapsedMs: number,
): BannerPromo | null {
  const n = promos.length;
  if (n === 0) return null;
  if (!Number.isInteger(slot) || slot < 0 || slot >= rotation.slots) throw new RangeError(`slot ${slot} out of range`);
  if (rotation.intervalMs <= 0 || rotation.slots <= 0) throw new RangeError('Invalid BannerRotation');
  const tick = Math.floor(Math.max(0, elapsedMs) / rotation.intervalMs);
  return promos[(slot + tick * rotation.slots) % n] ?? null;
}
