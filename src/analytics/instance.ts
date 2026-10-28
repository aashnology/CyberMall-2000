import { TelemetryLog, newSessionId } from './telemetry';

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** One log per page load; the session id is random and never leaves the device. */
export const telemetry = new TelemetryLog({ sessionId: newSessionId(), storage: storage() });

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { telemetry.flush(); });
