import { useSyncExternalStore } from 'react';
import { telemetry } from './instance';
import { CATALOG } from '../data/catalog';
import { MOODS } from '../data/moods';
import { computeLifts, type LiftTable } from '../engine/scoringLoop';

let cachedVersion = -1;
let cached: LiftTable | undefined;

/**
 * Lift table derived from the live telemetry log. Recomputed only when the log changes
 * (O(events), ≤ MAX_EVENTS), so callers on hot paths such as `track` can call it freely.
 */
export function currentLifts(): LiftTable {
  const v = telemetry.snapshot();
  if (cached === undefined || v !== cachedVersion) {
    cached = computeLifts(telemetry.events(), CATALOG, MOODS);
    cachedVersion = v;
  }
  return cached;
}

/** React binding: re-renders when the telemetry log changes. */
export function useLearnedLifts(): LiftTable {
  useSyncExternalStore(telemetry.subscribe.bind(telemetry), telemetry.snapshot.bind(telemetry));
  return currentLifts();
}
