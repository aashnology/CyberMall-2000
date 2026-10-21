import { useMemo, useState } from 'react';
import { BRANDS, FLOORS, MOODS } from './data/catalog';
import { isValidPincode } from './location/pincode';
import { Floor } from './scene/Floor';
import { useMall } from './store/useMall';
import { BrandCard } from './ui/BrandCard';
import { ElevatorPanel } from './ui/ElevatorPanel';
import type { Brand, UserProfile } from './types';

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
  const { pincode, floor, moods, saved, setPincode, setFloor, toggleMood, toggleSaved } = useMall();
  const [near, setNear] = useState<Brand | null>(null);
  const brands = useMemo(() => BRANDS.filter((b) => b.floor === floor), [floor]);
  const category = FLOORS.find((f) => f.floor === floor)?.category ?? null;
  if (!pincode) return <Lobby onEnter={setPincode} />;
  const profile: UserProfile = { pincode, moods, colors: [], category, budget: null };
  return (
    <div className="stage">
      <Floor key={floor} brands={brands} nearbyId={near?.id ?? null} onNearby={setNear} />
      <ElevatorPanel floor={floor} onSelect={(f) => { setNear(null); setFloor(f); }} />
      <div className="moods" role="group" aria-label="Moods">
        {MOODS.map((m) => <button key={m.id} className={`chip ${moods.includes(m.id) ? 'on' : ''}`} title={m.blurb} onClick={() => toggleMood(m.id)}>{m.title}</button>)}
      </div>
      <div className="hint">Move with WASD or arrow keys. Walk up to a store.</div>
      {near && <BrandCard brand={near} profile={profile} saved={saved} onSave={toggleSaved} />}
    </div>
  );
}
