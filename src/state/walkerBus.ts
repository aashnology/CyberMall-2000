/** Tiny pub/sub so the map can show a live "You Are Here" without re-rendering React every frame. */
export interface WalkerSnapshot { readonly t: number; readonly lateral: number }

let current: WalkerSnapshot = { t: 0, lateral: 0 };
const listeners = new Set<() => void>();

export const walkerBus = {
  get: (): WalkerSnapshot => current,
  publish(s: WalkerSnapshot): void {
    if (Math.abs(s.t - current.t) < 0.0005 && Math.abs(s.lateral - current.lateral) < 0.01) return;
    current = s;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
};
