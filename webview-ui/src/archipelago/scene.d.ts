/** One agent as the archipelago draws it (derived from the office state every frame). */
export interface ArchipelagoAgent {
  id: number;
  name: string;
  /** The Directory it runs in: its island. */
  project: string;
  color: string;
  state: 'work' | 'need' | 'done' | 'idle';
  activity: string;
  /** Runs a sub-agent right now (a boat leaves its island). */
  sub: boolean;
  /** The office's camera follows it. */
  followed: boolean;
  /** Share of its context window used (0–1), or null until reported. */
  context: number | null;
  /** Its conversation's title in Claude (a /rename, else Claude's own), once known. */
  title: string | null;
  /** A Sub-agent: the agent that launched it (its terminal is that one's). */
  parentId: number | null;
  parentName: string | null;
  /** Finished while nobody looked: marked until read. */
  unread?: boolean;
}

export class ArchipelagoScene {
  constructor(
    container: HTMLElement,
    opts: {
      getCrew: () => ArchipelagoAgent[];
      onSelect: (id: number) => void;
      /** The islands' names, in the order goIsland numbers them; on every rebuild. */
      onIslands?: (names: string[]) => void;
      /** Each island's style id (islandThemes.ts); read every frame, a change rebuilds. */
      themeOf?: (project: string) => string;
    },
  );
  /** Fly to the i-th island. */
  goIsland(i: number): void;
  /** Everything in view again. */
  showAll(): void;
  /** Move the camera toward (f < 1) or away from (f > 1) what it looks at. */
  zoomBy(f: number): void;
  dispose(): void;
}
