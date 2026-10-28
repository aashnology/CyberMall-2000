import { useSyncExternalStore } from 'react';
import { telemetry } from './instance';
import { TelemetryError, type EventType, type TelemetryEvent } from './telemetry';
import { MOODS, moodVector, scoreEntry } from '../data/moods';
import type { DirectoryEntry } from '../engine/pincode';
import { useMallStore } from '../state/mallStore';

let faults = 0;
/** Number of events dropped because they failed validation (a bug indicator, shown nowhere by default). */
export const telemetryFaults = (): number => faults;

/**
 * Record one event for the current visitor. Reads the PIN and active mood from the store,
 * so callers only say what happened. A rejected event is counted and warned about, never thrown
 * into the UI.
 */
export function track(type: EventType, itemId: string | null, entry?: DirectoryEntry): TelemetryEvent | null {
  const s = useMallStore.getState();
  if (s.pincode === null) return null;
  const mood = MOODS.find((m) => m.id === s.moodId);
  try {
    return telemetry.track(type, {
      pincode: s.pincode,
      item_id: itemId,
      match_score: mood !== undefined && entry !== undefined ? scoreEntry(mood, entry) : null,
      user_mood_vector: mood === undefined ? null : moodVector(mood.id),
    });
  } catch (err) {
    if (!(err instanceof TelemetryError)) throw err;
    faults += 1;
    console.warn(`[telemetry] dropped ${type}: ${err.message}`);
    return null;
  }
}

export function useTelemetryEvents(): readonly TelemetryEvent[] {
  useSyncExternalStore(telemetry.subscribe.bind(telemetry), telemetry.snapshot.bind(telemetry));
  return telemetry.events();
}
