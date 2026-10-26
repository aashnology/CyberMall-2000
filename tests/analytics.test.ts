import { describe, it, expect } from 'vitest';
import {
  TelemetryLog, validateEvent, TelemetryError, DwellTracker, ImpressionTracker, eventsToCsv, csvField, exportFilename,
  CSV_COLUMNS, EVENT_TYPES, DWELL_THRESHOLD_MS, type TelemetryEvent, type EventType,
} from '../src/analytics/telemetry';
import { computeFunnel, computeAffinity, summarize, MIN_RELIABLE_SESSIONS } from '../src/analytics/metrics';
import { clusterForPincode } from '../src/analytics/cluster';
import { parseCsv } from '../src/data/indiaPost';
import { MOODS, moodVector, scoreEntry } from '../src/data/moods';
import { SAMPLE_CATALOG } from '../src/data/catalog.sample';
import { buildDirectory, parsePincode } from '../src/engine/pincode';
import type { Pincode } from '../src/data/types';

const T0 = Date.parse('2026-10-24T09:00:00.000Z');
const mem = (): { store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>; data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, store: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } } };
};
const log = (sessionId = 'sess-0001', storage: ReturnType<typeof mem>['store'] | null = null): TelemetryLog => {
  let n = 0;
  return new TelemetryLog({ sessionId, now: () => new Date(T0 + 1000 * n++), storage, persistDelayMs: 0 });
};
const ev = (session: string, type: EventType, item: string | null, pin = '400058', extra: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
  session_id: session, timestamp: new Date(T0).toISOString(), pincode: pin, event_type: type, item_id: item, match_score: null, user_mood_vector: null, ...extra,
});

describe('event validation', () => {
  it('has exactly the specified event types (seven core + photobooth) and the seven CSV columns', () => {
    expect([...EVENT_TYPES]).toEqual(['PINCODE_SUBMITTED', 'STORE_IMPRESSION', 'STORE_HOVER_DWELL', 'STORE_MODAL_OPENED', 'PRODUCT_SAVED_LOOKBOOK', 'EXTERNAL_MERCHANT_ROUTED', 'MOOD_SELECTED', 'PHOTOBOOTH_STRIP_GENERATED']);
    expect([...CSV_COLUMNS]).toEqual(['session_id', 'timestamp', 'pincode', 'event_type', 'item_id', 'match_score', 'user_mood_vector']);
    expect(DWELL_THRESHOLD_MS).toBe(3000);
  });
  it('rejects malformed events instead of storing them', () => {
    const l = log();
    expect(() => l.track('STORE_IMPRESSION', { pincode: '12' , item_id: 'f1-01' })).toThrow(TelemetryError);
    expect(() => l.track('STORE_IMPRESSION', { pincode: '400058' })).toThrow(/item_id/);
    expect(() => l.track('STORE_IMPRESSION', { pincode: '400058', item_id: '=HYPERLINK("x")' })).toThrow(/item_id/);
    expect(() => l.track('PINCODE_SUBMITTED', { pincode: '400058', item_id: 'x1' })).toThrow(/item_id/);
    expect(() => l.track('STORE_MODAL_OPENED', { pincode: '400058', item_id: 'f1-01', match_score: 1.5 })).toThrow(/match_score/);
    expect(() => l.track('MOOD_SELECTED', { pincode: '400058', item_id: 'cozy-sunday', user_mood_vector: { a: 2 } })).toThrow(/mood_vector/);
    expect(l.events()).toHaveLength(0);
    expect(() => validateEvent({ ...ev('sess-0001', 'STORE_IMPRESSION', 'a1'), timestamp: 'yesterday' })).toThrow(/timestamp/);
  });
  it('accepts valid events, rounds match_score, stamps ISO UTC time', () => {
    const l = log();
    const e = l.track('STORE_MODAL_OPENED', { pincode: '400058', item_id: 'f1-01', match_score: 0.123456 });
    expect(e.match_score).toBe(0.1235);
    expect(e.timestamp).toBe('2026-10-24T09:00:00.000Z');
    expect(l.track('PINCODE_SUBMITTED', { pincode: '400058' }).item_id).toBeNull();
  });
});

