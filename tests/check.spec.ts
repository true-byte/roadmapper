// The file check: every error of a roadmap file at once, each as its line, the path the page names it by, its key, the name of the error and the wrong value.
// The name is one of ERRORS, and nothing else is said. A state of "blocked" is an error: a step is blocked only by what it waits for.
// `npm run validate` prints the errors; the page shows them all in a list in place of the plan, and the plan comes back as it was once the file is fixed.
/// <reference types="node" />
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as plain } from '@playwright/test';
import { readPlan, type Fonts } from '../src/view/plan';
import { checkRoadmap, parseRoadmap } from '../src/roadmap/check';
import { ERRORS, sayError, type FileError } from '../src/roadmap/errors';
import type { Roadmap } from '../src/roadmap/types';
import { errorList, errorRows, expect, level, openPlan, save, settle, step, test, zoomTo } from './helpers';
import { flat, full } from './plans';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** A file with an error of most kinds, on lines of their own but the last three. */
const BROKEN = `{
  "title": "Broken",
  "branches": [
    { "name": "V1", "items": [
      { "id": "a", "name": "Design", "state": "blocked" },
      { "id": "b", "name": "Build", "waitsfor": ["a"] },
      { "branchng": true, "split": [
        { "name": "Code", "items": [ { "id": "c", "name": "Code one", "start": "2026-02-30" } ] }
      ] },
      { "id": "a", "name": "Again" },
      { "id": "d", "waitsFor": ["nope"], "state": "doing" }
    ] }
  ]
}
`;
const BROKEN_ERRORS: FileError[] = [
  { line: 5, path: 'V1 › Design', key: 'state', error: 'Invalid value', value: '"blocked"' },
  { line: 5, path: 'V1 › Design', key: 'id', error: 'Duplicate id', value: '"a"' },
  { line: 6, path: 'V1 › Build', key: 'waitsfor', error: 'Unknown key', value: '' },
  { line: 7, path: 'V1', key: 'branchng', error: 'Unknown key', value: '' },
  { line: 8, path: 'V1 › Code › Code one', key: 'start', error: 'Invalid date', value: '"2026-02-30"' },
  { line: 10, path: 'V1 › Again', key: 'id', error: 'Duplicate id', value: '"a"' },
  { line: 11, path: 'V1 › d', key: 'state', error: 'Invalid value', value: '"doing"' },
  { line: 11, path: 'V1 › d', key: 'name', error: 'Missing key', value: '' },
  { line: 11, path: 'V1 › d', key: 'waitsFor', error: 'Unknown id', value: '"nope"' },
];

