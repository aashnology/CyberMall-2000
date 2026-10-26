import { describe, it, expect } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { CameraSession, classifyCameraError } from '../src/photobooth/camera';
import { SHOTS, SHOT_MS, TOTAL_MS, COUNT_MS, COUNT_FROM, captureTime, capturesBetween, ticksBetween, phaseAt } from '../src/photobooth/sequence';
import { PhotoboothController, type BoothMode, type ControllerDeps } from '../src/photobooth/controller';
import { captureVideoFrame } from '../src/photobooth/captureFrame';
import { AVATAR_POSES, avatarPoseSvg } from '../src/photobooth/avatarFrames';
import { DEFAULT_AVATAR } from '../src/avatar/config';
import { generatePhotostrip, coverRect, stripFilename, canvasToBlob, formatStripDate, STRIP, STRIP_HEIGHT, frameTop, sprocketCount, STICKER_PLACEMENTS, type StripCanvas, type StripFrame } from '../src/utils/photostripGenerator';
import { STICKER_KINDS } from '../src/utils/stickers';

/* ───────── fakes ───────── */
interface FakeTrack { stopped: number; onended: (() => void) | null; stop(): void }
const mkTrack = (): FakeTrack => ({ stopped: 0, onended: null, stop() { this.stopped += 1; } });
const mkStream = (n = 1): { stream: MediaStream; tracks: FakeTrack[] } => { const tracks = Array.from({ length: n }, mkTrack); return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks }; };
const deferred = <T,>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const named = (name: string, message = name): Error => Object.assign(new Error(message), { name });

function fakeDevices(impl: (c: MediaStreamConstraints) => Promise<MediaStream>): { md: Pick<MediaDevices, 'getUserMedia'>; calls: MediaStreamConstraints[] } {
  const calls: MediaStreamConstraints[] = [];
  return { calls, md: { getUserMedia: (c?: MediaStreamConstraints) => { calls.push(c as MediaStreamConstraints); return impl(c as MediaStreamConstraints); } } };
}
const tinyFrame = (): StripFrame => ({ source: createCanvas(8, 6) as unknown as CanvasImageSource, width: 8, height: 6 });

describe('CameraSession: guaranteed cleanup', () => {
  it('asks for exactly { video: true } and goes idle → requesting → live', async () => {
    const { stream } = mkStream(); const { md, calls } = fakeDevices(async () => stream);
    const cam = new CameraSession({ mediaDevices: md }); const seen: string[] = []; cam.subscribe(() => seen.push(cam.status));
    expect(await cam.open()).toBe(stream);
    expect(calls).toEqual([{ video: true }]);
    expect(seen).toEqual(['requesting', 'live']); expect(cam.status).toBe('live');
  });
  it('close() stops every track, is idempotent, and returns to idle', async () => {
    const { stream, tracks } = mkStream(2); const cam = new CameraSession({ mediaDevices: fakeDevices(async () => stream).md });
    await cam.open(); cam.close(); cam.close(); cam.close();
    expect(tracks.map((t) => t.stopped)).toEqual([1, 1]); expect(cam.status).toBe('idle'); expect(cam.stream).toBeNull();
  });
  it('closing while the permission prompt is open stops the late stream immediately and never exposes it', async () => {
    const d = deferred<MediaStream>(); const { stream, tracks } = mkStream(); const cam = new CameraSession({ mediaDevices: fakeDevices(() => d.promise).md });
    const pending = cam.open(); expect(cam.status).toBe('requesting');
    cam.close();
    d.resolve(stream);
    expect(await pending).toBeNull();
    expect(tracks[0]!.stopped).toBe(1); expect(cam.stream).toBeNull(); expect(cam.status).toBe('idle');
  });
  it('re-opening stops the previous stream first; a stale request resolving later is stopped too', async () => {
    const a = mkStream(); const b = mkStream(); const first = deferred<MediaStream>(); let n = 0;
    const cam = new CameraSession({ mediaDevices: fakeDevices(() => (n++ === 0 ? first.promise : Promise.resolve(b.stream))).md });
    const p1 = cam.open(); const p2 = cam.open();
    expect(await p2).toBe(b.stream);
    first.resolve(a.stream); expect(await p1).toBeNull();
    expect(a.tracks[0]!.stopped).toBe(1); expect(b.tracks[0]!.stopped).toBe(0); expect(cam.stream).toBe(b.stream);
    await cam.open(); expect(b.tracks[0]!.stopped).toBe(1); // opening again released the live one
  });
  it('classifies permission refusal, missing hardware and everything else', async () => {
    for (const [name, status] of [['NotAllowedError', 'denied'], ['PermissionDeniedError', 'denied'], ['SecurityError', 'denied'], ['NotFoundError', 'unavailable'], ['OverconstrainedError', 'unavailable'], ['NotReadableError', 'error'], ['Weird', 'error']] as const) {
      expect(classifyCameraError(named(name))).toBe(status);
      const cam = new CameraSession({ mediaDevices: fakeDevices(() => Promise.reject(named(name, `boom ${name}`))).md });
      expect(await cam.open()).toBeNull(); expect(cam.status).toBe(status); expect(cam.errorMessage).toBe(`boom ${name}`);
    }
    expect(classifyCameraError('x')).toBe('error'); expect(classifyCameraError(null)).toBe('error');
  });
  it('no camera API (insecure context / unsupported) is reported as unavailable, not a crash', async () => {
    const cam = new CameraSession({ mediaDevices: null });
    expect(await cam.open()).toBeNull(); expect(cam.status).toBe('unavailable'); expect(cam.errorMessage).toMatch(/HTTPS or localhost/);
  });
  it('a refusal that arrives after close() is ignored silently', async () => {
    const d = deferred<MediaStream>(); const cam = new CameraSession({ mediaDevices: fakeDevices(() => d.promise).md });
    const p = cam.open(); cam.close(); d.reject(named('NotAllowedError'));
    expect(await p).toBeNull(); expect(cam.status).toBe('idle');
  });
  it('a device that disappears (track ended) is released and reported', async () => {
    const { stream, tracks } = mkStream(); const cam = new CameraSession({ mediaDevices: fakeDevices(async () => stream).md });
    await cam.open(); tracks[0]!.onended!();
    expect(cam.status).toBe('error'); expect(cam.stream).toBeNull(); expect(tracks[0]!.stopped).toBe(1);
  });
});

