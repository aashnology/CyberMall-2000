/**
 * Mood matching (lives in the Directory drawer, not the header).
 * Fully explainable: each mood is a weight table over store subcategories; a store's score is
 * the weight of its subcategory, then multiplied by a delivery factor. The `why` string says
 * exactly which numbers produced the score.
 */
import type { DirectoryEntry } from '../engine/pincode';
import { liftFor, type LiftTable } from '../engine/scoringLoop';

export interface Mood {
  readonly id: string;
  readonly label: string;
  readonly weights: Readonly<Record<string, number>>;
}

export const MOODS: readonly Mood[] = [
  { id: 'jazz-club', label: '1990s Jazz-Club Elegance', weights: { 'fine jewelry': 1, watches: 0.9, 'coffee roaster': 0.8, music: 0.8, womenswear: 0.6, fragrance: 0.7, bags: 0.6 } },
  { id: 'corporate-chic', label: 'Corporate Chic', weights: { menswear: 1, womenswear: 0.8, watches: 0.8, bags: 0.7, stationery: 0.6, footwear: 0.6, cafe: 0.5 } },
  { id: 'cozy-sunday', label: 'Cozy Sunday', weights: { books: 1, bakery: 0.9, 'tea room': 0.9, cafe: 0.8, stationery: 0.5, 'bath-body': 0.6, 'board games': 0.6 } },
  { id: 'self-care', label: 'Self-Care Reset', weights: { skincare: 1, salon: 0.8, 'bath-body': 0.9, haircare: 0.7, supplements: 0.6, ayurveda: 0.7, fragrance: 0.6 } },
];

/** Delivery factor: stores that cannot deliver are strongly down-weighted, unknown is neutral. */
const DELIVERY_FACTOR = { delivers: 1, unknown: 0.85, 'not-deliverable': 0.15 } as const;

export interface MoodMatch {
  readonly entry: DirectoryEntry;
  readonly score: number;
  readonly why: string;
}

/**
 * Mood fit of one store: the editorial prior, optionally multiplied by the lift learned from
 * telemetry (see engine/scoringLoop.ts), capped at 1. No table or no data for the cell ⇒ lift 1.
 */
export function fitOf(mood: Mood, entry: DirectoryEntry, lifts?: LiftTable): { readonly prior: number; readonly lift: number; readonly n: number; readonly fit: number } {
  const prior = mood.weights[entry.store.subcategory.toLowerCase()] ?? 0;
  const cell = prior === 0 ? null : liftFor(lifts, mood.id, entry.store.subcategory);
  const lift = cell?.lift ?? 1;
  return { prior, lift, n: cell?.n ?? 0, fit: Math.min(1, prior * lift) };
}

/** Score in [0,1] for one store under one mood; 0 when the category has no affinity. */
export function scoreEntry(mood: Mood, entry: DirectoryEntry, lifts?: LiftTable): number {
  return fitOf(mood, entry, lifts).fit * DELIVERY_FACTOR[entry.status];
}

/** One-hot mood vector over every known mood id (active mood = 1). */
export function moodVector(activeId: string | null, moods: readonly Mood[] = MOODS): Record<string, number> {
  return Object.fromEntries(moods.map((m) => [m.id, m.id === activeId ? 1 : 0]));
}

export function matchMood(mood: Mood, entries: readonly DirectoryEntry[], lifts?: LiftTable): MoodMatch[] {
  const out: MoodMatch[] = [];
  for (const entry of entries) {
    const { prior, lift, n, fit } = fitOf(mood, entry, lifts);
    if (prior === 0) continue;
    const f = DELIVERY_FACTOR[entry.status];
    const learned = n > 0 ? ` × learned lift ${lift.toFixed(2)} (n=${n})` : '';
    out.push({ entry, score: fit * f, why: `${entry.store.subcategory} fit ${prior.toFixed(2)}${learned} × delivery ${f.toFixed(2)} (${entry.status})` });
  }
  return out.sort((a, b) => b.score - a.score || a.entry.store.name.localeCompare(b.entry.store.name));
}
