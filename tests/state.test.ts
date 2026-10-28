import { describe, it, expect } from 'vitest';
import { parsePersisted, sanitizeAvatar, savePersisted } from '../src/state/persist';
import { DEFAULT_AVATAR } from '../src/avatar/config';
import { renderAvatarSvg } from '../src/avatar/renderAvatar';
import { IDLE_POSE } from '../src/avatar/config';
import { buildFloor6 } from '../src/data/floor6';
import { MOODS, matchMood } from '../src/data/moods';
import { SAMPLE_CATALOG } from '../src/data/catalog.sample';
import { buildDirectory, parsePincode } from '../src/engine/pincode';
import type { Pincode } from '../src/data/types';

const pin = (s: string): Pincode => { const r = parsePincode(s); if (!r.ok) throw new Error(s); return r.pincode; };

describe('persistence', () => {
  it('never throws on garbage and falls back to safe defaults', () => {
    for (const bad of [null, '', 'not json', '[]', '{"pincode":123}', '{"avatar":{"skin":"purple"}}']) {
      const p = parsePersisted(bad);
      expect(p.pincode).toBeNull();
      expect(p.avatar.skin).toBe(DEFAULT_AVATAR.skin);
    }
  });
  it('restores a valid pincode and rejects an invalid one', () => {
    expect(parsePersisted('{"pincode":"400058"}').pincode).toBe('400058');
    expect(parsePincode('012345').ok).toBe(false);
    expect(parsePersisted('{"pincode":"012345"}').pincode).toBeNull();
  });
  it('sanitizes avatar fields individually and ignores unknown keys', () => {
    const a = sanitizeAvatar({ skin: 'deep', hairstyle: 'mullet', freckles: 'yes', hack: '<script>' });
    expect(a.skin).toBe('deep');
    expect(a.hairstyle).toBe(DEFAULT_AVATAR.hairstyle);
    expect(a.freckles).toBe(DEFAULT_AVATAR.freckles);
    expect('hack' in a).toBe(false);
  });
  it('survives unavailable or throwing storage', () => {
    expect(savePersisted({ pincode: null, onlyDeliverable: false, avatar: DEFAULT_AVATAR, lookbook: [] }, null)).toBe(false);
    const throwing = { setItem: (): void => { throw new Error('quota'); } };
    expect(savePersisted({ pincode: null, onlyDeliverable: false, avatar: DEFAULT_AVATAR, lookbook: [] }, throwing)).toBe(false);
  });
  it('round-trips', () => {
    let blob = '';
    savePersisted({ pincode: pin('560034'), onlyDeliverable: true, avatar: { ...DEFAULT_AVATAR, skin: 'cocoa' }, lookbook: ['f1-01', 'f8-02'] }, { setItem: (_k, v) => { blob = v; } });
    const back = parsePersisted(blob);
    expect(back.pincode).toBe('560034');
    expect(back.onlyDeliverable).toBe(true);
    expect(back.avatar.skin).toBe('cocoa');
    expect(back.lookbook).toEqual(['f1-01', 'f8-02']);
  });
  it('sanitizes the lookbook: drops non-ids, duplicates and formula-like strings', () => {
    expect(parsePersisted('{"lookbook":["f1-01","f1-01","=cmd",7,"ok.id","bad id"]}').lookbook).toEqual(['f1-01', 'ok.id']);
  });
});

describe('avatar renderer', () => {
  it('is deterministic, namespaced by idPrefix, and flips for facing left', () => {
    const a = renderAvatarSvg(DEFAULT_AVATAR, IDLE_POSE, 'x');
    expect(renderAvatarSvg(DEFAULT_AVATAR, IDLE_POSE, 'x')).toBe(a);
    expect(a).toContain('id="x-iris"');
    expect(a).not.toContain('id="y-iris"');
    expect(renderAvatarSvg(DEFAULT_AVATAR, { ...IDLE_POSE, facing: 'left' }, 'x')).toContain('scale(-1 1)');
    expect(a).not.toContain('scale(-1 1)');
  });
  it('walking changes the pose over the cycle; idle ignores phase', () => {
    const w = (phase: number): string => renderAvatarSvg(DEFAULT_AVATAR, { phase, walking: true, facing: 'right' }, 'x');
    expect(w(0.25)).not.toBe(w(0.75));
    expect(renderAvatarSvg(DEFAULT_AVATAR, { phase: 0.3, walking: false, facing: 'right' }, 'x')).toBe(renderAvatarSvg(DEFAULT_AVATAR, IDLE_POSE, 'x'));
  });
  it('renders every option without NaN or undefined leaking into the SVG', async () => {
    const { HAIRSTYLES, TOPS, BOTTOMS, SHOES, HEADWEAR } = await import('../src/avatar/config');
    for (const hairstyle of HAIRSTYLES) for (const top of TOPS) for (const bottom of BOTTOMS) for (const shoes of SHOES) for (const headwear of HEADWEAR) {
      const svg = renderAvatarSvg({ ...DEFAULT_AVATAR, hairstyle, top, bottom, shoes, headwear, headphones: true, pearlChoker: true, miniBag: true }, { phase: 0.4, walking: true, facing: 'left' }, 'p');
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(svg.startsWith('<svg')).toBe(true);
    }
  });
});

describe('floor 6 model', () => {
  it('lists nearest theatres plus every OTT platform, never with a delivery ribbon', () => {
    const m = buildFloor6(pin('400058'), null, 4);
    expect(m.entries.filter((e) => e.store.subcategory === 'theatre')).toHaveLength(4);
    expect(m.entries.filter((e) => e.store.subcategory === 'ott').length).toBeGreaterThan(0);
    for (const e of m.entries) { expect(e.status).toBe('unknown'); expect(e.ribbon).toBeNull(); }
  });
  it('the theatre list follows the pincode', () => {
    const city = (p: string): string | undefined => buildFloor6(pin(p), null, 1).nearest.ranked[0]?.theatre.city;
    expect(city('400058')).toBe('Mumbai');
    expect(city('110001')).toBe('Delhi');
  });
});

describe('mood matching', () => {
  const dir = buildDirectory(SAMPLE_CATALOG, { pincode: pin('400058'), onlyDeliverable: false });
  const all = [1, 2, 3, 4, 5, 7, 8, 9].flatMap((f) => dir.byFloor[f as 1]);
  it('is explainable and ranks deliverable stores above non-deliverable ones of equal fit', () => {
    for (const mood of MOODS) {
      const r = matchMood(mood, all);
      for (let i = 1; i < r.length; i += 1) expect(r[i - 1]!.score).toBeGreaterThanOrEqual(r[i]!.score);
      for (const m of r) { expect(m.why).toContain('delivery'); expect(m.score).toBeGreaterThan(0); expect(m.score).toBeLessThanOrEqual(1); }
    }
    const cozy = matchMood(MOODS.find((m) => m.id === 'cozy-sunday')!, all);
    const firstBlocked = cozy.findIndex((m) => m.entry.status === 'not-deliverable');
    const bestBlocked = cozy[firstBlocked];
    if (bestBlocked) expect(bestBlocked.score).toBeLessThan(cozy[0]!.score);
  });
  it('the four brief moods exist', () => {
    expect(MOODS.map((m) => m.label)).toEqual(expect.arrayContaining(['1990s Jazz-Club Elegance', 'Corporate Chic']));
  });
});
