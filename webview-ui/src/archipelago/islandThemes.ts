import { ARCHIPELAGO_ISLAND_THEMES_KEY } from '../constants.js';

/** An island's style: what its landmark and ground look like (islands.js THEMES). */
export type IslandThemeId = 'beach' | 'company' | 'lab' | 'device' | 'gym';

export const ISLAND_THEMES: ReadonlyArray<{ id: IslandThemeId; label: string; hint: string }> = [
  { id: 'beach', label: 'Playa', hint: 'The default: a cottage among palms' },
  { id: 'company', label: 'Empresa', hint: 'A glass office tower on a lawn, for company work' },
  {
    id: 'lab',
    label: 'Técnica',
    hint: 'A lab dome, server racks and a dish, for infra and tooling',
  },
  {
    id: 'device',
    label: 'App / Device',
    hint: 'A giant folding phone and a cell tower, for app and device tests',
  },
  { id: 'gym', label: 'Fitness', hint: 'An open-air gym, for fitness work' },
];

const IDS = new Set<string>(ISLAND_THEMES.map((t) => t.id));

/** A guess from the Directory's name, preselected when a new island asks for its style. */
export function suggestTheme(name: string): IslandThemeId {
  const n = name.toLowerCase();
  if (/(ios|iphone|android|mobile|movil|móvil|device|duo|\bapp\b)/.test(n)) return 'device';
  if (/(fit|gym|workout|corefit|train)/.test(n)) return 'gym';
  if (/(neuro|empresa|company|corp|office|erp|crm|admin|finance)/.test(n)) return 'company';
  if (/(api|server|infra|lab|tool|cli|sdk|devops|data)/.test(n)) return 'lab';
  return 'beach';
}

function read(): Record<string, IslandThemeId> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(ARCHIPELAGO_ISLAND_THEMES_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, IslandThemeId> = {};
    for (const [k, v] of Object.entries(raw))
      if (typeof v === 'string' && IDS.has(v)) out[k] = v as IslandThemeId;
    return out;
  } catch {
    return {};
  }
}

/**
 * Each island's chosen style, by Directory name, kept in this browser. An
 * island with none yet draws as a beach and asks for one.
 */
class IslandThemeStore {
  private chosen = read();
  private listeners = new Set<() => void>();

  get(name: string): IslandThemeId | undefined {
    return this.chosen[name];
  }

  set(name: string, theme: IslandThemeId): void {
    this.chosen = { ...this.chosen, [name]: theme };
    try {
      localStorage.setItem(ARCHIPELAGO_ISLAND_THEMES_KEY, JSON.stringify(this.chosen));
    } catch {
      // Private mode / blocked storage: the choice lasts this page only.
    }
    for (const l of this.listeners) l();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const islandThemes = new IslandThemeStore();
