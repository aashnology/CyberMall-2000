import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFAULT_AVATAR, type AvatarConfig, IDLE_POSE } from '../src/avatar/config';
import { renderAvatarSvg } from '../src/avatar/renderAvatar';

const variants: AvatarConfig[] = [
  DEFAULT_AVATAR,
  { ...DEFAULT_AVATAR, hairstyle: 'curly-waves', hairColor: 'espresso', skin: 'deep', eyes: 'hazel', top: 'striped-polo', topColor: 'cream', bottom: 'wide-trousers', bottomColor: 'white', headwear: 'none', headphones: false, sunglassesOnHead: false, freckles: true },
  { ...DEFAULT_AVATAR, hairstyle: 'bob', hairColor: 'honeyBrown', skin: 'honey', eyes: 'green', top: 'knit-sweater', topColor: 'burgundy', bottom: 'pleated-skirt', bottomColor: 'cream', shoes: 'sneakers', headwear: 'beret', headwearColor: 'burgundy', sunglassesOnHead: false, pearlChoker: true, miniBag: true },
  { ...DEFAULT_AVATAR, hairstyle: 'long-straight', hairColor: 'black', skin: 'porcelain', eyes: 'violet', top: 'knit-sweater', topColor: 'blush', bottom: 'pleated-skirt', bottomColor: 'navy', headwear: 'none', sunglassesOnHead: false, headphones: true, pearlChoker: true },
];
const cells = variants.map((v, i) => renderAvatarSvg(v, { ...IDLE_POSE, walking: i === 1, phase: 0.25 }, `a${i}`).replace(/<svg[^>]*>/, `<svg x="${i * 210 + 5}" y="5" width="200" height="320" viewBox="0 0 200 320">`));
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${variants.length * 210 + 10}" height="330"><rect width="100%" height="100%" fill="#FDFBF7"/>${cells.join('')}</svg>`;
const png = new Resvg(sheet, { fitTo: { mode: 'zoom', value: 1.6 }, font: { loadSystemFonts: true } }).render().asPng();
writeFileSync(process.argv[2] ?? '/tmp/avatars.png', png);
console.log('ok');
