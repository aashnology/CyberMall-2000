import { create } from 'zustand';
import { DEFAULT_AVATAR, type AvatarConfig } from '../avatar/config';
import { parsePincode, type DirectoryEntry, type PincodeParse } from '../engine/pincode';
import type { FloorId, Pincode } from '../data/types';
import { loadPersisted, savePersisted } from './persist';

export type Panel = 'none' | 'directory' | 'map' | 'elevator' | 'avatar' | 'analytics';

export interface MallState {
  readonly pincode: Pincode | null;
  readonly onlyDeliverable: boolean;
  readonly floorId: FloorId;
  readonly hour: number;
  readonly autoClock: boolean;
  readonly avatar: AvatarConfig;
  readonly panel: Panel;
  /** Active mood id (drives match_score and user_mood_vector in telemetry); null = none. */
  readonly moodId: string | null;
  readonly lookbook: readonly string[];
  /** Store whose detail modal is open. */
  readonly selected: DirectoryEntry | null;
  /** Returns the parse result; the PIN is only stored when it is valid. */
  setPincode: (raw: string) => PincodeParse;
  clearPincode: () => void;
  setOnlyDeliverable: (v: boolean) => void;
  setFloor: (f: FloorId) => void;
  setHour: (h: number) => void;
  setAutoClock: (v: boolean) => void;
  patchAvatar: (patch: Partial<AvatarConfig>) => void;
  resetAvatar: () => void;
  openPanel: (p: Panel) => void;
  closePanel: () => void;
  setMood: (id: string | null) => void;
  /** Adds or removes; returns true when the store is now saved. */
  toggleLookbook: (id: string) => boolean;
  openStore: (e: DirectoryEntry) => void;
  closeStore: () => void;
}

export const useMallStore = create<MallState>()((set, get) => {
  const saved = loadPersisted();
  const persist = (): void => {
    const s = get();
    savePersisted({ pincode: s.pincode, onlyDeliverable: s.onlyDeliverable, avatar: s.avatar, lookbook: s.lookbook });
  };
  return {
    pincode: saved.pincode,
    onlyDeliverable: saved.onlyDeliverable,
    floorId: 1,
    hour: new Date().getHours() + new Date().getMinutes() / 60,
    autoClock: true,
    avatar: saved.avatar,
    panel: 'none',
    moodId: null,
    lookbook: saved.lookbook,
    selected: null,
    setPincode: (raw) => {
      const r = parsePincode(raw);
      if (r.ok) { set({ pincode: r.pincode }); persist(); }
      return r;
    },
    clearPincode: () => { set({ pincode: null, panel: 'none', selected: null, moodId: null }); persist(); },
    setOnlyDeliverable: (v) => { set({ onlyDeliverable: v }); persist(); },
    setFloor: (f) => set({ floorId: f, panel: 'none' }),
    setHour: (h) => set({ hour: ((h % 24) + 24) % 24, autoClock: false }),
    setAutoClock: (v) => set({ autoClock: v }),
    patchAvatar: (patch) => { set({ avatar: { ...get().avatar, ...patch } }); persist(); },
    resetAvatar: () => { set({ avatar: DEFAULT_AVATAR }); persist(); },
    openPanel: (p) => set({ panel: p }),
    closePanel: () => set({ panel: 'none' }),
    setMood: (id) => set({ moodId: id }),
    toggleLookbook: (id) => {
      const has = get().lookbook.includes(id);
      set({ lookbook: has ? get().lookbook.filter((x) => x !== id) : [...get().lookbook, id] });
      persist();
      return !has;
    },
    openStore: (e) => set({ selected: e }),
    closeStore: () => set({ selected: null }),
  };
});
