// The fonts of the theme on the pages that show a roadmap (src/themes/fonts.ts, src/view/fonts.ts): the app page, the box of the plain script and the export
// load them from the folder fonts/ next to Roadmapper's own files, ask no other host, and draw and wrap the names in them. The tests run with no network.
/// <reference types="node" />
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { wrap, type Fonts } from '../../src/view/plan';
import { folder, removeFolders, roadmapper, ROOT } from '../support/cli';
import { boxesDrawn, drawnIn, expect, flowOf, nameOf, PLAIN, settle, test } from '../support/helpers';

test.afterEach(removeFolders);

/** A name of a step and a name of a branch, each drawn in the font of the theme. */
const THEME = { name: 'theme', branch: 'theme' };

/** Names of many lengths. The first three wrap otherwise in the fallback fonts, Liberation Sans for Arial, as Playwright installs it on Linux. */
const NAMES = ['Hang the sign with care', 'Fix the sink twice', 'Hire the staff first', 'Paint the front wall', 'Order chairs and tables', 'Fit the big glass door',
  'Hang the lamps over the bar', 'Lay the floor tiles', 'Test the coffee machine', 'Print the opening flyers', 'Fix the leak in the back room', 'Buy flour for a month',
  'Set up the till', 'Book a band for the opening', 'Plan the first menu'];

/** Each address the page asks for, from now on. */
function asked(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', r => urls.push(r.url()));
  return urls;
}

/** The width of each run of whole words of each name, as the view measures a name: in the font of the names, or with `fallback` in the fonts after it. */
async function widths(page: Page, names: string[], fallback: boolean): Promise<Map<string, number>> {
  return new Map(await page.evaluate(([names, fallback]) => {
    const s = getComputedStyle(document.querySelector('svg.plan text.label')!);
    const pen = document.createElement('canvas').getContext('2d')!;
    pen.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${fallback ? s.fontFamily.split(',').slice(1).join(',') : s.fontFamily}`;
    const gap = parseFloat(s.letterSpacing) || 0;
    return names.flatMap(name => {
      const words = name.split(' ');
      return words.flatMap((_, i) => words.slice(i).map((__, n) => words.slice(i, i + n + 1).join(' '))).map((t): [string, number] => [t, pen.measureText(t).width + gap * [...t].length]);
    });
  }, [names, fallback] as const));
}
/** The lines a name wraps to, with the widths a font gives. */
const linesIn = (name: string, w: Map<string, number>): string[] => {
  const fonts: Fonts = { width: t => w.get(t) ?? Number.NaN, line: 16, top: 10 };
  return wrap(name, fonts).lines;
};

test('the app page loads the fonts from its folder fonts/, asks no other address, and draws and wraps the names in them', async ({ page }) => {
  const here = folder();
  writeFileSync(join(here, 'roadmap.json'), JSON.stringify({ title: 'Opening', branches: [{ name: 'Shop', items: NAMES.map((name, i) => ({ id: `n${i}`, name })) }] }));
  expect((await roadmapper(['build', 'roadmap.json', 'out'], here)).code).toBe(0);
  const out = pathToFileURL(join(here, 'out')).href;
  const urls = asked(page);
  await page.goto(`${out}/index.html`);
  await expect(page.locator('svg.plan')).toBeVisible();
  await settle(page);

  await test.step('the page asks only for itself and the files of its folder fonts/', async () => {
    const files = new Set(readdirSync(join(here, 'out/fonts')).map(f => `${out}/fonts/${f}`));
    expect(urls.filter(u => u !== `${out}/index.html` && !files.has(u))).toEqual([]);
    expect(urls.some(u => u.endsWith('.woff2'))).toBe(true);
  });

  await test.step('the names are drawn in the fonts of the theme', async () => {
    expect(await drawnIn(page)).toEqual(THEME);
  });

  await test.step('the names wrap as the font of the names measures them, not as the fallback fonts do', async () => {
    expect(await flowOf(page)).toBe('h');
    const theme = await widths(page, NAMES, false), fallback = await widths(page, NAMES, true);
    const drawn = await Promise.all(NAMES.map((_, i) => nameOf(page, `n${i}`).allTextContents()));
    expect(drawn).toEqual(NAMES.map(name => linesIn(name, theme)));
    expect(NAMES.filter(name => linesIn(name, theme).join('|') !== linesIn(name, fallback).join('|')).length, 'a name that wraps otherwise in the fallback fonts').toBeGreaterThan(0);
  });
});

test('the box of the plain script loads the fonts from the folder fonts/ next to the script, and asks no other address', async ({ page, errors }) => {
  const urls = asked(page);
  await page.goto(PLAIN);
  await boxesDrawn(page);
  // the browser says it does not let the page read garden.json; the box says nothing
  errors.splice(0, errors.length, ...errors.filter(e => !/^Fetch API cannot load file:.*\/garden\.json\./.test(e)));
  const lib = pathToFileURL(join(ROOT, 'dist/lib')).href;
  expect(urls.filter(u => u !== PLAIN && u !== `${lib}/roadmapper.js` && !u.startsWith(`${lib}/fonts/`))).toEqual([]);
  expect(urls.some(u => u.startsWith(`${lib}/fonts/`) && u.endsWith('.woff2'))).toBe(true);
  expect(await drawnIn(page)).toEqual(THEME);
});

test('the export on a site asks only that site, for its fonts too', async ({ page }) => {
  const dir = join(ROOT, 'dist/tests/export');
  const types: Record<string, string> = { html: 'text/html; charset=utf-8', json: 'application/json', js: 'text/javascript; charset=utf-8', woff2: 'font/woff2', txt: 'text/plain' };
  const files = ['roadmap.html', 'roadmap.json', 'roadmapper.js', ...readdirSync(join(dir, 'fonts')).map(f => `fonts/${f}`)];
  // the site, and any other host the page might ask: none answers but the site
  await page.context().setOffline(false);
  await page.route('**/*', r => {
    const url = new URL(r.request().url()), name = url.pathname.slice(1);
    if (url.origin !== 'https://landing.test') return r.abort();
    return files.includes(name) ? r.fulfill({ contentType: types[name.split('.').pop()!], body: readFileSync(join(dir, name)) }) : r.fulfill({ status: 404, body: 'Not found' });
  });
  const urls = asked(page);
  await page.goto('https://landing.test/roadmap.html');
  await expect(page.locator('svg.plan')).toBeVisible();
  await settle(page);
  expect(urls.filter(u => new URL(u).origin !== 'https://landing.test')).toEqual([]);
  expect(urls.some(u => u.startsWith('https://landing.test/fonts/') && u.endsWith('.woff2'))).toBe(true);
  expect(await drawnIn(page)).toEqual(THEME);
});
