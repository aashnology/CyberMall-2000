import { useMemo } from 'react';
import {
  type AvatarConfig, IDLE_POSE, SKIN_TONES, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS, HAIRSTYLES, TOPS, BOTTOMS, SHOES, HEADWEAR,
} from '../avatar/config';
import { renderAvatarSvg } from '../avatar/renderAvatar';
import { useMallStore } from '../state/mallStore';

const label = (s: string): string => s.replace(/([A-Z])/g, ' $1').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

function Select<T extends string>({ name, value, options, onChange }: { readonly name: string; readonly value: T; readonly options: readonly T[]; readonly onChange: (v: T) => void }): React.JSX.Element {
  return (
    <label className="field">{name}
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>{options.map((o) => <option key={o} value={o}>{label(o)}</option>)}</select>
    </label>
  );
}
function Swatches<T extends string>({ name, value, map, onChange }: { readonly name: string; readonly value: T; readonly map: Readonly<Record<T, string>>; readonly onChange: (v: T) => void }): React.JSX.Element {
  return (
    <div className="field"><span>{name}</span>
      <div className="swatches" role="radiogroup" aria-label={name}>
        {(Object.keys(map) as T[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={k === value} aria-label={label(k)} title={label(k)} className={k === value ? 'on' : ''} style={{ background: map[k] }} onClick={() => onChange(k)} />
        ))}
      </div>
    </div>
  );
}
function Toggle({ name, value, onChange }: { readonly name: string; readonly value: boolean; readonly onChange: (v: boolean) => void }): React.JSX.Element {
  return <label className="check"><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />{name}</label>;
}

export function AvatarEditor(): React.JSX.Element {
  const { avatar: a, patchAvatar, resetAvatar, closePanel } = useMallStore();
  const p = (patch: Partial<AvatarConfig>) => (): void => patchAvatar(patch);
  void p;
  const svg = useMemo(() => renderAvatarSvg(a, IDLE_POSE, 'ed'), [a]);
  const eyeSwatches = Object.fromEntries(Object.entries(EYE_COLORS).map(([k, v]) => [k, v[1]])) as Record<keyof typeof EYE_COLORS, string>;
  return (
    <aside className="drawer avatar-editor" aria-label="Avatar editor">
      <div className="drawer-head"><h2>Your avatar</h2><button type="button" onClick={closePanel} aria-label="Close">✕</button></div>
      <div className="avatar-preview" dangerouslySetInnerHTML={{ __html: svg }} />
      <Swatches name="Skin" value={a.skin} map={SKIN_TONES} onChange={(skin) => patchAvatar({ skin })} />
      <Select name="Hairstyle" value={a.hairstyle} options={HAIRSTYLES} onChange={(hairstyle) => patchAvatar({ hairstyle })} />
      <Swatches name="Hair colour" value={a.hairColor} map={HAIR_COLORS} onChange={(hairColor) => patchAvatar({ hairColor })} />
      <Swatches name="Eyes" value={a.eyes} map={eyeSwatches} onChange={(eyes) => patchAvatar({ eyes })} />
      <Toggle name="Freckles" value={a.freckles} onChange={(freckles) => patchAvatar({ freckles })} />
      <Select name="Top" value={a.top} options={TOPS} onChange={(top) => patchAvatar({ top })} />
      <Swatches name="Top colour" value={a.topColor} map={OUTFIT_COLORS} onChange={(topColor) => patchAvatar({ topColor })} />
      <Select name="Bottom" value={a.bottom} options={BOTTOMS} onChange={(bottom) => patchAvatar({ bottom })} />
      <Swatches name="Bottom colour" value={a.bottomColor} map={OUTFIT_COLORS} onChange={(bottomColor) => patchAvatar({ bottomColor })} />
      <Select name="Shoes" value={a.shoes} options={SHOES} onChange={(shoes) => patchAvatar({ shoes })} />
      <Select name="Headwear" value={a.headwear} options={HEADWEAR} onChange={(headwear) => patchAvatar({ headwear })} />
      {a.headwear !== 'none' && <Swatches name="Headwear colour" value={a.headwearColor} map={OUTFIT_COLORS} onChange={(headwearColor) => patchAvatar({ headwearColor })} />}
      <div className="toggles">
        <Toggle name="Sunglasses on head" value={a.sunglassesOnHead} onChange={(sunglassesOnHead) => patchAvatar({ sunglassesOnHead })} />
        <Toggle name="Chunky headphones" value={a.headphones} onChange={(headphones) => patchAvatar({ headphones })} />
        <Toggle name="Pearl choker" value={a.pearlChoker} onChange={(pearlChoker) => patchAvatar({ pearlChoker })} />
        <Toggle name="Mini shoulder bag" value={a.miniBag} onChange={(miniBag) => patchAvatar({ miniBag })} />
      </div>
      <button type="button" className="link" onClick={resetAvatar}>Reset to default</button>
    </aside>
  );
}
