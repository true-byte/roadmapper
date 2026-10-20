// What `npm run build` and `npm run package` write, and what they never touch, and the errors of `npm run build` and `npm run export:preview`. A build writes only into a folder that is missing, empty or holds a build,
// so it never deletes or writes over a file of someone's own; a broken roadmap file builds nothing, and its errors are printed as `npm run validate` prints them.
// The package is the one tgz in dist/.
/// <reference types="node" />
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const plan = (title: string): string => JSON.stringify({ title, branches: [{ name: 'Main', items: [{ id: 'a', name: 'A' }] }] }, null, 2);

/** Runs `npm run <event> -- <args>` as typed in the folder `from`, with the script that npm runs, and gives what it said and how it ended. */
function run(event: string, script: string[], args: string[], from: string): Promise<{ code: number; said: string }> {
  return new Promise(done => {
    const env = { ...process.env, npm_lifecycle_event: event, INIT_CWD: from };
    execFile(process.execPath, [...script, ...args], { cwd: ROOT, env }, (e, out, err) => done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, said: out + err }));
  });
}
const build = (args: string[], from: string): Promise<{ code: number; said: string }> => run('build', [join(ROOT, 'scripts/roadmapper.mjs'), 'build'], args, from);

/** A folder typed in, as `npm run build` is, holding a roadmap file. */
function folder(name: string): string {
  const dir = test.info().outputPath(name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'roadmap.json'), plan('Mine'));
  return dir;
}

test.describe('npm run build', () => {
  test('into a folder that holds a file of its own, it writes nothing and prints the error with those files', async () => {
    const dir = folder('typed-here');
    mkdirSync(join(dir, 'out'));
    writeFileSync(join(dir, 'out', 'notes.txt'), 'mine');
    expect(await build(['roadmap.json', 'out'], dir)).toEqual({ code: 1, said: 'out  Folder not empty  notes.txt\n' });
    expect(readdirSync(join(dir, 'out'))).toEqual(['notes.txt']);
    expect(readFileSync(join(dir, 'out', 'notes.txt'), 'utf8')).toBe('mine');
  });

  test('into the folder it is typed in, or the one above, it writes nothing: the roadmap file and all beside it stay', async () => {
    const dir = folder('typed-here');
    mkdirSync(join(dir, 'deeper', 'down'), { recursive: true });
    expect(await build(['roadmap.json', '.'], dir)).toEqual({ code: 1, said: '.  Folder not empty  deeper/, roadmap.json\n' });
    expect(readFileSync(join(dir, 'roadmap.json'), 'utf8')).toBe(plan('Mine'));
    const down = join(dir, 'deeper', 'down');
    expect(await build(['../../roadmap.json', '..'], down)).toEqual({ code: 1, said: '..  Folder not empty  down/\n' });
    expect(readdirSync(dir).sort()).toEqual(['deeper', 'roadmap.json']);
    expect(readdirSync(join(dir, 'deeper'))).toEqual(['down']);
    expect(readFileSync(join(dir, 'roadmap.json'), 'utf8')).toBe(plan('Mine'));
  });

  test('into a new folder it writes the page; into a folder that holds a build, it writes the new build over it; a path to a file is not a folder', async () => {
    const dir = folder('typed-here');
    writeFileSync(join(dir, 'roadmap.json'), plan('First plan xq'));
    const first = await build(['roadmap.json', 'out'], dir);
    expect(first.code, first.said).toBe(0);
    expect(readdirSync(join(dir, 'out'))).toEqual(['index.html']);
    expect(readFileSync(join(dir, 'out', 'index.html'), 'utf8')).toContain('First plan xq');
    writeFileSync(join(dir, 'roadmap.json'), plan('Second plan xq'));
    const again = await build(['roadmap.json', 'out'], dir);
    expect(again.code, again.said).toBe(0);
    expect(readdirSync(join(dir, 'out'))).toEqual(['index.html']);
    const page = readFileSync(join(dir, 'out', 'index.html'), 'utf8');
    expect(page).toContain('Second plan xq');
    expect(page).not.toContain('First plan xq');
    expect(await build(['roadmap.json', 'roadmap.json'], dir)).toEqual({ code: 1, said: 'roadmap.json  Not a folder  \n' });
  });

  test('a broken or missing roadmap file builds nothing, and its errors are printed as npm run validate prints them', async () => {
    const dir = folder('typed-here');
    writeFileSync(join(dir, 'broken.json'), '{ "title": "Broken", "branches": [], "about": 5 }');
    expect(await build(['broken.json', 'out'], dir)).toEqual({ code: 1, said: 'broken.json:1    about  Wrong type  5\nbroken.json:1    branches  Invalid value  []\n' });
    expect(await build(['nope.json', 'out'], dir)).toEqual({ code: 1, said: 'nope.json:      Unreadable file  \n' });
    expect(existsSync(join(dir, 'out'))).toBe(false);
  });
});

test('npm run export:preview with an option it does not take serves nothing and prints the error', async () => {
  expect(await run('export:preview', [join(ROOT, 'scripts/roadmapper.mjs'), 'export:preview'], ['--hots'], ROOT)).toEqual({ code: 1, said: 'export:preview  Unknown option  --hots\n' });
});

test('npm run package deletes each older package, so dist/ holds the one package of this version', async () => {
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
  writeFileSync(join(ROOT, 'dist', 'roadmapper-0.0.1-old.tgz'), 'an old package');
  const packed = await run('package', [join(ROOT, 'scripts/pack.mjs')], [], ROOT);
  expect(packed.code, packed.said).toBe(0);
  expect(readdirSync(join(ROOT, 'dist')).filter(f => f.endsWith('.tgz'))).toEqual([`roadmapper-${version}.tgz`]);
});
