import { useEffect, useReducer, useRef, useState } from 'react';
import { CameraSession } from './camera';
import { PhotoboothController, type BoothState } from './controller';
import { captureVideoFrame } from './captureFrame';
import { AVATAR_POSES, FRAME_H, FRAME_W, avatarPoseSvg, drawAvatarFrame, loadSvgImage } from './avatarFrames';
import { canvasToBlob, generatePhotostrip, stripFilename, type BlobCanvas, type StripCanvas, type StripFormat, type StripFrame } from '../utils/photostripGenerator';
import { downloadBlob } from '../utils/downloadBlob';
import { renderAvatarSvg } from '../avatar/renderAvatar';
import { IDLE_POSE, type AvatarConfig } from '../avatar/config';
import { useMallStore } from '../state/mallStore';
import { track } from '../analytics/track';
import { audio } from '../audio/instance';

/** Everything the booth touches in the outside world is replaceable, so each path can be tested. */
export interface PhotoboothViewDeps {
  readonly mediaDevices?: Pick<MediaDevices, 'getUserMedia'> | null;
  readonly captureCamera?: (video: HTMLVideoElement | null, shot: number) => StripFrame;
  readonly loadAvatarImages?: (avatar: AvatarConfig) => Promise<CanvasImageSource[]>;
  readonly captureAvatar?: (image: CanvasImageSource, shot: number) => StripFrame;
  readonly compose?: (frames: readonly StripFrame[]) => StripCanvas;
  readonly download?: (filename: string, blob: Blob) => void;
  readonly now?: () => number;
}

const defaultCaptureCamera = (video: HTMLVideoElement | null): StripFrame => captureVideoFrame(video as never);
const defaultLoadAvatarImages = (a: AvatarConfig): Promise<CanvasImageSource[]> => Promise.all(AVATAR_POSES.map((_, i) => loadSvgImage(avatarPoseSvg(a, i))));
const defaultCaptureAvatar = (image: CanvasImageSource, shot: number): StripFrame => {
  const c = document.createElement('canvas'); c.width = FRAME_W; c.height = FRAME_H;
  const ctx = c.getContext('2d');
  if (ctx === null) throw new Error('2D canvas is not available.');
  drawAvatarFrame(ctx, image, shot);
  return { source: c, width: FRAME_W, height: FRAME_H };
};

const INITIAL_VIEW: BoothState = { stage: 'requesting', mode: null, cameraStatus: 'idle', shot: 0, count: null, flash: false, captured: 0, strip: null, error: null };

function failureCopy(s: BoothState): string {
  if (s.cameraStatus === 'denied') return 'Camera access was blocked. Allow it in your browser’s site settings and try again, or pose with your avatar instead.';
  if (s.cameraStatus === 'unavailable') return s.error ?? 'No camera is available here.';
  return s.error ?? 'Something went wrong in the booth.';
}