describe('persistence and subscriptions', () => {
  it('round-trips through storage, drops corrupt rows, and survives bad storage', () => {
    const m = mem();
    const a = log('sess-0001', m.store);
    a.track('STORE_IMPRESSION', { pincode: '400058', item_id: 'f1-01' });
    a.track('STORE_IMPRESSION', { pincode: '400058', item_id: 'f1-02' });
    const b = log('sess-0002', m.store);
    expect(b.events()).toHaveLength(2);
    const arr = JSON.parse(m.data.get('cybermall2000.telemetry.v1') ?? '[]') as unknown[];
    m.data.set('cybermall2000.telemetry.v1', JSON.stringify([...arr, { event_type: 'NOPE' }, 7]));
    expect(log('sess-0003', m.store).events()).toHaveLength(2);
    m.data.set('cybermall2000.telemetry.v1', 'not json');
    expect(log('sess-0004', m.store).events()).toHaveLength(0);
    const throwing = { getItem: () => null, removeItem: () => undefined, setItem: (): void => { throw new Error('quota'); } };
    const c = log('sess-0005', throwing);
    expect(() => c.track('STORE_IMPRESSION', { pincode: '400058', item_id: 'f1-01' })).not.toThrow();
    expect(c.events()).toHaveLength(1);
  });
  it('caps the log, notifies subscribers, and clear() empties memory and storage', () => {
    const m = mem();
    const l = new TelemetryLog({ sessionId: 'sess-0001', storage: m.store, maxEvents: 3, persistDelayMs: 0 });
    let calls = 0; const off = l.subscribe(() => { calls += 1; });
    for (let i = 0; i < 5; i += 1) l.track('STORE_IMPRESSION', { pincode: '400058', item_id: `s${i}` });
    expect(l.events().map((e) => e.item_id)).toEqual(['s2', 's3', 's4']);
    expect(calls).toBe(5);
    const v = l.snapshot();
    l.clear();
    expect(l.snapshot()).not.toBe(v);
    expect(l.events()).toHaveLength(0);
    expect(m.data.has('cybermall2000.telemetry.v1')).toBe(false);
    off(); l.track('STORE_IMPRESSION', { pincode: '400058', item_id: 'x1' });
    expect(calls).toBe(6); // the clear() notification; unsubscribed afterwards
  });
});

describe('behaviour trackers', () => {
  it('dwell fires once after exactly 3000 ms on the same store, resets on change or leave', () => {
    const d = new DwellTracker();
    expect(d.update('a', 0)).toBeNull();
    expect(d.update('a', 2999)).toBeNull();
    expect(d.update('a', 3000)).toBe('a');
    expect(d.update('a', 9000)).toBeNull();      // once per episode
    expect(d.update('b', 9100)).toBeNull();      // moved: timer restarts
    expect(d.update('b', 12099)).toBeNull();
    expect(d.update('b', 12100)).toBe('b');
    expect(d.update(null, 12200)).toBeNull();
    expect(d.update('b', 12300)).toBeNull();     // a new episode on the same store
    expect(d.update('b', 15300)).toBe('b');
  });
  it('impressions are de-duplicated per session and can be reset', () => {
    const t = new ImpressionTracker();
    expect(t.observe(['a', 'b', 'a'])).toEqual(['a', 'b']);
    expect(t.observe(['b', 'c'])).toEqual(['c']);
    t.reset();
    expect(t.observe(['a'])).toEqual(['a']);
  });
});

describe('CSV export', () => {
  it('writes the exact header and parses back losslessly with a standard parser (nulls = empty)', () => {
    const l = log();
    l.track('PINCODE_SUBMITTED', { pincode: '400058' });
    l.track('MOOD_SELECTED', { pincode: '400058', item_id: 'cozy-sunday', user_mood_vector: moodVector('cozy-sunday') });
    l.track('STORE_MODAL_OPENED', { pincode: '400058', item_id: 'f8-01', match_score: 0.85, user_mood_vector: moodVector('cozy-sunday') });
    const csv = eventsToCsv(l.events());
    expect(csv.startsWith('session_id,timestamp,pincode,event_type,item_id,match_score,user_mood_vector\n')).toBe(true);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv.endsWith('\n')).toBe(true);
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.length === 7)).toBe(true);
    expect(rows[1]).toEqual(['sess-0001', '2026-10-24T09:00:00.000Z', '400058', 'PINCODE_SUBMITTED', '', '', '']);
    const vec = JSON.parse(rows[3]![6]!) as Record<string, number>;
    expect(vec).toEqual(moodVector('cozy-sunday'));
    expect(Object.values(vec).reduce((a, b) => a + b, 0)).toBe(1);
    expect(rows[3]![5]).toBe('0.85');
  });
  it('escapes commas, quotes and newlines per RFC 4180; empty log is just a header', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('l1\nl2')).toBe('"l1\nl2"');
    expect(csvField('plain')).toBe('plain');
    expect(eventsToCsv([])).toBe('session_id,timestamp,pincode,event_type,item_id,match_score,user_mood_vector\n');
  });
  it('exportFilename is UTC, sortable and filesystem-safe', () => {
    expect(exportFilename(new Date('2026-10-24T09:05:03Z'))).toBe('cybermall_telemetry_20261024-090503Z.csv');
  });
});

