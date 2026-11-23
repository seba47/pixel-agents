/**
 * Vite dev only: a simulated crew so the office has agents to look at without
 * a server or Claude running. browserMock starts it after the layout loads.
 *
 * Four agents loop through scripted turns: a Lead with a Teammate, one that
 * stops for approval, one that runs a Sub-agent. Everything travels as the
 * same ServerMessages the server would send, injected as window messages.
 */

interface Step {
  at: number;
  msg: Record<string, unknown>;
}

/** One loop of the script, in ms; it then starts over. */
const LOOP_MS = 24_000;

function dispatch(msg: Record<string, unknown>): void {
  window.dispatchEvent(new MessageEvent('message', { data: msg }));
}

function tool(id: number, toolId: string, status: string, at: number, length: number): Step[] {
  return [
    { at, msg: { type: 'agentToolStart', id, toolId, status } },
    { at: at + length, msg: { type: 'agentToolDone', id, toolId } },
  ];
}

function turn(id: number, at: number, tools: Array<[string, number]>, loop: number): Step[] {
  const steps: Step[] = [{ at, msg: { type: 'agentStatus', id, status: 'active' } }];
  let t = at + 300;
  tools.forEach(([status, length], i) => {
    steps.push(...tool(id, `t${id}-${loop}-${i}`, status, t, length));
    t += length + 400;
  });
  steps.push({ at: t, msg: { type: 'agentToolsClear', id } });
  steps.push({ at: t + 50, msg: { type: 'agentStatus', id, status: 'waiting' } });
  return steps;
}

function script(loop: number): Step[] {
  return [
    // 1: the Lead, editing.
    ...turn(
      1,
      500,
      [
        ['Reading App.tsx', 2500],
        ['Editing renderer.ts', 4000],
        ['Running npm test', 5000],
      ],
      loop,
    ),
    // 2: its Teammate, searching.
    ...turn(
      2,
      1500,
      [
        ['Searching for holoMode', 3000],
        ['Reading index.css', 3000],
        ['Editing HoloTag.tsx', 4500],
      ],
      loop,
    ),
    // 3: stops for approval mid-turn.
    { at: 2000, msg: { type: 'agentStatus', id: 3, status: 'active' } },
    {
      at: 2300,
      msg: { type: 'agentToolStart', id: 3, toolId: `p${loop}`, status: 'Running git push' },
    },
    { at: 4000, msg: { type: 'agentToolPermission', id: 3 } },
    { at: 14_000, msg: { type: 'agentToolPermissionClear', id: 3 } },
    { at: 14_200, msg: { type: 'agentToolDone', id: 3, toolId: `p${loop}` } },
    { at: 14_500, msg: { type: 'agentToolsClear', id: 3 } },
    { at: 14_600, msg: { type: 'agentStatus', id: 3, status: 'waiting', awaitingInput: true } },
    // 4: runs a Sub-agent.
    { at: 3000, msg: { type: 'agentStatus', id: 4, status: 'active' } },
    {
      at: 3200,
      msg: {
        type: 'agentToolStart',
        id: 4,
        toolId: `task${loop}`,
        status: 'Subtask: network · Check the DNS records',
        toolName: 'Task',
      },
    },
    ...[0, 1, 2].flatMap((i) => [
      {
        at: 4500 + i * 3000,
        msg: {
          type: 'subagentToolStart',
          id: 4,
          parentToolId: `task${loop}`,
          toolId: `sub${loop}-${i}`,
          status: ['Running dig horus.dev', 'Reading resolv.conf', 'Running ping 1.1.1.1'][i],
        },
      },
      {
        at: 6800 + i * 3000,
        msg: {
          type: 'subagentToolDone',
          id: 4,
          parentToolId: `task${loop}`,
          toolId: `sub${loop}-${i}`,
        },
      },
    ]),
    { at: 14_000, msg: { type: 'agentToolDone', id: 4, toolId: `task${loop}` } },
    { at: 14_100, msg: { type: 'subagentClear', id: 4, parentToolId: `task${loop}` } },
    { at: 14_300, msg: { type: 'agentToolsClear', id: 4 } },
    { at: 14_400, msg: { type: 'agentStatus', id: 4, status: 'waiting' } },
  ];
}

