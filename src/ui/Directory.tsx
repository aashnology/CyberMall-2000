import { useMemo, useState } from 'react';
import { FLOORS, FLOOR_IDS, type FloorId } from '../data/types';
import type { DirectoryEntry, DirectoryResult } from '../engine/pincode';
import { MOODS, matchMood } from '../data/moods';
import { useMallStore } from '../state/mallStore';
import { track } from '../analytics/track';
import { audio } from '../audio/instance';
import { CATALOG } from '../data/catalog';

export function Directory({ directory, floorEntries }: { readonly directory: DirectoryResult; readonly floorEntries: readonly DirectoryEntry[] }): React.JSX.Element {
  const { floorId, pincode, closePanel, setFloor, moodId, setMood, lookbook, openStore } = useMallStore();
  const [tab, setTab] = useState<'stores' | 'moods' | 'lookbook'>('stores');
  const mood = MOODS.find((m) => m.id === moodId);
  const everything = useMemo(() => FLOOR_IDS.flatMap((f) => directory.byFloor[f]), [directory]);
  const matches = useMemo(() => (mood === undefined ? [] : matchMood(mood, everything)), [mood, everything]);

  return (
    <aside className="drawer" aria-label="Directory and lookbook">
      <div className="drawer-head">
        <h2>Directory &amp; Lookbook</h2>
        <button type="button" onClick={closePanel} aria-label="Close">✕</button>
      </div>
      <p className="muted">Showing what delivers to <strong>{pincode}</strong>. Stores that cannot reach you are marked, never hidden, unless you ask.</p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'stores'} onClick={() => setTab('stores')}>Floor {floorId}</button>
        <button role="tab" aria-selected={tab === 'moods'} onClick={() => setTab('moods')}>Match a mood</button>
        <button role="tab" aria-selected={tab === 'lookbook'} onClick={() => setTab('lookbook')}>Lookbook ({lookbook.length})</button>
      </div>

      {tab === 'stores' && (
        <>
          <p className="count">{floorEntries.length} {floorEntries.length === 1 ? 'store' : 'stores'} on {FLOORS[floorId].name}</p>
          {floorEntries.length === 0 && <p className="empty">Nothing on this floor delivers to {pincode}. Try another floor, or switch off “Only stores that deliver to me”.</p>}
          <ul className="store-list">
            {floorEntries.map((e) => (
              <li key={e.store.id} className={e.status === 'not-deliverable' ? 'blocked' : ''}>
                <div><strong>{e.store.name}</strong><span>{e.store.subcategory}</span></div>
                {e.ribbon !== null && <em className="ribbon-text">{e.ribbon}</em>}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'moods' && (
        <>
          <div className="mood-row" role="radiogroup" aria-label="Mood">
            {MOODS.map((m) => (
              <button key={m.id} role="radio" aria-checked={m.id === moodId} className={m.id === moodId ? 'on' : ''}
                onClick={() => { audio.play('click'); if (m.id === moodId) setMood(null); else { setMood(m.id); track('MOOD_SELECTED', m.id); } }}>{m.label}</button>
            ))}
          </div>
          <p className="muted">Score = how well a store’s category fits the mood × a delivery factor. Every number is shown.</p>
          {mood === undefined && <p className="empty">Pick a mood to rank stores by fit. With no mood selected, nothing is scored.</p>}
          {mood !== undefined && matches.length === 0 && <p className="empty">No stores match this mood yet.</p>}
          <ul className="store-list">
            {matches.map((m) => (
              <li key={m.entry.store.id} className={m.entry.status === 'not-deliverable' ? 'blocked' : ''}>
                <div>
                  <strong>{m.entry.store.name}</strong>
                  <span>Floor {m.entry.store.floorId} · {FLOORS[m.entry.store.floorId as FloorId].name}</span>
                  <small>{m.why} = {m.score.toFixed(2)}</small>
                </div>
                {m.entry.ribbon !== null ? <em className="ribbon-text">{m.entry.ribbon}</em>
                  : <button type="button" className="link" onClick={() => setFloor(m.entry.store.floorId)}>Go to floor</button>}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'lookbook' && (
        <>
          {lookbook.length === 0 && <p className="empty">Nothing saved yet. Open a store and choose “Save to lookbook”.</p>}
          <ul className="store-list">
            {lookbook.map((id) => {
              const e = everything.find((x) => x.store.id === id);
              const s = e?.store ?? CATALOG.find((x) => x.id === id);
              if (s === undefined) return null;
              return (
                <li key={id} className={e?.status === 'not-deliverable' ? 'blocked' : ''}>
                  <div><strong>{s.name}</strong><span>Floor {s.floorId} · {s.subcategory}</span></div>
                  {e?.ribbon != null ? <em className="ribbon-text">{e.ribbon}</em> : e !== undefined && <button type="button" className="link" onClick={() => openStore(e)}>Open</button>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </aside>
  );
}
