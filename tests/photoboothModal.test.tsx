// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { PhotoboothModal, type PhotoboothViewDeps } from '../src/photobooth/PhotoboothModal';
import { AnalyticsDashboard } from '../src/components/analytics/AnalyticsDashboard';
import { useMallStore } from '../src/state/mallStore';
import { telemetry } from '../src/analytics/instance';
import { eventsToCsv } from '../src/analytics/telemetry';
import { parseCsv } from '../src/data/indiaPost';
import { TOTAL_MS, COUNT_MS, captureTime } from '../src/photobooth/sequence';
import type { Pincode } from '../src/data/types';
import type { StripCanvas, StripFrame } from '../src/utils/photostripGenerator';

interface FakeTrack { stopped: number; onended: (() => void) | null; stop(): void }
const mkStream = (): { stream: MediaStream; tracks: FakeTrack[] } => { const tracks: FakeTrack[] = [{ stopped: 0, onended: null, stop() { this.stopped += 1; } }]; return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks }; };
const frame = (): StripFrame => ({ source: {} as CanvasImageSource, width: 4, height: 3 });
const fakeStrip = (): StripCanvas & { toBlob(cb: (b: Blob | null) => void, type?: string, q?: number): void } => ({ width: 10, height: 10, getContext: () => null, toBlob: (cb, type) => cb(new Blob(['strip'], type === undefined ? {} : { type })) });
const clock = { t: 0 };

function Harness({ deps }: { deps: PhotoboothViewDeps }): React.JSX.Element | null {
  const panel = useMallStore((s) => s.panel);
  return panel === 'photobooth' ? <PhotoboothModal deps={deps} /> : null;
}
type Md = Pick<MediaDevices, 'getUserMedia'> | null;
const baseDeps = (md: Md, extra: Partial<PhotoboothViewDeps> = {}): PhotoboothViewDeps => ({
  mediaDevices: md, captureCamera: frame, captureAvatar: frame, loadAvatarImages: async () => [{}, {}, {}, {}] as CanvasImageSource[], compose: fakeStrip, now: () => clock.t, ...extra,
});
const camera = (stream: MediaStream): Md => ({ getUserMedia: () => Promise.resolve(stream) });

let errors: ReturnType<typeof vi.spyOn>; let warns: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  cleanup(); telemetry.clear(); clock.t = 0;
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { value: () => Promise.resolve(), configurable: true });
  useMallStore.setState({ pincode: '400058' as Pincode, floorId: 7, panel: 'photobooth', moodId: null, lookbook: [], selected: null });
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  warns = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { expect(errors).not.toHaveBeenCalled(); expect(warns).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

const types = (): string[] => telemetry.events().map((e) => e.event_type);

describe('photobooth modal: camera path', () => {
  it('requests the camera, shows a live viewfinder, counts 3-2-1-Flash, captures 4, switches the camera OFF, then offers the strip', async () => {
    const { stream, tracks } = mkStream();
    render(<Harness deps={baseDeps(camera(stream))} />);
    expect(screen.getByRole('dialog', { name: /four poses/i })).toBeTruthy();
    const take = await screen.findByRole('button', { name: /take 4 photos/i });
    const video = document.querySelector('video') as HTMLVideoElement & { srcObject: unknown };
    await waitFor(() => expect(video.srcObject).toBe(stream));
    expect(screen.getByText(/CAMERA ON/)).toBeTruthy();
    expect(tracks[0]!.stopped).toBe(0);

    clock.t = 0; fireEvent.click(take);
    await waitFor(() => expect(screen.getByRole('status', { name: '' }).textContent).toBe('3'));
    clock.t = COUNT_MS + 20; await waitFor(() => expect(screen.getByText('2')).toBeTruthy());
    clock.t = 2 * COUNT_MS + 20; await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
    clock.t = captureTime(0) + 20; await waitFor(() => expect(screen.getByText('FLASH!')).toBeTruthy());
    expect(tracks[0]!.stopped).toBe(0); // still live between shots

    clock.t = TOTAL_MS + 50;
    await screen.findByRole('button', { name: /save photostrip · png/i });
    expect(screen.getByRole('button', { name: /save photostrip · jpeg/i })).toBeTruthy();
    expect(tracks[0]!.stopped).toBe(1);                        // privacy: camera off before the result is shown
    expect(types()).toEqual(['PHOTOBOOTH_STRIP_GENERATED']);   // telemetry, exactly once
    expect(telemetry.events()[0]!.item_id).toBe('photobooth-camera');
  });

  it('saving calls the downloader with a correctly named PNG and JPEG blob', async () => {
    const { stream } = mkStream(); const saved: Array<[string, string]> = [];
    render(<Harness deps={baseDeps(camera(stream), { download: (n, b) => { saved.push([n, b.type]); } })} />);
    fireEvent.click(await screen.findByRole('button', { name: /take 4 photos/i })); clock.t = TOTAL_MS + 10;
    fireEvent.click(await screen.findByRole('button', { name: /save photostrip · png/i }));
    await waitFor(() => expect(saved).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /save photostrip · jpeg/i }));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[0]![0]).toMatch(/^cybermall_photostrip_\d{8}-\d{6}\.png$/); expect(saved[0]![1]).toBe('image/png');
    expect(saved[1]![0]).toMatch(/\.jpg$/); expect(saved[1]![1]).toBe('image/jpeg');
    expect(screen.getAllByRole('status').some((s) => /Saved cybermall_photostrip/.test(s.textContent ?? ''))).toBe(true);
    expect(types()).toEqual(['PHOTOBOOTH_STRIP_GENERATED']); // saving does not double count
  });

  it('retake shoots again and records a second strip', async () => {
    const a = mkStream(); const b = mkStream(); let n = 0;
    render(<Harness deps={baseDeps({ getUserMedia: () => Promise.resolve(n++ === 0 ? a.stream : b.stream) })} />);
    fireEvent.click(await screen.findByRole('button', { name: /take 4 photos/i })); clock.t = TOTAL_MS + 10;
    fireEvent.click(await screen.findByRole('button', { name: /^retake$/i }));
    clock.t = 0; fireEvent.click(await screen.findByRole('button', { name: /take 4 photos/i })); clock.t = TOTAL_MS + 10;
    await screen.findByRole('button', { name: /save photostrip · png/i });
    expect(types()).toEqual(['PHOTOBOOTH_STRIP_GENERATED', 'PHOTOBOOTH_STRIP_GENERATED']);
    expect(a.tracks[0]!.stopped).toBe(1); expect(b.tracks[0]!.stopped).toBe(1);
  });
});

