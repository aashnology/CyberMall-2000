import { EVENT_TYPES, type EventType, type TelemetryEvent } from './types';

const isPrim = (v: unknown): boolean => ['string', 'number', 'boolean'].includes(typeof v);

/** Runtime check so corrupted localStorage rows never reach the dashboard. */
export function isTelemetryEvent(v: unknown): v is TelemetryEvent {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  if (typeof e.eventId !== 'string' || e.eventId === '') return false;
  if (typeof e.eventType !== 'string' || !(EVENT_TYPES as readonly string[]).includes(e.eventType as EventType)) return false;
  if (typeof e.timestamp !== 'number' || !Number.isFinite(e.timestamp)) return false;
  if (typeof e.properties !== 'object' || e.properties === null) return false;
  return Object.values(e.properties).every(isPrim);
}
