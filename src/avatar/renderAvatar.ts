/**
 * Layered chibi/doll avatar as an SVG string (viewBox 0 0 200 320).
 * Proportions follow Avatar_Designs_Cyber_Mall.pdf: oversized head, tiny torso, short legs,
 * small posed hands, glossy gradient eyes with sparkle highlights, eyeliner wing, blush, freckles.
 *
 * Pure function: same (config, pose, idPrefix) → same string. `idPrefix` keeps gradient ids
 * unique when several avatars share one document.
 */

import {
  type AvatarConfig, type Pose, SKIN_TONES, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS,
} from './config';

export const AVATAR_VIEWBOX = { width: 200, height: 320 } as const;

const INK = '#3B2527';

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number): number => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function eye(cx: number, side: -1 | 1, id: string): string {
  const cy = 112;
  const wing = `M ${cx - 16 * side} ${cy - 8} C ${cx - 14 * side} ${cy - 22}, ${cx + 10 * side} ${cy - 24}, ${cx + 16 * side} ${cy - 10} L ${cx + 22 * side} ${cy - 15} C ${cx + 20 * side} ${cy - 6}, ${cx + 17 * side} ${cy - 3}, ${cx + 15 * side} ${cy}`;
  return `
  <g>
    <ellipse cx="${cx}" cy="${cy}" rx="15.5" ry="18.5" fill="#FFFFFF"/>
    <ellipse cx="${cx}" cy="${cy + 1}" rx="13" ry="16.5" fill="url(#${id}-iris)"/>
    <ellipse cx="${cx}" cy="${cy + 1}" rx="6.6" ry="8.8" fill="#1C1420"/>
    <ellipse cx="${cx}" cy="${cy + 9}" rx="9" ry="4.6" fill="#FFFFFF" opacity=".22"/>
    <circle cx="${cx - 4.5}" cy="${cy - 6}" r="4.4" fill="#FFFFFF"/>
    <circle cx="${cx + 5}" cy="${cy + 6}" r="2.1" fill="#FFFFFF"/>
    <path d="M0 -3.2 L.95 -1 L3.2 -.8 L1.5 .8 L2 3 L0 1.8 L-2 3 L-1.5 .8 L-3.2 -.8 L-.95 -1 Z" fill="#FFFFFF" opacity=".9" transform="translate(${cx + 6.5} ${cy + 2.5})"/>
    <path d="${wing}" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M ${cx - 12 * side} ${cy + 14} Q ${cx} ${cy + 20} ${cx + 12 * side} ${cy + 14}" fill="none" stroke="${INK}" stroke-width="1" opacity=".5" stroke-linecap="round"/>
  </g>`;
}

function backHair(style: AvatarConfig['hairstyle'], c: string): string {
  const d = shade(c, -0.18);
  switch (style) {
    case 'long-straight':
      return `<path d="M34 98 C28 40 70 20 100 20 C130 20 172 40 166 98 L170 248 Q100 268 30 248 Z" fill="${c}"/>
        <path d="M44 120 L46 240 M156 120 L154 240 M70 140 L72 250 M130 140 L128 250" stroke="${d}" stroke-width="2" opacity=".35" fill="none"/>`;
    case 'bob':
      return `<path d="M34 100 C30 42 70 22 100 22 C130 22 170 42 166 100 L164 156 Q100 176 36 156 Z" fill="${c}"/>`;
    case 'curly-waves': {
      const pts: Array<[number, number, number]> = [
        [40, 88, 19], [32, 116, 19], [36, 144, 19], [42, 172, 18], [52, 198, 16],
        [160, 88, 19], [168, 116, 19], [164, 144, 19], [158, 172, 18], [148, 198, 16],
        [58, 48, 21], [100, 36, 25], [142, 48, 21], [80, 40, 20], [120, 40, 20],
      ];
      return pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('') +
        `<circle cx="34" cy="130" r="14" fill="${d}" opacity=".25"/><circle cx="166" cy="160" r="13" fill="${d}" opacity=".25"/>`;
    }
  }
}

