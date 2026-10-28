export const fmtPct = (x: number | null, digits = 1): string => (x === null ? '—' : `${(x * 100).toFixed(digits)}%`);
export const fmtInt = (n: number): string => n.toLocaleString('en-IN');
