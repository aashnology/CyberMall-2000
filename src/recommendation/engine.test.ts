import { describe, expect, it } from 'vitest';
import { BRANDS, PRODUCTS } from '../data/catalog';
import { budgetFit, overlapScore, recommend, totalScore } from './engine';
import { DEFAULT_WEIGHTS } from './weights';
import type { UserProfile } from '../types';

const empty: UserProfile = { pincode: null, moods: [], colors: [], category: null, budget: null };

describe('weights', () => {
  it('sum to 1', () => {
    const s = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1);
  });
});
describe('components', () => {
  it('overlap is neutral with no preference and fractional otherwise', () => {
    expect(overlapScore(['a'], [])).toBe(0.5);
    expect(overlapScore(['a', 'b'], ['a', 'c'])).toBe(0.5);
  });
  it('budget is 1 inside range, decays outside, never below 0', () => {
    const b = { min: 1000, max: 5000 };
    expect(budgetFit(3000, b)).toBe(1);
    expect(budgetFit(7500, b)).toBeCloseTo(0.5);
    expect(budgetFit(99999, b)).toBe(0);
    expect(budgetFit(10, null)).toBe(0.5);
  });
});
describe('recommend', () => {
  it('cold start: deterministic order and an explanation for every item', () => {
    const r = recommend(PRODUCTS, BRANDS, empty);
    expect(r).toHaveLength(PRODUCTS.length);
    expect(r[0]?.reasons[0]).toContain('popular starting point');
    expect(recommend(PRODUCTS, BRANDS, empty).map((x) => x.product.id)).toEqual(r.map((x) => x.product.id));
  });
  it('mood + delivery push the jazz-club dress to the top', () => {
    const r = recommend(PRODUCTS, BRANDS, { ...empty, moods: ['jazz-club'], pincode: '400001' });
    expect(r[0]?.product.id).toBe('z1');
    expect(r[0]?.reasons.join(' ')).toContain('Jazz-Club');
  });
  it('a brand that does not deliver is penalised', () => {
    const m = recommend(PRODUCTS, BRANDS, { ...empty, pincode: '700001' }).find((x) => x.product.id === 'm1');
    expect(m?.components.delivery).toBe(0);
    expect(m?.reasons.join(' ')).toContain('does not deliver');
  });
  it('changing weights changes ranking', () => {
    const prof: UserProfile = { ...empty, moods: ['minimalist'], colors: ['gold'] };
    const byMood = recommend(PRODUCTS, BRANDS, prof, { mood: 1, color: 0, category: 0, budget: 0, delivery: 0 })[0];
    const byColor = recommend(PRODUCTS, BRANDS, prof, { mood: 0, color: 1, category: 0, budget: 0, delivery: 0 })[0];
    expect(byMood?.product.id).not.toBe(byColor?.product.id);
    expect(totalScore({ mood: 1, color: 1, category: 1, budget: 1, delivery: 1 }, DEFAULT_WEIGHTS)).toBeCloseTo(1);
  });
});