/** Dev only: the standalone chrome (terminals, Directories, recent conversations). */
function mockStandaloneChrome(): void {
  const dirs = [
    { name: 'pixel-agents', path: '/Users/dev/Projects/pixel-agents', source: 'user' },
    { name: 'horus-api', path: '/Users/dev/Projects/horus-api', source: 'user' },
    { name: 'horus-web', path: '/Users/dev/Projects/horus-web', source: 'user' },
  ];
  dispatch({ type: 'terminalAvailability', available: true });
  dispatch({ type: 'directoriesLoaded', directories: dirs });
  const now = Date.now();
  const min = 60_000;
  const conversations = () => ({
    type: 'conversationsLoaded',
    directories: [
      {
        name: 'pixel-agents',
        path: dirs[0].path,
        conversations: [
          {
            sessionId: 's1',
            title: 'Archipelago view for the office',
            updatedAt: now - 2 * min,
            palette: 0,
            agentId: 1,
          },
          {
            sessionId: 's2',
            title: 'Style the crew dock',
            updatedAt: now - 5 * min,
            palette: 0,
            agentId: 2,
          },
          {
            sessionId: 's3',
            title: 'Fix the hook installer test',
            updatedAt: now - 3 * 60 * min,
            palette: 3,
          },
        ],
        more: true,
      },
      {
        name: 'horus-api',
        path: dirs[1].path,
        conversations: [
          {
            sessionId: 's4',
            title: 'Release the routes refactor',
            updatedAt: now - 1 * min,
            palette: 2,
            agentId: 3,
          },
          {
            sessionId: 's5',
            title: 'Migrate the billing tables',
            updatedAt: now - 26 * 60 * min,
            palette: 2,
          },
        ],
      },
      {
        name: 'horus-web',
        path: dirs[2].path,
        conversations: [
          {
            sessionId: 's6',
            title: 'Network checks for the CDN',
            updatedAt: now - 8 * min,
            palette: 4,
            agentId: 4,
          },
        ],
      },
    ],
  });
  dispatch(conversations());
  window.setInterval(() => dispatch(conversations()), 5000);
}

export function startMockCrew(): void {
  mockStandaloneChrome();
  const crew: Array<{ id: number; directoryName: string; palette: number }> = [
    { id: 1, directoryName: 'pixel-agents', palette: 0 },
    { id: 2, directoryName: 'pixel-agents', palette: 0 },
    { id: 3, directoryName: 'horus-api', palette: 2 },
    { id: 4, directoryName: 'horus-web', palette: 4 },
  ];
  for (const c of crew) dispatch({ type: 'agentCreated', ...c });
  // Agent 1 has a terminal in this office (the rest run elsewhere, as in Orca).
  dispatch({ type: 'terminalSessionOpened', agentId: 1 });
  dispatch({ type: 'agentTeamInfo', id: 1, teamName: 'holo', isTeamLead: true });
  dispatch({
    type: 'agentTeamInfo',
    id: 2,
    teamName: 'holo',
    agentName: 'stylist',
    leadAgentId: 1,
  });
  const context: Array<[number, number]> = [
    [1, 420_000],
    [2, 120_000],
    [3, 760_000],
    [4, 300_000],
  ];
  for (const [id, tokens] of context) {
    dispatch({ type: 'agentContextUsage', id, contextTokens: tokens, maxContextTokens: 1_000_000 });
  }

  let loop = 0;
  const run = () => {
    for (const step of script(loop)) window.setTimeout(() => dispatch(step.msg), step.at);
    loop++;
  };
  run();
  window.setInterval(run, LOOP_MS);
}