describe('capture timeline', () => {
  it('has 4 shots of 3-2-1-flash and a fixed total', () => {
    expect(SHOTS).toBe(4); expect(TOTAL_MS).toBe(4 * SHOT_MS);
    expect(phaseAt(0)).toEqual({ kind: 'count', shot: 0, count: 3 });
    expect(phaseAt(COUNT_MS)).toEqual({ kind: 'count', shot: 0, count: 2 });
    expect(phaseAt(2 * COUNT_MS)).toEqual({ kind: 'count', shot: 0, count: 1 });
    expect(phaseAt(captureTime(0))).toEqual({ kind: 'flash', shot: 0 });
    expect(phaseAt(captureTime(0) - 1)).toEqual({ kind: 'count', shot: 0, count: 1 });
    expect(phaseAt(SHOT_MS)).toEqual({ kind: 'count', shot: 1, count: 3 });
    expect(phaseAt(TOTAL_MS - 1).kind).toBe('hold'); expect(phaseAt(TOTAL_MS)).toEqual({ kind: 'done' });
  });
  it('every shot is captured exactly once, in order, whatever the frame step (property)', () => {
    let seed = 7; const rnd = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (const step of [1, 16, 33, 250, 1000, 5000, TOTAL_MS * 2, -1]) {
      const got: number[] = []; let prev = -1; let t = 0;
      while (prev < TOTAL_MS) { t += step < 0 ? 1 + rnd() * 700 : step; const now = Math.min(t, TOTAL_MS + 1); got.push(...capturesBetween(prev, now)); prev = now; if (now > TOTAL_MS) break; }
      expect(got, `step ${step}`).toEqual([0, 1, 2, 3]);
    }
  });
  it('emits exactly 12 countdown ticks (3-2-1 ×4), the first at t = 0', () => {
    const t = ticksBetween(-1, TOTAL_MS);
    expect(t).toHaveLength(SHOTS * COUNT_FROM);
    expect(t.slice(0, 3)).toEqual([{ shot: 0, count: 3 }, { shot: 0, count: 2 }, { shot: 0, count: 1 }]);
    expect(ticksBetween(0, 0)).toEqual([]);
  });
});

