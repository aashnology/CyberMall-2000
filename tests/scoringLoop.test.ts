import { describe, it, expect } from 'vitest';
import { computeLifts, liftReport, activeMoodId, liftFor, SHRINKAGE_K, LIFT_MIN, LIFT_MAX, EMPTY_LIFTS } from '../src/engine/scoringLoop';
import { MOODS, moodVector, matchMood, scoreEntry } from '../src/data/moods';
import { TelemetryLog, type EventType, type TelemetryEvent } from '../src/analytics/telemetry';
import type { Store } from '../src/data/types';
import type { DirectoryEntry } from '../src/engine/pincode';

const PIN = '400058';
const mk = (id: string, subcategory: string, pins: readonly string[] = [PIN]): Store => ({ id, name: id, floorId: 2, subcategory, serviceablePincodes: pins });
const CATALOG = [mk('b1', 'books'), mk('b2', 'books'), mk('t1', 'tea room'), mk('far', 'books', ['110001'])];
const cozy = MOODS.find((m) => m.id === 'cozy-sunday')!;

let t = 0;
const ev = (session: string, type: EventType, item: string | null, moodId: string | null = 'cozy-sunday', pin = PIN): TelemetryEvent => ({
  session_id: session, timestamp: new Date(Date.UTC(2026, 9, 24, 9, 0, t++)).toISOString(), pincode: pin, event_type: type, item_id: item,
  match_score: null, user_mood_vector: moodId === null ? null : moodVector(moodId),
});
const entry = (store: Store, status: DirectoryEntry['status'] = 'delivers'): DirectoryEntry => ({ store, status, ribbon: null });

/** N sessions each see `store` under cozy-sunday; the first `hits` of them open its modal. */
function cohort(prefix: string, store: string, n: number, hits: number, outcome: EventType = 'STORE_MODAL_OPENED'): TelemetryEvent[] {
  const out: TelemetryEvent[] = [];
  for (let i = 0; i < n; i++) {
    const s = `${prefix}-${String(i).padStart(4, '0')}`;
    out.push(ev(s, 'STORE_IMPRESSION', store));
    if (i < hits) out.push(ev(s, outcome, store));
  }
  return out;
}

describe('computeLifts: cold start', () => {
  it('empty log ⇒ empty table, and scores equal the editorial prior exactly', () => {
    const lifts = computeLifts([], CATALOG, MOODS);
    expect(lifts.byMood).toEqual({});
    const e = entry(CATALOG[0]!);
    expect(scoreEntry(cozy, e, lifts)).toBe(scoreEntry(cozy, e));
    expect(scoreEntry(cozy, e, EMPTY_LIFTS)).toBe(1);
  });
  it('a single mood with no outcomes anywhere (pooled rate 0) keeps lift 1', () => {
    const lifts = computeLifts(cohort('s', 'b1', 5, 0), CATALOG, MOODS);
    expect(liftFor(lifts, 'cozy-sunday', 'books')?.lift).toBe(1);
  });
});

