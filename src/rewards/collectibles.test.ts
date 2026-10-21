import { describe, expect, it } from 'vitest';
import { COLLECTIBLES, earnedBadges, unlockedFilters } from './collectibles';

describe('rewards', () => {
  it('unlocks only filters and badges for collected items', () => {
    expect(unlockedFilters([])).toEqual(['none']);
    expect(unlockedFilters(['cassette', 'nope'])).toEqual(['none', 'vhs']);
    expect(earnedBadges(['tamagotchi'])).toEqual(["Mall Rat '99"]);
  });
  it('has three collectibles with unique ids', () => {
    expect(new Set(COLLECTIBLES.map((c) => c.id)).size).toBe(3);
  });
});