/* ───────── controller ───────── */
function rig(opts: { devices?: Pick<MediaDevices, 'getUserMedia'> | null; composeThrows?: boolean; captureThrows?: boolean } = {}) {
  const log = { sfx: [] as string[], generated: [] as BoothMode[], captured: [] as Array<{ mode: string; shot: number }>, composed: [] as number[] };
  const camera = new CameraSession(opts.devices === undefined ? { mediaDevices: null } : { mediaDevices: opts.devices });
  const deps: ControllerDeps = {
    camera,
    captureCamera: (shot) => { if (opts.captureThrows) throw new Error('video not ready'); log.captured.push({ mode: 'camera', shot }); return tinyFrame(); },
    prepareAvatar: async () => undefined,
    captureAvatar: (shot) => { log.captured.push({ mode: 'avatar', shot }); return tinyFrame(); },
    compose: (frames) => { if (opts.composeThrows) throw new Error('canvas exploded'); log.composed.push(frames.length); return createCanvas(10, 10) as unknown as StripCanvas; },
    onGenerated: (m) => log.generated.push(m),
    sfx: (s) => log.sfx.push(s),
  };
  const ctl = new PhotoboothController(deps);
  const run = (from: number, to: number, step = 16): void => { ctl.begin(from); for (let t = from; t <= to; t += step) ctl.tick(t); ctl.tick(to); };
  return { ctl, camera, log, run };
}

