import { describe, it, expect } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { DEFAULT_CONCOURSE as S, layoutFloor, worldToConcourse } from '../src/spatial/concourse';
import { floor7Landmarks, nearPhotobooth, landmarkPositions, PHOTOBOOTH_HALF_WIDTH, PHOTOBOOTH_TRIGGER_RADIUS } from '../src/spatial/landmarks';
import { PIXEL_FONT, GLYPH_W, GLYPH_H, ARCADE_SIGNS, pixelTextWidth, drawPixelText, drawArcadeWing, drawPhotoboothKiosk, BOOTH_PALETTE } from '../src/scene/floor7Art';

describe('Floor 7 landmark geometry', () => {
  it('the photobooth stands on the walkway, in the free end cap, between the last food stall and the arcade, for every floor size', () => {
    for (const n of [0, 1, 5, 24, 48, 120, 400, 1000]) {
      const l = layoutFloor(n);
      const { photobooth, arcade } = floor7Landmarks(S, l.radius);
      const c = worldToConcourse(S, l.radius, photobooth);
      expect(Math.abs(c.lateral)).toBeLessThanOrEqual(S.walkwayWidth / 2 + 1e-9);          // on the walkway
      expect(c.t).toBeGreaterThanOrEqual(1 - S.endMargin); expect(c.t).toBeLessThanOrEqual(1); // in the reserved end cap
      for (const p of l.placements) {
        expect(Math.hypot(p.x - photobooth.x, p.y - photobooth.y)).toBeGreaterThanOrEqual(p.frontage / 2 + PHOTOBOOTH_HALF_WIDTH - 1e-6); // no overlap with any storefront
      }
      expect(Math.hypot(arcade.x - photobooth.x, arcade.y - photobooth.y)).toBeGreaterThan(5); // the arcade is beyond it
    }
  });
  it('the arcade occupies the far end (same spot as the other floors\' centerpiece) and the booth is nearer the food court than the arcade is', () => {
    const l = layoutFloor(24); const { arcade, photobooth } = floor7Landmarks(S, l.radius);
    expect(arcade).toEqual(landmarkPositions(S, l.radius).centerpiece);
    const last = l.placements[l.placements.length - 1]!;
    expect(Math.hypot(photobooth.x - last.x, photobooth.y - last.y)).toBeLessThan(Math.hypot(arcade.x - last.x, arcade.y - last.y));
  });
  it('"Enter Photobooth" triggers within the radius and not outside it', () => {
    const { photobooth } = floor7Landmarks(S, 40);
    expect(nearPhotobooth({ x: photobooth.x, y: photobooth.y }, photobooth)).toBe(true);
    expect(nearPhotobooth({ x: photobooth.x + PHOTOBOOTH_TRIGGER_RADIUS - 0.01, y: photobooth.y }, photobooth)).toBe(true);
    expect(nearPhotobooth({ x: photobooth.x + PHOTOBOOTH_TRIGGER_RADIUS + 0.01, y: photobooth.y }, photobooth)).toBe(false);
    expect(nearPhotobooth({ x: 0, y: 0 }, photobooth)).toBe(false);
  });
});

describe('pixel font and arcade signs', () => {
  it('every glyph is a 5×7 bitmap of 0/1', () => {
    for (const [ch, rows] of Object.entries(PIXEL_FONT)) {
      expect(rows, ch).toHaveLength(GLYPH_H);
      for (const r of rows) expect(r).toMatch(new RegExp(`^[01]{${GLYPH_W}}$`));
    }
  });
  it('every sign string is drawable, and the required copy is exact', () => {
    expect(ARCADE_SIGNS.marquee).toBe('GAMING ARCADE');
    expect(`${ARCADE_SIGNS.soon} ${ARCADE_SIGNS.version}`).toBe('COMING SOON IN V3');
    for (const text of Object.values(ARCADE_SIGNS)) for (const ch of text) expect(PIXEL_FONT[ch], ch).toBeDefined();
  });
  it('measures text as (letters × 6 − 1) cells and rejects glyphs it does not have', () => {
    expect(pixelTextWidth('', 3)).toBe(0); expect(pixelTextWidth('A', 3)).toBe(15); expect(pixelTextWidth('AB', 2)).toBe(22);
    const ctx = createCanvas(40, 20).getContext('2d') as unknown as CanvasRenderingContext2D;
    expect(() => drawPixelText(ctx, 'Q', 0, 0, 2, '#fff')).toThrow(RangeError);
  });
  it('draws without error and actually paints pixels; the kiosk uses the specified palette', () => {
    expect(BOOTH_PALETTE).toEqual({ burgundy: '#710912', gold: '#C28D39', champagne: '#EFE5D2' });
    const c = createCanvas(600, 420); const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    drawArcadeWing(ctx, 200, 400, 14, 1.3); drawPhotoboothKiosk(ctx, 470, 400, 14, 1.3, true);
    const d = c.getContext('2d').getImageData(0, 0, 600, 420).data;
    let painted = 0; for (let i = 3; i < d.length; i += 4) if ((d[i] as number) > 0) painted += 1;
    expect(painted).toBeGreaterThan(40000);
    // the booth body is burgundy: sample the kiosk body pixel left of the curtain door
    const px = c.getContext('2d').getImageData(470 - 2.4 * 14 + 4, 400 - 40, 1, 1).data;
    expect([px[0], px[1], px[2]]).not.toEqual([0, 0, 0]);
    expect((px[0] as number)).toBeGreaterThan((px[2] as number) + 20); // warm red family, not blue/grey
  });
});
