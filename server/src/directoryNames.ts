/**
 * Which Directory an agent belongs to, by name, for agents this server did
 * not launch (adopted transcripts, hooks from other terminals, restored ones).
 *
 * A launch names its agent after the Directory it ran in. Everything else only
 * knows a `cwd` (hooks) and/or the CLI's hashed project dir (transcripts:
 * `-Users-me-Projects-iphone-duo-maui-poc`), where a `-` may be a path
 * separator or part of a name. Resolution, first hit wins:
 *   1. the host's resolver (Directories: VS Code workspace folders, standalone
 *      the user's Directories), by cwd containment or project-dir hash;
 *   2. the cwd's basename;
 *   3. the project dir decoded back into a real path on disk;
 *   4. the hash's last segment (the old guess: "poc").
 */

import * as fs from 'fs';
import * as path from 'path';

import { normalizeProjectPath } from '../../core/src/normalizeProjectPath.js';

export type DirectoryNameResolver = (ctx: {
  cwd?: string;
  projectDir?: string;
}) => string | undefined;

let hostResolver: DirectoryNameResolver | null = null;

/** Register the host's cwd/projectDir → Directory name resolver. */
export function setDirectoryNameResolver(resolver: DirectoryNameResolver): void {
  hostResolver = resolver;
}

/** The Directory name for a session that wasn't launched here. */
export function resolveDirectoryName(ctx: {
  cwd?: string;
  projectDir?: string;
}): string | undefined {
  const fromHost = hostResolver?.(ctx);
  if (fromHost) return fromHost;
  if (ctx.cwd) return path.basename(ctx.cwd) || ctx.cwd;
  if (!ctx.projectDir) return undefined;
  const real = decodeProjectDir(path.basename(ctx.projectDir));
  if (real) return path.basename(real) || real;
  return lastSegmentGuess(path.basename(ctx.projectDir));
}

/**
 * A name that may be the old guess (the hash's last segment): restore
 * re-resolves these, so islands saved as "poc" come back as their folder.
 */
export function isGuessedName(name: string | undefined, projectDir: string | undefined): boolean {
  return !!name && !!projectDir && name === lastSegmentGuess(path.basename(projectDir));
}

/**
 * Among Directories, the one a session belongs to: the most specific one
 * containing its cwd, else the one whose hashed path is its project dir (or a
 * `<hash>-<subpath>` prefix of it, for sessions in a subfolder).
 */
export function directoryNameIn(
  directories: ReadonlyArray<{ name: string; path: string }>,
  ctx: { cwd?: string; projectDir?: string },
): string | undefined {
  if (ctx.cwd) {
    const cwd = ctx.cwd;
    const owning = directories
      .filter((d) => cwd === d.path || cwd.startsWith(d.path + path.sep))
      .sort((a, b) => b.path.length - a.path.length)[0];
    if (owning) return owning.name;
  }
  if (ctx.projectDir) {
    const target = path.basename(ctx.projectDir);
    let best: { name: string; len: number } | null = null;
    for (const d of directories)
      for (const p of pathsOf(d.path)) {
        const hash = normalizeProjectPath(p);
        if ((target === hash || target.startsWith(`${hash}-`)) && (!best || hash.length > best.len))
          best = { name: d.name, len: hash.length };
      }
    if (best) return best.name;
  }
  return undefined;
}

/** A path and, when it differs, its symlink-resolved form (the CLI files sessions under the latter). */
function pathsOf(p: string): string[] {
  try {
    const real = fs.realpathSync(p);
    return real === p ? [p] : [p, real];
  } catch {
    return [p];
  }
}

/** The old guess: the hash's last `-` segment. */
function lastSegmentGuess(hash: string): string {
  const parts = hash.replace(/^-+/, '').split('-');
  return parts[parts.length - 1] || hash;
}

const DECODE_MAX_STEPS = 400;

/**
 * The real directory a project-dir hash came from, found by walking the disk:
 * each `-` is either a path separator or a character of a name (a `-`, `.`,
 * space, … all hash to `-`). Longest matching entry first. Null when the
 * folder no longer exists or the walk gets too long.
 */
export function decodeProjectDir(hash: string): string | null {
  if (!hash.startsWith('-')) return null;
  const tokens = hash.slice(1).split('-');
  let steps = 0;
  const walk = (dir: string, i: number): string | null => {
    if (i === tokens.length) return dir;
    if (++steps > DECODE_MAX_STEPS) return null;
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return null;
    }
    // Entry names, by their hashed form.
    const byHash = new Map<string, string[]>();
    for (const e of entries) {
      const h = normalizeProjectPath(e);
      const list = byHash.get(h);
      if (list) list.push(e);
      else byHash.set(h, [e]);
    }
    for (let j = tokens.length; j > i; j--) {
      const want = tokens.slice(i, j).join('-');
      for (const e of byHash.get(want) ?? []) {
        const next = path.join(dir, e);
        try {
          if (!fs.statSync(next).isDirectory()) continue;
        } catch {
          continue;
        }
        const found = walk(next, j);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(path.parse(process.cwd()).root, 0);
}
