import { BRANDS } from './catalog';
import type { Brand, Category } from '../types';

/** The mall is a rectangle of stores around a central atrium. Units are metres. */
export const HALF_W = 20;
export const HALF_D = 14;
export const FOUNTAIN_RADIUS = 3;
export const ELEVATOR = { x: 0, z: HALF_D - 1 };
const SPACING = 6;

/** Stores are grouped by wing, in this order, walking clockwise from the top-left corner. */
export const WING_ORDER: Record<number, Category[]> = {
  1: ['apparel', 'books', 'accessories', 'food', 'wellness'],
  2: ['tech', 'living', 'editorial', 'cinema', 'hobby'],
};

export interface Slot { x: number; z: number; rotY: number }
export interface Placed { brand: Brand; slot: Slot }

function pointAt(d: number): { x: number; z: number } {
  const w = 2 * HALF_W; const h = 2 * HALF_D;
  if (d < w) return { x: -HALF_W + d, z: -HALF_D };
  if (d < w + h) return { x: HALF_W, z: -HALF_D + (d - w) };
  if (d < 2 * w + h) return { x: HALF_W - (d - w - h), z: HALF_D };
  return { x: -HALF_W, z: HALF_D - (d - 2 * w - h) };
}

/** Evenly spaced points on the outer wall, skipping the gap in front of the elevator bank. */
export function perimeterSlots(n: number): Slot[] {
  const total = 2 * (2 * HALF_W) + 2 * (2 * HALF_D);
  const points: { x: number; z: number }[] = [];
  for (let i = 0; i < Math.floor(total / SPACING); i++) points.push(pointAt(i * SPACING));
  return points
    .filter((p) => !(p.z > HALF_D - 4 && Math.abs(p.x) < 5))
    .slice(0, n)
    .map((p) => ({ ...p, rotY: Math.atan2(-p.x, -p.z) })); // local +z faces the atrium
}

export function placeStores(floor: number, brands: readonly Brand[] = BRANDS): Placed[] {
  const order = WING_ORDER[floor] ?? [];
  const onFloor = brands.filter((b) => b.floor === floor)
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  const slots = perimeterSlots(onFloor.length);
  return onFloor.flatMap((brand, i) => { const slot = slots[i]; return slot ? [{ brand, slot }] : []; });
}