function frontHair(style: AvatarConfig['hairstyle'], c: string): string {
  const d = shade(c, -0.15);
  const hi = shade(c, 0.35);
  const sheen = `<path d="M62 52 Q82 40 104 44" stroke="${hi}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".55"/>`;
  switch (style) {
    case 'long-straight':
      return `<path d="M42 96 C44 54 72 36 100 36 C128 36 156 54 158 96 C146 78 124 68 104 68 C86 74 70 62 42 96 Z" fill="${c}"/>
        <path d="M40 100 C34 134 36 176 42 214 L58 214 C54 176 56 136 60 104 Z" fill="${c}"/>
        <path d="M160 100 C166 134 164 176 158 214 L142 214 C146 176 144 136 140 104 Z" fill="${c}"/>
        <path d="M104 68 C112 78 124 84 136 84" stroke="${d}" stroke-width="1.6" fill="none" opacity=".5"/>${sheen}`;
    case 'bob':
      return `<path d="M44 92 C46 54 74 36 100 36 C126 36 154 54 156 92 L156 84 C140 78 122 76 100 76 C78 76 60 78 44 84 Z" fill="${c}"/>
        <path d="M38 100 L38 150 Q46 158 60 150 L60 104 Z" fill="${c}"/><path d="M162 100 L162 150 Q154 158 140 150 L140 104 Z" fill="${c}"/>${sheen}`;
    case 'curly-waves':
      return `<path d="M42 96 C42 50 72 34 100 34 C128 34 158 50 158 96 C150 78 138 70 126 70 C118 82 108 74 100 70 C92 82 82 74 74 70 C62 70 50 78 42 96 Z" fill="${c}"/>${sheen}`;
  }
}

function headwearSvg(a: AvatarConfig): string {
  const col = OUTFIT_COLORS[a.headwearColor];
  if (a.headwear === 'headband') {
    return `<path d="M40 82 C46 40 154 40 160 82" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round"/>
      <path d="M44 80 C52 48 148 48 156 80" fill="none" stroke="${shade(col, 0.4)}" stroke-width="2.2" opacity=".7"/>`;
  }
  if (a.headwear === 'beret') {
    return `<ellipse cx="96" cy="48" rx="50" ry="19" fill="${col}" transform="rotate(-8 96 48)"/>
      <ellipse cx="92" cy="44" rx="36" ry="10" fill="${shade(col, 0.2)}" opacity=".5" transform="rotate(-8 96 48)"/>
      <circle cx="100" cy="28" r="4" fill="${shade(col, -0.25)}"/>`;
  }
  return '';
}

function sunglassesSvg(): string {
  return `<g transform="translate(0 -2)">
    <path d="M52 52 Q100 34 148 52" fill="none" stroke="#1C1420" stroke-width="2.4"/>
    <ellipse cx="74" cy="52" rx="19" ry="11" fill="#3B1F4D" stroke="#1C1420" stroke-width="2.4" transform="rotate(-8 74 52)"/>
    <ellipse cx="126" cy="52" rx="19" ry="11" fill="#3B1F4D" stroke="#1C1420" stroke-width="2.4" transform="rotate(8 126 52)"/>
    <path d="M90 52 Q100 47 110 52" fill="none" stroke="#1C1420" stroke-width="2.4"/>
    <path d="M62 49 L74 46 M114 46 L126 49" stroke="#FFFFFF" stroke-width="2" opacity=".55" stroke-linecap="round"/></g>`;
}

function headphonesSvg(): string {
  return `<path d="M34 108 C26 20 174 20 166 108" fill="none" stroke="#2B1E1A" stroke-width="7" stroke-linecap="round"/>
    <path d="M34 108 C26 24 174 24 166 108" fill="none" stroke="#C5A059" stroke-width="1.6" opacity=".8"/>
    <rect x="22" y="94" width="24" height="38" rx="11" fill="#2B1E1A"/><rect x="154" y="94" width="24" height="38" rx="11" fill="#2B1E1A"/>
    <rect x="27" y="101" width="14" height="24" rx="7" fill="#C5A059" opacity=".9"/><rect x="159" y="101" width="14" height="24" rx="7" fill="#C5A059" opacity=".9"/>`;
}