describe('computeLifts: attribution rules', () => {
  it('ignores impressions without a mood, unknown stores and non-deliverable stores, and reports them', () => {
    const events = [
      ev('s-0001', 'STORE_IMPRESSION', 'b1', null),
      ev('s-0002', 'STORE_IMPRESSION', 'ghost'),
      ev('s-0003', 'STORE_IMPRESSION', 'far'),
      ev('s-0004', 'STORE_IMPRESSION', 'b1'),
    ];
    const r = computeLifts(events, CATALOG, MOODS);
    expect(r.diagnostics).toEqual({ noMood: 1, unknownStore: 1, notDeliverable: 1, usedJourneys: 1 });
  });
  it('an outcome only counts for a journey exposed under the same mood', () => {
    const events = [
      ev('s-0001', 'STORE_IMPRESSION', 'b1', 'cozy-sunday'),
      ev('s-0001', 'STORE_MODAL_OPENED', 'b1', 'self-care'),   // different mood: not attributed
      ev('s-0002', 'STORE_IMPRESSION', 'b1', 'cozy-sunday'),
      ev('s-0002', 'STORE_MODAL_OPENED', 'b1', 'cozy-sunday'),
    ];
    const cell = computeLifts(events, CATALOG, MOODS).byMood['cozy-sunday']!.cells['books']!;
    expect(cell.n).toBe(2);
    expect(cell.sum).toBe(0.5);
  });
  it('journey value is the deepest stage reached, not the sum', () => {
    const events = [
      ev('s-0001', 'STORE_IMPRESSION', 'b1'), ev('s-0001', 'STORE_HOVER_DWELL', 'b1'), ev('s-0001', 'STORE_MODAL_OPENED', 'b1'), ev('s-0001', 'PRODUCT_SAVED_LOOKBOOK', 'b1'),
    ];
    expect(computeLifts(events, CATALOG, MOODS).byMood['cozy-sunday']!.cells['books']!.sum).toBe(0.75);
  });
  it('duplicate impressions of the same (session, store, mood) count once', () => {
    const events = [ev('s-0001', 'STORE_IMPRESSION', 'b1'), ev('s-0001', 'STORE_IMPRESSION', 'b1')];
    expect(computeLifts(events, CATALOG, MOODS).byMood['cozy-sunday']!.cells['books']!.n).toBe(2 - 1);
  });
  it('activeMoodId rejects absent, all-zero and tied vectors', () => {
    expect(activeMoodId(null)).toBeNull();
    expect(activeMoodId({ a: 0, b: 0 })).toBeNull();
    expect(activeMoodId({ a: 1, b: 1 })).toBeNull();
    expect(activeMoodId({ a: 0, b: 1 })).toBe('b');
  });
});

describe('computeLifts: the math', () => {
  // books: 20 journeys, 16 modal opens (y=.5) ⇒ s=8.  tea room: 20 journeys, 2 opens ⇒ s=1.
  const events = [...cohort('bk', 'b1', 20, 16), ...cohort('tr', 't1', 20, 2)];
  const mood = computeLifts(events, CATALOG, MOODS).byMood['cozy-sunday']!;

  it('pooled rate = Σy / Σn', () => { expect(mood.pooledRate).toBeCloseTo(9 / 40, 12); });
  it('cell rate is shrunk toward the pooled rate with K pseudo-journeys', () => {
    const p = 9 / 40;
    expect(mood.cells['books']!.rate).toBeCloseTo((8 + SHRINKAGE_K * p) / (20 + SHRINKAGE_K), 12);
  });
  it('the over-performing subcategory is lifted, the under-performing one is cut, both within bounds', () => {
    expect(mood.cells['books']!.lift).toBeGreaterThan(1);
    expect(mood.cells['tea room']!.lift).toBeLessThan(1);
    for (const c of Object.values(mood.cells)) { expect(c.lift).toBeGreaterThanOrEqual(LIFT_MIN); expect(c.lift).toBeLessThanOrEqual(LIFT_MAX); }
  });
  it('lift is clamped to [LIFT_MIN, LIFT_MAX] under extreme data', () => {
    const extreme = computeLifts([...cohort('x', 'b1', 500, 500, 'EXTERNAL_MERCHANT_ROUTED'), ...cohort('y', 't1', 500, 0)], CATALOG, MOODS).byMood['cozy-sunday']!;
    expect(extreme.cells['books']!.lift).toBe(LIFT_MAX);
    expect(extreme.cells['tea room']!.lift).toBe(LIFT_MIN);
  });
  it('little data barely moves the lift (shrinkage): one hit vs one miss ⇒ |lift − 1| < 0.1', () => {
    const tiny = computeLifts([...cohort('a', 'b1', 1, 1), ...cohort('b', 't1', 1, 0)], CATALOG, MOODS).byMood['cozy-sunday']!;
    expect(Math.abs(tiny.cells['books']!.lift - 1)).toBeLessThan(0.1);
    expect(Math.abs(tiny.cells['tea room']!.lift - 1)).toBeLessThan(0.1);
    expect(tiny.cells['books']!.lift).toBeGreaterThan(1);
    expect(tiny.cells['tea room']!.lift).toBeLessThan(1);
  });
});

