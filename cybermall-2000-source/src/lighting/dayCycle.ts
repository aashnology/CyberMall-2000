export type TimeOfDay = 'morning' | 'afternoon' | 'twilight' | 'midnight';
export interface LightPreset { label: string; sky: string; skylight: string; ambient: number; sun: number; neon: number; spot: number }

export const PRESETS: Record<TimeOfDay, LightPreset> = {
  morning: { label: 'Morning Glow', sky: '#fdf3e3', skylight: '#fff1d6', ambient: 0.9, sun: 1.2, neon: 0.2, spot: 0 },
  afternoon: { label: 'Golden Afternoon', sky: '#f6e2b8', skylight: '#ffd58a', ambient: 0.8, sun: 1.4, neon: 0.3, spot: 0 },
  twilight: { label: 'Electric Neon Twilight', sky: '#3b1d4f', skylight: '#ff5fa8', ambient: 0.45, sun: 0.5, neon: 1, spot: 20 },
  midnight: { label: 'Cyberpunk Midnight', sky: '#0a0a1c', skylight: '#2a7bff', ambient: 0.25, sun: 0.2, neon: 1.6, spot: 35 },
};

export function timeOfDayFromHour(hour: number): TimeOfDay {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'twilight';
  return 'midnight';
}
