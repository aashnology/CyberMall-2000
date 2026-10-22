import { useState } from 'react';
import type { Brand } from '../types';

/** Real logo fetched on the laptop at runtime; falls back to a text wordmark if offline or missing. */
export function BrandLogo({ brand }: { brand: Brand }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="wordmark">{brand.name.slice(0, 2)}</div>;
  return <img className="logo" alt={`${brand.name} logo`} onError={() => setFailed(true)}
    src={`https://www.google.com/s2/favicons?domain=${brand.domain}&sz=128`} />;
}
