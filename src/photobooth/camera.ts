/**
 * Camera session. One job: hand out a webcam stream and GUARANTEE it is stopped.
 *
 * Every exit path stops every track so the camera light goes off and nothing leaks:
 *   - close() / dispose, finishing the shoot, opening again, an error, the page being hidden
 *   - closing the modal WHILE the browser permission prompt is still open: the stream that arrives
 *     later is stopped the moment it lands and is never exposed
 * The constraint is exactly `{ video: true }`.
 */

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unavailable' | 'error';

export interface CameraDeps {
  /** `undefined` = use `navigator.mediaDevices`; `null` = no camera API at all (tests, insecure contexts). */
  readonly mediaDevices?: Pick<MediaDevices, 'getUserMedia'> | null;
}

export function classifyCameraError(err: unknown): Exclude<CameraStatus, 'idle' | 'requesting' | 'live'> {
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'unavailable';
  return 'error';
}

export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export class CameraSession {
  private current: CameraStatus = 'idle';
  private media: MediaStream | null = null;
  private token = 0;
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private message = '';

  constructor(private readonly deps: CameraDeps = {}) {}

  get status(): CameraStatus { return this.current; }
  get stream(): MediaStream | null { return this.media; }
  get errorMessage(): string { return this.message; }
  snapshot(): number { return this.version; }
  subscribe(l: () => void): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  private set(s: CameraStatus, message = ''): void {
    this.current = s; this.message = message; this.version += 1;
    this.listeners.forEach((l) => l());
  }

  private api(): Pick<MediaDevices, 'getUserMedia'> | null {
    if (this.deps.mediaDevices !== undefined) return this.deps.mediaDevices;
    return typeof navigator !== 'undefined' && navigator.mediaDevices !== undefined ? navigator.mediaDevices : null;
  }

  /** Ask for the webcam. Resolves with the stream, or null if it was denied, missing, or closed meanwhile. */
  async open(): Promise<MediaStream | null> {
    this.release();
    const mine = ++this.token;
    const md = this.api();
    if (md === null || typeof md.getUserMedia !== 'function') { this.set('unavailable', 'This browser or connection does not allow camera access (it needs HTTPS or localhost).'); return null; }
    this.set('requesting');
    let stream: MediaStream;
    try {
      stream = await md.getUserMedia({ video: true });
    } catch (err) {
      if (mine !== this.token) return null; // closed while asking: say nothing
      this.set(classifyCameraError(err), err instanceof Error ? err.message : String(err));
      return null;
    }
    if (mine !== this.token) { stopStream(stream); return null; } // closed during the permission prompt: never expose it
    this.media = stream;
    for (const track of stream.getTracks()) {
      track.onended = () => { if (mine === this.token) { this.release(); this.set('error', 'The camera was disconnected.'); } };
    }
    this.set('live');
    return stream;
  }

  /** Stop everything and invalidate any request still in flight. Safe to call repeatedly. */
  close(): void {
    this.token += 1;
    this.release();
    if (this.current !== 'idle') this.set('idle');
  }

  private release(): void {
    if (this.media !== null) { const s = this.media; this.media = null; for (const t of s.getTracks()) t.onended = null; stopStream(s); }
  }
}
