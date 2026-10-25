import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONCOURSE as SPEC, concourseToWorld, type FloorLayout } from '../spatial/concourse';
import { floor7Landmarks, nearPhotobooth } from '../spatial/landmarks';
import { drawScene, landmarkPositions, type FloorLayer } from '../scene/drawScene';
import { clampZoom, screenToWorld, worldToScreen, type Camera } from '../scene/camera';
import { initialWalker, NO_INPUT, setTarget, stepWalker, type KeyInput, type Walker } from '../scene/movement';
import { nearestPlacement } from '../scene/interaction';
import { skyboxFor, type SkyboxState } from '../scene/skybox';
import { ParticleField } from '../scene/particles';
import { renderAvatarSvg } from '../avatar/renderAvatar';
import type { DirectoryEntry } from '../engine/pincode';
import type { BannerPromo } from '../engine/banners';
import type { FloorId, Pincode } from '../data/types';
import { useMallStore } from '../state/mallStore';
import { walkerBus } from '../state/walkerBus';
import type { MarbleRequest, MarbleResponse } from '../render/marbleWorker';
import { DwellTracker, ImpressionTracker } from '../analytics/telemetry';
import { track } from '../analytics/track';
import { audio } from '../audio/instance';

interface Props {
  readonly layout: FloorLayout;
  readonly entries: readonly DirectoryEntry[];
  readonly floorId: FloorId;
  readonly pincode: Pincode | null;
  readonly banners: readonly BannerPromo[];
}

interface Tip { readonly x: number; readonly y: number; readonly entry: DirectoryEntry }

const AVATAR_UNITS_TALL = 5.8;
const KEYMAP: Readonly<Record<string, keyof KeyInput>> = {
  w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
};

