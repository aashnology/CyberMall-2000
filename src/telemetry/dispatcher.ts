import { isTelemetryEvent } from './schema';
import type { EventType, Prop, TelemetryEvent } from './types';

export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }
const KEY = 'cybermall-events';
const MAX_EVENTS = 5000;

/** Pure factory (storage, clock and id are injected) so it can be unit tested without a browser. */
export function createDispatcher(store: KeyValueStore, sessionId: string, now: () => number = Date.now,
  newId: () => string = () => crypto.randomUUID()) {
  function read(): TelemetryEvent[] {
    try {
      const raw = store.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isTelemetryEvent) : [];
    } catch { return []; }
  }
  function track(eventType: EventType, properties: Record<string, Prop> = {}): TelemetryEvent {
    const event: TelemetryEvent = { eventId: newId(), eventType, timestamp: now(), properties: { ...properties, sessionId } };
    try { store.setItem(KEY, JSON.stringify([...read(), event].slice(-MAX_EVENTS))); } catch { /* storage full: drop */ }
    return event;
  }
  return { track, read, clear: () => store.setItem(KEY, '[]') };
}
