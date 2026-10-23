// The package, as another project gets it: `npm pack` makes the tgz, a new project in the system's temp folder installs it, and runs `npx roadmapper` there.
// npm test builds the lib and the commands first, and this packs what they built. No test starts `dev` or `preview`, as each would serve on this computer:
// the last two tests check, with no server, what each would answer, through Playwright's routes.
/// <reference types="node" />
import { execFile, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { runnerImport } from 'vite';
import { errorList, errorRows, expect, settle, side, step, test } from './helpers';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** A roadmap with private items, and a step whose name holds `</script><!--`. */
const PLAN = join(ROOT, 'tests/export/plan.json');
/** The names and ids of its private items, which only an export with --private holds. */
const PRIVATE = ['Pricing track', 'Secret price', 'secret-price', 'Payroll', 'payroll', 'Hidden prep', 'hidden-prep'];
const plan = (title: string): string => JSON.stringify({ title, branches: [{ name: 'Main', items: [{ id: 'a', name: 'Alpha step' }] }] }, null, 2);
const BROKEN = '{ "title": "Broken", "branches": [], "about": 5 }';
const BROKEN_SAID = ['broken.json:1    about  Wrong type  5', 'broken.json:1    branches  Invalid value  []'];

/** The env of a shell: npm's own variables of `npm test` would point npm at this folder. */
const shell = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('npm_') && k !== 'INIT_CWD'));
/** The other project, and Roadmapper as installed in it. */
let project = '';
let installed = '';

// one install for the whole file: its tests run in order, in one worker
test.describe.configure({ mode: 'default' });

test.beforeAll(() => {
  test.setTimeout(120_000);
  project = mkdtempSync(join(tmpdir(), 'roadmapper-project-'));
  const [{ filename }] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', project], { cwd: ROOT, env: shell, encoding: 'utf8' })) as { filename: string }[];
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'other-project', private: true }));
  execFileSync('npm', ['install', '--offline', '--no-audit', '--no-fund', join(project, filename)], { cwd: project, env: shell });
  installed = join(project, 'node_modules', 'roadmapper');
});

test.afterAll(() => {
  if (project) rmSync(project, { recursive: true, force: true });
});

/** Runs `npx roadmapper <words>` in a folder of the project, and gives how it ended and what it printed. */
function npx(words: string[], from: string): Promise<{ code: number; out: string; err: string }> {
  return new Promise(done => {
    execFile('npx', ['roadmapper', ...words], { cwd: from, env: shell }, (e, out, err) => done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, out, err }));
  });
}