plain.describe('the check', () => {
  plain('finds every error at once, in the order of the file, each with its line, path, key, error and value', () => {
    const { roadmap, errors } = checkRoadmap(BROKEN);
    expect(roadmap).toBeUndefined();
    expect(errors).toEqual(BROKEN_ERRORS);
  });

  plain('refuses a key it does not know, on every piece, with no value', () => {
    const text = `{
  "title": "Keys",
  "subtitle": "no such key",
  "branches": [
    { "name": "Main", "item": [], "items": [
      { "name": "Group", "branchng": true, "split": [
        { "name": "Code", "items": [
          { "id": "x", "name": "X", "waitsfor": [], "Icon": "map", "color": "red" }
        ] }
      ] }
    ] }
  ]
}`;
    expect(checkRoadmap(text).errors.map(sayError)).toEqual([
      '3    subtitle  Unknown key  ',
      '5  Main  item  Unknown key  ',
      '6  Main › Group  branchng  Unknown key  ',
      '8  Main › Group › Code › X  waitsfor  Unknown key  ',
      '8  Main › Group › Code › X  Icon  Unknown key  ',
      '8  Main › Group › Code › X  color  Unknown key  ',
    ]);
  });

  plain('a value of the wrong type, an empty list or name, a step that waits for itself: each with its value as the file writes it', () => {
    const text = `{
  "title": "Types",
  "branches": [
    { "name": "Main", "items": [
      7,
      { "id": "x", "name": "", "milestone": "yes", "start": 20261001, "end": "2026-10", "waitsFor": [5, "x"] },
      { "split": [] },
      { "name": "Items", "split": [ { "items": { "id": "y", "name": "Y", "why": "an object where a list goes, which is cut short" } } ] }
    ] }
  ]
}`;
    expect(checkRoadmap(text).errors.map(sayError)).toEqual([
      '5  Main    Wrong type  7',
      '6  Main › x  name  Invalid value  ""',
      '6  Main › x  milestone  Wrong type  "yes"',
      '6  Main › x  start  Wrong type  20261001',
      '6  Main › x  end  Invalid date  "2026-10"',
      '6  Main › x  waitsFor  Wrong type  5',
      '6  Main › x  waitsFor  Invalid value  "x"',
      '7  Main  split  Invalid value  []',
      '8  Main › Items  items  Wrong type  {"id":"y","name":"Y","why":"an object where a list goes, wh…',
    ]);
    expect(checkRoadmap('[]').errors).toEqual([{ line: 1, path: '', key: '', error: 'Wrong type', value: '[]' }]);
    expect(checkRoadmap('{ "branches": [] }').errors.map(sayError)).toEqual(['1    title  Missing key  ', '1    branches  Invalid value  []']);
  });

  plain('a duplicate id is an error on each line it is on, once a line', () => {
    const text = `{ "title": "Twice", "branches": [ { "items": [
  { "id": "a", "name": "One" }, { "id": "a", "name": "Two" },
  { "id": "a", "name": "Three" }
] } ] }`;
    expect(checkRoadmap(text).errors.map(sayError)).toEqual(['2  #1 › One  id  Duplicate id  "a"', '3  #1 › Three  id  Duplicate id  "a"']);
  });

  plain('a text that is not JSON has one error, on the line where it breaks, with the text there it cannot take', () => {
    const at = (text: string): [number, string] => {
      const { errors } = checkRoadmap(text);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ path: '', key: '', error: 'Invalid JSON' });
      return [errors[0].line, errors[0].value];
    };
    expect(at('{\n  "title": "T"\n  "branches": []\n}')).toEqual([2, '']);
    expect(at('{\n  "title": "T",\n  "branches": [1, 2,\n  ]\n}')).toEqual([3, ',']);
    expect(at('{\n  "title": "T\n}')).toEqual([2, '"T']);
    expect(at('{\n  title: "T"\n}')).toEqual([2, 'title']);
    expect(at('{\n  "title" "T"\n}')).toEqual([2, '']);
    expect(at('{\n  "title": "T",\n  "branches": [')).toEqual([3, '']);
    expect(at('{\n  "n": 01\n}')).toEqual([2, '01']);
    expect(at('{\n  "n": "a\\qb"\n}')).toEqual([2, '\\q']);
    expect(at('{\n  "n": nope\n}')).toEqual([2, 'nope']);
    expect(at('{}\n}')).toEqual([2, '}']);
    expect(at('')).toEqual([1, '']);
  });

  plain('each error is a name of the one list', () => {
    const all = [BROKEN, '{', '[]', '{ "title": "T", "branches": [ { "items": [ { "id": "a", "name": "A", "waitsFor": ["b"], "end": 5 } ] } ] }'];
    for (const text of all) for (const e of checkRoadmap(text).errors) expect(ERRORS).toContain(e.error);
  });

  plain('the sample roadmap a new user sees has no error', () => {
    expect(checkRoadmap(readFileSync(join(ROOT, 'data/sample.roadmap.json'), 'utf8')).errors).toEqual([]);
  });

  plain('a roadmap given as data throws its first error, with no line', () => {
    expect(() => parseRoadmap({ title: 'T', branches: [{ items: [{ id: 'a', name: 'A', state: 'blocked' }] }] })).toThrow('#1 › A  state  Invalid value  "blocked"');
  });
});

plain.describe('blocked', () => {
  const fonts: Fonts = { width: s => s.length * 8, line: 18, top: 12 };
  const states = (r: Roadmap): Record<string, string> => Object.fromEntries(readPlan(r, () => undefined, fonts).all.map(n => [n.node.id, n.state]));

  plain('no file says it: a step is blocked while a step it waits for is not done, or, in an export, while it waits for private work', () => {
    const [error] = checkRoadmap('{ "title": "T", "branches": [ { "items": [ { "id": "a", "name": "A", "state": "blocked" } ] } ] }').errors;
    expect(error).toEqual({ line: 1, path: '#1 › A', key: 'state', error: 'Invalid value', value: '"blocked"' });
    const r: Roadmap = {
      title: 'T',
      branches: [
        { name: 'Partner', items: [{ id: 'signs', name: 'Partner signs', state: 'in-progress' }] },
        { name: 'Ours', items: [
          { id: 'deal', name: 'Deal', waitsFor: ['signs'] },
          { id: 'cut', name: 'Cut', waitsForPrivate: true },
          { id: 'over', name: 'Over', state: 'done', waitsForPrivate: true },
        ] },
      ],
    };
    expect(states(parseRoadmap(r))).toEqual({ signs: 'in-progress', deal: 'blocked', cut: 'blocked', over: 'done' });
    r.branches[0].items[0] = { id: 'signs', name: 'Partner signs', state: 'done' };
    expect(states(r).deal).toBe('todo');
  });
});