describe('PhotoboothController', () => {
  it('camera path: 4 timed captures, 12 beeps, 4 shutters, ONE telemetry call, one 4-frame composite, camera stopped before the result', async () => {
    const { stream, tracks } = mkStream(); const dev = fakeDevices(async () => stream);
    const { ctl, log, run } = rig({ devices: dev.md });
    await ctl.start(); expect(ctl.state.stage).toBe('ready'); expect(ctl.state.mode).toBe('camera');
    ctl.begin(1000); expect(ctl.state.stage).toBe('shooting'); expect(ctl.state.count).toBe(3);
    expect(tracks[0]!.stopped).toBe(0); // camera stays live while shooting
    let midRes = false;
    for (let t = 1000; t <= 1000 + TOTAL_MS + 100; t += 16) { ctl.tick(t); if (ctl.state.flash) midRes = true; }
    expect(midRes).toBe(true);
    expect(ctl.state.stage).toBe('done'); expect(ctl.state.strip).not.toBeNull();
    expect(log.captured).toEqual([0, 1, 2, 3].map((shot) => ({ mode: 'camera', shot })));
    expect(log.sfx.filter((s) => s === 'beep')).toHaveLength(12); expect(log.sfx.filter((s) => s === 'shutter')).toHaveLength(4);
    expect(log.composed).toEqual([4]); expect(log.generated).toEqual(['camera']);
    expect(tracks[0]!.stopped).toBe(1); expect(ctl.state.cameraStatus).toBe('idle');
    void run;
  });
  it('shows the countdown numbers 3, 2, 1 then flash for each shot', async () => {
    const { stream } = mkStream(); const { ctl } = rig({ devices: fakeDevices(async () => stream).md });
    await ctl.start(); ctl.begin(0);
    const seen: string[] = [];
    for (let t = 0; t < SHOT_MS; t += 20) { ctl.tick(t); const s = ctl.state.flash ? 'F' : String(ctl.state.count); if (seen[seen.length - 1] !== s) seen.push(s); }
    expect(seen).toEqual(['3', '2', '1', 'F', 'null']);
  });
  it('a huge frame gap (hidden tab) still captures all four, once each', async () => {
    const { stream } = mkStream(); const { ctl, log } = rig({ devices: fakeDevices(async () => stream).md });
    await ctl.start(); ctl.begin(0); ctl.tick(TOTAL_MS * 3);
    expect(ctl.state.stage).toBe('done'); expect(log.captured.map((c) => c.shot)).toEqual([0, 1, 2, 3]); expect(log.generated).toHaveLength(1);
  });
  it('denied camera → failed with the reason; the avatar fallback then works end to end and logs mode "avatar"', async () => {
    const { ctl, log } = rig({ devices: fakeDevices(() => Promise.reject(named('NotAllowedError', 'Permission denied'))).md });
    await ctl.start();
    expect(ctl.state).toMatchObject({ stage: 'failed', cameraStatus: 'denied', error: 'Permission denied' });
    await ctl.useAvatar(); expect(ctl.state).toMatchObject({ stage: 'ready', mode: 'avatar' });
    ctl.begin(0); ctl.tick(TOTAL_MS + 1);
    expect(ctl.state.stage).toBe('done'); expect(log.captured.every((c) => c.mode === 'avatar')).toBe(true); expect(log.generated).toEqual(['avatar']);
  });
  it('no camera API at all also offers the fallback', async () => {
    const { ctl } = rig({ devices: null }); await ctl.start();
    expect(ctl.state.stage).toBe('failed'); expect(ctl.state.cameraStatus).toBe('unavailable');
    await ctl.useAvatar(); expect(ctl.state.stage).toBe('ready');
  });
  it('closing (dispose) during the permission prompt: the late stream is stopped and nothing ever becomes ready', async () => {
    const d = deferred<MediaStream>(); const { stream, tracks } = mkStream(); const { ctl, log } = rig({ devices: fakeDevices(() => d.promise).md });
    const started = ctl.start(); expect(ctl.state.stage).toBe('requesting');
    ctl.dispose(); d.resolve(stream); await started;
    expect(tracks[0]!.stopped).toBe(1); expect(ctl.state.stage).toBe('requesting'); expect(log.generated).toEqual([]);
  });
  it('dispose mid-shoot stops the camera, ignores later ticks, composes nothing and logs nothing', async () => {
    const { stream, tracks } = mkStream(); const { ctl, log } = rig({ devices: fakeDevices(async () => stream).md });
    await ctl.start(); ctl.begin(0); ctl.tick(1000);
    ctl.dispose(); ctl.tick(TOTAL_MS * 2); ctl.begin(0);
    expect(tracks[0]!.stopped).toBe(1); expect(log.composed).toEqual([]); expect(log.generated).toEqual([]);
    ctl.dispose(); expect(tracks[0]!.stopped).toBe(1);
  });
  it('the camera being unplugged mid-shoot fails safely and logs nothing', async () => {
    const { stream, tracks } = mkStream(); const { ctl, log } = rig({ devices: fakeDevices(async () => stream).md });
    await ctl.start(); ctl.begin(0); ctl.tick(500); tracks[0]!.onended!();
    expect(ctl.state.stage).toBe('failed'); expect(ctl.state.error).toMatch(/disconnected/);
    ctl.tick(TOTAL_MS); expect(log.generated).toEqual([]); expect(tracks[0]!.stopped).toBeGreaterThanOrEqual(1);
  });
  it('a failing capture or compose stops the camera, shows the error and logs nothing', async () => {
    for (const o of [{ captureThrows: true }, { composeThrows: true }] as const) {
      const { stream, tracks } = mkStream(); const { ctl, log } = rig({ devices: fakeDevices(async () => stream).md, ...o });
      await ctl.start(); ctl.begin(0); ctl.tick(TOTAL_MS + 1);
      expect(ctl.state.stage).toBe('failed'); expect(ctl.state.error).toMatch(/video not ready|canvas exploded/); expect(tracks[0]!.stopped).toBe(1); expect(log.generated).toEqual([]);
    }
  });
  it('begin() is ignored unless ready; ticks outside shooting do nothing', async () => {
    const { ctl, log } = rig({ devices: null }); ctl.begin(0); ctl.tick(5000);
    expect(ctl.state.stage).toBe('requesting'); expect(log.captured).toEqual([]);
  });
  it('retake re-opens the camera (releasing nothing twice) and a second strip logs a second event', async () => {
    const s1 = mkStream(); const s2 = mkStream(); let n = 0; const { ctl, log } = rig({ devices: fakeDevices(async () => (n++ === 0 ? s1.stream : s2.stream)).md });
    await ctl.start(); ctl.begin(0); ctl.tick(TOTAL_MS + 1); expect(ctl.state.stage).toBe('done');
    await ctl.retake(); expect(ctl.state).toMatchObject({ stage: 'ready', mode: 'camera', strip: null, captured: 0 });
    ctl.begin(0); ctl.tick(TOTAL_MS + 1); expect(ctl.state.stage).toBe('done');
    expect(log.generated).toEqual(['camera', 'camera']); expect(s1.tracks[0]!.stopped).toBe(1); expect(s2.tracks[0]!.stopped).toBe(1);
  });
  it('avatar retake goes straight back to ready without touching a camera', async () => {
    const { ctl, log } = rig({ devices: null }); await ctl.start(); await ctl.useAvatar();
    ctl.begin(0); ctl.tick(TOTAL_MS + 1); await ctl.retake();
    expect(ctl.state).toMatchObject({ stage: 'ready', mode: 'avatar' }); expect(log.generated).toEqual(['avatar']);
  });
});

