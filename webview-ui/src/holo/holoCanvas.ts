/**
 * Holo Mode's own canvas passes, drawn by the office renderer:
 *
 * - `renderHoloGrid` — a neon grid on the floor tiles (after the floor, before
 *   furniture and characters).
 * - `renderHoloLighting` — at night, the room under a dark wash, lit by pools
 *   of light around each agent in its state's colour (after the scene).
 *
 * Both paint only where the office already has pixels (`source-atop`), so the
 * void around the map stays the page's own background.
 */

import {
  HOLO_GRID_COLOR_DAY,
  HOLO_GRID_COLOR_NIGHT,
  HOLO_LIGHT_ACTIVE,
  HOLO_LIGHT_ALPHA,
  HOLO_LIGHT_IDLE,
  HOLO_LIGHT_PERMISSION,
  HOLO_LIGHT_RADIUS_PX,
  HOLO_LIGHT_STEPS,
  HOLO_LIGHT_WAITING,
  HOLO_NIGHT_WASH,
} from '../constants.js';
import type { Character, TileType as TileTypeVal } from '../office/types.js';
import { TILE_SIZE, TileType } from '../office/types.js';
import type { ResolvedAmbience } from './holoMode.js';

/** Idle agents glow fainter than working ones. */
const IDLE_LIGHT_SHARE = 0.45;

export function renderHoloGrid(
  ctx: CanvasRenderingContext2D,
  tileMap: TileTypeVal[][],
  offsetX: number,
  offsetY: number,
  zoom: number,
  ambience: ResolvedAmbience,
): void {
  const s = TILE_SIZE * zoom;
  ctx.save();
  ctx.fillStyle = ambience === 'night' ? HOLO_GRID_COLOR_NIGHT : HOLO_GRID_COLOR_DAY;
  for (let r = 0; r < tileMap.length; r++) {
    const row = tileMap[r];
    for (let c = 0; c < row.length; c++) {
      const tile = row[c];
      if (tile === TileType.VOID || tile === TileType.WALL) continue;
      const x = offsetX + c * s;
      const y = offsetY + r * s;
      // The tile's top and left edges: neighbours draw the rest.
      ctx.fillRect(x, y, s, zoom);
      ctx.fillRect(x, y + zoom, zoom, s - zoom);
    }
  }
  ctx.restore();
}

/** A character's light colour and strength, or null when it gives none. */
function lightOf(ch: Character): { color: string; strength: number } | null {
  if (ch.isGreeter || ch.matrixEffect === 'despawn') return null;
  if (ch.bubbleType === 'permission') return { color: HOLO_LIGHT_PERMISSION, strength: 1 };
  if (ch.bubbleType === 'waiting') return { color: HOLO_LIGHT_WAITING, strength: 1 };
  if (ch.isActive) return { color: HOLO_LIGHT_ACTIVE, strength: 1 };
  return { color: HOLO_LIGHT_IDLE, strength: IDLE_LIGHT_SHARE };
}

export function renderHoloLighting(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
  mapW: number,
  mapH: number,
  ambience: ResolvedAmbience,
): void {
  if (ambience !== 'night') return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = HOLO_NIGHT_WASH;
  ctx.fillRect(offsetX, offsetY, mapW * zoom, mapH * zoom);

  // Light pools as concentric squares-ish rings of whole sprite pixels:
  // quantized to HOLO_LIGHT_STEPS so the falloff reads as dithered pixel art.
  for (const ch of characters) {
    const light = lightOf(ch);
    if (!light) continue;
    ctx.fillStyle = light.color;
    const cx = Math.round(ch.x);
    const cy = Math.round(ch.y);
    const R = HOLO_LIGHT_RADIUS_PX;
    for (let step = 1; step <= HOLO_LIGHT_STEPS; step++) {
      const outer = (R * (HOLO_LIGHT_STEPS - step + 1)) / HOLO_LIGHT_STEPS;
      ctx.globalAlpha = ((HOLO_LIGHT_ALPHA * light.strength) / HOLO_LIGHT_STEPS) * 0.9;
      // A pixel-art disc: one run per sprite row.
      for (let dy = -Math.floor(outer); dy <= Math.floor(outer); dy++) {
        const half = Math.floor(Math.sqrt(outer * outer - dy * dy));
        ctx.fillRect(
          offsetX + (cx - half) * zoom,
          offsetY + (cy + dy) * zoom,
          (half * 2 + 1) * zoom,
          zoom,
        );
      }
    }
  }
  ctx.restore();
}
