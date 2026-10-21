import { describe, expect, it } from 'vitest';
import { PRESETS, timeOfDayFromHour } from './dayCycle';

describe('day cycle', () => {
  it('maps hours to phases including boundaries and wrap-around', () => {
    expect([4, 5, 11, 12, 16, 17, 20, 21, 0, 25].map(timeOfDayFromHour))
      .toEqual(['midnight', 'morning', 'morning', 'afternoon', 'afternoon', 'twilight', 'twilight', 'midnight', 'midnight', 'midnight']);
  });
  it('turns neon and the avatar spotlight up at night', () => {
    expect(PRESETS.midnight.neon).toBeGreaterThan(PRESETS.morning.neon);
    expect(PRESETS.morning.spot).toBe(0);
  });
});
