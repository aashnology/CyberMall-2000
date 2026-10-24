import { useEffect } from 'react';
import { FLOORS, FLOOR_IDS, type FloorId } from '../data/types';
import { useMallStore } from '../state/mallStore';
import { audio } from '../audio/instance';

const BRASS = '#C28D39';
const dialPoint = (i: number, r: number): { x: number; y: number } => {
  const a = Math.PI + (i / (FLOOR_IDS.length - 1)) * Math.PI;
  return { x: 320 + Math.cos(a) * r, y: 84 + Math.sin(a) * r };
};

export function Elevator(): React.JSX.Element {
  const { floorId, setFloor, closePanel } = useMallStore();
  const choose = (f: FloorId): void => { audio.play('bell'); setFloor(f); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 9) { audio.play('bell'); setFloor(n as FloorId); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setFloor]);
  const needle = dialPoint(FLOOR_IDS.indexOf(floorId), 52);

  return (
    <div className="elevator-wrap" role="dialog" aria-label="Elevator">
      <svg viewBox="0 0 640 440" className="elevator-svg" role="group" aria-label="Elevator cabin">
        <defs>
          <linearGradient id="el-wood" x1="0" x2="1"><stop offset="0" stopColor="#3B2418" /><stop offset=".5" stopColor="#6A4426" /><stop offset="1" stopColor="#3B2418" /></linearGradient>
          <linearGradient id="el-mirror" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#EAF0F2" /><stop offset=".45" stopColor="#B9C7CE" /><stop offset="1" stopColor="#DDE6EA" /></linearGradient>
          <linearGradient id="el-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F1D58C" /><stop offset=".5" stopColor="#C28D39" /><stop offset="1" stopColor="#8A5F22" /></linearGradient>
          <radialGradient id="el-glow"><stop offset="0" stopColor="#FFF1B8" /><stop offset="1" stopColor="#E0A93A" /></radialGradient>
          <pattern id="el-carpet" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="#58111A" /><path d="M13 3 L23 13 L13 23 L3 13 Z" fill="none" stroke="#C5A059" strokeWidth="1.2" opacity=".7" /></pattern>
        </defs>
        {/* side walls (wood panelling, perspective) */}
        <polygon points="0,0 120,60 120,340 0,440" fill="url(#el-wood)" />
        <polygon points="640,0 520,60 520,340 640,440" fill="url(#el-wood)" />
        {[0, 1, 2].map((i) => <polygon key={`l${i}`} points={`${14 + i * 34},${70 + i * 18} ${40 + i * 34},${82 + i * 18} ${40 + i * 34},${318 - i * 12} ${14 + i * 34},${352 - i * 12}`} fill="none" stroke={BRASS} strokeOpacity=".55" />)}
        {[0, 1, 2].map((i) => <polygon key={`r${i}`} points={`${626 - i * 34},${70 + i * 18} ${600 - i * 34},${82 + i * 18} ${600 - i * 34},${318 - i * 12} ${626 - i * 34},${352 - i * 12}`} fill="none" stroke={BRASS} strokeOpacity=".55" />)}
        {/* ceiling + back mirror wall */}
        <polygon points="0,0 640,0 520,60 120,60" fill="#2B1E1A" />
        <rect x="120" y="60" width="400" height="280" fill="url(#el-mirror)" />
        <path d="M150 340 L260 60 M230 340 L330 60" stroke="#FFFFFF" strokeOpacity=".45" strokeWidth="14" />
        <rect x="120" y="60" width="400" height="280" fill="none" stroke="url(#el-brass)" strokeWidth="5" />
        {/* brass handrail */}
        <rect x="124" y="214" width="392" height="9" rx="4.5" fill="url(#el-brass)" />
        {[170, 320, 470].map((x) => <rect key={x} x={x - 4} y="220" width="8" height="18" fill="url(#el-brass)" />)}
        {/* vintage dial floor indicator */}
        <path d="M262 84 A58 58 0 0 1 378 84 Z" fill="#1A110E" stroke="url(#el-brass)" strokeWidth="4" />
        {FLOOR_IDS.map((f, i) => {
          const a = dialPoint(i, 44);
          const b = dialPoint(i, 52);
          return <g key={f}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={f === floorId ? '#FFE9A8' : BRASS} strokeWidth="2" />
            <text x={dialPoint(i, 34).x} y={dialPoint(i, 34).y + 3} textAnchor="middle" fontSize="9" fill={f === floorId ? '#FFE9A8' : '#C5A059'} fontFamily="Georgia, serif">{f}</text></g>;
        })}
        <line x1="320" y1="84" x2={needle.x} y2={needle.y} stroke="#FFE9A8" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="320" cy="84" r="5" fill="url(#el-brass)" />
        {/* carpet floor */}
        <polygon points="0,440 120,340 520,340 640,440" fill="url(#el-carpet)" />
        <polygon points="120,340 520,340 520,350 120,350" fill="#2B1E1A" opacity=".5" />
        {/* button panel: number + category plate */}
        <rect x="528" y="78" width="104" height="252" rx="8" fill="#1A110E" stroke="url(#el-brass)" strokeWidth="3" />
        {FLOOR_IDS.map((f, i) => {
          const y = 98 + i * 26;
          const on = f === floorId;
          return (
            <g key={f} className="el-btn" tabIndex={0} role="button" aria-label={`Floor ${f}: ${FLOORS[f].name}`} onClick={() => choose(f)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(f); } }}>
              <circle cx="552" cy={y} r="10" fill={on ? 'url(#el-glow)' : '#4A3322'} stroke="url(#el-brass)" strokeWidth="2" />
              {on && <circle cx="552" cy={y} r="14" fill="#FFE9A8" opacity=".25" />}
              <text x="552" y={y + 4} textAnchor="middle" fontSize="11" fontFamily="Georgia, serif" fontWeight="700" fill={on ? '#2B1E1A' : '#E9C77B'}>{f}</text>
              <rect x="568" y={y - 8} width="60" height="16" rx="2" fill="#0E0A08" stroke={BRASS} strokeOpacity=".6" />
              <text x="598" y={y + 3.5} textAnchor="middle" fontSize="7" fontFamily="Georgia, serif" letterSpacing=".6" fill={on ? '#FFE9A8' : '#C5A059'}>{FLOORS[f].plate}</text>
            </g>
          );
        })}
      </svg>
      <div className="elevator-foot">
        <p>Floor {floorId} · {FLOORS[floorId].name}. Press <kbd>1</kbd>–<kbd>9</kbd> or tap a button.</p>
        <button type="button" onClick={closePanel}>Step out</button>
      </div>
    </div>
  );
}
