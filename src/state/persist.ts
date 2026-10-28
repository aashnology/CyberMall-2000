/** Validated localStorage persistence. Never trusts what it reads; never throws. */
import {
  DEFAULT_AVATAR, type AvatarConfig, SKIN_TONES, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS,
  HAIRSTYLES, TOPS, BOTTOMS, SHOES, HEADWEAR,
} from '../avatar/config';
import { parsePincode } from '../engine/pincode';
import type { Pincode } from '../data/types';

const KEY = 'cybermall2000.v2';

export interface Persisted { readonly pincode: Pincode | null; readonly onlyDeliverable: boolean; readonly avatar: AvatarConfig; readonly lookbook: readonly string[] }

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
export const MAX_LOOKBOOK = 500;
export function sanitizeLookbook(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === 'string' && ID_RE.test(x)))].slice(0, MAX_LOOKBOOK);
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

export function sanitizeAvatar(raw: unknown): AvatarConfig {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AVATAR;
  return {
    skin: pick(o['skin'], Object.keys(SKIN_TONES) as (keyof typeof SKIN_TONES)[], d.skin),
    hairstyle: pick(o['hairstyle'], HAIRSTYLES, d.hairstyle),
    hairColor: pick(o['hairColor'], Object.keys(HAIR_COLORS) as (keyof typeof HAIR_COLORS)[], d.hairColor),
    eyes: pick(o['eyes'], Object.keys(EYE_COLORS) as (keyof typeof EYE_COLORS)[], d.eyes),
    freckles: bool(o['freckles'], d.freckles),
    top: pick(o['top'], TOPS, d.top),
    topColor: pick(o['topColor'], Object.keys(OUTFIT_COLORS) as (keyof typeof OUTFIT_COLORS)[], d.topColor),
    bottom: pick(o['bottom'], BOTTOMS, d.bottom),
    bottomColor: pick(o['bottomColor'], Object.keys(OUTFIT_COLORS) as (keyof typeof OUTFIT_COLORS)[], d.bottomColor),
    shoes: pick(o['shoes'], SHOES, d.shoes),
    headwear: pick(o['headwear'], HEADWEAR, d.headwear),
    headwearColor: pick(o['headwearColor'], Object.keys(OUTFIT_COLORS) as (keyof typeof OUTFIT_COLORS)[], d.headwearColor),
    sunglassesOnHead: bool(o['sunglassesOnHead'], d.sunglassesOnHead),
    headphones: bool(o['headphones'], d.headphones),
    pearlChoker: bool(o['pearlChoker'], d.pearlChoker),
    miniBag: bool(o['miniBag'], d.miniBag),
  };
}

export function parsePersisted(json: string | null): Persisted {
  const empty: Persisted = { pincode: null, onlyDeliverable: false, avatar: DEFAULT_AVATAR, lookbook: [] };
  if (json === null) return empty;
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const pin = typeof o['pincode'] === 'string' ? parsePincode(o['pincode']) : null;
    return {
      pincode: pin !== null && pin.ok ? pin.pincode : null,
      onlyDeliverable: bool(o['onlyDeliverable'], false),
      avatar: sanitizeAvatar(o['avatar']),
      lookbook: sanitizeLookbook(o['lookbook']),
    };
  } catch {
    return empty;
  }
}

export function loadPersisted(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Persisted {
  try { return parsePersisted(storage?.getItem(KEY) ?? null); } catch { return parsePersisted(null); }
}

export function savePersisted(p: Persisted, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try { storage?.setItem(KEY, JSON.stringify(p)); return storage !== null; } catch { return false; }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
