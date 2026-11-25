import { ARCHIPELAGO_AGENT_NAME_MAX, ARCHIPELAGO_AGENT_NAMES_KEY } from '../constants.js';

function read(): Record<string, string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(ARCHIPELAGO_AGENT_NAMES_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw))
      if (typeof v === 'string' && v.trim() && !k.startsWith('agent:')) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** A typed name as kept: trimmed, single-spaced, capped. Empty = back to the default. */
export function cleanAgentName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, ARCHIPELAGO_AGENT_NAME_MAX);
}

/**
 * The names the user gave agents, kept in this browser by the agent's session
 * id (an agent id is only this server run's: a restart hands it to another
 * agent). An agent whose session isn't known yet is named by its id, for this
 * page only, until it is (`adopt`), so a rename right after launch isn't lost.
 */
class AgentNameStore {
  private names = read();
  private listeners = new Set<() => void>();

  private static key(agentId: number, sessionId: string | undefined): string {
    return sessionId ?? `agent:${agentId}`;
  }

  get(agentId: number, sessionId: string | undefined): string | undefined {
    return this.names[AgentNameStore.key(agentId, sessionId)];
  }

  /** Name an agent; an empty name gives it back its default one. */
  set(agentId: number, sessionId: string | undefined, name: string): void {
    const key = AgentNameStore.key(agentId, sessionId);
    const clean = cleanAgentName(name);
    const next = { ...this.names };
    if (clean) next[key] = clean;
    else delete next[key];
    delete next[`agent:${agentId}`];
    this.commit(next);
  }

  /** Its session became known: a name given under its id moves to the session. */
  adopt(agentId: number, sessionId: string): void {
    const tmp = this.names[`agent:${agentId}`];
    if (tmp === undefined) return;
    const next = { ...this.names, [sessionId]: tmp };
    delete next[`agent:${agentId}`];
    this.commit(next);
  }

  private commit(next: Record<string, string>): void {
    this.names = next;
    try {
      // Only names by session: an agent id means another agent after a restart.
      const kept = Object.fromEntries(
        Object.entries(next).filter(([k]) => !k.startsWith('agent:')),
      );
      localStorage.setItem(ARCHIPELAGO_AGENT_NAMES_KEY, JSON.stringify(kept));
    } catch {
      // Private mode / blocked storage: the names last this page only.
    }
    for (const l of this.listeners) l();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const agentNames = new AgentNameStore();