/** Runs `npm run validate -- <args>` as typed in the folder `from`, and gives what it said and how it ended. */
function validate(args: string[], from: string): Promise<{ code: number; out: string; err: string }> {
  return new Promise(done => {
    const env = { ...process.env, npm_lifecycle_event: 'validate', INIT_CWD: from };
    execFile(process.execPath, [join(ROOT, 'scripts/roadmapper.mjs'), 'validate', ...args], { cwd: ROOT, env }, (e, out, err) =>
      done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, out, err }),
    );
  });
}

plain.describe('npm run validate', () => {
  plain('prints each error on a line of its own, as file:line, path, key, error and value, and ends with an error', async () => {
    const dir = plain.info().outputPath('typed-here');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'broken.json'), BROKEN);
    const { code, out } = await validate(['broken.json'], dir);
    expect(code).toBe(1);
    expect(out).toBe(`${BROKEN_ERRORS.map(e => `broken.json:${sayError(e)}`).join('\n')}\n`);
    expect(out.split('\n').slice(0, 3)).toEqual([
      'broken.json:5  V1 › Design  state  Invalid value  "blocked"',
      'broken.json:5  V1 › Design  id  Duplicate id  "a"',
      'broken.json:6  V1 › Build  waitsfor  Unknown key  ',
    ]);
    writeFileSync(join(dir, 'syntax.json'), '{\n  "title": "T"\n  "branches": []\n}');
    expect(await validate(['syntax.json'], dir)).toEqual({ code: 1, out: 'syntax.json:2      Invalid JSON  \n', err: '' });
    expect(await validate(['nope.json'], dir)).toEqual({ code: 1, out: 'nope.json:      Unreadable file  \n', err: '' });
  });

  plain('a file with no error: one short line, and no error; with no file named, data/roadmap.json', async () => {
    const dir = plain.info().outputPath('typed-here');
    mkdirSync(join(dir, 'plans'), { recursive: true });
    writeFileSync(join(dir, 'plans', 'good.json'), JSON.stringify({ title: 'Good', branches: [{ items: [{ id: 'a', name: 'A' }] }] }, null, 2));
    expect(await validate(['plans/good.json'], dir)).toEqual({ code: 0, out: 'plans/good.json: no errors\n', err: '' });
    expect(await validate([], ROOT)).toEqual({ code: 0, out: 'data/roadmap.json: no errors\n', err: '' });
  });
});

test.describe('the error list', () => {
  test('a broken file shows every error in place of the plan: the title, the file, how many, and a row for each, by line', async ({ page }) => {
    await openPlan(page, flat, { store: null });
    await page.evaluate(t => window.view.show(t, 'roadmap.json'), BROKEN);
    await settle(page);
    const list = errorList(page);
    await expect(list).toBeVisible();
    await expect(list.locator('.title')).toHaveText('Broken');
    await expect(list.locator('.file')).toHaveText('roadmap.json');
    await expect(list.locator('.howmany')).toHaveText('9 errors');
    await expect(list.locator('.cols')).toHaveText('LineWhereKeyErrorValue');
    expect(await errorRows(page)).toEqual(BROKEN_ERRORS.map(sayError));
    await expect(step(page, 'f-1')).toBeHidden();
    await expect(page.locator('.roadmap .zoom')).toBeHidden();
  });

  test('a text that is not JSON: no title, and one row, on the line where it breaks', async ({ page }) => {
    await openPlan(page, flat, { store: null });
    await save(page, '{ "title": "T",\n  "branches": [');
    await expect(errorList(page).locator('.title')).toHaveCount(0);
    await expect(errorList(page).locator('.howmany')).toHaveText('1 error');
    expect(await errorRows(page)).toEqual(['2      Invalid JSON  ']);
  });

  test('once the file is fixed, the plan comes back as it was, at its level and place; the keys do nothing while the list shows', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await zoomTo(page, 'Tracks');
    const before = await step(page, 'kickoff').boundingBox();
    await save(page, BROKEN);
    await expect(errorList(page)).toBeVisible();
    await page.keyboard.press('+');
    await save(page, '{ "title": ');
    expect(await errorRows(page)).toEqual(['1      Invalid JSON  ']);
    await save(page, full);
    await expect(errorList(page)).toBeHidden();
    await expect(errorList(page).locator('.row')).toHaveCount(0);
    expect(await level(page)).toBe('Tracks');
    expect(await step(page, 'kickoff').boundingBox()).toEqual(before);
  });

  test('a file broken from the start shows the list, and the plan draws once it is fixed', async ({ page }) => {
    await openPlan(page, BROKEN, { store: null });
    expect(await errorRows(page)).toEqual(BROKEN_ERRORS.map(sayError));
    await save(page, flat);
    await expect(errorList(page)).toBeHidden();
    await expect(page.locator('.roadmap .head .title')).toHaveText(flat.title);
    await expect(step(page, 'f-1')).toBeVisible();
  });
});
