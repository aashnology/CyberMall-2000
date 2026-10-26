/**
 * Typed telemetry pipeline. Local only: events live in memory and localStorage on the visitor's
 * device and leave it only when the visitor presses "Export Telemetry (CSV)".
 *
 * One row per event, flat, so it loads straight into pandas / SQL / Power BI.
 */

import { parsePincode } from '../engine/pincode';

export const EVENT_TYPES = [
  'PINCODE_SUBMITTED',
  'STORE_IMPRESSION',
  'STORE_HOVER_DWELL',
  'STORE_MODAL_OPENED',
  'PRODUCT_SAVED_LOOKBOOK',
  'EXTERNAL_MERCHANT_ROUTED',
  'MOOD_SELECTED',
  'PHOTOBOOTH_STRIP_GENERATED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** A hover only counts as engagement after this long. */
export const DWELL_THRESHOLD_MS = 3000;

/** mood id → weight in [0,1]. Currently one-hot: the active mood is 1, the rest 0. */
export type MoodVector = Readonly<Record<string, number>>;

export const CSV_COLUMNS = ['session_id', 'timestamp', 'pincode', 'event_type', 'item_id', 'match_score', 'user_mood_vector'] as const;

export interface TelemetryEvent {
  readonly session_id: string;
  /** ISO-8601 UTC, e.g. 2026-10-24T09:15:02.123Z */
  readonly timestamp: string;
  readonly pincode: string;
  readonly event_type: EventType;
  /** Store id (or mood id for MOOD_SELECTED). Null only for PINCODE_SUBMITTED. */
  readonly item_id: string | null;
  /** Mood-fit score in [0,1] at the time of the event; null when no mood was active. */
  readonly match_score: number | null;
  /** Active mood vector at the time of the event; null when no mood was active. */
  readonly user_mood_vector: MoodVector | null;
}

export interface TrackInput {
  readonly pincode: string;
  readonly item_id?: string | null;
  readonly match_score?: number | null;
  readonly user_mood_vector?: MoodVector | null;
}

export class TelemetryError extends Error {}

/** Ids are written to CSV unescaped-safe: no leading formula characters, no control chars. */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const EVENT_SET: ReadonlySet<string> = new Set(EVENT_TYPES);

export function validateEvent(e: TelemetryEvent): void {
  if (!EVENT_SET.has(e.event_type)) throw new TelemetryError(`unknown event_type ${String(e.event_type)}`);
  if (!parsePincode(e.pincode).ok) throw new TelemetryError('pincode must be a valid 6-digit PIN');
  if (Number.isNaN(Date.parse(e.timestamp)) || !e.timestamp.endsWith('Z')) throw new TelemetryError('timestamp must be ISO-8601 UTC');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(e.session_id)) throw new TelemetryError('bad session_id');
  if (e.event_type === 'PINCODE_SUBMITTED') {
    if (e.item_id !== null) throw new TelemetryError('PINCODE_SUBMITTED has no item_id');
  } else if (e.item_id === null || !ID_RE.test(e.item_id)) {
    throw new TelemetryError(`${e.event_type} needs a valid item_id`);
  }
  if (e.match_score !== null && !(Number.isFinite(e.match_score) && e.match_score >= 0 && e.match_score <= 1)) {
    throw new TelemetryError('match_score must be within [0,1] or null');
  }
  if (e.user_mood_vector !== null) {
    for (const [k, v] of Object.entries(e.user_mood_vector)) {
      if (!ID_RE.test(k) || !Number.isFinite(v) || v < 0 || v > 1) throw new TelemetryError('bad user_mood_vector');
    }
  }
}

/* ───────────────────────── log ───────────────────────── */

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const STORAGE_KEY = 'cybermall2000.telemetry.v1';
export const MAX_EVENTS = 5000;

export interface TelemetryOptions {
  readonly sessionId: string;
  readonly now?: () => Date;
  readonly storage?: Store | null;
  readonly maxEvents?: number;
  /** Debounce for persistence; 0 persists synchronously (used in tests). */
  readonly persistDelayMs?: number;
}

export class TelemetryLog {
  private list: TelemetryEvent[];
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly now: () => Date;
  private readonly storage: Store | null;
  private readonly max: number;
  private readonly delay: number;
  readonly sessionId: string;

