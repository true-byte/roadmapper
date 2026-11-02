// The package as another project gets it: `npm pack` makes the tgz, a new project in the system's temp folder installs it, and `npx roadmapper` runs src/cli/bin.ts there.
// npm test builds the lib and the commands first, and this packs what they built. The commands themselves are checked in this process: tests/cli/cli.test.ts.
/// <reference types="node" />
import { execFile, execFileSync, spawn } from 'node:child_process';
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

/** The page that `roadmapper <words>` serves when typed in a folder, from the link that npx runs. It stops the server after it reads the page. */
async function served(words: string[], from: string): Promise<string> {
  const server = spawn(join(project, 'node_modules/.bin/roadmapper'), words, { cwd: from, env: shell(), stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const address = await new Promise<string>((done, failed) => {
      let out = '', err = '';
      server.stdout.on('data', d => {
        out += d;
        const said = /Local: +(\S+)\n/.exec(out);
        if (said) done(said[1]);
      });
      server.stderr.on('data', d => (err += d));
      server.on('close', code => failed(new Error(`it ended with code ${code}: ${err}`)));
    });
    return await (await fetch(address)).text();
  } finally {
    server.kill();
  }
}

test('the package holds what a project needs, and installs nothing else', () => {
  const pkg = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as Record<string, unknown>;
  // npm refuses to publish a package that is private
  expect(pkg.private).toBeUndefined();
  expect(pkg.bin).toEqual({ roadmapper: 'dist/cli/roadmapper.js' });
  expect(pkg.dependencies).toBeUndefined();
  for (const f of ['dist/cli/roadmapper.js', 'dist/cli/app.html', 'dist/lib/index.js', 'dist/lib/react.js', 'dist/lib/roadmapper.js', 'dist/lib/roadmapper-page.js',
    'README.md', 'roadmap/sample.roadmap.json']) expect(existsSync(join(installed, f)), f).toBe(true);
  // never the skill, which a project installs with npx skills add, from GitHub, nor Roadmapper's own roadmap file
  expect(existsSync(join(installed, '.claude')), '.claude').toBe(false);
  expect(readdirSync(join(installed, 'roadmap'))).toEqual(['sample.roadmap.json']);
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

test('npx roadmapper with no command serves roadmap.json, else roadmap/roadmap.json, or the file named', async () => {
  const plan = (title: string): string => JSON.stringify({ title, branches: [{ name: 'Main', items: [{ id: 'a', name: 'A' }] }] });
  const dir = join(project, 'start');
  mkdirSync(join(dir, 'roadmap'), { recursive: true });
  mkdirSync(join(dir, 'plans'));
  writeFileSync(join(dir, 'roadmap/roadmap.json'), plan('Nested plan xq'));
  writeFileSync(join(dir, 'plans/other.json'), plan('Other plan xq'));
  expect(await served([], dir)).toContain('Nested plan xq');
  writeFileSync(join(dir, 'roadmap.json'), plan('Top plan xq'));
  expect(await served([], dir)).toContain('Top plan xq');
  expect(await served(['plans/other.json'], dir)).toContain('Other plan xq');
});

test('the build of the commands runs as a program', () => {
  const said = execFileSync(join(ROOT, 'dist/cli/roadmapper.js'), ['--help'], { env: shell(), encoding: 'utf8' });
  expect(said).toContain('npx roadmapper [file] [--host]\n');
});