describe('captureVideoFrame', () => {
  const rec = (): { ctx: { calls: string[]; translate(x: number, y: number): void; scale(x: number, y: number): void; drawImage(...a: unknown[]): void }; canvas: StripCanvas } => {
    const calls: string[] = []; const ctx = { calls, translate: (x: number, y: number) => { calls.push(`translate(${x},${y})`); }, scale: (x: number, y: number) => { calls.push(`scale(${x},${y})`); }, drawImage: () => { calls.push('draw'); } };
    return { ctx, canvas: { width: 0, height: 0, getContext: () => ctx } };
  };
  const video = (w: number, h: number, rs = 4): CanvasImageSource & { videoWidth: number; videoHeight: number; readyState: number } => ({ videoWidth: w, videoHeight: h, readyState: rs }) as never;
  it('mirrors like a booth mirror by default, and not when asked', () => {
    const a = rec(); const f = captureVideoFrame(video(640, 480), true, () => a.canvas);
    expect(a.ctx.calls).toEqual(['translate(640,0)', 'scale(-1,1)', 'draw']); expect([f.width, f.height]).toEqual([640, 480]);
    const b = rec(); captureVideoFrame(video(640, 480), false, () => b.canvas); expect(b.ctx.calls).toEqual(['draw']);
  });
  it('refuses to capture before the camera has a picture', () => {
    for (const v of [null, video(0, 0), video(640, 480, 1)]) expect(() => captureVideoFrame(v, true, () => rec().canvas)).toThrow(/not ready/);
  });
});

describe('avatar fallback poses', () => {
  it('has four visibly different poses of the visitor’s own avatar', () => {
    expect(AVATAR_POSES).toHaveLength(4);
    const svgs = AVATAR_POSES.map((_, i) => avatarPoseSvg(DEFAULT_AVATAR, i));
    expect(new Set(svgs).size).toBe(4);
    for (const s of svgs) expect(s).not.toMatch(/NaN|undefined/);
    expect(() => avatarPoseSvg(DEFAULT_AVATAR, 4)).toThrow(RangeError);
    expect(avatarPoseSvg({ ...DEFAULT_AVATAR, skin: 'deep' }, 0)).not.toBe(svgs[0]); // it follows the customisation
  });
});

