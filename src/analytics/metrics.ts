/**
 * Dashboard metrics. Every function is pure and documents its numerator and denominator.
 * Ratios with a zero denominator are `null` (undefined), never 0%.
 */

import type { EventType, TelemetryEvent } from './telemetry';
import type { Mood } from '../data/moods';
import { type Cluster, clusterForPincode } from './cluster';

/* ───────────────────────── conversion funnel ───────────────────────── */

export interface FunnelStageDef { readonly id: string; readonly label: string; readonly event: EventType }

export const FUNNEL_STAGES: readonly FunnelStageDef[] = [
  { id: 'impression', label: 'Impression', event: 'STORE_IMPRESSION' },
  { id: 'dwell', label: 'Hover / Dwell', event: 'STORE_HOVER_DWELL' },
  { id: 'modal', label: 'Detail Modal Open', event: 'STORE_MODAL_OPENED' },
  { id: 'save', label: 'Save to Lookbook', event: 'PRODUCT_SAVED_LOOKBOOK' },
  { id: 'external', label: 'External Link Click', event: 'EXTERNAL_MERCHANT_ROUTED' },
];

export interface FunnelRow {
  readonly stage: FunnelStageDef;
  /** Distinct (session, store) journeys that completed this stage AND every earlier stage. */
  readonly count: number;
  /** count / previous count; null for stage 1 or when the previous count is 0. */
  readonly conversionFromPrev: number | null;
  /** 1 − conversionFromPrev. */
  readonly dropOffFromPrev: number | null;
  /** count / stage-1 count; null when stage 1 is 0. */
  readonly conversionFromTop: number | null;
  /** Journeys that logged this stage without completing the full prior path (e.g. a click with no 3 s dwell). Data-quality note. */
  readonly skippedPrior: number;
}

const key = (e: TelemetryEvent): string => `${e.session_id}\u0000${e.item_id ?? ''}`;

/**
 * Cumulative (ordered) funnel over (session_id, item_id) journeys.
 *   S_1 = journeys with STORE_IMPRESSION
 *   S_k = S_{k-1} ∩ journeys with stage-k event          ⇒ count_k ≤ count_{k-1}  (drop-off ≥ 0)
 *   conversionFromPrev_k = |S_k| / |S_{k-1}|,  dropOff_k = 1 − that,  fromTop_k = |S_k| / |S_1|
 * Order of timestamps is not required: it is "has reached", not "reached in order".
 */
export function computeFunnel(events: readonly TelemetryEvent[], stages: readonly FunnelStageDef[] = FUNNEL_STAGES): FunnelRow[] {
  const raw = new Map<EventType, Set<string>>();
  for (const s of stages) raw.set(s.event, new Set());
  for (const e of events) raw.get(e.event_type)?.add(key(e));

  const rows: FunnelRow[] = [];
  let prev: Set<string> | null = null;
  let top = 0;
  for (const stage of stages) {
    const set = raw.get(stage.event) ?? new Set<string>();
    const cumulative: Set<string> = prev === null ? new Set(set) : new Set([...set].filter((k) => (prev as Set<string>).has(k)));
    const skipped = prev === null ? 0 : [...set].filter((k) => !(prev as Set<string>).has(k)).length;
    if (prev === null) top = cumulative.size;
    const conv = prev === null || prev.size === 0 ? null : cumulative.size / prev.size;
    rows.push({
      stage,
      count: cumulative.size,
      conversionFromPrev: conv,
      dropOffFromPrev: conv === null ? null : 1 - conv,
      conversionFromTop: top === 0 ? null : cumulative.size / top,
      skippedPrior: skipped,
    });
    prev = cumulative;
  }
  return rows;
}

/* ───────────────────────── pincode-cluster × mood affinity ───────────────────────── */

export interface HeatCell {
  readonly moodId: string;
  /** Sessions in this cluster with ≥ 1 MOOD_SELECTED for this mood. */
  readonly engaged: number;
  /** engaged / cluster sessions; null if the cluster has no sessions. */
  readonly pct: number | null;
}
export interface HeatRow {
  readonly cluster: Cluster;
  /** Distinct sessions assigned to this cluster. */
  readonly sessions: number;
  /** Fewer than MIN_RELIABLE_SESSIONS sessions: show the figure but flag it. */
  readonly lowSample: boolean;
  readonly cells: readonly HeatCell[];
}
export interface HeatMap { readonly moods: readonly Mood[]; readonly rows: readonly HeatRow[]; readonly totalSessions: number }

export const MIN_RELIABLE_SESSIONS = 5;

/**
 * Session → cluster: the PIN of the session's LAST PINCODE_SUBMITTED, else the PIN on its first event.
 * pct(cluster, mood) = |sessions in cluster with MOOD_SELECTED(mood)| / |sessions in cluster|.
 * A session counts once per mood however many times the mood was picked.
 */
export function computeAffinity(
  events: readonly TelemetryEvent[],
  moods: readonly Mood[],
  clusterOf: (pincode: string) => Cluster = clusterForPincode,
): HeatMap {
  const sessionPin = new Map<string, { pin: string; submitted: boolean }>();
  const moodsBySession = new Map<string, Set<string>>();
  for (const e of events) { // events are chronological
    const cur = sessionPin.get(e.session_id);
    if (e.event_type === 'PINCODE_SUBMITTED') sessionPin.set(e.session_id, { pin: e.pincode, submitted: true });
    else if (cur === undefined) sessionPin.set(e.session_id, { pin: e.pincode, submitted: false });
    if (e.event_type === 'MOOD_SELECTED' && e.item_id !== null) {
      let set = moodsBySession.get(e.session_id);
      if (set === undefined) { set = new Set(); moodsBySession.set(e.session_id, set); }
      set.add(e.item_id);
    }
  }

  const byCluster = new Map<string, { cluster: Cluster; sessions: string[] }>();
  for (const [sid, { pin }] of sessionPin) {
    const cluster = clusterOf(pin);
    const slot = byCluster.get(cluster.id) ?? { cluster, sessions: [] };
    slot.sessions.push(sid);
    byCluster.set(cluster.id, slot);
  }

  const rows: HeatRow[] = [...byCluster.values()]
    .map(({ cluster, sessions }) => ({
      cluster,
      sessions: sessions.length,
      lowSample: sessions.length < MIN_RELIABLE_SESSIONS,
      cells: moods.map((m): HeatCell => {
        const engaged = sessions.filter((s) => moodsBySession.get(s)?.has(m.id) === true).length;
        return { moodId: m.id, engaged, pct: sessions.length === 0 ? null : engaged / sessions.length };
      }),
    }))
    .sort((a, b) => b.sessions - a.sessions || a.cluster.label.localeCompare(b.cluster.label));

  return { moods, rows, totalSessions: sessionPin.size };
}

/* ───────────────────────── headline numbers ───────────────────────── */

export interface Summary { readonly events: number; readonly sessions: number; readonly pincodes: number }
export function summarize(events: readonly TelemetryEvent[]): Summary {
  return {
    events: events.length,
    sessions: new Set(events.map((e) => e.session_id)).size,
    pincodes: new Set(events.map((e) => e.pincode)).size,
  };
}