export function MallCanvas({ layout, entries, floorId, pincode, banners }: Props): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const walker = useRef<Walker>(initialWalker(SPEC, 0.06));
  const keys = useRef<{ -readonly [K in keyof KeyInput]: boolean }>({ ...NO_INPUT });
  const zoom = useRef(15);
  const cam = useRef<Camera | null>(null);
  const hover = useRef(-1);
  const floorLayer = useRef<FloorLayer | null>(null);
  const pendingElevator = useRef(false);
  const pendingBooth = useRef(false);
  const nearBoothRef = useRef(false);
  const impressions = useRef(new ImpressionTracker());
  const particles = useRef(new ParticleField());
  const dwell = useRef(new DwellTracker());
  const live = useRef({ layout, entries, floorId, pincode, banners });
  live.current = { layout, entries, floorId, pincode, banners };

  const [frame, setFrame] = useState<{ bucket: number; walking: boolean; facing: 'left' | 'right' }>({ bucket: -1, walking: false, facing: 'right' });
  const [tip, setTip] = useState<Tip | null>(null);
  const [nearElevator, setNearElevator] = useState(false);
  const [nearBooth, setNearBooth] = useState(false);
  const avatar = useMallStore((s) => s.avatar);
  const panel = useMallStore((s) => s.panel);

  const avatarSvg = useMemo(
    () => renderAvatarSvg(avatar, { phase: frame.bucket < 0 ? 0 : frame.bucket / 8, walking: frame.walking, facing: frame.facing }, 'mv'),
    [avatar, frame],
  );

  // marble floor, rendered off-thread; flat band is shown until it arrives
  const radius = layout.radius;
  useEffect(() => {
    floorLayer.current = null;
    if (typeof Worker === 'undefined') return undefined;
    const half = SPEC.walkwayWidth / 2;
    const ppu = Math.min(8, 2048 / (2 * (radius + half + 3)));
    const size = Math.ceil((radius + half + 3) * 2 * ppu);
    const key = `${radius.toFixed(3)}`;
    const worker = new Worker(new URL('../render/marbleWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<MarbleResponse>) => {
      if (e.data.key !== key) return;
      const c = document.createElement('canvas');
      c.width = e.data.size; c.height = e.data.size;
      const ctx = c.getContext('2d');
      if (ctx === null) return;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(e.data.buffer), e.data.size, e.data.size), 0, 0);
      floorLayer.current = { image: c, extent: e.data.size / ppu };
    };
    const req: MarbleRequest = { key, spec: SPEC, radius, size, pxPerUnit: ppu };
    worker.postMessage(req);
    return () => worker.terminate();
  }, [radius]);

  // arriving from the elevator: start of the concourse
  useEffect(() => { walker.current = initialWalker(SPEC, 0.06); pendingElevator.current = false; }, [floorId]);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      const st = useMallStore.getState();
      if (k === 'escape') { st.closePanel(); return; }
      if (k === 'm') { st.openPanel(st.panel === 'map' ? 'none' : 'map'); return; }
      if (k === 'l') { st.openPanel(st.panel === 'directory' ? 'none' : 'directory'); return; }
      if (k === 'e' && nearBoothRef.current && st.panel === 'none') { audio.play('open'); st.openPanel('photobooth'); return; }
      if (k === 'e' && walker.current.t < 0.1) { st.openPanel('elevator'); return; }
      const dir = KEYMAP[k];
      if (dir !== undefined && st.panel === 'none') { keys.current[dir] = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent): void => { const dir = KEYMAP[e.key.toLowerCase()]; if (dir !== undefined) keys.current[dir] = false; };
    const blur = (): void => { keys.current = { ...NO_INPUT }; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (canvas === null || wrap === null) return undefined;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return undefined;
    let raf = 0;
    let last = performance.now();
    let lastBucket = -2;
    let lastWalking = false;
    let lastFacing: 'left' | 'right' = 'right';
    let lastNear = false;
    let lastNearBooth = false;
    let lastPublish = 0;
    let lastImpressionScan = 0;
    let lastAudioScan = 0;
    let lastSkyAt = -1e9;
    let skybox: SkyboxState | null = null;
    let W = 0, H = 0;

    const resize = (): void => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, Math.floor(r.width)); H = Math.max(1, Math.floor(r.height));
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles.current.resize(W, H);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const tick = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = live.current;
      const st = useMallStore.getState();
      const wasPanel = st.panel !== 'none';
      walker.current = stepWalker(walker.current, wasPanel ? NO_INPUT : keys.current, dt, SPEC, L.layout.radius);
      const w = walker.current;
      const here = concourseToWorld(SPEC, L.layout.radius, w.t, w.lateral);
      const c = cam.current ?? { cx: here.x, cy: here.y, zoom: zoom.current };
      const k = Math.min(1, dt * 6);
      cam.current = { cx: c.cx + (here.x - c.cx) * k, cy: c.cy + (here.y - c.cy) * k, zoom: c.zoom + (zoom.current - c.zoom) * Math.min(1, dt * 8) };

      // device clock → season + day/night; re-evaluated twice a second (the slider only overrides the hour)
      if (skybox === null || now - lastSkyAt > 500) {
        lastSkyAt = now;
        const next = skyboxFor(new Date(), st.autoClock ? null : st.hour);
        if (skybox === null || next.particles.kind !== skybox.particles.kind || next.particles.intensity !== skybox.particles.intensity) particles.current.configure(next.particles.kind, next.particles.intensity);
        skybox = next;
      }
      particles.current.step(dt, 6);
      const f7 = L.floorId === 7 ? floor7Landmarks(SPEC, L.layout.radius) : null;
      const nearBoothNow = f7 !== null && nearPhotobooth(here, f7.photobooth);
      nearBoothRef.current = nearBoothNow;
      if (nearBoothNow !== lastNearBooth) { lastNearBooth = nearBoothNow; setNearBooth(nearBoothNow); }
      if (pendingBooth.current && nearBoothNow) { pendingBooth.current = false; audio.play('open'); st.openPanel('photobooth'); }
      drawScene(ctx, {
        width: W, height: H, camera: cam.current, spec: SPEC, layout: L.layout, entries: L.entries, floorId: L.floorId,
        pincode: L.pincode, nearBooth: nearBoothNow, floorLayer: floorLayer.current, skybox: skybox as SkyboxState, particles: particles.current, timeMs: now, banners: L.banners, hoverIndex: hover.current,
      });

      // spatial audio: distance to the nearest storefront drives the bed crossfade
      if (now - lastAudioScan > 200) {
        lastAudioScan = now;
        const idx = nearestPlacement(L.layout.placements, here.x, here.y, Number.POSITIVE_INFINITY);
        const pl = idx >= 0 ? L.layout.placements[idx] : undefined;
        const ent = idx >= 0 ? L.entries[idx] : undefined;
        const arcade = L.floorId === 7 ? floor7Landmarks(SPEC, L.layout.radius).arcade : null;
        audio.setListener({
          floorId: L.floorId,
          nearest: pl !== undefined && ent !== undefined ? { subcategory: ent.store.subcategory, distance: Math.hypot(pl.x - here.x, pl.y - here.y) } : null,
          arcadeDistance: arcade === null ? null : Math.hypot(arcade.x - here.x, arcade.y - here.y),
        });
      }
      // telemetry: impressions (first time on screen) and 3-second hover dwell
      if (now - lastImpressionScan > 250) {
        lastImpressionScan = now;
        const visible: string[] = [];
        const margin = 40;
        L.layout.placements.forEach((pl, i) => {
          const e = L.entries[i];
          if (e === undefined) return;
          const sp = worldToScreen(cam.current as Camera, W, H, pl.x, pl.y);
          if (sp.sx > -margin && sp.sx < W + margin && sp.sy > -margin && sp.sy < H + margin) visible.push(e.store.id);
        });
        for (const id of impressions.current.observe(visible)) track('STORE_IMPRESSION', id, L.entries.find((e) => e.store.id === id));
      }
      const hovered = hover.current >= 0 ? L.entries[hover.current] : undefined;
      const dwelled = dwell.current.update(hovered?.store.id ?? null, now);
      if (dwelled !== null) track('STORE_HOVER_DWELL', dwelled, hovered);

      const scr = worldToScreen(cam.current, W, H, here.x, here.y);
      const ah = AVATAR_UNITS_TALL * cam.current.zoom;
      const aw = ah * (200 / 320);
      const el = avatarRef.current;
      if (el !== null) { el.style.width = `${aw}px`; el.style.height = `${ah}px`; el.style.transform = `translate(${scr.sx - aw / 2}px, ${scr.sy - ah * 0.94}px)`; }

      const bucket = w.moving ? Math.floor(w.phase * 8) : -1;
      if (bucket !== lastBucket || w.moving !== lastWalking || w.facing !== lastFacing) {
        lastBucket = bucket; lastWalking = w.moving; lastFacing = w.facing;
        setFrame({ bucket, walking: w.moving, facing: w.facing });
      }
      const near = w.t < 0.1;
      if (near !== lastNear) { lastNear = near; setNearElevator(near); }
      if (pendingElevator.current && w.t < 0.07) { pendingElevator.current = false; st.openPanel('elevator'); }
      if (now - lastPublish > 100) { lastPublish = now; walkerBus.publish({ t: w.t, lateral: w.lateral }); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const toWorld = (e: React.PointerEvent | React.WheelEvent): { x: number; y: number } => {
    const r = wrapRef.current?.getBoundingClientRect();
    const c = cam.current ?? { cx: 0, cy: 0, zoom: zoom.current };
    return screenToWorld(c, r?.width ?? 1, r?.height ?? 1, e.clientX - (r?.left ?? 0), e.clientY - (r?.top ?? 0));
  };

  const onPointerDown = (e: React.PointerEvent): void => {
    if (panel !== 'none' || useMallStore.getState().selected !== null) return;
    const p = toWorld(e);
    const hit = nearestPlacement(live.current.layout.placements, p.x, p.y, 3.4);
    const hitEntry = hit >= 0 ? live.current.entries[hit] : undefined;
    if (hitEntry !== undefined) {
      audio.play('open');
      useMallStore.getState().openStore(hitEntry);
      track('STORE_MODAL_OPENED', hitEntry.store.id, hitEntry);
      return;
    }
    if (live.current.floorId === 7) {
      const booth = floor7Landmarks(SPEC, live.current.layout.radius).photobooth;
      if (Math.hypot(p.x - booth.x, p.y - booth.y) < 4.4) {
        if (nearBoothRef.current) { audio.play('open'); useMallStore.getState().openPanel('photobooth'); }
        else { pendingBooth.current = true; walker.current = setTarget(SPEC, live.current.layout.radius, walker.current, booth.x, booth.y); }
        return;
      }
    }
    pendingBooth.current = false;
    const lm = landmarkPositions(SPEC, live.current.layout.radius);
    if (Math.hypot(p.x - lm.elevator.x, p.y - lm.elevator.y) < 6) pendingElevator.current = true;
    else pendingElevator.current = false;
    walker.current = setTarget(SPEC, live.current.layout.radius, walker.current, p.x, p.y);
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    const p = toWorld(e);
    const idx = nearestPlacement(live.current.layout.placements, p.x, p.y, 3.4);
    if (idx !== hover.current) {
      hover.current = idx;
      const entry = idx >= 0 ? live.current.entries[idx] : undefined;
      if (entry === undefined) setTip(null);
      else { const r = wrapRef.current?.getBoundingClientRect(); setTip({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0), entry }); }
    } else if (idx >= 0) {
      setTip((t) => (t === null ? t : { ...t, x: e.clientX - (wrapRef.current?.getBoundingClientRect().left ?? 0), y: e.clientY - (wrapRef.current?.getBoundingClientRect().top ?? 0) }));
    }
  };
  const onWheel = (e: React.WheelEvent): void => { zoom.current = clampZoom(zoom.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); };

  return (
    <div ref={wrapRef} className="mall-wrap" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={() => { hover.current = -1; setTip(null); }} onWheel={onWheel}>
      <canvas ref={canvasRef} className="mall-canvas" aria-label="Mall concourse" />
      <div ref={avatarRef} className="avatar" dangerouslySetInnerHTML={{ __html: avatarSvg }} />
      {tip !== null && (
        <div className="tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <strong>{tip.entry.store.name}</strong>
          <span>{tip.entry.store.subcategory}</span>
          {tip.entry.ribbon !== null && <em className="ribbon-text">{tip.entry.ribbon}</em>}
          {tip.entry.status === 'delivers' && <em className="ok-text">Delivers to {pincode}</em>}
        </div>
      )}
      {nearBooth && panel === 'none' && <div className="prompt">Enter Photobooth <kbd>E</kbd> / Tap</div>}
      {nearElevator && !nearBooth && panel === 'none' && <div className="prompt">Press <kbd>E</kbd> or click the elevator · Floor {floorId}</div>}
      <div className="hint">WASD / arrows or click to walk · wheel to zoom · <kbd>M</kbd> map · <kbd>L</kbd> directory</div>
    </div>
  );
}
