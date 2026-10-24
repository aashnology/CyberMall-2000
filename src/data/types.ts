/**
 * Core domain types for CyberMall 2000 (v2).
 * Pure types + tiny constants only: no React, no DOM, no I/O.
 */

/** The nine floors of the mall, in elevator order. */
export const FLOOR_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type FloorId = (typeof FLOOR_IDS)[number];

export interface FloorDefinition {
  readonly id: FloorId;
  readonly name: string;
  /** Short plate text for the elevator button panel. */
  readonly plate: string;
}

/** Source of truth for floor naming. Matches the v2 spec's Dedicated Floor Directory. */
export const FLOORS: Readonly<Record<FloorId, FloorDefinition>> = {
  1: { id: 1, name: 'Apparel & Fashion', plate: 'APPAREL' },
  2: { id: 2, name: 'Books, Stationery & Media', plate: 'BOOKS' },
  3: { id: 3, name: 'Accessories & Fine Jewelry', plate: 'JEWELRY' },
  4: { id: 4, name: 'Specialty Hobby, Toys & Collectibles', plate: 'HOBBY' },
  5: { id: 5, name: 'Beauty, Cosmetics & Personal Grooming', plate: 'BEAUTY' },
  6: { id: 6, name: 'Theatre and OTT', plate: 'THEATRE' },
  7: { id: 7, name: 'Food Court', plate: 'FOOD' },
  8: { id: 8, name: 'Cafes', plate: 'CAFES' },
  9: { id: 9, name: 'Pharmaceuticals, Clinical Wellness & Apothecaries', plate: 'APOTHECARY' },
};

/** A validated six-digit Indian PIN code. Only `parsePincode` may mint one. */
export type Pincode = string & { readonly __brand: 'Pincode' };

/** Static promotional copy shown on hanging banners. Authored in the catalog, never fetched. */
export interface Promo {
  readonly headline: string;
  readonly detail: string;
}

export interface Store {
  readonly id: string;
  readonly name: string;
  readonly floorId: FloorId;
  readonly subcategory: string;
  /** Every PIN this store delivers to. Must be non-empty (enforced by validateCatalog). */
  readonly serviceablePincodes: readonly string[];
  /** Present on featured brands; drives the hanging banners. */
  readonly promo?: Promo;
  /** The merchant's own page (https). Without it the detail modal has no external link to offer. */
  readonly merchantUrl?: string;
}