/** A new folder in the project, which a test types its commands in: deeper than the project's own, as paths are from where they are typed. */
function folder(name: string): string {
  const dir = join(project, 'work', name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

test("the package holds the commands, the lib, the README and the sample roadmap file, never the skill or Roadmapper's own roadmap file, and installs nothing else", async () => {
  const pkg = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as Record<string, unknown>;
  expect(pkg.bin).toEqual({ roadmapper: 'dist/cli/roadmapper.js' });
  expect(pkg.dependencies).toBeUndefined();
  for (const f of ['dist/cli/roadmapper.js', 'dist/cli/app.html', 'dist/lib/index.js', 'dist/lib/react.js', 'dist/lib/roadmapper.js', 'dist/lib/roadmapper-page.js',
    'README.md', 'data/sample.roadmap.json']) expect(existsSync(join(installed, f)), f).toBe(true);
  // a project installs the skill with npx skills add, from GitHub
  expect(existsSync(join(installed, '.claude')), '.claude').toBe(false);
  expect(readdirSync(join(installed, 'data'))).toEqual(['sample.roadmap.json']);
  expect(readdirSync(join(project, 'node_modules')).filter(f => !f.startsWith('.'))).toEqual(['roadmapper']);
  const usage = await npx([], project);
  expect(usage).toEqual({ code: 0, err: '', out: expect.stringContaining('npx roadmapper validate [file]\n') });
  expect(await npx(['serve'], project)).toEqual({ code: 1, out: '', err: 'roadmapper  Unknown option  serve\n' });
});

test('npx roadmapper validate: roadmap.json in the folder it is typed in, unless a file is named; each error on a line of its own', async () => {
  const dir = folder('validate');
  writeFileSync(join(dir, 'roadmap.json'), plan('Mine'));
  writeFileSync(join(dir, 'broken.json'), BROKEN);
  expect(await npx(['validate'], dir)).toEqual({ code: 0, out: 'roadmap.json: no errors\n', err: '' });
  expect(await npx(['validate', 'broken.json'], dir)).toEqual({ code: 1, out: `${BROKEN_SAID.join('\n')}\n`, err: '' });
  expect(await npx(['validate', 'nope.json'], dir)).toEqual({ code: 1, out: 'nope.json:      Unreadable file  \n', err: '' });
  expect(await npx(['validate', '--strict'], dir)).toEqual({ code: 1, out: '', err: 'validate  Unknown option  --strict\n' });
  expect(await npx(['validate', 'roadmap.json', 'broken.json'], dir)).toEqual({ code: 1, out: '', err: 'validate  Unknown option  broken.json\n' });
});

test('npx roadmapper build writes one HTML file that draws the plan from disk; a broken file builds nothing and prints its errors', async ({ page }) => {
  const dir = folder('build');
  copyFileSync(PLAN, join(dir, 'roadmap.json'));
  const built = await npx(['build'], dir);
  expect(built.code, built.err).toBe(0);
  expect(built.out).toMatch(/^dist\/app\/index\.html {2}\d+ kB\n$/);
  expect(readdirSync(join(dir, 'dist', 'app'))).toEqual(['index.html']);
  await page.goto(`file://${join(dir, 'dist', 'app', 'index.html')}`);
  await expect(page.locator('.roadmap .title')).toHaveText('Launch &amp; </title> <Grow>');
  await settle(page);
  await expect(step(page, 'idea')).toBeVisible();
  await expect(errorList(page)).toBeHidden();
  // a name with </script><!-- in it
  await step(page, 'tricky').click();
  await settle(page);
  await expect(side(page).locator('h2')).toHaveText('Ends </script><!-- here');

  writeFileSync(join(dir, 'broken.json'), BROKEN);
  expect(await npx(['build', 'broken.json', 'out'], dir)).toEqual({ code: 1, out: '', err: `${BROKEN_SAID.join('\n')}\n` });
  expect(await npx(['build', 'nope.json', 'out'], dir)).toEqual({ code: 1, out: '', err: 'nope.json:      Unreadable file  \n' });
  expect(existsSync(join(dir, 'out'))).toBe(false);
});

test('npx roadmapper build and export write only into a folder that is missing, empty or holds what they wrote; a file is not a folder', async () => {
  // its commands run one after another, and each starts npx anew: on a busy computer, they take longer than the time a test gets
  test.setTimeout(90_000);
  const dir = folder('refusals');
  copyFileSync(PLAN, join(dir, 'roadmap.json'));
  mkdirSync(join(dir, 'mine'));
  writeFileSync(join(dir, 'mine', 'notes.txt'), 'mine');
  expect(await npx(['build', 'roadmap.json', 'mine'], dir)).toEqual({ code: 1, out: '', err: 'mine  Folder not empty  notes.txt\n' });
  expect(await npx(['export', 'roadmap.json', 'mine'], dir)).toEqual({ code: 1, out: '', err: 'mine  Folder not empty  notes.txt\n' });
  expect(await npx(['build', 'roadmap.json', '.'], dir)).toEqual({ code: 1, out: '', err: '.  Folder not empty  mine/, roadmap.json\n' });
  // a roadmap.json is a file of an export, so only the folder is named
  expect(await npx(['export', 'roadmap.json', '.'], dir)).toEqual({ code: 1, out: '', err: '.  Folder not empty  mine/\n' });
  expect(await npx(['build', 'roadmap.json', 'roadmap.json'], dir)).toEqual({ code: 1, out: '', err: 'roadmap.json  Not a folder  \n' });
  expect(await npx(['export', 'roadmap.json', 'roadmap.json/out'], dir)).toEqual({ code: 1, out: '', err: 'roadmap.json/out  Not a folder  \n' });
  expect(readdirSync(dir).sort()).toEqual(['mine', 'roadmap.json']);
  expect(readdirSync(join(dir, 'mine'))).toEqual(['notes.txt']);
  expect(readFileSync(join(dir, 'roadmap.json'), 'utf8')).toBe(readFileSync(PLAN, 'utf8'));

  // a build or an export goes over the one before it
  expect((await npx(['build', 'roadmap.json', 'site'], dir)).code).toBe(0);
  expect((await npx(['build', 'roadmap.json', 'site'], dir)).code).toBe(0);
  expect((await npx(['export', 'roadmap.json', 'shared'], dir)).code).toBe(0);
  expect((await npx(['export', 'roadmap.json', 'shared'], dir)).code).toBe(0);
  expect(await npx(['export', 'roadmap.json', 'site'], dir)).toEqual({ code: 1, out: '', err: 'site  Folder not empty  index.html\n' });
});

test('npx roadmapper export leaves the private items out, and --private keeps them, each in its own folder; the page draws from a site', async ({ page }) => {
  const dir = folder('export');
  copyFileSync(PLAN, join(dir, 'roadmap.json'));
  const shown = await npx(['export'], dir);
  expect(shown.code, shown.err).toBe(0);
  expect(shown.out.split('\n').map(l => l.replace(/\d+ kB$/, 'n kB'))).toEqual([
    'dist/export/roadmap.html  n kB', 'dist/export/roadmap.json  n kB', 'dist/export/roadmapper.js  n kB', '',
  ]);
  const out = join(dir, 'dist', 'export');
  const roadmap = readFileSync(join(out, 'roadmap.json'), 'utf8');
  for (const word of PRIVATE) expect(roadmap, word).not.toContain(word);
  expect(Object.keys(JSON.parse(roadmap).icons.icons)).toEqual(expect.arrayContaining(['bulb', 'code', 'rocket']));
  expect(readFileSync(join(out, 'roadmapper.js'), 'utf8')).toBe(readFileSync(join(installed, 'dist/lib/roadmapper-page.js'), 'utf8'));

  const kept = await npx(['export', '--private'], dir);
  expect(kept.code, kept.err).toBe(0);
  const whole = readFileSync(join(dir, 'dist', 'export-private', 'roadmap.json'), 'utf8');
  for (const word of PRIVATE) expect(whole, word).toContain(word);

  expect(await npx(['export', '--privat'], dir)).toEqual({ code: 1, out: '', err: 'export  Unknown option  --privat\n' });
  writeFileSync(join(dir, 'all.json'), JSON.stringify({ title: 'All mine', branches: [{ name: 'Mine', private: true, items: [{ id: 'a', name: 'A' }] }] }));
  expect(await npx(['export', 'all.json', 'mine'], dir)).toEqual({ code: 1, out: '', err: 'all.json  Nothing public  \n' });

  // the three files on a made-up site
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://site.test/**', r => {
    const name = new URL(r.request().url()).pathname.slice(1);
    const type = { html: 'text/html; charset=utf-8', json: 'application/json', js: 'text/javascript' }[name.split('.').pop() ?? ''];
    return readdirSync(out).includes(name) ? r.fulfill({ body: readFileSync(join(out, name)), contentType: type }) : r.fulfill({ status: 404 });
  });
  await page.goto('https://site.test/roadmap.html');
  await expect(page.locator('svg.plan')).toBeVisible();
  await settle(page);
  await expect(page.locator('.roadmap .title')).toHaveText('Launch &amp; </title> <Grow>');
});