function topSvg(a: AvatarConfig, skin: string): string {
  const col = OUTFIT_COLORS[a.topColor];
  const d = shade(col, -0.18);
  switch (a.top) {
    case 'knit-sweater':
      return `<path d="M58 160 L142 160 L150 226 L50 226 Z" fill="${col}"/>
        ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${68 + i * 12} 164 L${66 + i * 13} 224" stroke="${d}" stroke-width="1.6" opacity=".45" fill="none"/>`).join('')}
        <path d="M50 222 Q100 234 150 222 L150 230 Q100 242 50 230 Z" fill="${d}"/>
        <path d="M86 158 Q100 172 114 158" fill="${skin}"/>`;
    case 'striped-polo': {
      const alt = shade(col, -0.35);
      const stripes = [0, 1, 2, 3, 4].map((i) => `<rect x="56" y="${170 + i * 11}" width="88" height="5.5" fill="${alt}" opacity=".85"/>`).join('');
      return `<path d="M60 160 L140 160 L146 218 L54 218 Z" fill="${col}"/>${stripes}
        <path d="M84 158 L100 176 L116 158 L124 164 L100 186 L76 164 Z" fill="#FFFFFF"/><circle cx="100" cy="184" r="1.8" fill="${d}"/>`;
    }
    case 'crop-top':
      return `<path d="M64 160 L136 160 L138 200 L62 200 Z" fill="${col}"/>
        <path d="M86 158 Q100 170 114 158" fill="${skin}"/>
        <path d="M66 198 Q100 206 134 198" fill="none" stroke="${d}" stroke-width="2" opacity=".5"/>
        <rect x="62" y="200" width="76" height="8" fill="${skin}"/>`;
  }
}

function bottomSvg(a: AvatarConfig, skin: string): string {
  const col = OUTFIT_COLORS[a.bottomColor];
  const d = shade(col, -0.2);
  switch (a.bottom) {
    case 'pleated-skirt':
      return `<path d="M62 206 L138 206 L152 252 L48 252 Z" fill="${col}"/>
        ${Array.from({ length: 9 }, (_, i) => `<path d="M${64 + i * 9.5} 206 L${54 + i * 11.5} 252" stroke="${d}" stroke-width="1.4" opacity=".5" fill="none"/>`).join('')}
        <rect x="62" y="204" width="76" height="6" fill="${d}"/>`;
    case 'lace-mini': {
      const scallops = Array.from({ length: 8 }, (_, i) => `<circle cx="${54 + i * 13.2}" cy="250" r="6.6" fill="${col}"/>`).join('');
      return `<path d="M62 206 L138 206 L150 250 L50 250 Z" fill="${col}"/>${scallops}
        <path d="M62 208 L138 208" stroke="#7A5230" stroke-width="5"/><g fill="#C5A059">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${70 + i * 12}" cy="208" r="1.5"/>`).join('')}</g>
        ${Array.from({ length: 6 }, (_, i) => `<circle cx="${70 + i * 12}" cy="${226 + (i % 2) * 8}" r="2.2" fill="${d}" opacity=".3"/>`).join('')}`;
    }
    case 'wide-trousers':
      return `<path d="M64 206 L136 206 L146 292 L106 292 L100 232 L94 292 L54 292 Z" fill="${col}"/>
        <path d="M100 232 L100 206" stroke="${d}" stroke-width="1.6" opacity=".5"/><rect x="64" y="204" width="72" height="6" fill="${d}"/>`;
  }
  void skin;
}

function shoesSvg(a: AvatarConfig, side: -1 | 1): string {
  const cx = 100 + side * 13;
  if (a.shoes === 'platforms') {
    return `<path d="M${cx - 11} 286 Q${cx - 11} 276 ${cx} 276 Q${cx + 11} 276 ${cx + 11} 286 L${cx + 14} 296 L${cx - 14} 296 Z" fill="#3A2A22"/>
      <rect x="${cx - 15}" y="296" width="30" height="9" rx="3" fill="#F4EBDD" stroke="#3A2A22" stroke-width="1.6"/>
      <rect x="${cx - 15}" y="300" width="30" height="2" fill="#C5A059" opacity=".8"/>`;
  }
  return `<path d="M${cx - 11} 288 Q${cx - 11} 278 ${cx} 278 Q${cx + 11} 278 ${cx + 12} 290 L${cx + 15} 298 L${cx - 14} 298 Z" fill="#FDFBF7" stroke="#3A2A22" stroke-width="1.6"/>
    <rect x="${cx - 15}" y="297" width="30" height="5" rx="2" fill="#3A2A22"/><path d="M${cx - 4} 282 l8 0" stroke="#B9A3E3" stroke-width="2"/>`;
}

function arm(side: -1 | 1, skin: string, topSleeve: string, swing: number): string {
  const sx = 100 + side * 40;
  return `<g transform="rotate(${swing} ${sx} 168)">
    <path d="M${sx} 166 Q${sx + side * 10} 190 ${sx + side * 6} 210" stroke="${topSleeve}" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M${sx + side * 7} 196 L${sx + side * 6} 208" stroke="${skin}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${sx + side * 6}" cy="213" r="5.6" fill="${skin}"/></g>`;
}

