// The package as another project gets it: `npm pack` makes the tgz, a new project in the system's temp folder installs it, and `npx roadmapper` runs src/cli/bin.ts there.
// npm test builds the lib and the commands first, and this packs what they built. The commands themselves are checked in this process: tests/cli/cli.test.ts.
/// <reference types="node" />
import { execFile, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ROOT, shell } from '../support/cli';

/** The other project, and Roadmapper as installed in it. */
let project = '';
let installed = '';

// one install for the whole file: its tests run in order, in one worker
test.describe.configure({ mode: 'default' });

test.beforeAll(() => {
  // a pack and an install on a busy computer
  test.setTimeout(60_000);
  project = mkdtempSync(join(tmpdir(), 'roadmapper-project-'));
  const [{ filename }] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', project], { cwd: ROOT, env: shell(), encoding: 'utf8', stdio: 'pipe' })) as { filename: string }[];
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'other-project', private: true }));
  execFileSync('npm', ['install', '--offline', '--no-audit', '--no-fund', join(project, filename)], { cwd: project, env: shell(), stdio: 'pipe' });
  installed = join(project, 'node_modules', 'roadmapper');
});

test.afterAll(() => {
  if (project) rmSync(project, { recursive: true, force: true });
});

/** Runs `npx roadmapper <words>` in a folder of the project, and gives how it ended and what it printed. */
function npx(words: string[], from: string): Promise<{ code: number; out: string; err: string }> {
  return new Promise(done => {
    execFile('npx', ['roadmapper', ...words], { cwd: from, env: shell() }, (e, out, err) => done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, out, err }));
  });
}

test('the package holds what a project needs, and installs nothing else', () => {
  const pkg = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as Record<string, unknown>;
  expect(pkg.bin).toEqual({ roadmapper: 'dist/cli/roadmapper.js' });
  expect(pkg.dependencies).toBeUndefined();
  for (const f of ['dist/cli/roadmapper.js', 'dist/cli/app.html', 'dist/lib/index.js', 'dist/lib/react.js', 'dist/lib/roadmapper.js', 'dist/lib/roadmapper-page.js',
    'README.md', 'data/sample.roadmap.json']) expect(existsSync(join(installed, f)), f).toBe(true);
  // never the skill, which a project installs with npx skills add, from GitHub, nor Roadmapper's own roadmap file
  expect(existsSync(join(installed, '.claude')), '.claude').toBe(false);
  expect(readdirSync(join(installed, 'data'))).toEqual(['sample.roadmap.json']);
  expect(readdirSync(join(project, 'node_modules')).filter(f => !f.startsWith('.'))).toEqual(['roadmapper']);
});

test('npx roadmapper builds and exports roadmap.json where it is typed', async () => {
  const dir = join(project, 'work');
  mkdirSync(dir);
  copyFileSync(join(ROOT, 'tests/fixtures/export.json'), join(dir, 'roadmap.json'));
  const [built, exported] = await Promise.all([npx(['build'], dir), npx(['export'], dir)]);

  // the app page of the package, with the roadmap in it
  expect(built.code, built.err).toBe(0);
  expect(built.out).toMatch(/^dist\/app\/index\.html {2}\d+ kB\n$/);
  expect(readdirSync(join(dir, 'dist/app'))).toEqual(['index.html']);
  expect(readFileSync(join(dir, 'dist/app/index.html'), 'utf8')).toContain('Ends \\u003c/script>\\u003c!-- here');

  // the lib of the package, and the icons of the set the commands hold
  expect(exported.code, exported.err).toBe(0);
  expect(exported.out.replace(/\d+ kB$/gm, 'n kB')).toBe('dist/export/roadmap.html  n kB\ndist/export/roadmap.json  n kB\ndist/export/roadmapper.js  n kB\n');
  expect(readFileSync(join(dir, 'dist/export/roadmapper.js'), 'utf8')).toBe(readFileSync(join(installed, 'dist/lib/roadmapper-page.js'), 'utf8'));
  const roadmap = JSON.parse(readFileSync(join(dir, 'dist/export/roadmap.json'), 'utf8'));
  expect(Object.keys(roadmap.icons.icons)).toEqual(expect.arrayContaining(['bulb', 'code', 'rocket']));
  expect(JSON.stringify(roadmap)).not.toContain('Secret price');
});
