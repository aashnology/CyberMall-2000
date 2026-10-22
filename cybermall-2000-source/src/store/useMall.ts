import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TimeOfDay } from '../lighting/dayCycle';
import type { ScreenFilter } from '../rewards/collectibles';
import type { MoodId } from '../types';

interface MallState {
  pincode: string | null; floor: number; moods: MoodId[]; saved: string[];
  collected: string[]; filter: ScreenFilter; time: 'auto' | TimeOfDay;
  setPincode: (p: string) => void; setFloor: (f: number) => void;
  toggleMood: (m: MoodId) => void; toggleSaved: (id: string) => void;
  collect: (id: string) => void; setFilter: (f: ScreenFilter) => void; setTime: (t: 'auto' | TimeOfDay) => void;
}
export const useMall = create<MallState>()(persist((set) => ({
  pincode: null, floor: 1, moods: [], saved: [], collected: [], filter: 'none', time: 'auto',
  setPincode: (pincode) => set({ pincode }),
  setFloor: (floor) => set({ floor }),
  toggleMood: (m) => set((s) => ({ moods: s.moods.includes(m) ? s.moods.filter((x) => x !== m) : [...s.moods, m] })),
  toggleSaved: (id) => set((s) => ({ saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
  collect: (id) => set((s) => (s.collected.includes(id) ? {} : { collected: [...s.collected, id] })),
  setFilter: (filter) => set({ filter }),
  setTime: (time) => set({ time }),
}), { name: 'cybermall-2000' }));
