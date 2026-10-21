/** Indian PIN codes: 6 digits, first digit 1-9. */
export const isValidPincode = (p: string): boolean => /^[1-9]\d{5}$/.test(p);

export function matchesRule(pincode: string, rule: string): boolean {
  if (rule === '*') return true;
  if (rule.endsWith('*')) return pincode.startsWith(rule.slice(0, -1));
  return pincode === rule;
}

export function deliversTo(rules: readonly string[], pincode: string | null): boolean {
  if (pincode === null || !isValidPincode(pincode)) return false;
  return rules.some((r) => matchesRule(pincode, r));
}
