import { describe, expect, it } from 'vitest';
import { deliversTo, isValidPincode, matchesRule } from './pincode';

describe('pincode', () => {
  it('validates 6-digit codes not starting with 0', () => {
    expect(isValidPincode('400001')).toBe(true);
    expect(isValidPincode('040001')).toBe(false);
    expect(isValidPincode('4000')).toBe(false);
  });
  it('matches exact, prefix and wildcard rules', () => {
    expect(matchesRule('400001', '400001')).toBe(true);
    expect(matchesRule('400001', '400*')).toBe(true);
    expect(matchesRule('110001', '400*')).toBe(false);
    expect(matchesRule('110001', '*')).toBe(true);
  });
  it('handles empty coverage and bad input', () => {
    expect(deliversTo([], '400001')).toBe(false);
    expect(deliversTo(['*'], null)).toBe(false);
    expect(deliversTo(['*'], 'abc')).toBe(false);
  });
});
