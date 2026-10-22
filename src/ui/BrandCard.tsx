import { useEffect } from 'react';
import { BRANDS, PRODUCTS } from '../data/catalog';
import { deliversTo } from '../location/pincode';
import { recommend } from '../recommendation/engine';
import { track } from '../telemetry';
import type { Brand, UserProfile } from '../types';
import { BrandLogo } from './BrandLogo';

interface Props { brand: Brand; profile: UserProfile; saved: string[]; onSave: (id: string) => void }

export function BrandCard({ brand, profile, saved, onSave }: Props) {
  const ok = deliversTo(brand.supportedPincodes, profile.pincode);
  const recs = recommend(PRODUCTS.filter((x) => x.brandId === brand.id), BRANDS, profile).slice(0, 3);

  useEffect(() => {
    track('STORE_VISITED', { brandId: brand.id, category: brand.category, delivers: ok });
    recs.forEach((r) => track('RECOMMENDATION_IMPRESSION', { productId: r.product.id, brandId: brand.id, category: r.product.category }));
    const top = recs[0]; if (top) track('PRODUCT_VIEWED', { productId: top.product.id, brandId: brand.id });
  }, [brand.id]); // fire once per store visit

  const save = (productId: string, category: string) => {
    track('RECOMMENDATION_CLICKED', { productId, brandId: brand.id, category });
    if (!saved.includes(productId)) track('PRODUCT_SAVED', { productId, brandId: brand.id, category });
    onSave(productId);
  };
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
          <button className="btn" onClick={() => save(r.product.id, r.product.category)}>{saved.includes(r.product.id) ? 'Saved' : 'Save to lookbook'}</button>
        </div>
      ))}
      <p><a href={brand.url} target="_blank" rel="noopener noreferrer"
        onClick={() => track('EXTERNAL_ROUTE_CLICKED', { brandId: brand.id, category: brand.category })}>Visit {brand.name}</a></p>
    </aside>
  );
}
