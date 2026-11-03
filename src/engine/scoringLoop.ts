/**
 * Recommendation scoring loop: telemetry log → learned per-(mood, subcategory) lift → score.
 *
 * Pure and deterministic: no React, no storage, no clock. The only inputs are the telemetry
 * events, the store catalog (to resolve store id → subcategory and delivery reach) and the mood
 * list. Full derivation and limits: docs/RECOMMENDATION_ENGINE.md §6.
 *
 * Model (empirical-Bayes shrinkage of a multiplicative adjustment to the editorial prior):
 *
 *   journey  = one (session, store, mood) with a STORE_IMPRESSION under that mood
 *              (stores that cannot deliver to the visitor's PIN are excluded: they cannot convert)
 *   y        = deepest outcome the journey reached, weighted by OUTCOME_WEIGHTS ∈ {0, .25, .5, .75, 1}
 *   n_mc     = journeys for mood m, subcategory c         s_mc = Σ y over those journeys
 *   p_m      = Σ_c s_mc / Σ_c n_mc                        (the mood's pooled outcome rate)
 *
 *   rate_mc  = (s_mc + K · p_m) / (n_mc + K)              (shrunk toward the pooled rate)
 *   lift_mc  = clamp(rate_mc / p_m, LIFT_MIN, LIFT_MAX)   (1 when p_m = 0)
 *   fit'(i)  = min(1, W_m[c(i)] · lift_mc)
 *
 * With no data, n_mc = 0 ⇒ rate_mc = p_m ⇒ lift = 1 ⇒ the engine is exactly the editorial prior.
 */

import type { EventType, TelemetryEvent } from '../analytics/telemetry';
import type { Mood } from '../data/moods';
import type { Store } from '../data/types';

/** Pseudo-count: how many journeys of the mood's pooled rate a cell is blended with. Design constant. */
export const SHRINKAGE_K = 10;
/** A learned lift can move a prior at most this far either way. Design constants (bounded drift). */
export const LIFT_MIN = 0.5;
export const LIFT_MAX = 1.5;

/** Value of the deepest funnel stage a journey reached. Editorial constants, not estimated. */
export const OUTCOME_WEIGHTS: Readonly<Partial<Record<EventType, number>>> = {
  STORE_HOVER_DWELL: 0.25,
  STORE_MODAL_OPENED: 0.5,
  PRODUCT_SAVED_LOOKBOOK: 0.75,
  EXTERNAL_MERCHANT_ROUTED: 1,
};

export interface LiftCell {
  /** Journeys (exposures) behind this cell. */
  readonly n: number;
  /** Σ weighted outcomes. */
  readonly sum: number;
  /** Shrunk outcome rate of the cell. */
  readonly rate: number;
  /** Multiplier applied to the editorial prior. */
  readonly lift: number;
}

export interface MoodLifts {
  /** Pooled outcome rate across all subcategories of this mood; null with no journeys. */
  readonly pooledRate: number | null;
  readonly journeys: number;
  /** keyed by lower-cased subcategory */
  readonly cells: Readonly<Record<string, LiftCell>>;
}

export interface LiftTable {
  readonly byMood: Readonly<Record<string, MoodLifts>>;
  readonly diagnostics: {
    /** Impressions skipped because the visitor had no valid mood on them. */
    readonly noMood: number;
    /** Impressions whose store id is not in the catalog (catalog changed since the log was written). */
    readonly unknownStore: number;
    /** Impressions skipped because the store does not deliver to that PIN. */
    readonly notDeliverable: number;
    readonly usedJourneys: number;
  };
}

export const EMPTY_LIFTS: LiftTable = { byMood: {}, diagnostics: { noMood: 0, unknownStore: 0, notDeliverable: 0, usedJourneys: 0 } };