describe('conversion funnel', () => {
  const j = (s: string, item: string, upTo: number): TelemetryEvent[] =>
    (['STORE_IMPRESSION', 'STORE_HOVER_DWELL', 'STORE_MODAL_OPENED', 'PRODUCT_SAVED_LOOKBOOK', 'EXTERNAL_MERCHANT_ROUTED'] as const).slice(0, upTo).map((t) => ev(s, t, item));
  const events = [
    ...j('s1', 'a', 5), ...j('s1', 'b', 3), ...j('s2', 'a', 2), ...j('s3', 'c', 1), ...j('s3', 'd', 1), ...j('s4', 'a', 4),
  ];
  const rows = computeFunnel(events);
  it('counts distinct (session, store) journeys per stage', () => {
    // impressions: s1a s1b s2a s3c s3d s4a = 6 · dwell: s1a s1b s2a s4a = 4 · modal: s1a s1b s4a = 3 · save: s1a s4a = 2 · external: s1a = 1
    expect(rows.map((r) => r.count)).toEqual([6, 4, 3, 2, 1]);
  });
  it('computes conversion, drop-off and from-top with explicit numerators/denominators', () => {
    expect(rows[0]).toMatchObject({ conversionFromPrev: null, dropOffFromPrev: null, conversionFromTop: 1 });
    expect(rows[1]!.conversionFromPrev).toBeCloseTo(4 / 6, 12);
    expect(rows[1]!.dropOffFromPrev).toBeCloseTo(2 / 6, 12);
    expect(rows[2]!.conversionFromPrev).toBeCloseTo(3 / 4, 12);
    expect(rows[3]!.conversionFromPrev).toBeCloseTo(2 / 3, 12);
    expect(rows[3]!.dropOffFromPrev).toBeCloseTo(1 / 3, 12);
    expect(rows[4]!.conversionFromPrev).toBeCloseTo(1 / 2, 12);
    expect(rows[4]!.conversionFromTop).toBeCloseTo(1 / 6, 12);
  });
  it('is monotone non-increasing and never reports negative drop-off, even with out-of-order data', () => {
    const odd = [ev('s9', 'STORE_MODAL_OPENED', 'z'), ev('s9', 'STORE_IMPRESSION', 'y')]; // modal without impression/dwell
    const r = computeFunnel(odd);
    expect(r.map((x) => x.count)).toEqual([1, 0, 0, 0, 0]);
    expect(r[2]!.skippedPrior).toBe(1);               // surfaced as a data-quality note
    for (const x of [...rows, ...r]) if (x.dropOffFromPrev !== null) expect(x.dropOffFromPrev).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < rows.length; i += 1) expect(rows[i]!.count).toBeLessThanOrEqual(rows[i - 1]!.count);
  });
  it('same store in different sessions are different journeys; zero data gives nulls, not 0%', () => {
    expect(computeFunnel([ev('s1', 'STORE_IMPRESSION', 'a'), ev('s2', 'STORE_IMPRESSION', 'a')])[0]!.count).toBe(2);
    const empty = computeFunnel([]);
    expect(empty.map((r) => r.count)).toEqual([0, 0, 0, 0, 0]);
    for (const r of empty) { expect(r.conversionFromPrev).toBeNull(); expect(r.conversionFromTop).toBeNull(); }
  });
});

