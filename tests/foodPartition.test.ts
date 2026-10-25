import { describe, it, expect } from 'vitest';
import { floorForFoodSubcategory, normalizeFoodSubcategory, repartitionFood, FAST_FOOD_SUBCATEGORIES, CAFE_FLOOR_SUBCATEGORIES } from '../src/data/foodPartition';
import { SAMPLE_CATALOG } from '../src/data/catalog.sample';
import { FLOORS, type FloorId, type Store } from '../src/data/types';

const st = (id: string, floorId: FloorId, subcategory: string): Store => ({ id, name: id, floorId, subcategory, serviceablePincodes: ['400058'] });

describe('Floor 7 "Food Court and Arcade"', () => {
  it('is named per the spec and keeps the FOOD elevator plate', () => {
    expect(FLOORS[7].name).toBe('Food Court and Arcade');
    expect(FLOORS[8].name).toBe('Cafes');
  });
});

describe('fast food vs fine dining / cafes partition', () => {
  it.each([
    ['Burgers', 7], ['French Fries', 7], ['pizzeria', 7], ['Fast Food', 7], ['QSR', 7], ['Street Food', 7], ['Quick Bites', 7], ['fried-chicken', 7],
    ['Fine Dining', 8], ['specialty cafe', 8], ['Speciality Cafe', 8], ['Bakery', 8], ['bakehouse', 8], ['Coffee Roaster', 8], ['Tea Room', 8], ['Patisserie', 8], ['Dessert Parlor', 8],
    ['restaurant', null], ['multi-cuisine', null], ['', null],
  ] as const)('%s → %s', (sub, floor) => expect(floorForFoodSubcategory(sub)).toBe(floor));

  it('every listed subcategory maps to its own floor, and the two sets never overlap', () => {
    for (const s of FAST_FOOD_SUBCATEGORIES) expect(floorForFoodSubcategory(s)).toBe(7);
    for (const s of CAFE_FLOOR_SUBCATEGORIES) expect(floorForFoodSubcategory(s)).toBe(8);
    expect(FAST_FOOD_SUBCATEGORIES.filter((s) => (CAFE_FLOOR_SUBCATEGORIES as readonly string[]).includes(s))).toEqual([]);
    expect(normalizeFoodSubcategory('  Bath & Body ')).toBe('bath and body');
  });

  it('moves misplaced stores strictly between 7 and 8, leaves ambiguous ones, ignores other floors, never mutates', () => {
    const input = [st('a', 7, 'bakery'), st('b', 8, 'burgers'), st('c', 7, 'pizza'), st('d', 8, 'fine dining'), st('e', 7, 'restaurant'), st('f', 1, 'bakery')];
    const r = repartitionFood(input);
    expect(r.stores.map((s) => `${s.id}:${s.floorId}`)).toEqual(['a:8', 'b:7', 'c:7', 'd:8', 'e:7', 'f:1']);
    expect(r.moved).toEqual([{ storeId: 'a', from: 7, to: 8 }, { storeId: 'b', from: 8, to: 7 }]);
    expect(r.unclassified.map((s) => s.id)).toEqual(['e']);
    expect(input[0]?.floorId).toBe(7);
  });

  it('the sample catalog already respects the partition and still fills both floors', () => {
    const r = repartitionFood(SAMPLE_CATALOG);
    expect(r.moved).toEqual([]); expect(r.unclassified).toEqual([]);
    expect(SAMPLE_CATALOG.filter((s) => s.floorId === 7).length).toBeGreaterThan(0);
    expect(SAMPLE_CATALOG.filter((s) => s.floorId === 8).length).toBeGreaterThan(0);
    // fine dining and bakeries are on Cafes only
    expect(SAMPLE_CATALOG.filter((s) => s.floorId === 7 && /dining|bakery|cafe/.test(s.subcategory))).toEqual([]);
  });
});