describe('photobooth modal: privacy cleanup', () => {
  it('closing the booth mid-shoot stops the camera and records nothing', async () => {
    const { stream, tracks } = mkStream();
    render(<Harness deps={baseDeps(camera(stream))} />);
    fireEvent.click(await screen.findByRole('button', { name: /take 4 photos/i })); clock.t = 1000;
    await waitFor(() => expect(screen.getByRole('status', { name: '' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /close photobooth/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tracks[0]!.stopped).toBe(1);
    clock.t = TOTAL_MS * 2; await new Promise((r) => setTimeout(r, 60));
    expect(types()).toEqual([]);
  });
  it('closing while the browser permission prompt is still open: the late stream is stopped, never shown', async () => {
    const { stream, tracks } = mkStream(); let release!: (s: MediaStream) => void;
    render(<Harness deps={baseDeps({ getUserMedia: () => new Promise<MediaStream>((r) => { release = r; }) })} />);
    expect(screen.getByText(/requesting your camera/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /close photobooth/i }));
    release(stream); await new Promise((r) => setTimeout(r, 30));
    expect(tracks[0]!.stopped).toBe(1);
  });
  it('unmounting (for example switching panels) stops a live camera', async () => {
    const { stream, tracks } = mkStream();
    const { unmount } = render(<PhotoboothModal deps={baseDeps(camera(stream))} />);
    await screen.findByRole('button', { name: /take 4 photos/i });
    unmount(); expect(tracks[0]!.stopped).toBe(1);
  });
  it('clicking the dimmed backdrop closes the booth', async () => {
    const { stream, tracks } = mkStream(); const { container } = render(<Harness deps={baseDeps(camera(stream))} />);
    await screen.findByRole('button', { name: /take 4 photos/i });
    fireEvent.pointerDown(container.querySelector('.booth-back') as Element);
    expect(useMallStore.getState().panel).toBe('none'); expect(tracks[0]!.stopped).toBe(1);
  });
});

describe('photobooth modal: avatar fallback', () => {
  it('a blocked camera explains why and offers the avatar poses, which complete a strip tagged "avatar"', async () => {
    render(<Harness deps={baseDeps({ getUserMedia: () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })) })} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/blocked/i);
    expect(screen.getByRole('button', { name: /try the camera again/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /use my avatar poses/i }));
    fireEvent.click(await screen.findByRole('button', { name: /take 4 photos/i }));
    expect(screen.getByLabelText('Your avatar')).toBeTruthy(); expect(screen.getByText(/AVATAR MODE/)).toBeTruthy();
    clock.t = TOTAL_MS + 10;
    await screen.findByRole('button', { name: /save photostrip · png/i });
    expect(telemetry.events().map((e) => [e.event_type, e.item_id])).toEqual([['PHOTOBOOTH_STRIP_GENERATED', 'photobooth-avatar']]);
  });
  it('no camera API at all (plain http, old browser) lands in the same friendly fallback', async () => {
    render(<Harness deps={baseDeps(null)} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/HTTPS or localhost/);
    expect(screen.getByRole('button', { name: /use my avatar poses/i })).toBeTruthy();
  });
  it('"use my avatar instead" is available while the permission prompt is pending', async () => {
    render(<Harness deps={baseDeps({ getUserMedia: () => new Promise<MediaStream>(() => undefined) })} />);
    fireEvent.click(screen.getByRole('button', { name: /use my avatar instead/i }));
    await screen.findByRole('button', { name: /take 4 photos/i });
    expect(screen.getByText(/AVATAR MODE/)).toBeTruthy();
  });
});

describe('analytics integration', () => {
  it('the event lands in the CSV export and the dashboard counts photostrips', async () => {
    const { stream } = mkStream(); const { unmount } = render(<Harness deps={baseDeps(camera(stream))} />);
    fireEvent.click(await screen.findByRole('button', { name: /take 4 photos/i })); clock.t = TOTAL_MS + 10;
    await screen.findByRole('button', { name: /save photostrip · png/i }); unmount();
    const rows = parseCsv(eventsToCsv(telemetry.events()));
    expect(rows[0]).toEqual(['session_id', 'timestamp', 'pincode', 'event_type', 'item_id', 'match_score', 'user_mood_vector']);
    expect(rows[1]!.slice(2, 5)).toEqual(['400058', 'PHOTOBOOTH_STRIP_GENERATED', 'photobooth-camera']);
    render(<AnalyticsDashboard />);
    expect(screen.getByText('photostrips made').previousElementSibling?.textContent).toBe('1');
  });
});
