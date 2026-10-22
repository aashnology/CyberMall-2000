import type { EventType, TelemetryEvent } from './types';

const sessionsWith = (events: readonly TelemetryEvent[], t: EventType): Set<string> =>
  new Set(events.filter((e) => e.eventType === t).map((e) => String(e.properties.sessionId)));
const count = (events: readonly TelemetryEvent[], t: EventType): number => events.filter((e) => e.eventType === t).length;

export interface Kpis { totalInteractions: number; uniqueMoodSessions: number; ctr: number; moodToSave: number }

/** CTR = clicks / impressions (0 if none). Mood-to-save = mood sessions that also saved / mood sessions (0 if none). */
export function kpis(events: readonly TelemetryEvent[]): Kpis {
  const impressions = count(events, 'RECOMMENDATION_IMPRESSION');
  const moodSessions = sessionsWith(events, 'MOOD_SELECTED');
  const saveSessions = sessionsWith(events, 'PRODUCT_SAVED');
  const converted = [...moodSessions].filter((s) => saveSessions.has(s)).length;
  return {
    totalInteractions: events.length,
    uniqueMoodSessions: moodSessions.size,
    ctr: impressions === 0 ? 0 : count(events, 'RECOMMENDATION_CLICKED') / impressions,
    moodToSave: moodSessions.size === 0 ? 0 : converted / moodSessions.size,
  };
}

export function countBy(events: readonly TelemetryEvent[], type: EventType, prop: string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const e of events) if (e.eventType === type) { const k = String(e.properties[prop] ?? 'unknown'); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].map(([key, n]) => ({ key, count: n })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export const FUNNEL_STAGES: EventType[] = ['MOOD_SELECTED', 'STORE_VISITED', 'RECOMMENDATION_IMPRESSION', 'PRODUCT_SAVED', 'EXTERNAL_ROUTE_CLICKED'];

/** Cumulative: a session counts at a stage only if it reached every earlier stage too. */
export function funnel(events: readonly TelemetryEvent[]): { stage: EventType; sessions: number }[] {
  const out: { stage: EventType; sessions: number }[] = [];
  let alive: Set<string> | null = null;
  for (const stage of FUNNEL_STAGES) {
    const s = sessionsWith(events, stage);
    alive = alive === null ? s : new Set([...alive].filter((x) => s.has(x)));
    out.push({ stage, sessions: alive.size });
  }
  return out;
}

export function impressionsVsClicks(events: readonly TelemetryEvent[]): { category: string; impressions: number; clicks: number }[] {
  const m = new Map<string, { category: string; impressions: number; clicks: number }>();
  for (const e of events) {
    if (e.eventType !== 'RECOMMENDATION_IMPRESSION' && e.eventType !== 'RECOMMENDATION_CLICKED') continue;
    const category = String(e.properties.category ?? 'unknown');
    const row = m.get(category) ?? { category, impressions: 0, clicks: 0 };
    if (e.eventType === 'RECOMMENDATION_IMPRESSION') row.impressions++; else row.clicks++;
    m.set(category, row);
  }
  return [...m.values()].sort((a, b) => b.impressions - a.impressions || a.category.localeCompare(b.category));
}
