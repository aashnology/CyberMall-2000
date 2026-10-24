import { useSyncExternalStore } from 'react';
import { DEFAULT_CONCOURSE as SPEC, buildMapGeometry, type FloorLayout } from '../spatial/concourse';
import { landmarkPositions } from '../scene/drawScene';
import type { DirectoryEntry } from '../engine/pincode';
import { FLOORS, type FloorId } from '../data/types';
import { useMallStore } from '../state/mallStore';
import { walkerBus } from '../state/walkerBus';

export function MiniMap({ layout, entries, floorId }: { readonly layout: FloorLayout; readonly entries: readonly DirectoryEntry[]; readonly floorId: FloorId }): React.JSX.Element {
  const close = useMallStore((s) => s.closePanel);
  const w = useSyncExternalStore(walkerBus.subscribe, walkerBus.get);
  const g = buildMapGeometry(SPEC, layout.radius, 12);
  const me = g.youAreHere(w.t, w.lateral);
  const lm = landmarkPositions(SPEC, layout.radius);
  const u = layout.radius / 40;
  return (
    <div className="map-pop" role="dialog" aria-label="You are here">
      <div className="drawer-head"><h2>You are here</h2><button type="button" onClick={close} aria-label="Close map">✕</button></div>
      <svg viewBox={g.viewBox} className="map-svg" role="img" aria-label={`Floor ${floorId} blueprint: a C-shaped concourse around an open atrium`}>
        <circle cx={g.atrium.cx} cy={g.atrium.cy} r={g.atrium.r} fill="#E8DFCB" stroke="#C28D39" strokeWidth={0.5 * u} />
        {floorId === 1 && <circle cx={g.atrium.cx} cy={g.atrium.cy} r={g.atrium.r * 0.45} fill="#7ED3E6" stroke="#C28D39" strokeWidth={0.4 * u} />}
        <path d={g.centerlinePath} fill="none" stroke="#2B1E1A" strokeWidth={g.strokeWidth + 2 * u} strokeLinecap="butt" />
        <path d={g.centerlinePath} fill="none" stroke="#F2F5E2" strokeWidth={g.strokeWidth} strokeLinecap="butt" />
        <path d={g.centerlinePath} fill="none" stroke="#C28D39" strokeWidth={0.5 * u} strokeDasharray={`${2 * u} ${1.4 * u}`} />
        {layout.placements.map((p, i) => {
          const e = entries[i];
          return <circle key={e?.store.id ?? i} cx={p.x} cy={p.y} r={Math.max(0.7, 1.5 * p.scale) * u * 0.7} fill={e?.status === 'not-deliverable' ? '#8A8580' : '#58111A'} />;
        })}
        <g transform={`translate(${lm.elevator.x} ${lm.elevator.y})`}><rect x={-3.2 * u} y={-2.4 * u} width={6.4 * u} height={4.8 * u} fill="#3B2A22" stroke="#C28D39" strokeWidth={0.4 * u} /><text y={0.9 * u} textAnchor="middle" fontSize={2.6 * u} fill="#FDFBF7">E</text></g>
        <g transform={`translate(${lm.centerpiece.x} ${lm.centerpiece.y})`}><circle r={3 * u} fill="#C5A059" stroke="#58111A" strokeWidth={0.4 * u} /><text y={1 * u} textAnchor="middle" fontSize={2.8 * u} fill="#58111A">★</text></g>
        <g transform={`translate(${me.x} ${me.y})`}>
          <circle r={3.2 * u} fill="#58111A" opacity={0.25}><animate attributeName="r" values={`${2 * u};${4.4 * u};${2 * u}`} dur="1.8s" repeatCount="indefinite" /></circle>
          <circle r={1.7 * u} fill="#58111A" stroke="#FDFBF7" strokeWidth={0.5 * u} />
        </g>
      </svg>
      <p className="legend"><i className="dot you" /> You · <i className="dot store" /> Store · <i className="dot off" /> Does not deliver · <b>E</b> Elevator · <b>★</b> Centerpiece<br />Floor {floorId}: {FLOORS[floorId].name} · {entries.length} {entries.length === 1 ? 'store' : 'stores'}</p>
    </div>
  );
}
