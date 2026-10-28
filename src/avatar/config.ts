/** Avatar configuration: pure data, no rendering. Inspired by Avatar_Designs_Cyber_Mall.pdf. */

export const SKIN_TONES = {
  porcelain: '#F6DFCC',
  champagne: '#EBC9A6',
  honey: '#D9A878',
  caramel: '#BF8A5B',
  cocoa: '#8E5C3B',
  deep: '#6B402A',
} as const;
export type SkinToneId = keyof typeof SKIN_TONES;

export const HAIR_COLORS = {
  blonde: '#EBCB86',
  honeyBrown: '#9B6A44',
  espresso: '#2B1E1A',
  black: '#17151A',
  auburn: '#7A2E2A',
  lilac: '#B9A3E3',
} as const;
export type HairColorId = keyof typeof HAIR_COLORS;

export const EYE_COLORS = {
  sky: ['#8FD3FF', '#2C7DD2'],
  hazel: ['#E3C27A', '#8A5A2B'],
  green: ['#B6E3A0', '#3F8F4A'],
  violet: ['#D3B6FF', '#6A3FC4'],
  brown: ['#C98F63', '#5A2F1B'],
} as const satisfies Record<string, readonly [string, string]>;
export type EyeColorId = keyof typeof EYE_COLORS;

export const HAIRSTYLES = ['long-straight', 'curly-waves', 'bob'] as const;
export type Hairstyle = (typeof HAIRSTYLES)[number];

export const TOPS = ['knit-sweater', 'striped-polo', 'crop-top'] as const;
export type Top = (typeof TOPS)[number];
export const BOTTOMS = ['pleated-skirt', 'lace-mini', 'wide-trousers'] as const;
export type Bottom = (typeof BOTTOMS)[number];
export const SHOES = ['platforms', 'sneakers'] as const;
export type Shoes = (typeof SHOES)[number];
export const HEADWEAR = ['none', 'headband', 'beret'] as const;
export type Headwear = (typeof HEADWEAR)[number];

export const OUTFIT_COLORS = {
  cream: '#F4EBDD', burgundy: '#7A2433', lime: '#B7E04B', lilac: '#B9A3E3',
  navy: '#2F3E6B', blush: '#F2B8C6', white: '#FDFBF7', sage: '#A9C4A0',
} as const;
export type OutfitColorId = keyof typeof OUTFIT_COLORS;

export interface AvatarConfig {
  readonly skin: SkinToneId;
  readonly hairstyle: Hairstyle;
  readonly hairColor: HairColorId;
  readonly eyes: EyeColorId;
  readonly freckles: boolean;
  readonly top: Top;
  readonly topColor: OutfitColorId;
  readonly bottom: Bottom;
  readonly bottomColor: OutfitColorId;
  readonly shoes: Shoes;
  readonly headwear: Headwear;
  readonly headwearColor: OutfitColorId;
  readonly sunglassesOnHead: boolean;
  readonly headphones: boolean;
  readonly pearlChoker: boolean;
  readonly miniBag: boolean;
}

/** Default avatar from the project brief: long blonde hair, purple headband, shades on head, lime crop top, white lace skirt. */
export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 'champagne', hairstyle: 'long-straight', hairColor: 'blonde', eyes: 'sky', freckles: true,
  top: 'crop-top', topColor: 'lime', bottom: 'lace-mini', bottomColor: 'white', shoes: 'platforms',
  headwear: 'headband', headwearColor: 'lilac', sunglassesOnHead: true, headphones: false,
  pearlChoker: false, miniBag: false,
};

export type Facing = 'left' | 'right';
export interface Pose {
  /** Walk-cycle phase in [0,1). Ignored when `walking` is false. */
  readonly phase: number;
  readonly walking: boolean;
  readonly facing: Facing;
}
export const IDLE_POSE: Pose = { phase: 0, walking: false, facing: 'right' };