export function PhotoboothModal({ deps = {} }: { readonly deps?: PhotoboothViewDeps }): React.JSX.Element {
  const closePanel = useMallStore((s) => s.closePanel);
  const avatar = useMallStore((s) => s.avatar);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const ctlRef = useRef<PhotoboothController | null>(null);
  const camRef = useRef<CameraSession | null>(null);
  const depsRef = useRef(deps); depsRef.current = deps;
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const now = (): number => (depsRef.current.now ?? ((): number => performance.now()))();

  // The controller lives exactly as long as the modal. Cleanup stops the camera on every exit path.
  useEffect(() => {
    const camera = new CameraSession(depsRef.current.mediaDevices === undefined ? {} : { mediaDevices: depsRef.current.mediaDevices });
    let images: CanvasImageSource[] = [];
    const c = new PhotoboothController({
      camera,
      captureCamera: (shot) => (depsRef.current.captureCamera ?? defaultCaptureCamera)(videoRef.current, shot),
      prepareAvatar: async () => { images = await (depsRef.current.loadAvatarImages ?? defaultLoadAvatarImages)(useMallStore.getState().avatar); },
      captureAvatar: (shot) => (depsRef.current.captureAvatar ?? defaultCaptureAvatar)(images[shot] as CanvasImageSource, shot),
      compose: (frames) => (depsRef.current.compose ?? ((f) => generatePhotostrip(f)))(frames),
      onGenerated: (mode) => { track('PHOTOBOOTH_STRIP_GENERATED', mode === 'camera' ? 'photobooth-camera' : 'photobooth-avatar'); },
      sfx: (s) => { audio.play(s); },
    });
    ctlRef.current = c; camRef.current = camera;
    const off = c.subscribe(bump);
    void c.start();
    bump();
    const video = videoRef.current;
    return () => { off(); c.dispose(); ctlRef.current = null; camRef.current = null; if (video !== null) video.srcObject = null; };
  }, []);

  const st = ctlRef.current?.state ?? INITIAL_VIEW;

  // show the live stream in the viewfinder while the camera is the source
  useEffect(() => {
    const v = videoRef.current; const stream = camRef.current?.stream ?? null;
    if (v === null) return;
    if (st.mode === 'camera' && (st.stage === 'ready' || st.stage === 'shooting') && stream !== null) {
      if (v.srcObject !== stream) { v.srcObject = stream; if (typeof v.play === 'function') void Promise.resolve(v.play()).catch(() => { ctlRef.current?.reportError('The viewfinder could not start.'); }); }
    } else if (v.srcObject !== null) v.srcObject = null;
  }, [st.stage, st.mode]);

  // drive the countdown
  useEffect(() => {
    if (st.stage !== 'shooting') return undefined;
    let raf = 0;
    const loop = (): void => { ctlRef.current?.tick(now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [st.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // mount the finished strip for preview
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    host.replaceChildren();
    if (st.stage === 'done' && st.strip !== null && typeof Node !== 'undefined' && (st.strip as unknown) instanceof Node) host.appendChild(st.strip as unknown as Node);
  }, [st.stage, st.strip]);

  const save = async (format: StripFormat): Promise<void> => {
    if (st.strip === null) return;
    try {
      const blob = await canvasToBlob(st.strip as unknown as BlobCanvas, format);
      const name = stripFilename(format);
      (depsRef.current.download ?? downloadBlob)(name, blob);
      setSaveMsg(`Saved ${name}`);
    } catch (e) { setSaveMsg(e instanceof Error ? e.message : 'Could not save the strip.'); }
  };

  const ctl = ctlRef.current;
  const live = st.cameraStatus === 'live';
  const avatarPreview = renderAvatarSvg(avatar, IDLE_POSE, 'pbp');

  return (
    <div className="modal-back booth-back" onPointerDown={(e) => { if (e.target === e.currentTarget) closePanel(); }}>
      <div className="booth" role="dialog" aria-modal="true" aria-labelledby="booth-title">
        <header className="booth-head">
          <div><p className="eyebrow">Floor 7 · Photobooth</p><h2 id="booth-title">Four poses, one strip</h2></div>
          <button type="button" className="modal-x" onClick={closePanel} aria-label="Close photobooth">✕</button>
        </header>

        {st.stage !== 'done' && (
          <div className="crt" data-stage={st.stage}>
            <div className="crt-screen">
              <video ref={videoRef} className={`crt-video${st.mode === 'camera' && (st.stage === 'ready' || st.stage === 'shooting') ? '' : ' hidden'}`} muted playsInline aria-label="Live camera viewfinder" />
              {st.mode === 'avatar' && (st.stage === 'ready' || st.stage === 'shooting') && <div className="crt-avatar" aria-label="Your avatar" dangerouslySetInnerHTML={{ __html: avatarPreview }} />}
              {st.stage === 'requesting' && <p className="crt-msg">{st.mode === 'avatar' ? 'Setting up your poses…' : 'Requesting your camera… allow access in the browser prompt.'}</p>}
              {st.stage === 'failed' && <p className="crt-msg warn" role="alert">{failureCopy(st)}</p>}
              {st.stage === 'composing' && <p className="crt-msg">Developing film…</p>}
              {st.stage === 'shooting' && st.count !== null && <div className="crt-count" role="status" aria-live="assertive">{st.count}</div>}
              {st.stage === 'shooting' && st.flash && <div className="crt-flashword" role="status">FLASH!</div>}
              <div className={`crt-flash${st.flash ? ' on' : ''}`} aria-hidden="true" />
              <div className="crt-scan" aria-hidden="true" />
              <div className="crt-hud"><span className={live ? 'rec on' : 'rec'}>● {live ? 'CAMERA ON' : st.mode === 'avatar' ? 'AVATAR MODE' : 'CAMERA OFF'}</span><span>{st.stage === 'shooting' ? `PHOTO ${Math.min(st.shot + 1, 4)} / 4` : '4 PHOTOS'}</span></div>
            </div>
            <div className="pips" aria-label={`${st.captured} of 4 photos taken`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < st.captured ? 'on' : ''} />)}</div>
          </div>
        )}

        <div className="strip-host" ref={hostRef} hidden={st.stage !== 'done'} aria-label="Your photostrip" />

        <div className="booth-actions">
          {st.stage === 'requesting' && st.mode !== 'avatar' && <button type="button" onClick={() => { void ctl?.useAvatar(); }}>Use my avatar instead</button>}
          {st.stage === 'failed' && (<>
            <button type="button" className="primary" onClick={() => { void ctl?.useAvatar(); }}>Use my avatar poses</button>
            <button type="button" onClick={() => { void ctl?.start(); }}>Try the camera again</button>
          </>)}
          {st.stage === 'ready' && (<>
            <button type="button" className="primary" autoFocus onClick={() => { audio.play('click'); ctl?.begin(now()); }}>Take 4 photos</button>
            {st.mode === 'camera' && <button type="button" onClick={() => { void ctl?.useAvatar(); }}>Use my avatar instead</button>}
          </>)}
          {st.stage === 'done' && (<>
            <button type="button" className="primary" onClick={() => { void save('png'); }}>Save Photostrip · PNG</button>
            <button type="button" onClick={() => { void save('jpeg'); }}>Save Photostrip · JPEG</button>
            <button type="button" onClick={() => { setSaveMsg(null); void ctl?.retake(); }}>Retake</button>
          </>)}
        </div>
        {saveMsg !== null && <p className="muted" role="status">{saveMsg}</p>}
        <p className="fine-print">Your photos stay on this device — nothing is uploaded. The camera switches off as soon as the fourth photo is taken, or when you close the booth.</p>
      </div>
    </div>
  );
}