describe('photostrip generator', () => {
  const solid = (c: string): StripFrame => { const cv = createCanvas(300, 200); const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 300, 200); return { source: cv as unknown as CanvasImageSource, width: 300, height: 200 }; };
  const make = (scale = 1): { canvas: StripCanvas; px: (x: number, y: number) => [number, number, number] } => {
    const canvas = generatePhotostrip(['#ff0000', '#00ff00', '#0000ff', '#ffff00'].map(solid), { scale, date: new Date(2026, 9, 24, 18, 12), createCanvas: (w, h) => createCanvas(w, h) as unknown as StripCanvas });
    const ctx = (canvas as unknown as ReturnType<typeof createCanvas>).getContext('2d');
    return { canvas, px: (x, y) => { const d = ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data; return [d[0] as number, d[1] as number, d[2] as number]; } };
  };
  it('stacks exactly four frames in a 35 mm strip of the documented size, hi-res at 2×', () => {
    expect(STRIP.frames).toBe(4); expect(STRIP_HEIGHT).toBe(STRIP.top + 4 * STRIP.frameH + 3 * STRIP.gap + STRIP.bottom);
    const m1 = make(1); expect([m1.canvas.width, m1.canvas.height]).toEqual([760, STRIP_HEIGHT]);
    const m2 = make(2); expect([m2.canvas.width, m2.canvas.height]).toEqual([1520, STRIP_HEIGHT * 2]);
    expect(() => generatePhotostrip([solid('#f00')], { createCanvas: (w, h) => createCanvas(w, h) as unknown as StripCanvas })).toThrow(/exactly 4 frames/);
    expect(() => generatePhotostrip([1, 2, 3, 4].map(() => solid('#fff')), { scale: 9, createCanvas: (w, h) => createCanvas(w, h) as unknown as StripCanvas })).toThrow(RangeError);
  });
  it('puts frame i in slot i, top to bottom (red, green, blue, yellow dominate their slots)', () => {
    const { px } = make();
    const at = (i: number): [number, number, number] => px(STRIP.railW + STRIP.frameW / 2 + 140, frameTop(i) + STRIP.frameH / 2 + 80);
    const [r, g, b, y] = [at(0), at(1), at(2), at(3)];
    expect(r[0]).toBeGreaterThan(r[1] + 100); expect(g[1]).toBeGreaterThan(g[0] + 100); expect(b[2]).toBeGreaterThan(b[0] + 100); expect(y[0] + y[1]).toBeGreaterThan(y[2] * 3);
  });
  it('has a dark film base and light sprocket holes down BOTH rails, with the right hole count', () => {
    const { px } = make();
    const lum = (c: [number, number, number]): number => (c[0] + c[1] + c[2]) / 3;
    expect(lum(px(10, 400))).toBeLessThan(60);
    for (const x of [26 + STRIP.holeW / 2, STRIP.width - 26 - STRIP.holeW / 2]) { expect(lum(px(x, 30 + STRIP.holeH / 2))).toBeGreaterThan(200); expect(lum(px(x, 30 + STRIP.holeH + 16))).toBeLessThan(80); }
    expect(sprocketCount()).toBe(Math.floor((STRIP_HEIGHT - 60) / STRIP.holePitch) + 1);
  });
  it('carries the four required stickers, each placed on the strip', () => {
    expect(STICKER_KINDS).toEqual(['cassette', 'clock', 'starfish', 'hibiscus']);
    expect(STICKER_PLACEMENTS.map((s) => s.kind).sort()).toEqual([...STICKER_KINDS].sort());
    const { px } = make();
    for (const s of STICKER_PLACEMENTS) { expect(s.x).toBeGreaterThan(0); expect(s.x).toBeLessThan(STRIP.width); expect(s.y).toBeLessThan(STRIP_HEIGHT); const c = px(s.x, s.y); expect(c[0] + c[1] + c[2]).toBeGreaterThan(90); } // not film-black underneath
  });
  it('coverRect crops to fill without distortion', () => {
    expect(coverRect(1280, 720, 600, 450)).toEqual({ sx: (1280 - 960) / 2, sy: 0, sw: 960, sh: 720 });
    expect(coverRect(480, 640, 600, 450)).toMatchObject({ sx: 0, sw: 480, sh: 360 });
    const c = coverRect(1000, 1000, 600, 450); expect(c.sw / c.sh).toBeCloseTo(600 / 450, 12);
    expect(() => coverRect(0, 5, 1, 1)).toThrow(RangeError);
  });
  it('names exports by local time and format, and formats the footer date', () => {
    expect(stripFilename('png', new Date(2026, 9, 24, 9, 5, 3))).toBe('cybermall_photostrip_20261024-090503.png');
    expect(stripFilename('jpeg', new Date(2026, 0, 2, 23, 59, 59))).toBe('cybermall_photostrip_20260102-235959.jpg');
    expect(formatStripDate(new Date(2026, 11, 5))).toBe('05 DEC 2026');
  });
  it('exports PNG with no quality parameter and JPEG at 0.92, and reports an encoder failure', async () => {
    const calls: Array<[string | undefined, number | undefined]> = [];
    const ok = { toBlob: (cb: (b: Blob | null) => void, type?: string, q?: number) => { calls.push([type, q]); cb(new Blob(['x'], type === undefined ? {} : { type })); } };
    expect((await canvasToBlob(ok, 'png')).type).toBe('image/png'); expect((await canvasToBlob(ok, 'jpeg')).type).toBe('image/jpeg');
    expect(calls).toEqual([['image/png', undefined], ['image/jpeg', 0.92]]);
    await expect(canvasToBlob({ toBlob: (cb) => cb(null) }, 'png')).rejects.toThrow(/PNG/);
  });
  it('a real encode round-trips: the PNG and JPEG buffers have the right magic bytes and size', () => {
    const { canvas } = make(1); const c = canvas as unknown as { toBuffer(mime: string, quality?: number): Buffer };
    expect(c.toBuffer('image/png').subarray(0, 4).toString('hex')).toBe('89504e47');
    expect(c.toBuffer('image/jpeg', 92).subarray(0, 3).toString('hex')).toBe('ffd8ff');
  });
});