describe('affinity heat map', () => {
  const west = ['400058', '400053', '400049'];
  const south = ['400001', '400005'];
  const events: TelemetryEvent[] = [];
  west.forEach((p, i) => { events.push(ev(`w${i}`, 'PINCODE_SUBMITTED', null, p)); });
  south.forEach((p, i) => { events.push(ev(`z${i}`, 'PINCODE_SUBMITTED', null, p)); });
  events.push(ev('w0', 'MOOD_SELECTED', 'cozy-sunday', '400058'), ev('w0', 'MOOD_SELECTED', 'cozy-sunday', '400058'), ev('w1', 'MOOD_SELECTED', 'cozy-sunday', '400053'));
  events.push(ev('w2', 'MOOD_SELECTED', 'self-care', '400049'), ev('z0', 'MOOD_SELECTED', 'corporate-chic', '400001'));
  const hm = computeAffinity(events, MOODS);
  const cell = (cluster: string, mood: string): { engaged: number; pct: number | null } => {
    const c = hm.rows.find((r) => r.cluster.id === cluster)!.cells.find((x) => x.moodId === mood)!;
    return { engaged: c.engaged, pct: c.pct };
  };
  it('groups PINs into named delivery-zone clusters', () => {
    expect(hm.rows.map((r) => [r.cluster.id, r.sessions])).toEqual([['mumbai-western-suburbs', 3], ['mumbai-south', 2]]);
    expect(hm.totalSessions).toBe(5);
  });
  it('pct = distinct engaged sessions / cluster sessions (repeat picks count once)', () => {
    expect(cell('mumbai-western-suburbs', 'cozy-sunday')).toEqual({ engaged: 2, pct: 2 / 3 });
    expect(cell('mumbai-western-suburbs', 'self-care')).toEqual({ engaged: 1, pct: 1 / 3 });
    expect(cell('mumbai-south', 'corporate-chic')).toEqual({ engaged: 1, pct: 1 / 2 });
    expect(cell('mumbai-south', 'cozy-sunday')).toEqual({ engaged: 0, pct: 0 });
  });
  it('flags small clusters as low-sample and uses the last submitted PIN for a session', () => {
    expect(MIN_RELIABLE_SESSIONS).toBe(5);
    expect(hm.rows.every((r) => r.lowSample)).toBe(true);
    const moved = computeAffinity([ev('m', 'PINCODE_SUBMITTED', null, '400058'), ev('m', 'PINCODE_SUBMITTED', null, '110001')], MOODS);
    expect(moved.rows.map((r) => r.cluster.id)).toEqual(['delhi-central']);
  });
  it('falls back to the 3-digit postal district for PINs outside every zone; empty log gives an empty map', () => {
    expect(clusterForPincode('682001')).toEqual({ id: 'pin3-682', label: 'PIN 682xxx' });
    expect(computeAffinity([], MOODS)).toMatchObject({ rows: [], totalSessions: 0 });
  });
  it('every cell percentage is within [0,1] and each row has one cell per mood', () => {
    for (const r of hm.rows) { expect(r.cells).toHaveLength(MOODS.length); for (const c of r.cells) { expect(c.pct!).toBeGreaterThanOrEqual(0); expect(c.pct!).toBeLessThanOrEqual(1); } }
  });
});

describe('mood scoring helpers used by telemetry', () => {
  it('moodVector is one-hot over every known mood and scoreEntry lies in [0,1]', () => {
    const v = moodVector('self-care');
    expect(Object.keys(v).sort()).toEqual(MOODS.map((m) => m.id).sort());
    expect(Object.values(v).reduce((a, b) => a + b, 0)).toBe(1);
    expect(Object.values(moodVector(null)).every((x) => x === 0)).toBe(true);
    const p = parsePincode('400058'); if (!p.ok) throw new Error('x');
    const dir = buildDirectory(SAMPLE_CATALOG, { pincode: p.pincode as Pincode, onlyDeliverable: false });
    for (const f of [1, 5, 8] as const) for (const e of dir.byFloor[f]) for (const m of MOODS) { const s = scoreEntry(m, e); expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(1); }
  });
  it('delivery gating: equal fit ranks deliverable > unknown > not-deliverable, and a non-deliverable score never exceeds 0.15', () => {
    const store = SAMPLE_CATALOG.find((x) => x.subcategory === 'books')!;
    const mood = MOODS.find((m) => m.id === 'cozy-sunday')!;
    const at = (status: 'delivers' | 'unknown' | 'not-deliverable'): number => scoreEntry(mood, { store, status, ribbon: null });
    expect(at('delivers')).toBe(1);
    expect(at('delivers')).toBeGreaterThan(at('unknown'));
    expect(at('unknown')).toBeGreaterThan(at('not-deliverable'));
    expect(at('not-deliverable')).toBeCloseTo(0.15, 12);
    for (const m of MOODS) for (const sub of Object.keys(m.weights)) expect(scoreEntry(m, { store: { ...store, subcategory: sub }, status: 'not-deliverable', ribbon: null })).toBeLessThanOrEqual(0.15 + 1e-12);
  });
  it('summarize counts events, sessions and PINs', () => {
    expect(summarize([ev('a', 'STORE_IMPRESSION', 'x1'), ev('b', 'STORE_IMPRESSION', 'x1', '110001')])).toEqual({ events: 2, sessions: 2, pincodes: 2, photostrips: 0 });
    expect(summarize([ev('a', 'PHOTOBOOTH_STRIP_GENERATED', 'photobooth-camera'), ev('a', 'PHOTOBOOTH_STRIP_GENERATED', 'photobooth-avatar')]).photostrips).toBe(2);
  });
});
