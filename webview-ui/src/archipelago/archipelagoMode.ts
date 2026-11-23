import './theme.css';

import { useSyncExternalStore } from 'react';

import { ARCHIPELAGO_STORAGE_KEY } from '../constants.js';

/** The archipelago view: an experiment, per browser (localStorage), off by default. */
let enabled = (() => {
  try {
    return localStorage.getItem(ARCHIPELAGO_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export const archipelagoMode = {
  get: (): boolean => enabled,
  set(on: boolean): void {
    enabled = on;
    try {
      localStorage.setItem(ARCHIPELAGO_STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      // Blocked storage: the choice lasts for this session only.
    }
    for (const l of listeners) l();
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useArchipelagoMode(): boolean {
  return useSyncExternalStore(archipelagoMode.subscribe, archipelagoMode.get);
}

/**
 * Whether the archipelago is on screen now (the view on and not editing the
 * layout): its UI theme follows this, set by App. The pixel UI components
 * (PixelIcon, PixelText) read it to draw their archipelago forms.
 */
let uiOn = false;
const uiListeners = new Set<() => void>();
export const archipelagoUi = {
  get: (): boolean => uiOn,
  set(on: boolean): void {
    if (on === uiOn) return;
    uiOn = on;
    if (on) document.documentElement.dataset.ui = 'archipelago';
    else delete document.documentElement.dataset.ui;
    for (const l of uiListeners) l();
  },
  subscribe(l: () => void): () => void {
    uiListeners.add(l);
    return () => uiListeners.delete(l);
  },
};

export function useArchipelagoUi(): boolean {
  return useSyncExternalStore(archipelagoUi.subscribe, archipelagoUi.get);
}
