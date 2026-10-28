/**
 * Photobooth controller: the whole workflow as a small state machine, independent of React.
 * Time is injected (`tick(nowMs)`), as are camera, capture, compose, telemetry and sound, so every path
 * (including the nasty ones) is unit-tested.
 *
 *   requesting ─► ready ─► shooting ─► composing ─► done
 *        │          ▲                       
 *        └► failed ─┴─(use avatar poses / try again)
 *
 * Privacy: the camera is stopped (a) the instant the 4th photo is taken, (b) on any failure,
 * (c) on dispose. Frames live in memory only and are dropped on retake / dispose.
 */

import { CameraSession, type CameraStatus } from './camera';
import { SHOTS, TOTAL_MS, capturesBetween, phaseAt, ticksBetween } from './sequence';
import type { StripCanvas, StripFrame } from '../utils/photostripGenerator';

export type BoothMode = 'camera' | 'avatar';
export type BoothStage = 'requesting' | 'ready' | 'shooting' | 'composing' | 'done' | 'failed';

export interface BoothState {
  readonly stage: BoothStage;
  readonly mode: BoothMode | null;
  readonly cameraStatus: CameraStatus;
  /** Index (0-3) of the shot in progress. */
  readonly shot: number;
  /** Countdown number on screen, or null. */
  readonly count: number | null;
  readonly flash: boolean;
  readonly captured: number;
  readonly strip: StripCanvas | null;
  readonly error: string | null;
}

export interface ControllerDeps {
  readonly camera: CameraSession;
  readonly captureCamera: (shot: number) => StripFrame;
  readonly prepareAvatar: () => Promise<void>;
  readonly captureAvatar: (shot: number) => StripFrame;
  readonly compose: (frames: readonly StripFrame[]) => StripCanvas;
  /** Called exactly once per strip successfully generated (this is the telemetry hook). */
  readonly onGenerated: (mode: BoothMode) => void;
  readonly sfx: (s: 'beep' | 'shutter') => void;
}

const INITIAL: BoothState = { stage: 'requesting', mode: null, cameraStatus: 'idle', shot: 0, count: null, flash: false, captured: 0, strip: null, error: null };

export class PhotoboothController {
  private s: BoothState = INITIAL;
  private version = 0;
  private readonly listeners = new Set<() => void>();
  private frames: StripFrame[] = [];
  private startMs = 0;
  private prevElapsed = -1;
  private disposed = false;
  private readonly unsubscribeCamera: () => void;

  constructor(private readonly d: ControllerDeps) {
    this.unsubscribeCamera = d.camera.subscribe(() => {
      if (this.disposed) return;
      const st = d.camera.status;
      this.patch({ cameraStatus: st });
      // the camera vanished (unplugged / revoked) while we were relying on it
      if (st === 'error' && (this.s.stage === 'shooting' || this.s.stage === 'ready') && this.s.mode === 'camera') this.fail(d.camera.errorMessage || 'The camera was disconnected.');
    });
  }

  get state(): BoothState { return this.s; }
  snapshot(): number { return this.version; }
  subscribe(l: () => void): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  private patch(p: Partial<BoothState>): void {
    this.s = { ...this.s, ...p };
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  /** Ask for the camera. A refusal leaves the booth in `failed` so the visitor can pick the avatar fallback. */
  async start(): Promise<void> {
    if (this.disposed) return;
    this.frames = [];
    this.patch({ ...INITIAL, stage: 'requesting', cameraStatus: this.d.camera.status });
    const stream = await this.d.camera.open();
    if (this.disposed) return; // closed during the prompt: CameraSession already stopped the late stream
    if (stream === null) this.patch({ stage: 'failed', mode: null, cameraStatus: this.d.camera.status, error: this.d.camera.errorMessage || null });
    else this.patch({ stage: 'ready', mode: 'camera', cameraStatus: 'live', error: null });
  }

  /** Fallback: pose the visitor's customised chibi avatar instead of using a camera. */
  async useAvatar(): Promise<void> {
    if (this.disposed) return;
    this.d.camera.close();
    this.frames = [];
    this.patch({ ...INITIAL, stage: 'requesting', mode: 'avatar', cameraStatus: 'idle' });
    try { await this.d.prepareAvatar(); } catch (e) { if (!this.disposed) this.fail(e instanceof Error ? e.message : 'Could not prepare the avatar poses.'); return; }
    if (this.disposed) return;
    this.patch({ stage: 'ready', mode: 'avatar', error: null });
  }

  /** Start the 4-shot sequence. Ignored unless the booth is ready. */
  begin(nowMs: number): void {
    if (this.disposed || this.s.stage !== 'ready') return;
    this.frames = []; this.startMs = nowMs; this.prevElapsed = -1;
    this.patch({ stage: 'shooting', shot: 0, count: 3, flash: false, captured: 0, strip: null });
    this.tick(nowMs);
  }

  /** Advance the timeline. Call every animation frame while shooting. Idempotent for the same time. */
  tick(nowMs: number): void {
    if (this.disposed || this.s.stage !== 'shooting') return;
    const elapsed = Math.max(0, nowMs - this.startMs);
    try {
      for (const _ of ticksBetween(this.prevElapsed, elapsed)) this.d.sfx('beep');
      for (const k of capturesBetween(this.prevElapsed, elapsed)) {
        this.frames[k] = this.s.mode === 'avatar' ? this.d.captureAvatar(k) : this.d.captureCamera(k);
        this.d.sfx('shutter');
      }
    } catch (e) { this.fail(e instanceof Error ? e.message : 'Could not capture the photo.'); return; }
    this.prevElapsed = elapsed;
    const captured = this.frames.filter((f) => f !== undefined).length;
    if (elapsed >= TOTAL_MS) { this.finish(); return; }
    const ph = phaseAt(elapsed);
    if (ph.kind === 'done') return;
    this.patch({ shot: ph.shot, count: ph.kind === 'count' ? ph.count : null, flash: ph.kind === 'flash', captured });
  }

  private finish(): void {
    this.d.camera.close(); // privacy: the camera light goes off the moment the last photo is taken
    this.patch({ stage: 'composing', count: null, flash: false, captured: SHOTS });
    const frames = Array.from({ length: SHOTS }, (_, i) => this.frames[i]);
    if (frames.some((f) => f === undefined)) { this.fail('Some photos were not captured.'); return; }
    try {
      const strip = this.d.compose(frames as StripFrame[]);
      const mode = this.s.mode ?? 'camera';
      this.patch({ stage: 'done', strip });
      this.d.onGenerated(mode);
    } catch (e) { this.fail(e instanceof Error ? e.message : 'Could not develop the photostrip.'); }
  }

  private fail(message: string): void {
    this.d.camera.close();
    this.frames = [];
    this.patch({ stage: 'failed', count: null, flash: false, strip: null, error: message, cameraStatus: this.d.camera.status });
  }

  /** A view-level failure (for example the viewfinder could not play): stop everything and surface it. */
  reportError(message: string): void { if (!this.disposed) this.fail(message); }

  /** Throw the strip away and shoot again (re-opens the camera in camera mode). */
  async retake(): Promise<void> {
    if (this.disposed) return;
    if (this.s.mode === 'avatar') { this.frames = []; this.patch({ stage: 'ready', shot: 0, count: null, flash: false, captured: 0, strip: null }); return; }
    await this.start();
  }

  /** Tear everything down: stop the camera, ignore any late async result, drop frames. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeCamera();
    this.d.camera.close();
    this.frames = [];
    this.listeners.clear();
  }
}
