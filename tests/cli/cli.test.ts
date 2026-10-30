// The commands of src/cli/cli.ts, run in this process as `npx roadmapper` runs them: each path typed is from the folder it is typed in, and each path printed is to it.
// A command that cannot do its work writes nothing, prints one line for each error, and ends with code 1. `build` and `export` write only into a folder that is missing, empty or holds what they wrote.
/// <reference types="node" />
import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ask, cliSource, folder, removeFolders, roadmapper, ROOT } from '../support/cli';

/** A roadmap with private items, and a step whose name holds `</script><!--`. */
const FIXTURE = readFileSync(join(ROOT, 'tests/fixtures/export.json'), 'utf8');
/** The names and ids of its private items, which only an export with --private holds. */
const PRIVATE = ['Pricing track', 'Secret price', 'secret-price', 'Payroll', 'payroll', 'Hidden prep', 'hidden-prep'];
const plan = (title: string): string => JSON.stringify({ title, branches: [{ name: 'Main', items: [{ id: 'a', name: 'A' }] }] }, null, 2);
const ALL_PRIVATE = JSON.stringify({ title: 'All mine', branches: [{ name: 'Mine', private: true, items: [{ id: 'a', name: 'A' }] }] });
const BROKEN = `{
  "title": "Broken",
  "about": 5,
  "branches": [ { "name": "V1", "items": [ { "id": "a", "name": "Design", "state": "blocked" } ] } ]
}`;
const BROKEN_SAID = 'broken.json:3    about  Wrong type  5\nbroken.json:4  V1 › Design  state  Invalid value  "blocked"\n';

// one load of the source for the file: its tests run in order, in one worker
test.describe.configure({ mode: 'default' });
test.afterEach(removeFolders);

