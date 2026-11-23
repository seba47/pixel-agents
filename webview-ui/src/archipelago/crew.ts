import { castStore } from '../characters/castStore.js';
import { ARCHIPELAGO_AGENT_COLORS } from '../constants.js';
import type { SubagentCharacter } from '../hooks/useExtensionMessages.js';
import type { OfficeState } from '../office/engine/officeState.js';
import type { ToolActivity } from '../office/types.js';
import type { ArchipelagoAgent } from './scene.js';

export interface CrewSource {
  officeState: OfficeState;
  agents: number[];
  agentTools: Record<number, ToolActivity[]>;
  subagentCharacters: SubagentCharacter[];
  subagentTools: Record<number, Record<string, ToolActivity[]>>;
  /** Conversation titles of running agents, by agent id (from conversationsLoaded). */
  titles: ReadonlyMap<number, string>;
}

/** The office's agents as the archipelago draws them: one record per main agent. */
export function crewFrom({
  officeState,
  agents,
  agentTools,
  subagentCharacters,
  subagentTools,
  titles,
}: CrewSource): ArchipelagoAgent[] {
  const out: ArchipelagoAgent[] = [];
  const profiles = castStore.getState().profiles;
  for (const id of agents) {
    const ch = officeState.characters.get(id);
    if (!ch || ch.isSubagent) continue;
    const tools = agentTools[id] ?? [];
    const live = [...tools].reverse().find((t) => !t.done);
    const permission =
      ch.bubbleType === 'permission' || tools.some((t) => t.permissionWait && !t.done);
    const state: ArchipelagoAgent['state'] = permission
      ? 'need'
      : ch.bubbleType === 'waiting'
        ? 'done'
        : ch.isActive
          ? 'work'
          : 'idle';
    let activity: string;
    if (state === 'need') activity = live ? `Needs approval · ${live.status}` : 'Needs approval';
    else if (state === 'done')
      activity = ch.waitingAwaitingInput ? 'Waiting for input' : 'Done — your turn';
    else if (state === 'work')
      activity = live?.status ?? tools[tools.length - 1]?.status ?? 'Thinking…';
    else activity = 'Idle';
    out.push({
      id,
      name: agentName(profiles[ch.palette]?.name, ch.repeat, ch.agentName, titles.get(id), id),
      project: ch.directoryName ?? 'office',
      color: ARCHIPELAGO_AGENT_COLORS[ch.palette % ARCHIPELAGO_AGENT_COLORS.length],
      state,
      activity,
      sub: false,
      followed: officeState.cameraFollowId === id,
      context: ch.contextReported ? ch.contextTokens / ch.maxContextTokens : null,
      title: titles.get(id) ?? null,
      parentId: null,
      parentName: null,
    });
  }
  // Sub-agents: their own (smaller) characters on their parent's island,
  // named after the agent that runs ("network"), working its live tool.
  for (const sub of subagentCharacters) {
    const parent = out.find((a) => a.id === sub.parentAgentId);
    if (!parent) continue;
    const ch = officeState.characters.get(sub.id);
    const rows = subagentTools[sub.parentAgentId]?.[sub.parentToolId] ?? [];
    const live = [...rows].reverse().find((t) => !t.done);
    // Its label, else the launching call's own status ("Subtask: network · …"),
    // for a Sub-agent created before or without that call's label.
    const call = (agentTools[sub.parentAgentId] ?? []).find((t) => t.toolId === sub.parentToolId);
    const fromCall = call?.status.startsWith('Subtask:')
      ? call.status.slice('Subtask:'.length).trim()
      : '';
    const { who, what } = splitSubLabel(sub.label || fromCall);
    const permission = ch?.bubbleType === 'permission' || live?.permissionWait === true;
    out.push({
      id: sub.id,
      name: who ?? 'Sub-agent',
      project: parent.project,
      color: parent.color,
      state: permission ? 'need' : 'work',
      activity: permission ? `Needs approval · ${live?.status ?? what}` : (live?.status ?? what),
      sub: false,
      followed: officeState.cameraFollowId === sub.id,
      context: null,
      title: what,
      parentId: parent.id,
      parentName: parent.name,
    });
  }
  return out;
}

/** "network · Check DNS" → who: "network", what: "Check DNS" (the server names custom agents in front). */
function splitSubLabel(label: string): { who: string | null; what: string } {
  const at = label.indexOf(' \u00b7 ');
  if (at > 0) return { who: label.slice(0, at), what: label.slice(at + 3) };
  // No description: the label may be the agent's name alone (a hook's SubagentStart).
  return { who: null, what: label || 'Subtask' };
}

/**
 * What to call an agent: a Teammate's own name, else the character it wears
 * ("Suit", the second copy "Suit 2"), else its conversation's title.
 */
function agentName(
  character: string | undefined,
  repeat: number,
  teammate: string | undefined,
  title: string | undefined,
  id: number,
): string {
  // A Teammate wears its Lead's character, so its own team name tells them apart.
  if (teammate) return teammate;
  const who = character?.trim();
  if (who) return repeat > 0 ? `${who} ${repeat + 1}` : who;
  return title ?? `Agent ${id}`;
}
