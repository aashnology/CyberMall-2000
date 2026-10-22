import type { Brand, Budget, Product, Recommendation, ScoreComponents, UserProfile, Weights } from '../types';
import { MOODS } from '../data/catalog';
import { deliversTo, isValidPincode } from '../location/pincode';
import { DEFAULT_WEIGHTS, NEUTRAL } from './weights';

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const lower = (xs: readonly string[]): string[] => xs.map((x) => x.toLowerCase());

/** Share of the user's wanted values the product covers. No preference -> NEUTRAL. */
export function overlapScore(productValues: readonly string[], wanted: readonly string[]): number {
  if (wanted.length === 0) return NEUTRAL;
  const have = lower(productValues);
  return wanted.filter((w) => have.includes(w.toLowerCase())).length / wanted.length;
}

/** 1 inside the range; falls linearly to 0 as the price drifts one max-budget away. */
export function budgetFit(price: number, budget: Budget | null): number {
  if (!budget) return NEUTRAL;
  if (price >= budget.min && price <= budget.max) return 1;
  const gap = price < budget.min ? budget.min - price : price - budget.max;
  return clamp01(1 - gap / Math.max(budget.max, 1));
}

export function scoreProduct(product: Product, brand: Brand | undefined, profile: UserProfile): ScoreComponents {
  const delivery = profile.pincode === null ? NEUTRAL
    : brand && deliversTo(brand.supportedPincodes, profile.pincode) ? 1 : 0;
  return {
    mood: overlapScore(product.moodAssociations, profile.moods),
    color: overlapScore(product.colors, profile.colors),
    category: profile.category === null ? NEUTRAL : product.category === profile.category ? 1 : 0,
    budget: budgetFit(product.price, profile.budget),
    delivery,
  };
}

export const totalScore = (c: ScoreComponents, w: Weights): number =>
  w.mood * c.mood + w.color * c.color + w.category * c.category + w.budget * c.budget + w.delivery * c.delivery;

/** Plain-English reasons, one per signal that actually fired. */
export function explain(product: Product, brand: Brand | undefined, profile: UserProfile, c: ScoreComponents): string[] {
  const reasons: string[] = [];
  const moods = MOODS.filter((m) => profile.moods.includes(m.id) && product.moodAssociations.includes(m.id));
  if (moods.length) reasons.push(`matches your ${moods.map((m) => m.title).join(' and ')} mood`);
  const colors = product.colors.filter((x) => lower(profile.colors).includes(x.toLowerCase()));
  if (colors.length) reasons.push(`comes in your preferred ${colors.join(' and ')} palette`);
  if (c.category === 1 && profile.category) reasons.push(`is in the ${product.category} category you are browsing`);
  if (c.budget === 1 && profile.budget) reasons.push('fits your budget');
  if (profile.pincode && isValidPincode(profile.pincode)) {
    reasons.push(c.delivery === 1 ? `${brand?.name ?? 'the brand'} delivers to ${profile.pincode}`
      : `${brand?.name ?? 'the brand'} does not deliver to ${profile.pincode}`);
  }
  return reasons.length ? reasons : ['is a popular starting point (no preferences set yet)'];
}

/** Rank products best-first. Ties break by id so output is deterministic. */
export function recommend(products: readonly Product[], brands: readonly Brand[], profile: UserProfile,
  weights: Weights = DEFAULT_WEIGHTS): Recommendation[] {
  return products
    .map((product) => {
      const brand = brands.find((b) => b.id === product.brandId);
      const components = scoreProduct(product, brand, profile);
      return { product, components, score: totalScore(components, weights), reasons: explain(product, brand, profile, components) };
    })
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
}
