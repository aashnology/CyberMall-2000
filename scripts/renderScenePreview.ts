import { writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { DEFAULT_CONCOURSE as S, layoutFloor } from '../src/spatial/concourse';
import { renderMarbleFloor } from '../src/render/marbleFloor';
import { drawScene, type SceneState } from '../src/scene/drawScene';
import { buildDirectory, parsePincode } from '../src/engine/pincode';
import { eligiblePromos } from '../src/engine/banners';
import { SAMPLE_CATALOG } from '../src/data/catalog.sample';
import { skyboxAt } from '../src/scene/skybox';
import { ParticleField } from '../src/scene/particles';

// usage: tsx scripts/renderScenePreview.ts out.png floor 'YYYY-MM-DDTHH:MM' pin zoom t
const [, , out = '/tmp/scene.png', floorArg = '1', whenArg = '2026-06-15T12:00', pinArg = '400058', zoomArg = '14', tArg = '0.5'] = process.argv;
const floorId = Number(floorArg) as 1;
const parsed = parsePincode(pinArg);
if (!parsed.ok) throw new Error('bad pin');
const dir = buildDirectory(SAMPLE_CATALOG, { pincode: parsed.pincode, onlyDeliverable: false });
const entries = dir.byFloor[floorId];
const layout = layoutFloor(entries.length, S);
const W = 1280, H = 760;
const ppu = Math.min(8, 2048 / (2 * (layout.radius + S.walkwayWidth / 2 + 3)));
const size = Math.ceil((layout.radius + S.walkwayWidth / 2 + 3) * 2 * ppu);
const img = renderMarbleFloor({ width: size, height: size, pxPerUnit: ppu, spec: S, radius: layout.radius });
const fc = createCanvas(size, size);
const fctx = fc.getContext('2d');
const id = fctx.createImageData(size, size);
id.data.set(img.data);
fctx.putImageData(id, 0, 0);

const c = createCanvas(W, H);
const ctx = c.getContext('2d');
const skybox = skyboxAt(new Date(whenArg));
const field = new ParticleField(); field.resize(W, H); field.configure(skybox.particles.kind, skybox.particles.intensity);
for (let i = 0; i < 60 * 8; i += 1) field.step(1 / 60, 6); // let 8 seconds of weather settle
const t = Number(tArg);
const ang = S.startAngle + S.sweep * t;
const half = S.walkwayWidth / 2;
const st: SceneState = {
  width: W, height: H, camera: { cx: Math.cos(ang) * layout.radius, cy: Math.sin(ang) * layout.radius, zoom: Number(zoomArg) },
  spec: S, layout, entries, floorId, pincode: parsed.pincode,
  floorLayer: { image: fc as unknown as CanvasImageSource, extent: size / ppu },
  skybox, particles: field, timeMs: 2300, banners: eligiblePromos(dir), hoverIndex: -1, nearBooth: false,
};
void half;
drawScene(ctx as unknown as CanvasRenderingContext2D, st);
writeFileSync(out, c.toBuffer('image/png'));
console.log('rendered', out, 'stores', entries.length, 'radius', layout.radius.toFixed(1));
