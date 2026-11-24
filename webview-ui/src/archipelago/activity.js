// What an agent's thought cloud shows: an emoji for what it's doing, and the
// words for it. Read off the status text the provider formats
// (formatToolStatus: "Reading x.ts", "Running: npm test", …).

/** Commands, by what they are for, checked in order (the first match wins). */
const COMMANDS = [
  [/\b(test|vitest|jest|pytest|playwright|e2e)\b/, '🧪'],
  [/^git\b|\bgh\b/, '🌿'],
  [/\b(build|compile|tsc|esbuild|vite|make|xcodebuild|dotnet)\b/, '🔨'],
  [/\b(npm|yarn|pnpm|pip|brew)\s+(i|install|add)\b/, '📦'],
  [/\b(lint|eslint|prettier|format)\b/, '🧹'],
  [/^(curl|wget)\b/, '🌐'],
  [/^(ls|cat|grep|rg|find|head|tail|sed)\b/, '🔍'],
];

/** Status prefixes (formatToolStatus), checked in order. */
const TOOLS = [
  ['Reading', '📖'],
  ['Editing notebook', '📓'],
  ['Editing', '✏️'],
  ['Writing', '✍️'],
  ['Searching the web', '🌐'],
  ['Fetching', '🌐'],
  ['Searching', '🔍'],
  ['Subtask', '🤝'],
  ['Planning', '🗺️'],
  ['Waiting for your answer', '❓'],
  ['Thinking', '💭'],
  ['Using', '🧰'],
];

/**
 * The cloud for an agent: `{ emoji, text }`, text empty for an emoji-only
 * cloud (resting, done). Null shows no cloud.
 */
export function thoughtOf(agent) {
  const act = agent.activity ?? '';
  if (agent.state === 'need') return { emoji: '✋', text: act };
  if (agent.state === 'done') return { emoji: agent.unread ? '🎉' : '✅', text: '' };
  if (agent.state === 'idle') return { emoji: '💤', text: '' };
  if (act.startsWith('Running')) {
    const cmd = act.replace(/^Running:?\s*/, '');
    const hit = COMMANDS.find(([re]) => re.test(cmd));
    return { emoji: hit?.[1] ?? '⚙️', text: cmd || act };
  }
  const tool = TOOLS.find(([prefix]) => act.startsWith(prefix));
  return { emoji: tool?.[1] ?? '💭', text: act };
}
