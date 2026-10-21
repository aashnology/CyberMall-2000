import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MoodId } from '../types';

interface MallState {
  pincode: string | null; floor: number; moods: MoodId[]; saved: string[];
  setPincode: (p: string) => void; setFloor: (f: number) => void;
  toggleMood: (m: MoodId) => void; toggleSaved: (id: string) => void;
}
export const useMall = create<MallState>()(persist((set) => ({
  pincode: null, floor: 1, moods: [], saved: [],
  setPincode: (pincode) => set({ pincode }),
  setFloor: (floor) => set({ floor }),
  toggleMood: (m) => set((s) => ({ moods: s.moods.includes(m) ? s.moods.filter((x) => x !== m) : [...s.moods, m] })),
  toggleSaved: (id) => set((s) => ({ saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
}), { name: 'cybermall-2000' }));
