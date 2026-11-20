import * as os from 'os';
import * as path from 'path';

/**
 * Claude Code's config directory: `CLAUDE_CONFIG_DIR` when set (the same
 * variable Claude Code itself honours, e.g. to run a second account), otherwise
 * `~/.claude`. Every path into Claude's config — settings.json, projects/,
 * teams/ — goes through here, so a server started with CLAUDE_CONFIG_DIR
 * watches and hooks only that account.
 */
export function claudeConfigDir(): string {
  const fromEnv = process.env.CLAUDE_CONFIG_DIR?.trim();
  if (!fromEnv) return path.join(os.homedir(), '.claude');
  if (fromEnv === '~') return os.homedir();
  if (fromEnv.startsWith('~/')) return path.join(os.homedir(), fromEnv.slice(2));
  return path.resolve(fromEnv);
}
