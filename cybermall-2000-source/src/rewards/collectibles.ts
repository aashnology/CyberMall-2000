export type ScreenFilter = 'none' | 'crt' | 'vhs' | 'disposable';
export interface Collectible { id: string; name: string; floor: number; x: number; z: number; badge: string; filter: ScreenFilter; color: string }

/** Tucked into corners: plants by the food court, record-shop corner, cinema lobby. */
export const COLLECTIBLES: Collectible[] = [
  { id: 'tamagotchi', name: 'Pixelated 1998 Tamagotchi', floor: 1, x: 16.5, z: 9, badge: "Mall Rat '99", filter: 'crt', color: '#7CFC9A' },
  { id: 'cassette', name: 'Translucent purple cassette', floor: 1, x: 13, z: -11.5, badge: 'Tape Collector', filter: 'vhs', color: '#b07cff' },
  { id: 'golden-key', name: 'Vintage golden key', floor: 2, x: 15, z: -10.5, badge: 'Key Keeper', filter: 'disposable', color: '#ffd24a' },
];

export function unlockedFilters(collected: readonly string[]): ScreenFilter[] {
  const out: ScreenFilter[] = ['none'];
  for (const c of COLLECTIBLES) if (collected.includes(c.id)) out.push(c.filter);
  return out;
}
export const earnedBadges = (collected: readonly string[]): string[] =>
  COLLECTIBLES.filter((c) => collected.includes(c.id)).map((c) => c.badge);
