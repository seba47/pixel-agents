import { useEffect, useState, useSyncExternalStore } from 'react';

import type { HoloState, ResolvedAmbience } from './holoMode.js';
import { holoMode, resolveAmbience } from './holoMode.js';

/** How often an auto ambience re-checks the clock. */
const AMBIENCE_RECHECK_MS = 60_000;

/** Holo Mode's state, plus the ambience it resolves to now (auto follows the clock). */
export function useHoloMode(): HoloState & { resolved: ResolvedAmbience } {
  const state = useSyncExternalStore(holoMode.subscribe, holoMode.getState);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (state.ambience !== 'auto') return;
    const timer = window.setInterval(() => setNow(new Date()), AMBIENCE_RECHECK_MS);
    return () => window.clearInterval(timer);
  }, [state.ambience]);
  return { ...state, resolved: resolveAmbience(state.ambience, now) };
}

/** Mirrors Holo Mode onto <html data-theme data-ambience>, where index.css swaps the palette. */
export function useHoloThemeAttribute(): void {
  const { enabled, resolved } = useHoloMode();
  useEffect(() => {
    const root = document.documentElement;
    if (enabled) {
      root.dataset.theme = 'holo';
      root.dataset.ambience = resolved;
    } else {
      delete root.dataset.theme;
      delete root.dataset.ambience;
    }
  }, [enabled, resolved]);
}
