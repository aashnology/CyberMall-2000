/**
 * SAMPLE catalog: fictional brands, illustrative delivery zones. A stand-in so every floor has
 * content and the pincode engine can be exercised end-to-end. Replace with the real catalog
 * (same `Store` shape); nothing else needs to change. Floor 6 is NOT here: it is built from
 * ./mediaSnapshots.ts.
 *
 * Counts are deliberately uneven (Floor 1 has 48) to exercise dense-floor scaling.
 */

import { pincodesFor, ZONE_BUNDLES, type ZoneId } from './pincodeZones';
import { BEAUTY_SUBCATEGORIES, CLINICAL_SUBCATEGORIES } from './wellnessPartition';
import type { FloorId, Promo, Store } from './types';

type Reach = readonly ZoneId[];

/** Delivery reach patterns, cycled so neighbouring stores differ. */
const REACH: readonly Reach[] = [
  ZONE_BUNDLES.PAN_METRO,
  ZONE_BUNDLES.MUMBAI_ALL,
  ['mumbai-western-suburbs'],
  ZONE_BUNDLES.DELHI_ALL,
  ZONE_BUNDLES.BENGALURU_ALL,
  [...ZONE_BUNDLES.MUMBAI_ALL, ...ZONE_BUNDLES.BENGALURU_ALL],
  ['mumbai-south', 'delhi-central'],
];

interface FloorSpec {
  readonly floorId: Exclude<FloorId, 6>;
  readonly count: number;
  readonly firstWords: readonly string[];
  readonly secondWords: readonly string[];
  readonly subcategories: readonly string[];
  readonly promoThing: string;
}

const SPECS: readonly FloorSpec[] = [
  { floorId: 1, count: 48, firstWords: ['Velvet', 'Saffron', 'Linen', 'Indigo', 'Ochre', 'Mulberry', 'Juniper', 'Ember'],
    secondWords: ['Atelier', 'Loom', 'Threads', 'Tailors', 'Label', 'Drape'], subcategories: ['womenswear', 'menswear', 'ethnic wear', 'denim', 'kidswear', 'footwear'], promoThing: 'new-season edits' },
  { floorId: 2, count: 14, firstWords: ['Paper', 'Quill', 'Folio', 'Margin', 'Inkwell', 'Page'],
    secondWords: ['& Co', 'House', 'Corner'], subcategories: ['books', 'stationery', 'music', 'comics'], promoThing: 'notebooks' },
  { floorId: 3, count: 16, firstWords: ['Gilded', 'Opal', 'Pearl', 'Kundan', 'Aurum', 'Lumen'],
    secondWords: ['Jewels', 'Studio', 'Vault'], subcategories: ['fine jewelry', 'watches', 'sunglasses', 'bags'], promoThing: 'gold-plated pieces' },
  { floorId: 4, count: 12, firstWords: ['Meeple', 'Brick', 'Origami', 'Pixel', 'Cogwheel', 'Marble'],
    secondWords: ['Works', 'Emporium', 'Den'], subcategories: ['board games', 'toys', 'collectibles', 'hobby kits'], promoThing: 'collector sets' },
  { floorId: 5, count: 18, firstWords: ['Rosewater', 'Bloom', 'Dew', 'Petal', 'Silk', 'Halo'],
    secondWords: ['Skin', 'Parlour', 'Bar', 'Lab'], subcategories: [...BEAUTY_SUBCATEGORIES], promoThing: 'serums' },
  { floorId: 7, count: 24, firstWords: ['Tandoor', 'Spice', 'Noodle', 'Wok', 'Dosa', 'Kebab', 'Pasta'],
    secondWords: ['Express', 'Junction', 'Kitchen', 'Bowl'], subcategories: ['burgers', 'pizza', 'fries', 'fried chicken', 'sandwiches', 'street food'], promoThing: 'combo meals' },
  { floorId: 8, count: 20, firstWords: ['Monsoon', 'Slow', 'Crema', 'Bean', 'Pour', 'Third-Wave'],
    secondWords: ['Roasters', 'Cafe', 'Bakehouse', 'Coffee Co'], subcategories: ['coffee roaster', 'bakery', 'tea room', 'cafe', 'specialty cafe', 'fine dining'], promoThing: 'cold brew beans' },
  { floorId: 9, count: 14, firstWords: ['Wellspring', 'Carewell', 'Nirvana', 'Herbal', 'Vital', 'Samvedna'],
    secondWords: ['Pharmacy', 'Apothecary', 'Chemist', 'Diagnostics'], subcategories: [...CLINICAL_SUBCATEGORIES], promoThing: 'daily supplements' },
];

function build(spec: FloorSpec): Store[] {
  const out: Store[] = [];
  for (let i = 0; i < spec.count; i += 1) {
    const a = spec.firstWords[i % spec.firstWords.length] as string;
    const b = spec.secondWords[Math.floor(i / spec.firstWords.length) % spec.secondWords.length] as string;
    const name = `${a} ${b}`;
    const sub = spec.subcategories[i % spec.subcategories.length] as string;
    const reach = REACH[(i + spec.floorId) % REACH.length] as Reach;
    const base = { id: `f${spec.floorId}-${String(i + 1).padStart(2, '0')}`, name, floorId: spec.floorId, subcategory: sub, serviceablePincodes: pincodesFor(...reach) };
    if (i % 5 === 0) {
      const promo: Promo = { headline: `${name}: ${10 + ((i * 5) % 25)}% off ${spec.promoThing}`, detail: 'Sample promotion' };
      out.push({ ...base, promo });
    } else out.push(base);
  }
  return out;
}

export const SAMPLE_CATALOG: readonly Store[] = SPECS.flatMap(build);
