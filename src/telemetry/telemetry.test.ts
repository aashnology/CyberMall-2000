import { describe, expect, it } from 'vitest';
import { countBy, funnel, impressionsVsClicks, kpis } from './aggregate';
import { escapeCsv, toCsv } from './csv';
import { createDispatcher } from './dispatcher';
import { isTelemetryEvent } from './schema';
import type { EventType, Prop, TelemetryEvent } from './types';

let n = 0;
const ev = (eventType: EventType, properties: Record<string, Prop> = {}): TelemetryEvent => ({ eventId: `e${n++}`, eventType, timestamp: 1, properties });

describe('schema', () => {
  it('accepts valid events and rejects malformed ones', () => {
    expect(isTelemetryEvent(ev('MOOD_SELECTED'))).toBe(true);
    expect(isTelemetryEvent({ eventId: 'x', eventType: 'NOPE', timestamp: 1, properties: {} })).toBe(false);
    expect(isTelemetryEvent({ eventId: 'x', eventType: 'PRODUCT_SAVED', timestamp: NaN, properties: {} })).toBe(false);
    expect(isTelemetryEvent({ eventId: 'x', eventType: 'PRODUCT_SAVED', timestamp: 1, properties: { a: {} } })).toBe(false);
    expect(isTelemetryEvent(null)).toBe(false);
  });
});
describe('dispatcher', () => {
  it('stores events with the session id and survives corrupted storage', () => {
    const data: Record<string, string> = { 'cybermall-events': 'not json' };
    const d = createDispatcher({ getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } }, 's1', () => 5, () => 'id1');
    expect(d.read()).toEqual([]);
    d.track('PINCODE_UPDATED', { pincode: '400001' });
    expect(d.read()[0]).toMatchObject({ eventId: 'id1', timestamp: 5, properties: { pincode: '400001', sessionId: 's1' } });
  });
});
describe('aggregate', () => {
  const events = [
    ev('MOOD_SELECTED', { sessionId: 'a', moodId: 'jazz-club' }), ev('STORE_VISITED', { sessionId: 'a' }),
    ev('RECOMMENDATION_IMPRESSION', { sessionId: 'a', category: 'apparel' }), ev('RECOMMENDATION_IMPRESSION', { sessionId: 'a', category: 'apparel' }),
    ev('RECOMMENDATION_CLICKED', { sessionId: 'a', category: 'apparel' }), ev('PRODUCT_SAVED', { sessionId: 'a' }),
    ev('MOOD_SELECTED', { sessionId: 'b', moodId: 'jazz-club' }), ev('STORE_VISITED', { sessionId: 'b' }),
  ];
  it('computes KPIs and handles empty input without dividing by zero', () => {
    expect(kpis(events)).toEqual({ totalInteractions: 8, uniqueMoodSessions: 2, ctr: 0.5, moodToSave: 0.5 });
    expect(kpis([])).toEqual({ totalInteractions: 0, uniqueMoodSessions: 0, ctr: 0, moodToSave: 0 });
  });
  it('builds a cumulative funnel', () => {
    expect(funnel(events).map((f) => f.sessions)).toEqual([2, 2, 1, 1, 0]);
  });
  it('groups by property and category', () => {
    expect(countBy(events, 'MOOD_SELECTED', 'moodId')).toEqual([{ key: 'jazz-club', count: 2 }]);
    expect(impressionsVsClicks(events)).toEqual([{ category: 'apparel', impressions: 2, clicks: 1 }]);
  });
});
describe('csv', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(toCsv([ev('PRODUCT_SAVED', { sessionId: 's' })]).split('\n')).toHaveLength(2);
  });
});