/** What a request listener of src/cli/cli.ts answers at an address, with no server: its status, its type and what it wrote so far. */
function ask(listener: RequestListener, url: string): { status: number; type: string; body: () => string } {
  const req = { url, on: () => req } as unknown as IncomingMessage;
  const got = { status: 0, type: '', text: '' };
  const res = {
    writeHead: (status: number, headers: Record<string, string>) => Object.assign(got, { status, type: headers['content-type'] }),
    write: (b: string | Buffer) => (got.text += b.toString()),
    end: (b?: string | Buffer) => (got.text += b?.toString() ?? ''),
  } as unknown as ServerResponse;
  listener(req, res);
  return { status: got.status, type: got.type, body: () => got.text };
}

/** Serves what a listener answers at https://<host>/ to the page, with no server. */
async function routeTo(page: Page, host: string, listener: RequestListener, events?: () => string): Promise<void> {
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route(`https://${host}/**`, r => {
    const path = new URL(r.request().url()).pathname;
    // a short retry, so the page asks again soon
    if (events && path === '/events') return r.fulfill({ contentType: 'text/event-stream', body: `retry: 50\n\n${events()}` });
    const got = ask(listener, path);
    return r.fulfill({ status: got.status, contentType: got.type, body: got.body() });
  });
}

type Cli = typeof import('../src/cli/cli');
const source = async (): Promise<Cli> => (await runnerImport(join(ROOT, 'src/cli/cli.ts'), { root: ROOT, configFile: false, logLevel: 'error' })).module as Cli;

