import { PRODUCTS, BRANDS } from '../data/catalog';
import { deliversTo } from '../location/pincode';
import { recommend } from '../recommendation/engine';
import type { Brand, UserProfile } from '../types';
import { BrandLogo } from './BrandLogo';

interface Props { brand: Brand; profile: UserProfile; saved: string[]; onSave: (id: string) => void }

export function BrandCard({ brand, profile, saved, onSave }: Props) {
  const ok = deliversTo(brand.supportedPincodes, profile.pincode);
  const recs = recommend(PRODUCTS.filter((x) => x.brandId === brand.id), BRANDS, profile).slice(0, 3);
  return (
    <aside className="card" aria-live="polite">
      <header>
        <BrandLogo brand={brand} />
        <div><h2>{brand.name}</h2>
          <span className={`badge ${ok ? 'ok' : 'no'}`}>{ok ? `Delivers to ${profile.pincode}` : `Not available for ${profile.pincode}`}</span></div>
      </header>
      {recs.length === 0 && <p>No sample items here yet. Visit the brand to browse.</p>}
      {recs.map((r) => (
        <div className="rec" key={r.product.id}>
          <strong>{r.product.name}</strong> · ₹{r.product.price.toLocaleString('en-IN')} · score {r.score.toFixed(2)}
          <small>Recommended because it {r.reasons.join(', ')}.</small>
          <button className="btn" onClick={() => onSave(r.product.id)}>{saved.includes(r.product.id) ? 'Saved' : 'Save to lookbook'}</button>
        </div>
      ))}
      <p><a href={brand.url} target="_blank" rel="noopener noreferrer">Visit {brand.name}</a></p>
    </aside>
  );
}
