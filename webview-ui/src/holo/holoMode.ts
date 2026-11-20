/**
 * Holo Mode: a futuristic skin over the whole office (Settings → Holo Mode).
 *
 * Per-browser, like the radio's player: kept in localStorage, never sent to the
 * server. The renderer reads `holoRenderState()` every frame (module state, like
 * the headless-ghosts setting) and React reads it through `useHoloMode`.
 *
 * Ambience is day, night, or auto (the local hour decides).
 */

import { HOLO_DAY_END_HOUR, HOLO_DAY_START_HOUR, HOLO_STORAGE_KEY } from '../constants.js';

export type HoloAmbience = 'day' | 'night' | 'auto';
export type ResolvedAmbience = 'day' | 'night';

export interface HoloState {
  enabled: boolean;
  ambience: HoloAmbience;
}

const AMBIENCES: readonly HoloAmbience[] = ['day', 'night', 'auto'];

function loadStored(): HoloState {
  const fallback: HoloState = { enabled: false, ambience: 'night' };
  try {
    const raw = JSON.parse(localStorage.getItem(HOLO_STORAGE_KEY) ?? '{}') as Partial<HoloState>;
    return {
      enabled: raw.enabled === true,
      ambience: AMBIENCES.includes(raw.ambience as HoloAmbience)
        ? (raw.ambience as HoloAmbience)
        : fallback.ambience,
    };
  } catch {
    return fallback;
  }
}

/** What an ambience setting means right now. */
export function resolveAmbience(ambience: HoloAmbience, now: Date): ResolvedAmbience {
  if (ambience !== 'auto') return ambience;
  const hour = now.getHours();
  return hour >= HOLO_DAY_START_HOUR && hour < HOLO_DAY_END_HOUR ? 'day' : 'night';
}

let state: HoloState = loadStored();
const listeners = new Set<() => void>();

function save(): void {
  try {
    localStorage.setItem(HOLO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private window or blocked storage: the setting lasts for this session only.
  }
}

function update(next: Partial<HoloState>): void {
  state = { ...state, ...next };
  save();
  for (const listener of listeners) listener();
}

export const holoMode = {
  getState: (): HoloState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setEnabled: (enabled: boolean): void => update({ enabled }),
  setAmbience: (ambience: HoloAmbience): void => update({ ambience }),
};

/** The renderer's per-frame view: null while Holo Mode is off. */
export function holoRenderState(): { ambience: ResolvedAmbience } | null {
  if (!state.enabled) return null;
  return { ambience: resolveAmbience(state.ambience, new Date()) };
}
