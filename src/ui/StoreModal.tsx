import { useEffect } from 'react';
import { FLOORS } from '../data/types';
import { MOODS, scoreEntry } from '../data/moods';
import { useMallStore } from '../state/mallStore';
import { track } from '../analytics/track';
import { audio } from '../audio/instance';

export function StoreModal(): React.JSX.Element | null {
  const entry = useMallStore((s) => s.selected);
  const moodId = useMallStore((s) => s.moodId);
  const lookbook = useMallStore((s) => s.lookbook);
  const pincode = useMallStore((s) => s.pincode);
  const { closeStore, toggleLookbook } = useMallStore.getState();

  useEffect(() => {
    if (entry === null) return undefined;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); useMallStore.getState().closeStore(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [entry]);

  if (entry === null) return null;
  const { store } = entry;
  const saved = lookbook.includes(store.id);
  const mood = MOODS.find((m) => m.id === moodId);
  const score = mood === undefined ? null : scoreEntry(mood, entry);

  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) closeStore(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="store-title">
        <button type="button" className="modal-x" onClick={closeStore} aria-label="Close">✕</button>
        <p className="eyebrow">Floor {store.floorId} · {FLOORS[store.floorId].name}</p>
        <h2 id="store-title">{store.name}</h2>
        <p className="muted">{store.subcategory}</p>
        {entry.status === 'delivers' && <p className="ok-text">Delivers to {pincode}</p>}
        {entry.ribbon !== null && <p className="ribbon-text" role="status">{entry.ribbon}</p>}
        {store.promo !== undefined && <p className="promo">{store.promo.headline} <small>({store.promo.detail})</small></p>}
        {mood !== undefined && score !== null && <p className="muted">Fit for “{mood.label}”: <strong>{score.toFixed(2)}</strong></p>}
        <div className="modal-actions">
          <button type="button" className={saved ? 'on' : ''} aria-pressed={saved}
            onClick={() => { if (toggleLookbook(store.id)) { audio.play('chime'); track('PRODUCT_SAVED_LOOKBOOK', store.id, entry); } }}>
            {saved ? '♥ Saved to lookbook' : '♡ Save to lookbook'}
          </button>
          {store.merchantUrl !== undefined ? (
            <a className="btn" href={store.merchantUrl} target="_blank" rel="noopener noreferrer" onClick={() => { track('EXTERNAL_MERCHANT_ROUTED', store.id, entry); }}>Visit merchant ↗</a>
          ) : <button type="button" disabled title="This listing has no merchant link yet">No merchant link</button>}
        </div>
      </div>
    </div>
  );
}
