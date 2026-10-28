/**
 * Floor 7 vs Floor 8 partition (confirmed decision):
 *  - Floor 7  Food Court and Arcade : Fast Food & Quick Bites (burgers, fries, pizza, quick-service counters).
 *  - Floor 8  Cafes                 : Fine Dining, Specialty Cafes & Bakeries.
 *
 * Keyed on a store's `subcategory`. A subcategory that maps to neither (for example a bare
 * "restaurant") is reported as unclassified for a human to decide; it is never guessed.
 */

import type { FloorId, Store } from './types';

export const FAST_FOOD_SUBCATEGORIES = [
  'burgers', 'fries', 'pizza', 'fried chicken', 'sandwiches', 'wraps', 'street food', 'quick-service',
] as const;

export const CAFE_FLOOR_SUBCATEGORIES = [
  'fine dining', 'specialty cafe', 'cafe', 'bakery', 'coffee roaster', 'tea room', 'patisserie', 'dessert parlour',
] as const;

const SYNONYMS: Readonly<Record<string, string>> = {
  burger: 'burgers', 'burger-joint': 'burgers', pizzeria: 'pizza', 'french-fries': 'fries', chips: 'fries',
  'fried-chicken': 'fried chicken', sandwich: 'sandwiches', wrap: 'wraps', 'fast-food': 'quick-service',
  qsr: 'quick-service', 'quick-bites': 'quick-service', 'quick-service': 'quick-service', 'street-food': 'street food',
  'fine-dining': 'fine dining', 'specialty-cafe': 'specialty cafe', 'speciality-cafe': 'specialty cafe', 'specialty-coffee': 'specialty cafe',
  bakehouse: 'bakery', bakeries: 'bakery', 'coffee-roaster': 'coffee roaster', roastery: 'coffee roaster', 'tea-room': 'tea room',
  'dessert-parlour': 'dessert parlour', 'dessert-parlor': 'dessert parlour', coffee: 'cafe', 'coffee-shop': 'cafe',
};

const FAST = new Set<string>(FAST_FOOD_SUBCATEGORIES);
const CAFE = new Set<string>(CAFE_FLOOR_SUBCATEGORIES);

export function normalizeFoodSubcategory(raw: string): string {
  const slug = raw.trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return SYNONYMS[slug] ?? slug.replace(/-/g, ' ');
}

export function floorForFoodSubcategory(raw: string): 7 | 8 | null {
  const n = normalizeFoodSubcategory(raw);
  if (FAST.has(n)) return 7;
  if (CAFE.has(n)) return 8;
  return null;
}

export interface FoodRepartition {
  readonly stores: readonly Store[];
  readonly moved: readonly { readonly storeId: string; readonly from: FloorId; readonly to: 7 | 8 }[];
  readonly unclassified: readonly Store[];
}

/** Re-home every store currently on floor 7 or 8. Pure: returns a new array. */
export function repartitionFood(stores: readonly Store[]): FoodRepartition {
  const moved: { storeId: string; from: FloorId; to: 7 | 8 }[] = [];
  const unclassified: Store[] = [];
  const out = stores.map((s) => {
    if (s.floorId !== 7 && s.floorId !== 8) return s;
    const target = floorForFoodSubcategory(s.subcategory);
    if (target === null) { unclassified.push(s); return s; }
    if (target === s.floorId) return s;
    moved.push({ storeId: s.id, from: s.floorId, to: target });
    return { ...s, floorId: target };
  });
  return { stores: out, moved, unclassified };
}
