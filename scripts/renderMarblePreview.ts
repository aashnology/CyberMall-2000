import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { DEFAULT_CONCOURSE as S } from '../src/spatial/concourse';
import { renderMarbleFloor } from '../src/render/marbleFloor';

const ppu = 12;
const size = Math.ceil((S.baseRadius + S.walkwayWidth / 2 + 3) * 2 * ppu);
const img = renderMarbleFloor({ width: size, height: size, pxPerUnit: ppu, spec: S, radius: S.baseRadius });
const png = new PNG({ width: size, height: size });
// composite over a dark slate so the C shape and transparency are visible
for (let i = 0; i < size * size; i += 1) {
  const a = (img.data[i * 4 + 3] ?? 0) / 255;
  png.data[i * 4] = Math.round((img.data[i * 4] ?? 0) * a + 28 * (1 - a));
  png.data[i * 4 + 1] = Math.round((img.data[i * 4 + 1] ?? 0) * a + 34 * (1 - a));
  png.data[i * 4 + 2] = Math.round((img.data[i * 4 + 2] ?? 0) * a + 46 * (1 - a));
  png.data[i * 4 + 3] = 255;
}
writeFileSync(process.argv[2] ?? '/tmp/marble.png', PNG.sync.write(png));
console.log('wrote', size, 'px');
