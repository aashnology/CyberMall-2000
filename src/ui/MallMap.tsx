import { useState } from 'react';
import { ELEVATOR, FOUNTAIN_RADIUS, HALF_D, HALF_W, type Placed } from '../data/layout';
import { deliversTo } from '../location/pincode';
import { usePlayer } from '../store/usePlayer';

interface Props { slots: Placed[]; pincode: string | null; onClose: () => void }

/** Blueprint map. The pin follows the avatar; click a store for delivery status and a dashed route. */
export function MallMap({ slots, pincode, onClose }: Props) {
  const x = usePlayer((s) => s.x); const z = usePlayer((s) => s.z);
  const [pick, setPick] = useState<string | null>(null);
  const target = slots.find((p) => p.brand.id === pick);
  return (
    <div className="modal" role="dialog" aria-label="Mall map">
      <div className="mapbox">
        <button className="btn" onClick={onClose}>Close (M)</button>
        <svg viewBox="-23 -17 46 34" width="760">
          <rect x="-23" y="-17" width="46" height="34" fill="#0b2a4a" />
          <rect x={-HALF_W} y={-HALF_D} width={HALF_W * 2} height={HALF_D * 2} fill="none" stroke="#7fc6ff" strokeWidth="0.15" />
          <circle cx="0" cy="0" r={FOUNTAIN_RADIUS} fill="none" stroke="#7fc6ff" strokeWidth="0.15" strokeDasharray="0.4" />
          <text x="0" y="0.3" fontSize="0.9" fill="#7fc6ff" textAnchor="middle">ATRIUM</text>
          <rect x={ELEVATOR.x - 2} y={ELEVATOR.z} width="4" height="1.4" fill="#c9a46a" />
          <text x={ELEVATOR.x} y={ELEVATOR.z - 0.5} fontSize="0.8" fill="#ffd77a" textAnchor="middle">LIFT</text>
          {target && <line x1={x} y1={z} x2={target.slot.x} y2={target.slot.z} stroke="#ffd77a" strokeWidth="0.2" strokeDasharray="0.6" />}
          {slots.map(({ brand, slot }) => (
            <g key={brand.id} onClick={() => setPick(brand.id)} style={{ cursor: 'pointer' }}>
              <circle cx={slot.x} cy={slot.z} r="0.8" fill={pick === brand.id ? '#ffd77a' : '#7fc6ff'} />
              <text x={slot.x} y={slot.z + (slot.z > 0 ? -1.2 : 2)} fontSize="0.9" fill="#fff" textAnchor="middle">{brand.name}</text>
            </g>
          ))}
          <circle cx={x} cy={z} r="0.7" fill="#ff4fa3"><animate attributeName="r" values="0.5;1.1;0.5" dur="1.6s" repeatCount="indefinite" /></circle>
          <text x={x} y={z - 1.3} fontSize="0.9" fill="#ff4fa3" textAnchor="middle" fontWeight="bold">YOU ARE HERE</text>
        </svg>
        {target && <p>{target.brand.name}: {deliversTo(target.brand.supportedPincodes, pincode) ? `delivers to ${pincode}` : `does not deliver to ${pincode}`}. Dashed line shows the way.</p>}
      </div>
    </div>
  );
}
