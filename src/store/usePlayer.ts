import { create } from 'zustand';

/** Live avatar state written by the 3D loop: position ~10x/sec, proximity flags only when they change. */
interface PlayerState {
  x: number; z: number; brandId: string | null; itemId: string | null; atElevator: boolean;
  patch: (p: Partial<Omit<PlayerState, 'patch'>>) => void;
}
export const usePlayer = create<PlayerState>((set) => ({
  x: 0, z: 10, brandId: null, itemId: null, atElevator: false, patch: (p) => set(p),
}));