/** A new folder that the commands are typed in, with the files in `files`, by their paths there. */
function typedIn(files: Record<string, string> = {}): string {
  const dir = folder();
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
/** What a command printed, with each size as 'n kB'. */
const sized = (out: string): string => out.replace(/\d+ kB$/gm, 'n kB');
/** The files of a folder and what each holds. */
const contents = (dir: string): Record<string, string> => Object.fromEntries(readdirSync(dir).sort().map(f => [f, readFileSync(join(dir, f), 'utf8')]));

test('roadmapper prints the usage, or the error of an unknown command', async () => {
  const here = typedIn();
  expect(await roadmapper([], here)).toEqual({ code: 0, err: '', out: expect.stringContaining('npx roadmapper validate [file]\n') });
  expect(await roadmapper(['serve'], here)).toEqual({ code: 1, out: '', err: 'roadmapper  Unknown option  serve\n' });
});

test.describe('validate', () => {
  test('validate prints each error as file:line, and ends with code 1', async () => {
    const here = typedIn({ 'broken.json': BROKEN, 'syntax.json': '{\n  "title": "T"\n  "branches": []\n}' });
    expect(await roadmapper(['validate', 'broken.json'], here)).toEqual({ code: 1, out: BROKEN_SAID, err: '' });
    expect(await roadmapper(['validate', 'syntax.json'], here)).toEqual({ code: 1, out: 'syntax.json:2      Invalid JSON  \n', err: '' });
    expect(await roadmapper(['validate', 'nope.json'], here)).toEqual({ code: 1, out: 'nope.json:      Unreadable file  \n', err: '' });
  });

  test('validate reads roadmap.json where it is typed, unless a file is named', async () => {
    const here = typedIn({ 'roadmap.json': plan('Mine'), 'plans/good.json': plan('Good'), 'broken.json': BROKEN });
    expect(await roadmapper(['validate'], here)).toEqual({ code: 0, out: 'roadmap.json: no errors\n', err: '' });
    expect(await roadmapper(['validate', 'plans/good.json'], here)).toEqual({ code: 0, out: 'plans/good.json: no errors\n', err: '' });
    // one file, and no option
    expect(await roadmapper(['validate', '--strict'], here)).toEqual({ code: 1, out: '', err: 'validate  Unknown option  --strict\n' });
    expect(await roadmapper(['validate', 'roadmap.json', 'broken.json'], here)).toEqual({ code: 1, out: '', err: 'validate  Unknown option  broken.json\n' });
  });
});

test.describe('build', () => {
  test('build writes into a new folder, then over its own build', async () => {
    const here = typedIn({ 'roadmap.json': plan('First plan xq') });
    const built = await roadmapper(['build'], here);
    expect(sized(built.out), built.err).toBe('dist/app/index.html  n kB\n');
    expect(readdirSync(join(here, 'dist/app'))).toEqual(['index.html']);
    expect(readFileSync(join(here, 'dist/app/index.html'), 'utf8')).toContain('First plan xq');
    expect((await roadmapper(['build', 'roadmap.json', 'out'], here)).out).toMatch(/^out\/index\.html {2}\d+ kB\n$/);

    writeFileSync(join(here, 'roadmap.json'), plan('Second plan xq'));
    expect((await roadmapper(['build', 'roadmap.json', 'out'], here)).code).toBe(0);
    expect(readdirSync(join(here, 'out'))).toEqual(['index.html']);
    const page = readFileSync(join(here, 'out/index.html'), 'utf8');
    expect(page).toContain('Second plan xq');
    expect(page).not.toContain('First plan xq');
  });

  test('build writes nothing into a folder with files of its own', async () => {
    const here = typedIn({ 'roadmap.json': plan('Mine'), 'mine/notes.txt': 'mine' });
    mkdirSync(join(here, 'deeper/down'), { recursive: true });
    const refused = (where: string, value = ''): unknown => ({ code: 1, out: '', err: `${where}  ${value ? 'Folder not empty' : 'Not a folder'}  ${value}\n` });
    expect(await roadmapper(['build', 'roadmap.json', 'mine'], here)).toEqual(refused('mine', 'notes.txt'));
    // the folder it is typed in, and the one above
    expect(await roadmapper(['build', 'roadmap.json', '.'], here)).toEqual(refused('.', 'deeper/, mine/, roadmap.json'));
    expect(await roadmapper(['build', '../../roadmap.json', '..'], join(here, 'deeper/down'))).toEqual(refused('..', 'down/'));
    expect(await roadmapper(['build', 'roadmap.json', 'roadmap.json'], here)).toEqual(refused('roadmap.json'));
    expect(readdirSync(here).sort()).toEqual(['deeper', 'mine', 'roadmap.json']);
    expect(readdirSync(join(here, 'deeper'))).toEqual(['down']);
    expect(contents(join(here, 'mine'))).toEqual({ 'notes.txt': 'mine' });
    expect(readFileSync(join(here, 'roadmap.json'), 'utf8')).toBe(plan('Mine'));
  });

  test('a broken or missing roadmap file builds nothing and prints its errors', async () => {
    const here = typedIn({ 'broken.json': BROKEN });
    expect(await roadmapper(['build', 'broken.json', 'out'], here)).toEqual({ code: 1, out: '', err: BROKEN_SAID });
    expect(await roadmapper(['build', 'nope.json', 'out'], here)).toEqual({ code: 1, out: '', err: 'nope.json:      Unreadable file  \n' });
    expect(existsSync(join(here, 'out'))).toBe(false);
  });
});

test.describe('export', () => {
  test('export writes its three files, then over its own export', async () => {
    const here = typedIn({ 'roadmap.json': FIXTURE });
    const made = await roadmapper(['export'], here);
    expect(sized(made.out), made.err).toBe('dist/export/roadmap.html  n kB\ndist/export/roadmap.json  n kB\ndist/export/roadmapper.js  n kB\n');
    const out = join(here, 'dist/export'), first = contents(out);
    expect(Object.keys(first)).toEqual(['roadmap.html', 'roadmap.json', 'roadmapper.js']);
    expect(first['roadmapper.js']).toBe(readFileSync(join(ROOT, 'dist/lib/roadmapper-page.js'), 'utf8'));
    for (const word of PRIVATE) expect(first['roadmap.json'], word).not.toContain(word);

    for (const f of Object.keys(first)) writeFileSync(join(out, f), 'an export before');
    expect((await roadmapper(['export'], here)).code).toBe(0);
    expect(contents(out)).toEqual(first);
  });

  test('export --private keeps the whole roadmap, in a folder of its own', async () => {
    const here = typedIn({ 'roadmap.json': FIXTURE, 'all.json': ALL_PRIVATE });
    const kept = await roadmapper(['export', '--private'], here);
    expect(sized(kept.out), kept.err).toBe('dist/export-private/roadmap.html  n kB\ndist/export-private/roadmap.json  n kB\ndist/export-private/roadmapper.js  n kB\n');
    const whole = readFileSync(join(here, 'dist/export-private/roadmap.json'), 'utf8');
    for (const word of PRIVATE) expect(whole, word).toContain(word);
    // where everything is private, it all goes out
    expect((await roadmapper(['export', '--private', 'all.json', 'mine'], here)).code).toBe(0);
    expect(JSON.parse(readFileSync(join(here, 'mine/roadmap.json'), 'utf8')).branches[0].name).toBe('Mine');
  });

  test('export takes --private anywhere among the paths, and no other option', async () => {
    const here = typedIn({ 'plan.json': FIXTURE });
    expect(await roadmapper(['export', '--privat', 'plan.json', 'odd'], here)).toEqual({ code: 1, out: '', err: 'export  Unknown option  --privat\n' });
    expect(existsSync(join(here, 'odd'))).toBe(false);
    expect((await roadmapper(['export', 'plan.json', 'out', '--private'], here)).code).toBe(0);
    expect(readFileSync(join(here, 'out/roadmap.json'), 'utf8')).toContain('Secret price');
  });

  test('a broken, missing or all-private roadmap file exports nothing', async () => {
    const here = typedIn({ 'broken.json': BROKEN, 'all.json': ALL_PRIVATE, 'plan.json': FIXTURE });
    expect(await roadmapper(['export', 'broken.json', 'out'], here)).toEqual({ code: 1, out: '', err: BROKEN_SAID });
    expect(await roadmapper(['export', 'all.json', 'out'], here)).toEqual({ code: 1, out: '', err: 'all.json  Nothing public  \n' });
    expect(existsSync(join(here, 'out'))).toBe(false);
    // also into a folder that holds an export
    expect((await roadmapper(['export', 'plan.json', 'out'], here)).code).toBe(0);
    expect(await roadmapper(['export', 'plna.json', 'out'], here)).toEqual({ code: 1, out: '', err: 'plna.json:      Unreadable file  \n' });
  });

  test('export writes nothing into a folder with files of its own', async () => {
    const here = typedIn({ 'roadmap.json': FIXTURE, 'theirs/roadmap.json': 'their roadmap' });
    mkdirSync(join(here, 'deeper/down'), { recursive: true });
    const refused = (where: string, value = ''): unknown => ({ code: 1, out: '', err: `${where}  ${value ? 'Folder not empty' : 'Not a folder'}  ${value}\n` });
    expect((await roadmapper(['export', 'roadmap.json', 'out'], here)).code).toBe(0);
    writeFileSync(join(here, 'out/notes.txt'), 'mine');
    const before = contents(join(here, 'out'));
    expect(await roadmapper(['export', 'roadmap.json', 'out'], here)).toEqual(refused('out', 'notes.txt'));
    expect(contents(join(here, 'out'))).toEqual(before);
    // a roadmap.json alone may be someone's roadmap file
    expect(await roadmapper(['export', 'roadmap.json', 'theirs'], here)).toEqual(refused('theirs', 'roadmap.json'));
    expect(contents(join(here, 'theirs'))).toEqual({ 'roadmap.json': 'their roadmap' });
    // a roadmap.json is a file of an export, so only the folders are named
    expect(await roadmapper(['export', 'roadmap.json', '.'], here)).toEqual(refused('.', 'deeper/, out/, theirs/'));
    expect(await roadmapper(['export', '../../roadmap.json', '..'], join(here, 'deeper/down'))).toEqual(refused('..', 'down/'));
    expect(await roadmapper(['export', 'roadmap.json', 'roadmap.json/out'], here)).toEqual(refused('roadmap.json/out'));
    // a build is not an export
    expect((await roadmapper(['build', 'roadmap.json', 'site'], here)).code).toBe(0);
    expect(await roadmapper(['export', 'roadmap.json', 'site'], here)).toEqual(refused('site', 'index.html'));
    expect(readdirSync(here).sort()).toEqual(['deeper', 'out', 'roadmap.json', 'site', 'theirs']);
    expect(readdirSync(join(here, 'deeper'))).toEqual(['down']);
    expect(readFileSync(join(here, 'roadmap.json'), 'utf8')).toBe(FIXTURE);
  });

  test('export never writes over the roadmap file it reads', async () => {
    const here = typedIn({ 'roadmap.json': FIXTURE });
    expect(await roadmapper(['export', 'roadmap.json', '.'], here)).toEqual({ code: 1, out: '', err: '.  Folder not empty  roadmap.json\n' });
    // the same file by another name, through a link, in a folder that holds an export
    expect((await roadmapper(['export', 'roadmap.json', 'linked'], here)).code).toBe(0);
    rmSync(join(here, 'linked/roadmap.json'));
    linkSync(join(here, 'roadmap.json'), join(here, 'linked/roadmap.json'));
    expect(await roadmapper(['export', 'roadmap.json', 'linked'], here)).toEqual({ code: 1, out: '', err: 'linked  Folder not empty  roadmap.json\n' });
    expect(readFileSync(join(here, 'roadmap.json'), 'utf8')).toBe(FIXTURE);
  });
});

test.describe('dev and preview', () => {
  test('preview serves the three files of the export, and nothing else', async () => {
    const { previewServer } = await cliSource();
    const here = typedIn({ 'roadmap.json': FIXTURE });
    expect((await roadmapper(['export'], here)).code).toBe(0);
    const out = join(here, 'dist/export'), site = previewServer(out);
    const types = { 'roadmap.html': 'text/html; charset=utf-8', 'roadmap.json': 'application/json; charset=utf-8', 'roadmapper.js': 'text/javascript; charset=utf-8' };
    for (const [file, type] of Object.entries(types)) {
      const got = ask(site, `/${file}`);
      expect({ status: got.status, type: got.type, body: got.body() }, file).toEqual({ status: 200, type, body: readFileSync(join(out, file), 'utf8') });
    }
    // the page also without its .html
    expect(ask(site, '/roadmap').body()).toBe(readFileSync(join(out, 'roadmap.html'), 'utf8'));
    for (const path of ['/', '/index.html', '/../roadmap.json', '/dist/export/roadmap.json']) expect(ask(site, path).status, path).toBe(404);
  });

  test('preview with no export, or an unknown option, serves nothing', async () => {
    const here = typedIn();
    expect(await roadmapper(['preview', '--private'], here)).toEqual({ code: 1, out: '', err: 'dist/export-private/roadmap.html  Unreadable file  \n' });
    expect(await roadmapper(['preview', '--hots'], here)).toEqual({ code: 1, out: '', err: 'preview  Unknown option  --hots\n' });
  });

  test('dev serves the page at /, and each save at /events', async () => {
    const { devServer } = await cliSource();
    const dev = devServer(readFileSync(join(ROOT, 'dist/cli/app.html'), 'utf8'), () => ({ text: plan('First plan'), file: 'roadmap.json' }));
    const page = ask(dev.listener, '/');
    expect(page).toMatchObject({ status: 200, type: 'text/html; charset=utf-8' });
    // the slot of the page holds the file, its name, and the address of the saves
    const slot = /<script type="application\/json" id="roadmap">([^<]*)<\/script>/.exec(page.body())?.[1];
    expect(JSON.parse(slot ?? '')).toEqual({ text: plan('First plan'), file: 'roadmap.json', live: '/events' });
    expect(ask(dev.listener, '/nope').status).toBe(404);
    const stream = ask(dev.listener, '/events');
    expect(stream).toMatchObject({ status: 200, type: 'text/event-stream' });
    dev.send({ text: plan('Saved plan'), file: 'roadmap.json' });
    expect(stream.body()).toBe(`: open\n\ndata: ${JSON.stringify({ text: plan('Saved plan'), file: 'roadmap.json' })}\n\n`);
  });
});