test('dev, with no server: the page draws the file, redraws in place on each save, and shows the error list for a broken one', async ({ page }) => {
  const cli = await source();
  let now = { text: plan('First plan'), file: 'roadmap.json' };
  const dev = cli.devServer(readFileSync(join(installed, 'dist/cli/app.html'), 'utf8'), () => now);
  // a page that listens, as the browser's does; each time the page asks again, it gets the saves since it last asked, as a stream that stays open sends them
  const stream = ask(dev.listener, '/events');
  expect(stream).toMatchObject({ status: 200, type: 'text/event-stream' });
  expect(ask(dev.listener, '/nope').status).toBe(404);
  let sent = 0;
  const fresh = (): string => {
    const all = stream.body();
    const part = all.slice(sent);
    sent = all.length;
    return part;
  };
  await routeTo(page, 'dev.test', dev.listener, fresh);
  await page.goto('https://dev.test/');
  await expect(page.locator('.roadmap .title')).toHaveText('First plan');
  await settle(page);

  now = { text: plan('Saved plan'), file: 'roadmap.json' };
  dev.send(now);
  await expect(page.locator('.roadmap .title')).toHaveText('Saved plan');
  dev.send({ text: BROKEN, file: 'roadmap.json' });
  await expect(errorList(page)).toBeVisible();
  await expect(errorList(page).locator('.file')).toHaveText('roadmap.json');
  expect(await errorRows(page)).toEqual(BROKEN_SAID.map(l => l.slice('broken.json:'.length)));
  dev.send(now);
  await expect(errorList(page)).toBeHidden();
  await expect(step(page, 'a')).toBeVisible();
});

test('preview, with no server: the three files of the export, the page also without .html, and nothing else', async ({ page }) => {
  const cli = await source();
  const dir = folder('preview');
  copyFileSync(PLAN, join(dir, 'roadmap.json'));
  expect((await npx(['export'], dir)).code).toBe(0);
  const out = join(dir, 'dist', 'export');
  const site = cli.previewServer(out);
  expect(ask(site, '/roadmap').body()).toBe(readFileSync(join(out, 'roadmap.html'), 'utf8'));
  for (const path of ['/', '/index.html', '/../roadmap.json', '/dist/export/roadmap.json']) expect(ask(site, path).status, path).toBe(404);
  await routeTo(page, 'preview.test', site);
  await page.goto('https://preview.test/roadmap.html');
  await expect(page.locator('svg.plan')).toBeVisible();
  await settle(page);
  await expect(step(page, 's1')).toBeVisible();
  // with no export to serve, it serves nothing
  expect(existsSync(join(dir, 'dist', 'export-private'))).toBe(false);
  expect(await npx(['preview', '--private'], dir)).toEqual({ code: 1, out: '', err: 'dist/export-private/roadmap.html  Unreadable file  \n' });
});
