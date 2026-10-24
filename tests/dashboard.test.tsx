// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { AnalyticsDashboard } from '../src/components/analytics/AnalyticsDashboard';
import { ExportButton } from '../src/components/analytics/ExportButton';
import { PincodeGate } from '../src/ui/PincodeGate';
import { StoreModal } from '../src/ui/StoreModal';
import { Directory } from '../src/ui/Directory';
import { telemetry } from '../src/analytics/instance';
import { track } from '../src/analytics/track';
import { useMallStore } from '../src/state/mallStore';
import { eventsToCsv } from '../src/analytics/telemetry';
import { parseCsv } from '../src/data/indiaPost';
import { buildDirectory } from '../src/engine/pincode';
import { CATALOG } from '../src/data/catalog';
import type { Pincode } from '../src/data/types';

const PIN = '400058' as Pincode;
let errors: ReturnType<typeof vi.spyOn>;
let warns: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  cleanup(); telemetry.clear();
  useMallStore.setState({ pincode: PIN, floorId: 1, panel: 'none', moodId: null, lookbook: [], selected: null, onlyDeliverable: false });
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  warns = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  expect(errors).not.toHaveBeenCalled();   // zero console errors
  expect(warns).not.toHaveBeenCalled();    // and zero warnings (telemetry faults warn)
  vi.restoreAllMocks();
});

const entryOf = (id: string): ReturnType<typeof buildDirectory>['byFloor'][1][number] => {
  const dir = buildDirectory(CATALOG, { pincode: PIN, onlyDeliverable: false });
  for (const f of [1, 2, 3, 4, 5, 7, 8, 9] as const) { const e = dir.byFloor[f].find((x) => x.store.id === id); if (e) return e; }
  throw new Error(`no ${id}`);
};

describe('pincode modal neutrality', () => {
  it('starts empty with no placeholder, no prefilled or suggested PIN', () => {
    useMallStore.setState({ pincode: null });
    const { container } = render(<PincodeGate />);
    const input = screen.getByLabelText(/your pin code/i) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.getAttribute('placeholder')).toBeNull();
    expect(container.textContent).not.toMatch(/\b\d{6}\b/);
    expect(container.textContent).not.toMatch(/e\.g\./i);
  });
  it('emits PINCODE_SUBMITTED exactly once on a valid submit, none on an invalid one', () => {
    useMallStore.setState({ pincode: null });
    render(<PincodeGate />);
    const input = screen.getByLabelText(/your pin code/i);
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /enter the mall/i }));
    expect(telemetry.events()).toHaveLength(0);
    fireEvent.change(input, { target: { value: '560034' } });
    fireEvent.click(screen.getByRole('button', { name: /enter the mall/i }));
    expect(telemetry.events().map((e) => [e.event_type, e.pincode, e.item_id])).toEqual([['PINCODE_SUBMITTED', '560034', null]]);
  });
});