/** The single mood a one-hot vector selects; null when the vector is absent, all-zero or ambiguous. */
export function activeMoodId(v: Readonly<Record<string, number>> | null): string | null {
  if (v === null) return null;
  let best: string | null = null;
  let bestW = 0;
  let tie = false;
  for (const [id, w] of Object.entries(v)) {
    if (w > bestW) { best = id; bestW = w; tie = false; } else if (w === bestW && w > 0) tie = true;
  }
  return tie ? null : best;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const jkey = (session: string, store: string, mood: string): string => `${session}\u0000${store}\u0000${mood}`;

export function computeLifts(
  events: readonly TelemetryEvent[],
  catalog: readonly Store[],
  moods: readonly Mood[],
): LiftTable {
  const storeById = new Map(catalog.map((s) => [s.id, s]));
  const moodIds = new Set(moods.map((m) => m.id));

  let noMood = 0, unknownStore = 0, notDeliverable = 0;
  // journey key → { subcategory, mood, y }
  const journeys = new Map<string, { mood: string; sub: string; y: number }>();

  // Pass 1: exposures.
  for (const e of events) {
    if (e.event_type !== 'STORE_IMPRESSION' || e.item_id === null) continue;
    const mood = activeMoodId(e.user_mood_vector);
    if (mood === null || !moodIds.has(mood)) { noMood += 1; continue; }
    const store = storeById.get(e.item_id);
    if (store === undefined) { unknownStore += 1; continue; }
    if (!store.serviceablePincodes.includes(e.pincode)) { notDeliverable += 1; continue; }
    const k = jkey(e.session_id, e.item_id, mood);
    if (!journeys.has(k)) journeys.set(k, { mood, sub: store.subcategory.toLowerCase(), y: 0 });
  }

  // Pass 2: outcomes, only for journeys already exposed under the SAME mood.
  for (const e of events) {
    const w = OUTCOME_WEIGHTS[e.event_type];
    if (w === undefined || e.item_id === null) continue;
    const mood = activeMoodId(e.user_mood_vector);
    if (mood === null) continue;
    const j = journeys.get(jkey(e.session_id, e.item_id, mood));
    if (j !== undefined && w > j.y) j.y = w;
  }

  // Aggregate.
  const agg = new Map<string, Map<string, { n: number; sum: number }>>();
  for (const j of journeys.values()) {
    const m = agg.get(j.mood) ?? new Map<string, { n: number; sum: number }>();
    const c = m.get(j.sub) ?? { n: 0, sum: 0 };
    c.n += 1; c.sum += j.y;
    m.set(j.sub, c); agg.set(j.mood, m);
  }

  const byMood: Record<string, MoodLifts> = {};
  for (const [moodId, subs] of agg) {
    let N = 0, S = 0;
    for (const c of subs.values()) { N += c.n; S += c.sum; }
    const p = N === 0 ? null : S / N;
    const cells: Record<string, LiftCell> = {};
    for (const [sub, c] of subs) {
      if (p === null || p === 0) { cells[sub] = { n: c.n, sum: c.sum, rate: p ?? 0, lift: 1 }; continue; }
      const rate = (c.sum + SHRINKAGE_K * p) / (c.n + SHRINKAGE_K);
      cells[sub] = { n: c.n, sum: c.sum, rate, lift: clamp(rate / p, LIFT_MIN, LIFT_MAX) };
    }
    byMood[moodId] = { pooledRate: p, journeys: N, cells };
  }

  return { byMood, diagnostics: { noMood, unknownStore, notDeliverable, usedJourneys: journeys.size } };
}

/** The cell for (mood, subcategory), or null when the log holds nothing for it (callers treat that as lift 1). */
export function liftFor(table: LiftTable | undefined, moodId: string, subcategory: string): LiftCell | null {
  return table?.byMood[moodId]?.cells[subcategory.toLowerCase()] ?? null;
}

/* ───────────────────────── dashboard view-model ───────────────────────── */

export interface LiftReportRow {
  readonly subcategory: string;
  /** Editorial weight W_m[c]. */
  readonly prior: number;
  /** Journeys behind the cell (0 = no evidence yet). */
  readonly n: number;
  /** Shrunk outcome rate; null with no evidence. */
  readonly rate: number | null;
  readonly lift: number;
  /** min(1, prior · lift): the weight the engine actually uses. */
  readonly effective: number;
  /** Weight on the cell's own data, n / (n + K), in [0,1). */
  readonly evidenceShare: number;
}
export interface LiftReportMood {
  readonly moodId: string;
  readonly label: string;
  readonly journeys: number;
  readonly pooledRate: number | null;
  readonly rows: readonly LiftReportRow[];
}

/** Every prior subcategory of every mood, with its learned lift (1 where the log has no evidence). Sorted by effective weight. */
export function liftReport(table: LiftTable, moods: readonly Mood[]): LiftReportMood[] {
  return moods.map((m) => {
    const rows = Object.entries(m.weights).map(([subcategory, prior]): LiftReportRow => {
      const cell = liftFor(table, m.id, subcategory);
      const lift = cell?.lift ?? 1;
      const n = cell?.n ?? 0;
      return { subcategory, prior, n, rate: cell === null ? null : cell.rate, lift, effective: Math.min(1, prior * lift), evidenceShare: n / (n + SHRINKAGE_K) };
    }).sort((a, b) => b.effective - a.effective || a.subcategory.localeCompare(b.subcategory));
    const ml = table.byMood[m.id];
    return { moodId: m.id, label: m.label, journeys: ml?.journeys ?? 0, pooledRate: ml?.pooledRate ?? null, rows };
  });
}
