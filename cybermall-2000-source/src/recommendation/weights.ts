import type { Weights } from '../types';

/** Must sum to 1 so a perfect item scores exactly 1. Tune here. */
export const DEFAULT_WEIGHTS: Weights = { mood: 0.35, color: 0.2, category: 0.15, budget: 0.15, delivery: 0.15 };

/** Score used when the user has not told us a preference (cold start): neither reward nor punish. */
export const NEUTRAL = 0.5;
