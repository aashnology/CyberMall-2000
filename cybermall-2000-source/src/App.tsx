import { useCallback, useEffect, useMemo, useState } from 'react';
import { BRANDS, FLOORS, MOODS } from './data/catalog';
import { placeStores } from './data/layout';
import { PRESETS, timeOfDayFromHour } from './lighting/dayCycle';
import { isValidPincode } from './location/pincode';
import { COLLECTIBLES } from './rewards/collectibles';
import { Floor } from './scene/Floor';
import { useMall } from './store/useMall';
import { usePlayer } from './store/usePlayer';
import { track } from './telemetry';
import { BrandCard } from './ui/BrandCard';
import { Dashboard } from './ui/Dashboard';
import { ElevatorPanel } from './ui/ElevatorPanel';
import { MallMap } from './ui/MallMap';
import { SettingsPanel } from './ui/SettingsPanel';
import type { UserProfile } from './types';

function Lobby({ onEnter }: { onEnter: (p: string) => void }) {
  const [value, setValue] = useState('');
  const bad = value.length > 0 && !isValidPincode(value);
  return (
    <main className="gate">
      <h1>CyberMall 2000</h1>
      <label htmlFor="pin">Enter your pincode to see what delivers to you</label>
      <input id="pin" inputMode="numeric" maxLength={6} value={value} onChange={(e) => setValue(e.target.value)} placeholder="400001" />
      {bad && <span className="err">Pincodes are 6 digits and do not start with 0.</span>}
      <button disabled={!isValidPincode(value)} onClick={() => onEnter(value)}>Enter the mall</button>
    </main>
  );
}

export default function App() {
  const { pincode, floor, moods, saved, collected, filter, time, setPincode, setFloor, toggleMood, toggleSaved, collect } = useMall();
  const brandId = usePlayer((s) => s.brandId); const itemId = usePlayer((s) => s.itemId); const atElevator = usePlayer((s) => s.atElevator);
  const [mapOpen, setMapOpen] = useState(false); const [dashOpen, setDashOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false); const [transition, setTransition] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const slots = useMemo(() => placeStores(floor), [floor]);
  const items = useMemo(() => COLLECTIBLES.filter((c) => c.floor === floor && !collected.includes(c.id)), [floor, collected]);
  const preset = PRESETS[time === 'auto' ? timeOfDayFromHour(new Date().getHours()) : time];
  const brand = BRANDS.find((b) => b.id === brandId);
  const item = COLLECTIBLES.find((c) => c.id === itemId);

  useEffect(() => { if (!atElevator) setDismissed(false); }, [atElevator]);
  const openMap = useCallback(() => { setMapOpen(true); track('MAP_OPENED'); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'm' && pincode) { setMapOpen((o) => { if (!o) track('MAP_OPENED'); return !o; }); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [pincode]);

  const onCollect = useCallback((id: string) => {
    const c = COLLECTIBLES.find((x) => x.id === id);
    if (!c || collected.includes(id)) return;
    collect(id); track('EASTER_EGG_FOUND', { itemId: id, floor: c.floor });
    setToast(`Collected: ${c.name}. Badge unlocked: ${c.badge}`); setTimeout(() => setToast(null), 3500);
  }, [collected, collect]);

  const changeFloor = (f: number) => {
    if (f === floor || transition !== null) return;
    track('FLOOR_CHANGED', { from: floor, to: f });
    setTransition(f); setTimeout(() => setFloor(f), 600); setTimeout(() => setTransition(null), 1200);
  };

  if (!pincode) return <Lobby onEnter={(p) => { setPincode(p); track('PINCODE_UPDATED', { pincode: p }); }} />;
  const profile: UserProfile = { pincode, moods, colors: [], category: null, budget: null };
  return (
    <div className={`stage f-${filter}`}>
      <Floor key={floor} floor={floor} slots={slots} items={items} preset={preset} onCollect={onCollect} onOpenMap={openMap} />
      {atElevator && !dismissed && <ElevatorPanel floor={floor} onSelect={changeFloor} onClose={() => setDismissed(true)} />}
      <div className="moods" role="group" aria-label="Moods">
        {MOODS.map((m) => (
          <button key={m.id} className={`chip ${moods.includes(m.id) ? 'on' : ''}`} title={m.blurb}
            onClick={() => { if (!moods.includes(m.id)) track('MOOD_SELECTED', { moodId: m.id }); toggleMood(m.id); }}>{m.title}</button>
        ))}
      </div>
      <SettingsPanel onMap={openMap} onDashboard={() => setDashOpen(true)} />
      <div className="hint">Floor {floor}: {FLOORS.find((f) => f.floor === floor)?.label}. WASD or arrows to walk, M for the map, the lift is at the bottom.</div>
      {item && <div className="collect">Inspect / Collect [E]: {item.name}</div>}
      {toast && <div className="collect">{toast}</div>}
      {brand && !atElevator && <BrandCard key={brand.id} brand={brand} profile={profile} saved={saved} onSave={toggleSaved} />}
      {mapOpen && <MallMap slots={slots} pincode={pincode} onClose={() => setMapOpen(false)} />}
      {dashOpen && <Dashboard onClose={() => setDashOpen(false)} />}
      {transition !== null && <div className="veil">Floor {transition}: {FLOORS.find((f) => f.floor === transition)?.label}</div>}
    </div>
  );
}
