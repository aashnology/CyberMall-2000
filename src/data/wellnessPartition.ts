/**
 * Floor 5 vs Floor 9 partition rule (confirmed decision):
 *  - Floor 5  Beauty, Cosmetics & Personal Grooming: aesthetic focus.
 *  - Floor 9  Pharmaceuticals, Clinical Wellness & Apothecaries: medical / supplement / apothecary focus.
 *
 * The rule is keyed on a store's `subcategory` slug. Anything that does not map
 * cleanly (e.g. generic "wellness", "ayurvedic skincare") is reported as
 * unclassified for a human to decide; it is never guessed.
 */

import type { FloorId, Store } from './types';

export const BEAUTY_SUBCATEGORIES = [
  'skincare', 'fragrance', 'salon', 'makeup', 'haircare', 'bath-body', 'grooming',
] as const;

export const CLINICAL_SUBCATEGORIES = [
  'pharmacy', 'otc-medication', 'supplements', 'ayurveda', 'apothecary', 'diagnostics', 'first-aid',
] as const;

const SYNONYMS: Readonly<Record<string, string>> = {
  cosmetics: 'makeup',
  perfume: 'fragrance',
  perfumery: 'fragrance',
  spa: 'salon',
  'hair-care': 'haircare',
  'bath-and-body': 'bath-body',
  chemist: 'pharmacy',
  medical: 'pharmacy',
  vitamins: 'supplements',
  nutraceuticals: 'supplements',
  ayurvedic: 'ayurveda',
  'first-aid-supplies': 'first-aid',
  'diagnostic-lab': 'diagnostics',
};

const BEAUTY = new Set<string>(BEAUTY_SUBCATEGORIES);
const CLINICAL = new Set<string>(CLINICAL_SUBCATEGORIES);

export function normalizeSubcategory(raw: string): string {
  const slug = raw.trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return SYNONYMS[slug] ?? slug;
}

export function floorForWellnessSubcategory(raw: string): 5 | 9 | null {
  const slug = normalizeSubcategory(raw);
  if (BEAUTY.has(slug)) return 5;
  if (CLINICAL.has(slug)) return 9;
  return null;
}

export interface RepartitionResult {
  readonly stores: readonly Store[];
  readonly moved: readonly { readonly storeId: string; readonly from: FloorId; readonly to: 5 | 9 }[];
  /** Stores on floors 5/9 whose subcategory maps to neither wing. Left where they are. */
  readonly unclassified: readonly Store[];
}

/** Re-home every store currently on floor 5 or 9. Pure: returns a new array. */
export function repartitionWellness(stores: readonly Store[]): RepartitionResult {
  const moved: { storeId: string; from: FloorId; to: 5 | 9 }[] = [];
  const unclassified: Store[] = [];
  const out = stores.map((s) => {
    if (s.floorId !== 5 && s.floorId !== 9) return s;
    const target = floorForWellnessSubcategory(s.subcategory);
    if (target === null) { unclassified.push(s); return s; }
    if (target === s.floorId) return s;
    moved.push({ storeId: s.id, from: s.floorId, to: target });
    return { ...s, floorId: target };
  });
  return { stores: out, moved, unclassified };
}
