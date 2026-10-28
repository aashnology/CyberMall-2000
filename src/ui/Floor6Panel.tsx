import { FILMS, OTT_META, OTT_PLATFORMS, THEATRE_META, type Theatre } from '../data/mediaSnapshots';
import type { Floor6Model } from '../data/floor6';
import type { Pincode } from '../data/types';

const filmTitle = (id: string): string => FILMS.find((f) => f.id === id)?.title ?? id;

export function Floor6Panel({ model, pincode }: { readonly model: Floor6Model; readonly pincode: Pincode | null }): React.JSX.Element {
  const approx = model.nearest.basis === 'pin-similarity';
  return (
    <aside className="floor6" aria-label="Theatre and OTT">
      <p className="snapshot-note">Sample data · captured {THEATRE_META.capturedAt}. Showtimes are illustrative; live ticketing arrives in a later milestone.</p>
      <h3>Theatres near {pincode}</h3>
      <p className="muted">{approx ? 'Ordered by PIN similarity (approximate, not walking distance).' : 'Ordered by distance between PIN centroids.'}</p>
      <ul className="theatres">
        {model.nearest.ranked.map(({ theatre, score }) => <TheatreCard key={theatre.id} theatre={theatre} km={approx ? null : score} />)}
      </ul>
      <h3>Hot &amp; Trending on OTT</h3>
      <p className="muted">{OTT_META.basis}</p>
      {OTT_PLATFORMS.map((p) => (
        <section key={p.id} className="ott-row">
          <header><strong>{p.name}</strong><a href={p.deepLink} target="_blank" rel="noopener noreferrer">Open {p.name}</a></header>
          <div className="carousel" role="list">
            {p.hotAndTrending.map((t) => <div role="listitem" key={t.id} className="poster"><b>{t.title}</b><span>{t.kind}</span></div>)}
          </div>
        </section>
      ))}
    </aside>
  );
}

function TheatreCard({ theatre, km }: { readonly theatre: Theatre; readonly km: number | null }): React.JSX.Element {
  return (
    <li>
      <strong>{theatre.chain} {theatre.locality}</strong> <span className="muted">{theatre.city} · {theatre.pincode}{km !== null ? ` · ~${km.toFixed(1)} km` : ''}</span>
      {theatre.screenings.map((s) => (
        <div key={s.filmId + s.format} className="showtimes">
          <em>{filmTitle(s.filmId)} · {s.format}</em>
          <span>{s.times.map((t) => <time key={t}>{t}</time>)}</span>
        </div>
      ))}
    </li>
  );
}
