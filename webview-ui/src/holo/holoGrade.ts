/**
 * Holo grading: maps a sprite's pixels onto a short colour ramp by luminance,
 * the way a limited-palette screen would show it. The room (floors, walls,
 * carpets, furniture) is graded; characters and pets are not.
 *
 * Render-time only: the layout and the assets are untouched. Each graded
 * sprite is cached against its source sprite object, so it stays the same
 * object frame to frame and spriteCache's per-zoom canvases keep hitting.
 */

import { HOLO_DAY_RAMP, HOLO_NIGHT_RAMP } from '../constants.js';
import { luminance } from '../office/colorize.js';
import type { SpriteData } from '../office/types.js';
import type { ResolvedAmbience } from './holoMode.js';

const caches: Record<ResolvedAmbience, WeakMap<SpriteData, SpriteData>> = {
  day: new WeakMap(),
  night: new WeakMap(),
};

const RAMPS: Record<ResolvedAmbience, readonly string[]> = {
  day: HOLO_DAY_RAMP,
  night: HOLO_NIGHT_RAMP,
};

function rampColor(ramp: readonly string[], lightness: number): string {
  const step = Math.min(ramp.length - 1, Math.floor(lightness * ramp.length));
  return ramp[step];
}

function gradeSprite(sprite: SpriteData, ramp: readonly string[]): SpriteData {
  return sprite.map((row) =>
    row.map((pixel) => {
      if (pixel === '') return '';
      const r = parseInt(pixel.slice(1, 3), 16);
      const g = parseInt(pixel.slice(3, 5), 16);
      const b = parseInt(pixel.slice(5, 7), 16);
      const alpha = pixel.length > 7 ? pixel.slice(7, 9) : '';
      return rampColor(ramp, luminance(r, g, b)) + alpha;
    }),
  );
}

/** The sprite as Holo Mode shows it under this ambience (cached per source sprite). */
export function holoSprite(sprite: SpriteData, ambience: ResolvedAmbience): SpriteData {
  const cache = caches[ambience];
  let graded = cache.get(sprite);
  if (!graded) {
    graded = gradeSprite(sprite, RAMPS[ambience]);
    cache.set(sprite, graded);
  }
  return graded;
}

/** A flat fill (a wall base, the fallback floor) on the ramp: its darkest step but one. */
export function holoFillColor(ambience: ResolvedAmbience): string {
  return RAMPS[ambience][1];
}