export function renderAvatarSvg(a: AvatarConfig, pose: Pose, idPrefix = 'av'): string {
  const skin = SKIN_TONES[a.skin];
  const skinD = shade(skin, -0.12);
  const hair = HAIR_COLORS[a.hairColor];
  const [eyeLight, eyeDark] = EYE_COLORS[a.eyes];
  const topCol = OUTFIT_COLORS[a.topColor];
  const p = pose.walking ? pose.phase : 0;
  const s = pose.walking ? Math.sin(p * Math.PI * 2) : 0;
  const bob = pose.walking ? -Math.abs(s) * 3.2 : 0;
  const sway = s * 1.6;
  const legL = s * 14;
  const legR = -s * 14;
  const flip = pose.facing === 'left' ? 'translate(200 0) scale(-1 1)' : '';
  const sleeve = a.top === 'crop-top' || a.top === 'striped-polo' ? skin : topCol;
  const id = idPrefix;

  const leg = (side: -1 | 1, swing: number): string => {
    const hipX = 100 + side * 13;
    return `<g transform="rotate(${swing} ${hipX} 246)">
      <rect x="${hipX - 6}" y="244" width="12" height="40" rx="6" fill="${skin}"/>
      <rect x="${hipX - 6}" y="244" width="5" height="40" rx="2.5" fill="${skinD}" opacity=".25"/>
      ${shoesSvg(a, side)}</g>`;
  };

  const bag = a.miniBag
    ? `<path d="M138 166 L66 214" stroke="#7A5230" stroke-width="3" fill="none"/>
       <rect x="52" y="208" width="26" height="20" rx="5" fill="#B9A3E3" stroke="#7A5230" stroke-width="1.6"/>
       <circle cx="65" cy="217" r="2.4" fill="#C5A059"/>`
    : '';
  const choker = a.pearlChoker
    ? Array.from({ length: 9 }, (_, i) => {
        const t = i / 8; const x = 80 + t * 40; const y = 157 + Math.sin(t * Math.PI) * 6;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.1" fill="#FDF8F0" stroke="#D9CBB4" stroke-width=".8"/>`;
      }).join('')
    : '';
  const freckles = a.freckles
    ? `<g fill="${shade(skin, -0.28)}" opacity=".6">${[[64, 121], [70, 125], [60, 127], [136, 121], [130, 125], [140, 127]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2"/>`).join('')}</g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AVATAR_VIEWBOX.width} ${AVATAR_VIEWBOX.height}" width="${AVATAR_VIEWBOX.width}" height="${AVATAR_VIEWBOX.height}" role="img" aria-label="Avatar">
<defs>
  <radialGradient id="${id}-iris" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="${eyeLight}"/><stop offset=".65" stop-color="${eyeDark}"/><stop offset="1" stop-color="${shade(eyeDark, -0.45)}"/></radialGradient>
  <radialGradient id="${id}-cheek" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#F58C9B" stop-opacity=".75"/><stop offset="1" stop-color="#F58C9B" stop-opacity="0"/></radialGradient>
  <linearGradient id="${id}-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, -0.06)}"/></linearGradient>
</defs>
<ellipse cx="100" cy="308" rx="${42 - Math.abs(s) * 4}" ry="6" fill="#2B1E1A" opacity=".22"/>
<g transform="${flip}">
 <g transform="translate(0 ${bob.toFixed(2)}) rotate(${sway.toFixed(2)} 100 300)">
  ${backHair(a.hairstyle, hair)}
  ${a.bottom === 'wide-trousers' ? '' : leg(-1, legL) + leg(1, legR)}
  ${a.bottom === 'wide-trousers' ? `<g stroke="#3B2527" stroke-opacity=".3" stroke-width="1.1" stroke-linejoin="round">${bottomSvg(a, skin)}</g>` + shoesSvg(a, -1) + shoesSvg(a, 1) : ''}
  ${arm(-1, skin, sleeve, -legL * 0.9)}
  <g stroke="#3B2527" stroke-opacity=".3" stroke-width="1.1" stroke-linejoin="round">${topSvg(a, skin)}</g>
  ${a.bottom === 'wide-trousers' ? '' : `<g stroke="#3B2527" stroke-opacity=".3" stroke-width="1.1" stroke-linejoin="round">${bottomSvg(a, skin)}</g>`}
  ${arm(1, skin, sleeve, -legR * 0.9)}
  ${bag}
  <rect x="90" y="146" width="20" height="16" rx="6" fill="${skinD}"/>
  ${choker}
  <circle cx="43" cy="108" r="8" fill="${skin}"/><circle cx="157" cy="108" r="8" fill="${skin}"/>
  <path d="M42 98 C42 60 68 40 100 40 C132 40 158 60 158 98 C158 128 134 152 100 152 C66 152 42 128 42 98 Z" fill="url(#${id}-skin)"/>
  <ellipse cx="62" cy="128" rx="14" ry="9" fill="url(#${id}-cheek)"/><ellipse cx="138" cy="128" rx="14" ry="9" fill="url(#${id}-cheek)"/>
  ${freckles}
  ${eye(76, -1, id)}${eye(124, 1, id)}
  <path d="M62 86 Q76 79 90 86" fill="none" stroke="${shade(hair, -0.2)}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M110 86 Q124 79 138 86" fill="none" stroke="${shade(hair, -0.2)}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M98 128 Q100 130 102 128" fill="none" stroke="${skinD}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M91 138 Q100 144 109 138" fill="none" stroke="#C4566B" stroke-width="2.2" stroke-linecap="round"/>
  ${frontHair(a.hairstyle, hair)}
  ${a.headphones ? headphonesSvg() : ''}
  ${headwearSvg(a)}
  ${a.sunglassesOnHead ? sunglassesSvg() : ''}
 </g>
</g>
</svg>`;
}
