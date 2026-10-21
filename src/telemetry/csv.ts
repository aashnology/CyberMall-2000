import type { TelemetryEvent } from './types';

export const escapeCsv = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(events: readonly TelemetryEvent[]): string {
  const rows = events.map((e) => [e.eventId, e.eventType, String(e.timestamp), String(e.properties.sessionId ?? ''), JSON.stringify(e.properties)].map(escapeCsv).join(','));
  return ['eventId,eventType,timestamp,sessionId,properties', ...rows].join('\n');
}