describe('scoring with lifts', () => {
  const lifts = computeLifts([...cohort('bk', 'b1', 20, 16), ...cohort('tr', 't1', 20, 2)], CATALOG, MOODS);
  it('scores stay in [0,1] for every status, with lifts applied', () => {
    for (const s of CATALOG) for (const status of ['delivers', 'unknown', 'not-deliverable'] as const) for (const m of MOODS) {
      const v = scoreEntry(m, entry(s, status), lifts);
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('a store with no prior affinity is never promoted by learning', () => {
    const none = entry(mk('x', 'unmapped-category'));
    expect(scoreEntry(cozy, none, lifts)).toBe(0);
    expect(matchMood(cozy, [none], lifts)).toHaveLength(0);
  });
  it('deliverable still beats non-deliverable at equal fit', () => {
    const s = CATALOG[0]!;
    expect(scoreEntry(cozy, entry(s, 'delivers'), lifts)).toBeGreaterThan(scoreEntry(cozy, entry(s, 'not-deliverable'), lifts));
  });
  it('the explanation shows the learned lift and its sample size', () => {
    const r = matchMood(cozy, [entry(CATALOG[0]!)], lifts)[0]!;
    expect(r.why).toMatch(/learned lift \d\.\d\d \(n=20\)/);
  });
  it('results remain sorted by non-increasing score', () => {
    const r = matchMood(cozy, CATALOG.map((s) => entry(s)), lifts);
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.score).toBeGreaterThanOrEqual(r[i]!.score);
  });
});

describe('end to end: real TelemetryLog → CSV-grade events → lifts', () => {
  it('events written through the typed pipeline feed the loop', () => {
    let n = 0;
    const log = new TelemetryLog({ sessionId: 'sess-0001', now: () => new Date(Date.UTC(2026, 9, 24, 9, 0, n++)), persistDelayMs: 0 });
    const base = { pincode: PIN, user_mood_vector: moodVector('cozy-sunday') };
    log.track('STORE_IMPRESSION', { ...base, item_id: 'b1', match_score: 0.8 });
    log.track('STORE_MODAL_OPENED', { ...base, item_id: 'b1', match_score: 0.8 });
    const cell = computeLifts(log.events(), CATALOG, MOODS).byMood['cozy-sunday']!.cells['books']!;
    expect(cell.n).toBe(1);
    expect(cell.sum).toBe(0.5);
  });
});

describe('liftReport (dashboard view-model)', () => {
  it('lists every prior subcategory of every mood; no data ⇒ lift 1, n 0, effective = prior', () => {
    const rep = liftReport(EMPTY_LIFTS, MOODS);
    expect(rep.map((m) => m.moodId)).toEqual(MOODS.map((m) => m.id));
    for (const m of rep) {
      const mood = MOODS.find((x) => x.id === m.moodId)!;
      expect(m.rows).toHaveLength(Object.keys(mood.weights).length);
      for (const r of m.rows) { expect(r.lift).toBe(1); expect(r.n).toBe(0); expect(r.rate).toBeNull(); expect(r.effective).toBe(r.prior); expect(r.evidenceShare).toBe(0); }
    }
  });
  it('reflects learned cells, is sorted by effective weight and matches the scorer', () => {
    const lifts = computeLifts([...cohort('bk', 'b1', 20, 16), ...cohort('tr', 't1', 20, 2)], CATALOG, MOODS);
    const m = liftReport(lifts, MOODS).find((x) => x.moodId === 'cozy-sunday')!;
    expect(m.journeys).toBe(40);
    const books = m.rows.find((r) => r.subcategory === 'books')!;
    expect(books.n).toBe(20);
    expect(books.evidenceShare).toBeCloseTo(20 / (20 + SHRINKAGE_K), 12);
    expect(books.effective).toBe(Math.min(1, books.prior * books.lift));
    expect(scoreEntry(cozy, entry(CATALOG[0]!), lifts)).toBeCloseTo(books.effective, 12);
    for (let i = 1; i < m.rows.length; i++) expect(m.rows[i - 1]!.effective).toBeGreaterThanOrEqual(m.rows[i]!.effective);
  });
});
