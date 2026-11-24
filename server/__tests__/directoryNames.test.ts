import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { normalizeProjectPath } from '../../core/src/normalizeProjectPath.js';
import {
  decodeProjectDir,
  directoryNameIn,
  isGuessedName,
  resolveDirectoryName,
  setDirectoryNameResolver,
} from '../src/directoryNames.js';

describe('directoryNames', () => {
  let root: string;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pa-dirnames-')));
    setDirectoryNameResolver(() => undefined);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const mk = (...parts: string[]) => {
    const p = path.join(root, ...parts);
    fs.mkdirSync(p, { recursive: true });
    return p;
  };

  it('decodes a project dir whose folder name has dashes (not just its last segment)', () => {
    const dir = mk('Projects', 'iphone-duo-maui-poc');
    expect(decodeProjectDir(normalizeProjectPath(dir))).toBe(dir);
    expect(resolveDirectoryName({ projectDir: `/x/${normalizeProjectPath(dir)}` })).toBe(
      'iphone-duo-maui-poc',
    );
  });

  it('decodes dots and nested dashes back to the real folders', () => {
    const dir = mk('Projects', 'Maui.Material-Controls', '.claude', 'wt-1');
    expect(decodeProjectDir(normalizeProjectPath(dir))).toBe(dir);
  });

  it('prefers the folder that exists when a dash could be either', () => {
    mk('a');
    const dir = mk('a-b', 'c');
    expect(decodeProjectDir(normalizeProjectPath(dir))).toBe(dir);
  });

  it('falls back to the last segment for a folder that is gone', () => {
    const hash = normalizeProjectPath(path.join(root, 'gone', 'my-app'));
    expect(decodeProjectDir(hash)).toBeNull();
    expect(resolveDirectoryName({ projectDir: `/x/${hash}` })).toBe('app');
  });

  it("uses the host's Directories first, by the user's names", () => {
    const dir = mk('Projects', 'iphone-duo-maui-poc');
    const dirs = [{ name: 'iPhone Duo', path: dir }];
    setDirectoryNameResolver((ctx) => directoryNameIn(dirs, ctx));
    expect(resolveDirectoryName({ projectDir: `/x/${normalizeProjectPath(dir)}` })).toBe(
      'iPhone Duo',
    );
    expect(resolveDirectoryName({ cwd: path.join(dir, 'src') })).toBe('iPhone Duo');
  });

  it('matches a session in a subfolder to its Directory, the most specific first', () => {
    const outer = mk('w');
    const inner = mk('w', 'pkg');
    const dirs = [
      { name: 'outer', path: outer },
      { name: 'inner', path: inner },
    ];
    expect(directoryNameIn(dirs, { projectDir: normalizeProjectPath(path.join(inner, 'x')) })).toBe(
      'inner',
    );
    expect(directoryNameIn(dirs, { cwd: path.join(outer, 'docs') })).toBe('outer');
  });

  it('knows a saved name that was the old guess', () => {
    const hash = '-Users-me-Projects-iphone-duo-maui-poc';
    expect(isGuessedName('poc', hash)).toBe(true);
    expect(isGuessedName('iPhone Duo', hash)).toBe(false);
    expect(isGuessedName(undefined, hash)).toBe(false);
  });
});
