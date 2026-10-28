import { useSyncExternalStore } from 'react';
import { SpatialAudio } from './spatialAudio';

function storage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export const audio = new SpatialAudio({ storage: storage() });

export function useAudioState(): { readonly muted: boolean; readonly started: boolean; readonly supported: boolean } {
  useSyncExternalStore(audio.subscribe.bind(audio), audio.snapshot.bind(audio));
  return { muted: audio.isMuted, started: audio.isStarted, supported: audio.isSupported };
}