describe('analytics dashboard', () => {
  const seed = (): void => {
    for (const [s, item, n] of [['a', 'f1-01', 5], ['a', 'f1-02', 3], ['b', 'f1-01', 2], ['c', 'f1-03', 1]] as const) {
      const types = ['STORE_IMPRESSION', 'STORE_HOVER_DWELL', 'STORE_MODAL_OPENED', 'PRODUCT_SAVED_LOOKBOOK', 'EXTERNAL_MERCHANT_ROUTED'] as const;
      for (const t of types.slice(0, n)) {
        telemetry.track(t, { pincode: PIN, item_id: item });
      }
      void s;
    }
  };
  it('shows an honest empty state with a disabled export when nothing is logged', () => {
    render(<AnalyticsDashboard />);
    expect(screen.getByText(/no journeys recorded yet/i)).toBeTruthy();
    expect(document.querySelector('.recharts-bar-rectangle')).toBeNull(); // no fake bars when there is no data
    expect(screen.getByText(/no sessions yet/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /export telemetry \(csv\)/i }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('renders the funnel with counts, conversion and drop-off, the heat map, and an enabled export', () => {
    // one session (this page load): journeys are keyed by store, so f1-01, f1-02, f1-03
    seed();
    render(<AnalyticsDashboard />);
    const funnel = screen.getByRole('region', { name: /conversion funnel/i });
    const rows = within(funnel).getAllByRole('row').slice(1);
    // journeys: f1-01 reaches all 5 stages, f1-02 reaches 3 (impression, dwell, modal), f1-03 only the impression
    expect(rows.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['3', '—', '—', '100.0%'],       // impressions: f1-01, f1-02, f1-03
      ['2', '66.7%', '33.3%', '66.7%'], // dwell: f1-01, f1-02            (2/3)
      ['2', '100.0%', '0.0%', '66.7%'], // modal: f1-01, f1-02            (2/2)
      ['1', '50.0%', '50.0%', '33.3%'], // save: f1-01                    (1/2)
      ['1', '100.0%', '0.0%', '33.3%'], // external: f1-01                (1/1)
    ]);
    expect(within(funnel).getByRole('rowheader', { name: /Detail Modal Open/ })).toBeTruthy();
    // the bar chart itself: one bar and one value label per stage
    expect(funnel.querySelector('svg.recharts-surface')).not.toBeNull();
    expect(funnel.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(5);
    expect(funnel.querySelectorAll('.recharts-label-list text, .recharts-label')).toHaveLength(5);
    const heat = screen.getByRole('region', { name: /aesthetic affinity/i });
    // the session has events but picked no mood: it counts in the cluster denominator, so every cell is 0%
    const zero = within(heat).getAllByRole('cell').filter((c) => /^0%/.test(c.textContent ?? ''));
    expect(zero).toHaveLength(4);
    expect(within(heat).getByRole('rowheader', { name: /Western Suburbs, Mumbai/ })).toBeTruthy();
    expect((screen.getByRole('button', { name: /export telemetry \(csv\)/i }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('heat map fills in once a mood is chosen', () => {
    useMallStore.setState({ panel: 'directory' });
    const dir = buildDirectory(CATALOG, { pincode: PIN, onlyDeliverable: false });
    track('PINCODE_SUBMITTED', null);
    render(<Directory directory={dir} floorEntries={dir.byFloor[1]} />);
    fireEvent.click(screen.getByRole('tab', { name: /match a mood/i }));
    fireEvent.click(screen.getByRole('radio', { name: 'Cozy Sunday' }));
    expect(telemetry.events().map((e) => e.event_type)).toEqual(['PINCODE_SUBMITTED', 'MOOD_SELECTED']);
    const last = telemetry.events()[1]!;
    expect(last.item_id).toBe('cozy-sunday');
    expect(last.user_mood_vector).toEqual({ 'cozy-sunday': 1, 'corporate-chic': 0, 'jazz-club': 0, 'self-care': 0 });
    cleanup();
    render(<AnalyticsDashboard />);
    const cell = screen.getByRole('cell', { name: /100\.0% of 1 sessions from Western Suburbs, Mumbai engaged with Cozy Sunday/ });
    expect(cell.textContent).toContain('1/1');
    expect(screen.getByText(/low n/)).toBeTruthy();
  });
});

describe('export', () => {
  it('hands the injected downloader a valid CSV with the seven columns and every event', () => {
    telemetry.track('PINCODE_SUBMITTED', { pincode: PIN });
    telemetry.track('STORE_MODAL_OPENED', { pincode: PIN, item_id: 'f8-01', match_score: 0.8, user_mood_vector: { 'cozy-sunday': 1 } });
    let got: { name: string; csv: string } | null = null;
    render(<ExportButton events={telemetry.events()} onDownload={(name, csv) => { got = { name, csv }; }} />);
    fireEvent.click(screen.getByRole('button', { name: /export telemetry \(csv\)/i }));
    expect(got).not.toBeNull();
    const { name, csv } = got as unknown as { name: string; csv: string };
    expect(name).toMatch(/^cybermall_telemetry_\d{8}-\d{6}Z\.csv$/);
    expect(csv).toBe(eventsToCsv(telemetry.events()));
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(['session_id', 'timestamp', 'pincode', 'event_type', 'item_id', 'match_score', 'user_mood_vector']);
    expect(rows).toHaveLength(3);
    expect(rows[2]![3]).toBe('STORE_MODAL_OPENED');
    expect(screen.getByRole('status').textContent).toMatch(/Exported 2 events/);
  });
});

describe('store modal events', () => {
  it('save emits PRODUCT_SAVED_LOOKBOOK once, un-save emits nothing, state persists in the store', () => {
    useMallStore.getState().openStore(entryOf('f1-01'));
    render(<StoreModal />);
    const btn = screen.getByRole('button', { name: /save to lookbook/i });
    fireEvent.click(btn);
    expect(telemetry.events().map((e) => e.event_type)).toEqual(['PRODUCT_SAVED_LOOKBOOK']);
    expect(useMallStore.getState().lookbook).toEqual(['f1-01']);
    fireEvent.click(screen.getByRole('button', { name: /saved to lookbook/i }));
    expect(telemetry.events()).toHaveLength(1);
    expect(useMallStore.getState().lookbook).toEqual([]);
  });
  it('a store with no merchant link offers no external route; one with a link emits EXTERNAL_MERCHANT_ROUTED on click', () => {
    useMallStore.getState().openStore(entryOf('f1-01'));
    render(<StoreModal />);
    expect((screen.getByRole('button', { name: /no merchant link/i }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const base = entryOf('f1-02');
    useMallStore.getState().openStore({ ...base, store: { ...base.store, merchantUrl: 'https://example.com/shop' } });
    render(<StoreModal />);
    const link = screen.getByRole('link', { name: /visit merchant/i });
    expect(link.getAttribute('rel')).toContain('noopener');
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(telemetry.events().map((e) => [e.event_type, e.item_id])).toEqual([['EXTERNAL_MERCHANT_ROUTED', 'f1-02']]);
  });
  it('includes match_score when a mood is active and null otherwise', () => {
    const e = entryOf('f8-01');
    track('STORE_MODAL_OPENED', e.store.id, e);
    useMallStore.setState({ moodId: 'cozy-sunday' });
    track('STORE_MODAL_OPENED', e.store.id, e);
    const [a, b] = telemetry.events();
    expect(a!.match_score).toBeNull();
    expect(a!.user_mood_vector).toBeNull();
    expect(b!.match_score).not.toBeNull();
    expect(b!.user_mood_vector?.['cozy-sunday']).toBe(1);
  });
  it('Escape closes the modal', () => {
    useMallStore.getState().openStore(entryOf('f1-01'));
    render(<StoreModal />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useMallStore.getState().selected).toBeNull();
  });
});