  constructor(opts: TelemetryOptions) {
    this.sessionId = opts.sessionId;
    this.now = opts.now ?? (() => new Date());
    this.storage = opts.storage ?? null;
    this.max = opts.maxEvents ?? MAX_EVENTS;
    this.delay = opts.persistDelayMs ?? 300;
    this.list = this.load();
  }

  track(type: EventType, input: TrackInput): TelemetryEvent {
    const event: TelemetryEvent = {
      session_id: this.sessionId,
      timestamp: this.now().toISOString(),
      pincode: input.pincode,
      event_type: type,
      item_id: input.item_id ?? null,
      match_score: input.match_score === undefined || input.match_score === null ? null : Math.round(input.match_score * 10000) / 10000,
      user_mood_vector: input.user_mood_vector ?? null,
    };
    validateEvent(event); // throws: bad events are bugs, never silently stored
    this.list.push(event);
    if (this.list.length > this.max) this.list.splice(0, this.list.length - this.max);
    this.version += 1;
    this.schedulePersist();
    this.listeners.forEach((l) => l());
    return event;
  }

  events(): readonly TelemetryEvent[] { return this.list; }
  /** Changes on every mutation: a stable snapshot for useSyncExternalStore. */
  snapshot(): number { return this.version; }
  subscribe(l: () => void): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  clear(): void {
    this.list = [];
    this.version += 1;
    try { this.storage?.removeItem(STORAGE_KEY); } catch { /* storage unavailable: memory is already cleared */ }
    this.listeners.forEach((l) => l());
  }

  /** Write pending events now. Returns false if storage is missing or rejected the write. */
  flush(): boolean {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    if (this.storage === null) return false;
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.list)); return true; } catch { return false; }
  }

  private schedulePersist(): void {
    if (this.storage === null) return;
    if (this.delay === 0) { this.flush(); return; }
    if (this.timer === null) this.timer = setTimeout(() => { this.timer = null; this.flush(); }, this.delay);
  }

  private load(): TelemetryEvent[] {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw === null || raw === undefined) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const out: TelemetryEvent[] = [];
      for (const item of parsed as TelemetryEvent[]) {
        try { validateEvent(item); out.push(item); } catch { /* drop corrupt rows, keep the rest */ }
      }
      return out.slice(-this.max);
    } catch {
      return [];
    }
  }
}

/* ───────────────────────── behaviour trackers (pure, injectable time) ───────────────────────── */

/** Fires once per hover episode, when the same item has been hovered for `thresholdMs`. */
export class DwellTracker {
  private id: string | null = null;
  private since = 0;
  private fired = false;
  constructor(private readonly thresholdMs: number = DWELL_THRESHOLD_MS) {}

  update(hoveredId: string | null, nowMs: number): string | null {
    if (hoveredId !== this.id) { this.id = hoveredId; this.since = nowMs; this.fired = false; return null; }
    if (this.id !== null && !this.fired && nowMs - this.since >= this.thresholdMs) { this.fired = true; return this.id; }
    return null;
  }
}

/** An impression is the first time a store is on screen in this session. */
export class ImpressionTracker {
  private readonly seen = new Set<string>();
  observe(visibleIds: Iterable<string>): string[] {
    const fresh: string[] = [];
    for (const id of visibleIds) if (!this.seen.has(id)) { this.seen.add(id); fresh.push(id); }
    return fresh;
  }
  reset(): void { this.seen.clear(); }
}

/* ───────────────────────── CSV ───────────────────────── */

/** RFC 4180: quote fields containing comma, quote or newline; double embedded quotes. */
export function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function sortedVector(v: MoodVector): string {
  const keys = Object.keys(v).sort();
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, v[k]])));
}

/** Header + one line per event, LF line endings, no BOM (a BOM corrupts the first pandas column name). */
export function eventsToCsv(events: readonly TelemetryEvent[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const e of events) {
    lines.push([
      e.session_id, e.timestamp, e.pincode, e.event_type, e.item_id ?? '',
      e.match_score === null ? '' : String(e.match_score),
      e.user_mood_vector === null ? '' : sortedVector(e.user_mood_vector),
    ].map(csvField).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function exportFilename(now: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `cybermall_telemetry_${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z.csv`;
}

export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')).join('-');
}
