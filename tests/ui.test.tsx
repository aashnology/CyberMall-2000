// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PincodeGate, PINCODE_MESSAGES } from '../src/ui/PincodeGate';
import { Elevator } from '../src/ui/Elevator';
import { Directory } from '../src/ui/Directory';
import { MiniMap } from '../src/ui/MiniMap';
import { useMallStore } from '../src/state/mallStore';
import { buildDirectory, parsePincode } from '../src/engine/pincode';
import { CATALOG } from '../src/data/catalog';
import { layoutFloor } from '../src/spatial/concourse';

const reset = (): void => useMallStore.setState({ pincode: null, onlyDeliverable: false, floorId: 1, panel: 'none' });
beforeEach(() => { cleanup(); reset(); });

describe('mandatory pincode gate', () => {
  it('blocks with a specific message for each invalid input and stores nothing', () => {
    render(<PincodeGate />);
    const input = screen.getByLabelText(/your pin code/i);
    const cases: Array<[string, keyof typeof PINCODE_MESSAGES]> = [['', 'empty'], ['4000', 'incomplete'], ['40005a', 'non-numeric'], ['4000581', 'too-long'], ['012345', 'invalid-leading-digit']];
    for (const [value, reason] of cases) {
      fireEvent.change(input, { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: /enter the mall/i }));
      expect(screen.getByRole('alert').textContent).toBe(PINCODE_MESSAGES[reason]);
      expect(useMallStore.getState().pincode).toBeNull();
    }
  });
  it('accepts a valid PIN (spaces allowed) and shows the neighbourhood value proposition', () => {
    render(<PincodeGate />);
    expect(screen.getByText(/genuinely delivers to your doorstep in your new neighbourhood/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/your pin code/i), { target: { value: '400 058' } });
    fireEvent.click(screen.getByRole('button', { name: /enter the mall/i }));
    expect(useMallStore.getState().pincode).toBe('400058');
  });
});

describe('store actions', () => {
  it('clearPincode returns to the gate state and closes panels; hour wraps', () => {
    useMallStore.getState().setPincode('560034');
    useMallStore.getState().openPanel('map');
    useMallStore.getState().clearPincode();
    expect(useMallStore.getState().pincode).toBeNull();
    expect(useMallStore.getState().panel).toBe('none');
    useMallStore.getState().setHour(25);
    expect(useMallStore.getState().hour).toBe(1);
    expect(useMallStore.getState().autoClock).toBe(false);
  });
  it('rejects an invalid PIN without changing the stored one', () => {
    useMallStore.getState().setPincode('400058');
    expect(useMallStore.getState().setPincode('12').ok).toBe(false);
    expect(useMallStore.getState().pincode).toBe('400058');
  });
});

describe('elevator', () => {
  it('has all 9 floors, and a button changes the floor and closes the panel', () => {
    useMallStore.setState({ panel: 'elevator' });
    render(<Elevator />);
    expect(screen.getAllByRole('button', { name: /^Floor \d:/ })).toHaveLength(9);
    fireEvent.click(screen.getByRole('button', { name: /Floor 6: Theatre and OTT/ }));
    expect(useMallStore.getState().floorId).toBe(6);
    expect(useMallStore.getState().panel).toBe('none');
  });
  it('keys 1-9 pick a floor', () => {
    render(<Elevator />);
    fireEvent.keyDown(window, { key: '9' });
    expect(useMallStore.getState().floorId).toBe(9);
  });
});

describe('directory drawer shows every store and the exact ribbon', () => {
  it('lists all 48 Floor 1 stores (no cap) with ribbons for non-delivering ones', () => {
    useMallStore.setState({ pincode: parsePincode('400058').ok ? ('400058' as never) : null, floorId: 1, panel: 'directory' });
    const dir = buildDirectory(CATALOG, { pincode: '400058' as never, onlyDeliverable: false });
    render(<Directory directory={dir} floorEntries={dir.byFloor[1]} />);
    expect(dir.byFloor[1].length).toBeGreaterThan(25);
    expect(screen.getAllByRole('listitem')).toHaveLength(dir.byFloor[1].length);
    expect(screen.getAllByText('DOES NOT DELIVER TO 400058').length).toBe(dir.byFloor[1].filter((e) => e.status === 'not-deliverable').length);
  });
  it('mood matching lives in the drawer and shows its working', () => {
    useMallStore.setState({ pincode: '400058' as never });
    const dir = buildDirectory(CATALOG, { pincode: '400058' as never, onlyDeliverable: false });
    render(<Directory directory={dir} floorEntries={dir.byFloor[1]} />);
    fireEvent.click(screen.getByRole('tab', { name: /match a mood/i }));
    expect(screen.getByText(/nothing is scored/i)).toBeTruthy(); // no silent default mood
    fireEvent.click(screen.getByRole('radio', { name: '1990s Jazz-Club Elegance' }));
    expect(screen.getAllByText(/delivery \d\.\d\d/).length).toBeGreaterThan(0);
  });
});

describe('minimap', () => {
  it('renders the curved blueprint (an arc path, not a line) for the current floor', () => {
    const dir = buildDirectory(CATALOG, { pincode: '400058' as never, onlyDeliverable: false });
    const entries = dir.byFloor[1];
    const { container } = render(<MiniMap layout={layoutFloor(entries.length)} entries={entries} floorId={1} />);
    const d = container.querySelector('path')?.getAttribute('d') ?? '';
    expect(d).toMatch(/ A 40\.000 40\.000 0 1 1 /);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/C-shaped/);
  });
});
