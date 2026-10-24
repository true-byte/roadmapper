// The HTML export: roadmap.html, roadmap.json and roadmapper.js side by side, as `npm run export` writes them and a landing page serves them.
// npm test exports tests/export/plan.json into dist/tests/export. The page reads roadmap.json as a site serves it, so the tests open it
// from a made-up host that answers from those files. Opened from disk, where the browser does not let it read roadmap.json, it draws the copy it holds.
/// <reference types="node" />
import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { errorList, expect, flowOf, labelsSwitch, level, nameOf, openTools, pickLayout, popup, settle, showLabels, side, step, test } from './helpers';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = fileURLToPath(new URL('../dist/tests/export/', import.meta.url));
const FAIL = 'The roadmap could not load: roadmapper.js did not run.';
/** The ids the export gives the steps of tests/export/plan.json that a stranger sees: s1, s2 and on, in reading order. */
const ID = { idea: 's1', tricky: 's2', 'code-1': 's3', 'tests-1': 's6', 'tests-2': 's7', release: 's9', later: 's10', party: 's11' };
/** What only the owner may read: the names, ids, icons, links and keys of the private items of tests/export/plan.json. */
const PRIVATE = ['Pricing track', 'Secret price', 'secret-price', 'Only the owner reads', 'coin', 'Price sheet', 'price-sheet', 'receipt', 'Internal branch', 'Payroll', 'payroll', 'cash',
  'Hidden prep', 'hidden-prep', 'ghost', '"private"'];
/** The days of 'Code one' in tests/export/plan.json, which would tell a stranger it is late. */
const DAYS = ['"start"', '"end"', '"deadline"', '2026-01-05', '2026-01-09', '2026-01-20'];

/** The line the page shows until the lib runs, or when it does not. */
const waitLine = (page: Page): Locator => page.locator('#roadmapper-wait');

/** The roadmap that the page of an export holds, as roadmap.json has it, from the text of the page. */
const heldIn = (html: string): unknown => JSON.parse(/<script type="application\/json">([^<]*)<\/script>/.exec(html)![1]);

/** Drops the one error the browser logs for a page opened from disk: it does not let the page read roadmap.json. The lib itself logs none. */
const fromDisk = (errors: string[]): void => {
  errors.splice(0, errors.length, ...errors.filter(e => !/^Fetch API cannot load file:.*\/roadmap\.json\. URL scheme "file" is not supported\.$/.test(e)));
};

/** Waits until the plan is drawn and at rest. */
async function drawn(page: Page): Promise<void> {
  await expect(page.locator('svg.plan')).toBeVisible();
  await settle(page);
}

/** A made-up landing page at https://landing.test: the export's files in the folder `at`, the page also without its .html, and the pages in `pages`,
 * and for any other address a 404, or the landing's own page, as a host that serves a one-page app does. `files` puts other text in place of a file. */
async function landing(page: Page, at = '/', o: { lib?: boolean; ownPage?: boolean; files?: Record<string, string>; pages?: Record<string, string> } = {}): Promise<void> {
  const file = (name: string): string | Buffer => o.files?.[name] ?? readFileSync(join(DIR, name));
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://landing.test/**', r => {
    const path = new URL(r.request().url()).pathname;
    if (path === `${at}roadmap.html` || path === `${at}roadmap`) return r.fulfill({ contentType: 'text/html; charset=utf-8', body: file('roadmap.html') });
    if (path === `${at}roadmap.json`) return r.fulfill({ contentType: 'application/json', body: file('roadmap.json') });
    if (path === `${at}roadmapper.js` && o.lib !== false) return r.fulfill({ contentType: 'text/javascript; charset=utf-8', body: file('roadmapper.js') });
    if (o.pages && Object.hasOwn(o.pages, path)) return r.fulfill({ contentType: 'text/html; charset=utf-8', body: o.pages[path] });
    if (o.ownPage) return r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Landing</title><h1>Landing</h1>' });
    return r.fulfill({ status: 404, body: 'Not found' });
  });
}

/** Opens the export on the made-up landing page, at its root, and waits until the plan is drawn and at rest. */
async function openExport(page: Page): Promise<void> {
  await landing(page);
  await page.goto('https://landing.test/roadmap.html');
  await drawn(page);
}

/** Runs the export as `npm run export -- <args>` does when typed in the folder `from`, and gives what it said and how it ended. */
function runExport(args: string[], from = ROOT, npm: Record<string, string> = {}): Promise<{ code: number; said: string }> {
  return new Promise(done => {
    const env = { ...process.env, npm_lifecycle_event: 'export', INIT_CWD: from, ...npm };
    execFile(process.execPath, [join(ROOT, 'scripts/roadmapper.mjs'), 'export', ...args], { cwd: ROOT, env }, (e, out, err) =>
      done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, said: out + err }),
    );
  });
}

/** How big a step's name is on the screen right now, in px. */
const nameSize = (page: Page): Promise<number> =>
  page.locator('svg.plan').evaluate(svg => {
    const plan = svg as SVGSVGElement, label = plan.querySelector('text.label')!;
    return (parseFloat(getComputedStyle(label).fontSize) * plan.getBoundingClientRect().width) / plan.viewBox.baseVal.width;
  });

test.use({ offline: false });

test('the page is the whole window, with the title in its head and the about line as its description, and it keeps nothing: a stranger always opens it with the labels shown', async ({ page }) => {
  await openExport(page);
  expect(await page.title()).toBe('Launch &amp; </title> <Grow> · roadmap');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'A made-up plan for the export tests: "quotes", <tags> and & in its words.');
  expect(await page.locator('roadmapper-view').boundingBox()).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  await expect(waitLine(page)).toBeHidden();
  await expect(page.locator('.roadmap .head')).not.toContainText('A made-up plan');
  await page.keyboard.press('+');
  await settle(page);
  // a pick of the layout holds only for the visit
  await pickLayout(page, 'Vertical');
  expect(await flowOf(page)).toBe('v');
  await showLabels(page, false);
  await expect(nameOf(page, ID.idea).first()).toBeHidden();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.reload();
  await drawn(page);
  await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(nameOf(page, ID.idea).first()).toBeVisible();
});

test("the popup holds the parts 'Key' and 'View', which ends with the mode and the layouts: the page has no part 'Export', no switch 'Include private items' and no button 'Export'", async ({ page }) => {
  await openExport(page);
  await page.locator('.zoom .tools').click();
  await expect(popup(page)).toBeVisible();
  await expect(popup(page).locator('button.fold')).toHaveText(['Key', 'View']);
  await expect(popup(page).locator('hr')).toHaveCount(1);
  await expect(popup(page).getByRole('radiogroup', { name: 'Mode' })).toBeVisible();
  await expect(popup(page).getByRole('switch', { name: 'Include private items', includeHidden: true })).toHaveCount(0);
  await expect(popup(page).locator('button.export')).toHaveCount(0);
  await expect(popup(page).getByRole('button', { name: 'Export', includeHidden: true })).toHaveCount(0);
});

test("'Light' and 'Dark' draw the whole page in that mode, whatever the device is set to, and a visit after starts as the device is set", async ({ page }) => {
  const view = page.locator('.roadmap'), mode = (name: string): Locator => popup(page).getByRole('radio', { name, includeHidden: true });
  await openExport(page);
  await expect(view).toHaveCSS('background-color', 'rgb(10, 18, 36)');
  await openTools(page);
  await mode('Light').click();
  await expect(view).toHaveCSS('background-color', 'rgb(244, 246, 251)');
  await expect(view).toHaveCSS('color-scheme', 'light');
  await expect(view.locator('svg.plan .lane').first()).toHaveCSS('stroke', 'rgb(11, 122, 140)');
  await expect(popup(page)).toHaveCSS('color', 'rgb(16, 27, 51)');
  await page.emulateMedia({ colorScheme: 'light' });
  await mode('Dark').click();
  await expect(view).toHaveCSS('background-color', 'rgb(10, 18, 36)');
  await expect(view.locator('svg.plan .lane').first()).toHaveCSS('stroke', 'rgb(86, 207, 225)');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.reload();
  await drawn(page);
  await expect(view).toHaveCSS('background-color', 'rgb(244, 246, 251)');
  await expect(mode('Device')).toHaveAttribute('aria-checked', 'true');
});

test('the keys and the wheel are the view\'s, with no click first, and the window itself never scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await openExport(page);
  expect(await level(page)).toBe('Main steps');
  await page.keyboard.press('+');
  await settle(page);
  expect(await level(page)).toBe('Tracks');
  await page.keyboard.press('+');
  await settle(page);
  expect(await level(page)).toBe('Every step');
  const stage = page.locator('.roadmap .stage');
  const at = (): Promise<{ x: number; y: number }> => stage.evaluate(s => ({ x: s.scrollLeft, y: s.scrollTop }));
  const before = await at();
  await page.mouse.move(320, 180);
  await page.mouse.wheel(0, 200);
  await settle(page);
  expect((await at()).y, 'the wheel scrolls the plan down').toBeGreaterThan(before.y);
  await page.keyboard.press('ArrowRight');
  await settle(page);
  expect((await at()).x, 'an arrow key moves the plan').toBeGreaterThan(before.x);
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
});

test('a pinch, or Ctrl and the wheel, scales the plan, not the page; over a plan that runs only sideways, the wheel moves it sideways', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  await openExport(page);
  // a narrow upright window draws the plan down; drawn across, this plan runs only sideways
  expect(await flowOf(page)).toBe('v');
  await pickLayout(page, 'Horizontal');
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
  const stage = page.locator('.roadmap .stage');
  const fits = await stage.evaluate(s => ({ down: s.scrollHeight <= s.clientHeight, across: s.scrollWidth <= s.clientWidth }));
  expect(fits, "at 'Main steps' the plan fits up and down, and not across").toEqual({ down: true, across: false });
  await page.mouse.move(240, 300);
  await page.mouse.wheel(0, 200);
  await settle(page);
  expect(await stage.evaluate(s => s.scrollLeft)).toBeGreaterThan(0);

  const before = await nameSize(page);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await settle(page);
  expect(await nameSize(page)).toBeGreaterThan(before * 1.1);
});

test('roadmap.json holds only the icons the roadmap a stranger sees names, with their license, and the steps draw them', async ({ page }) => {
  const own = JSON.parse(readFileSync(join(DIR, 'roadmap.json'), 'utf8')).icons;
  expect(own.set).toBe('tabler');
  // with the glyphs the view draws itself: the arrows, the gear of the tools button and the chevron of each part of its popup, the button of the list of branches, its search,
  // the pill of a hidden branch, the grip and the mode;
  // with those of the links of a shown step, and the icon of a link, the arrow and the chevron of 'Links'; and with none of the icons of a private step or of its links
  expect(Object.keys(own.icons)).toEqual(['arrow-left', 'arrow-right', 'book', 'bulb', 'chevron-down', 'chevron-up', 'code', 'confetti', 'device-desktop', 'external-link', 'eye-off',
    'link', 'moon', 'rocket', 'search', 'settings', 'stack-2', 'sun', 'test-pipe']);
  expect(own.license).toContain('Permission is hereby granted');
  expect(own.license).toContain('Paweł Kuna');
  await openExport(page);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await settle(page);
  for (const id of [ID.idea, ID.tricky, ID['code-1'], ID['tests-1'], ID.release]) await expect(step(page, id).locator('.coin'), id).toBeVisible();
  expect(await step(page, ID['code-1']).locator('.ic .art').innerHTML()).toContain('m7 8l-4 4l4 4');
  await expect(step(page, ID['tests-2']).locator('.coin'), 'an icon the set has not keeps the mark').toHaveCount(0);
});

test("a shown step keeps its links, and its side bar draws them with their icons, from the icons in roadmap.json", async ({ page }) => {
  const release = JSON.parse(readFileSync(join(DIR, 'roadmap.json'), 'utf8')).branches[0].items.at(-1);
  expect(release.links).toEqual([{ name: 'Release notes', url: 'https://example.com/notes', icon: 'book' }, { name: 'Tag', url: 'https://example.com/tag' }]);
  await openExport(page);
  await step(page, ID.release).click();
  await settle(page);
  const rows = side(page).locator('a.row');
  await expect(rows).toHaveText(['Release notes', 'Tag']);
  await expect(rows.first()).toHaveAttribute('href', 'https://example.com/notes');
  // each row draws its icon and the arrow, and the heading its chevron: no sign in place of a drawing the export left out
  for (const row of await rows.all()) await expect(row.locator('svg')).toHaveCount(2);
  await expect(side(page).locator('.fold svg')).toHaveCount(1);
  expect(await rows.nth(0).locator('svg').first().innerHTML()).not.toBe(await rows.nth(1).locator('svg').first().innerHTML());
});

test('a "<" in the roadmap stays text: a name with </script> and <!-- in it is drawn whole', async ({ page }) => {
  await openExport(page);
  expect((await nameOf(page, ID.tricky).allTextContents()).join(' ')).toBe('Ends </script><!-- here');
  await expect(page.locator('.roadmap .title')).toHaveText(/Launch &amp; <\/title> <Grow>/i);
});

test('no private item is in the export: not its name, its id, its icon or its keys, and the page draws only what is left', async ({ page }) => {
  // the lib is the same for every roadmap
  const files = ['roadmap.html', 'roadmap.json'].map(f => readFileSync(join(DIR, f), 'utf8'));
  for (const word of PRIVATE) for (const text of files) expect(text, word).not.toContain(word);
  await openExport(page);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await settle(page);
  const names = await page.locator('svg.plan text').allTextContents();
  expect(names.join(' ')).not.toMatch(/Secret|Payroll|Hidden|Pricing|Internal/);
  expect(await page.locator('svg.plan g.zn[data-id]').count(), 'the steps a stranger sees').toBe(11);
});

test('no step of the export keeps its days, so a stranger cannot tell what is late', async ({ page }) => {
  const roadmap = readFileSync(join(DIR, 'roadmap.json'), 'utf8');
  for (const day of DAYS) expect(roadmap, day).not.toContain(day);
  await openExport(page);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await settle(page);
  await step(page, ID['code-1']).click();
  await settle(page);
  await expect(side(page).locator('h2')).toHaveText('Code one');
  await expect(side(page).locator('section.part h3', { hasText: /Planned|Deadline/ })).toHaveCount(0);
});

test('with --private the export keeps the whole roadmap as written, each private item with its tag; an option it does not know writes nothing', async ({ page }) => {
  const dir = test.info().outputPath('typed-here');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(ROOT, 'tests/export/plan.json'), join(dir, 'plan.json'));
  const odd = await runExport(['--privat', 'plan.json', 'odd'], dir);
  expect(odd).toEqual({ code: 1, said: 'export  Unknown option  --privat\n' });
  expect(existsSync(join(dir, 'odd'))).toBe(false);

  // the option goes anywhere among the paths
  const kept = await runExport(['plan.json', 'out', '--private'], dir);
  expect(kept.code, kept.said).toBe(0);
  const out = join(dir, 'out');
  expect(readFileSync(join(out, 'roadmapper.js'), 'utf8')).toBe(readFileSync(join(DIR, 'roadmapper.js'), 'utf8'));
  const roadmap = readFileSync(join(out, 'roadmap.json'), 'utf8');
  for (const word of [...PRIVATE, ...DAYS]) expect(roadmap, word).toContain(word);
  expect(heldIn(readFileSync(join(out, 'roadmap.html'), 'utf8')), 'the page holds the whole roadmap too').toEqual(JSON.parse(roadmap));
  expect(Object.keys(JSON.parse(roadmap).icons.icons)).toEqual(expect.arrayContaining(['cash', 'coin', 'ghost', 'receipt']));
  // `npm run export --private`, with no `--`: npm keeps the option and says so in the env
  const kept2 = await runExport(['plan.json', 'out2'], dir, { npm_config_private: 'true' });
  expect(kept2.code, kept2.said).toBe(0);
  expect(readFileSync(join(dir, 'out2', 'roadmap.json'), 'utf8')).toBe(roadmap);

  await landing(page, '/', { files: { 'roadmap.json': roadmap } });
  await page.goto('https://landing.test/roadmap.html');
  await drawn(page);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await settle(page);
  expect(await page.locator('svg.plan g.zn[data-id]').count(), 'every step').toBe(14);
  for (const id of ['secret-price', 'payroll', 'hidden-prep']) {
    await step(page, id).click();
    await settle(page);
    await expect(side(page).locator('.facts .tag'), id).toHaveText(['Private']);
  }
  await step(page, 'code-1').click();
  await settle(page);
  await expect(side(page).locator('section.part h3', { hasText: /Planned|Deadline/ })).toHaveText(['Planned', 'Deadline']);

  // where everything is private, it all goes out
  writeFileSync(join(dir, 'all.json'), JSON.stringify({ title: 'All mine', branches: [{ name: 'Mine', private: true, items: [{ id: 'a', name: 'A' }] }] }));
  const all = await runExport(['--private', 'all.json', 'mine'], dir);
  expect(all.code, all.said).toBe(0);
  expect(JSON.parse(readFileSync(join(dir, 'mine', 'roadmap.json'), 'utf8')).branches[0].name).toBe('Mine');
});

test('a shown step that waits for private work not done is blocked, and its side bar does not say by what', async ({ page }) => {
  await openExport(page);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await settle(page);
  await expect(nameOf(page, ID.party)).toHaveClass(/\bblocked\b/);
  await step(page, ID.party).click();
  await settle(page);
  await expect(side(page)).toContainText('Launch party');
  await expect(side(page).locator('.facts')).toHaveText('Blocked');
  await expect(side(page).locator('section.part h3', { hasText: 'Blocked by' })).toHaveCount(0);
  // a step whose line holds shown open work too is as the file says
  await expect(nameOf(page, ID.release)).toHaveClass(/\btodo\b/);
});

test('on a site, roadmap.json wins over the copy the page holds: a new roadmap.json alone shows the new roadmap, with its title', async ({ page }) => {
  const roadmap = JSON.parse(readFileSync(join(DIR, 'roadmap.json'), 'utf8'));
  roadmap.branches[0].items[0].name = 'A new idea';
  expect(readFileSync(join(DIR, 'roadmap.html'), 'utf8'), 'the copy is the roadmap before').not.toContain('A new');
  await landing(page, '/', { files: { 'roadmap.json': JSON.stringify({ ...roadmap, title: 'A new title' }) } });
  await page.goto('https://landing.test/roadmap.html');
  await drawn(page);
  await expect(page.locator('.roadmap .title')).toHaveText(/A new title/i);
  expect(await page.title()).toBe('A new title · roadmap');
  expect((await nameOf(page, ID.idea).allTextContents()).join(' ')).toBe('A new idea');
});

test('with its lib not next to it, the page says that the roadmap could not load', async ({ page, errors }) => {
  await landing(page, '/', { lib: false });
  await page.goto('https://landing.test/roadmap.html');
  await expect(waitLine(page)).toHaveText(FAIL);
  // the browser says the lib did not come
  errors.splice(0, errors.length, ...errors.filter(e => !e.includes('404')));
});

test('opened from disk, where the browser does not let it read roadmap.json, the page draws the copy it holds, with its icons, and shows no error', async ({ page, errors }) => {
  expect(heldIn(readFileSync(join(DIR, 'roadmap.html'), 'utf8')), 'the copy is roadmap.json').toEqual(JSON.parse(readFileSync(join(DIR, 'roadmap.json'), 'utf8')));
  await page.goto(pathToFileURL(join(DIR, 'roadmap.html')).href);
  // the lib comes as the page loads it from disk: a plain script with src
  await drawn(page);
  await expect(waitLine(page)).toBeHidden();
  await expect(errorList(page)).toBeHidden();
  expect(await page.title()).toBe('Launch &amp; </title> <Grow> · roadmap');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await settle(page);
  for (const id of [ID.idea, ID.tricky, ID['code-1'], ID['tests-1'], ID.release]) await expect(step(page, id).locator('.coin'), id).toBeVisible();
  expect((await nameOf(page, ID.tricky).allTextContents()).join(' ')).toBe('Ends </script><!-- here');
  fromDisk(errors);
});

test('no text of the roadmap can end the copy the page holds: a title and names with </script>, <!--<script> and </roadmapper-view> in them are drawn whole, and run nothing', async ({ page, errors }) => {
  const dir = test.info().outputPath('typed-here');
  mkdirSync(dir, { recursive: true });
  const title = '</script><script>window.ran = 1</script>';
  const names = ['Ends </SCRIPT > here', 'Opens <!--<script> here', 'Ends </roadmapper-view> here'];
  writeFileSync(join(dir, 'tricky.json'), JSON.stringify({ title, branches: [{ name: 'Main', items: names.map((name, i) => ({ id: `n${i}`, name })) }] }));
  const made = await runExport(['tricky.json', 'out'], dir);
  expect(made.code, made.said).toBe(0);
  const out = join(dir, 'out');
  await page.goto(pathToFileURL(join(out, 'roadmap.html')).href);
  await drawn(page);
  // the tag holds the copy whole, and what comes after it
  const held = await page.locator('roadmapper-view > script[type="application/json"]').evaluateAll(s => s.map(e => JSON.parse(e.textContent!)));
  expect(held).toEqual([JSON.parse(readFileSync(join(out, 'roadmap.json'), 'utf8'))]);
  await expect(page.locator('roadmapper-view > #roadmapper-wait')).toHaveCount(1);
  expect(await page.evaluate(() => (window as { ran?: number }).ran)).toBeUndefined();
  expect(await page.title()).toBe(`${title} · roadmap`);
  // the export gives the steps new ids, s1 and on; a long word of a name may break over two lines
  const bare = (s: string): string => s.replace(/\s/g, '');
  for (const [i, name] of names.entries()) expect(bare((await nameOf(page, `s${i + 1}`).allTextContents()).join(''))).toBe(bare(name));
  fromDisk(errors);
});

test('it draws at /roadmap.html and at /roadmap, at the root of the site and in a folder', async ({ page }) => {
  for (const [at, open] of [['/', '/roadmap'], ['/', '/roadmap.html'], ['/en/plans/', '/en/plans/roadmap'], ['/en/plans/', '/en/plans/roadmap.html']]) {
    await page.unrouteAll();
    await landing(page, at);
    await page.goto('https://landing.test' + open);
    await drawn(page);
    await expect(step(page, ID.idea), open).toBeVisible();
  }
});

test('a page of the site shows the roadmap in a box with the two lines, with its icons', async ({ page }) => {
  const about = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>About us</title>
<script src="roadmapper.js" defer></script></head>
<body><h1>About us</h1><roadmapper-view src="roadmap.json"></roadmapper-view><p>More about us.</p></body></html>`;
  await landing(page, '/', { pages: { '/about.html': about } });
  await page.goto('https://landing.test/about.html');
  await drawn(page);
  expect(await page.title(), 'a box leaves the title of its page alone').toBe('About us');
  const box = await page.locator('roadmapper-view').boundingBox();
  expect(box?.height).toBe(560);
  await expect(step(page, ID.idea).locator('.coin')).toBeVisible();

  // a new src with icons the first file did not have: the box draws them
  const roadmap = JSON.parse(readFileSync(join(DIR, 'roadmap.json'), 'utf8'));
  roadmap.branches[0].items[1].icon = 'new-icon';
  roadmap.icons.icons['new-icon'] = '<path fill="none" stroke="currentColor" d="M1 1h22"/>';
  await page.route('https://landing.test/other.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...roadmap, title: 'Other' }) }));
  await page.locator('roadmapper-view').evaluate(e => e.setAttribute('src', 'other.json'));
  await expect(page.locator('.roadmap .title')).toHaveText(/Other/i);
  await settle(page);
  await expect(step(page, ID.tricky).locator('.coin')).toBeVisible();
  expect(await step(page, ID.tricky).locator('.ic .art').innerHTML()).toContain('M1 1h22');
});

test('an icon in roadmap.json that is more than a drawing is not drawn, so the file cannot run a script on the page', async ({ page }) => {
  const roadmap = JSON.parse(readFileSync(join(DIR, 'roadmap.json'), 'utf8'));
  roadmap.icons.icons.bulb = '<image href="data:," onerror="window.ran = 1"/>';
  roadmap.icons.icons.code = '<path d="M1 1h2"/><script>window.ran = 2</script>';
  roadmap.icons.icons.rocket = '<foreignObject><img src="x" onerror="window.ran = 3"></foreignObject>';
  await landing(page, '/', { files: { 'roadmap.json': JSON.stringify(roadmap) } });
  await page.goto('https://landing.test/roadmap.html');
  await drawn(page);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await settle(page);
  for (const id of [ID.idea, ID.tricky, ID.release]) await expect(step(page, id).locator('.coin'), id).toHaveCount(0);
  await expect(step(page, ID['tests-1']).locator('.coin'), 'a plain drawing is drawn').toBeVisible();
  expect(await page.evaluate(() => (window as { ran?: number }).ran)).toBeUndefined();
});

test('the page says it is loading until roadmap.json comes', async ({ page }) => {
  let send = (): void => {};
  const sent = new Promise<void>(done => { send = done; });
  await landing(page);
  await page.route('https://landing.test/roadmap.json', async r => {
    await sent;
    await r.fulfill({ contentType: 'application/json', body: readFileSync(join(DIR, 'roadmap.json')) });
  });
  await page.goto('https://landing.test/roadmap.html');
  await page.waitForFunction(() => !!customElements.get('roadmapper-view'));
  await expect(waitLine(page)).toBeVisible();
  await expect(waitLine(page)).toHaveText('Loading the roadmap…');
  send();
  await drawn(page);
  await expect(waitLine(page)).toBeHidden();
});

test('when the host answers for the lib with a page of its own, the page says that the roadmap could not load', async ({ page, errors }) => {
  await landing(page, '/', { lib: false, ownPage: true });
  await page.goto('https://landing.test/roadmap');
  await expect(waitLine(page)).toHaveText(FAIL);
  // the browser runs the landing's page as the script, which fails
  expect(errors.length).toBeGreaterThan(0);
  errors.length = 0;
});

test('the export writes nothing for a broken roadmap and prints its errors as npm run validate does; a new export takes the place of the last one in its folder', async () => {
  const dir = test.info().outputPath('typed-here');
  const out = join(dir, 'out');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'broken.json'), '{ "title": "Broken", "branches": [], "about": 5 }');
  const broken = await runExport(['broken.json', 'out'], dir);
  expect(broken).toEqual({ code: 1, said: 'broken.json:1    about  Wrong type  5\nbroken.json:1    branches  Invalid value  []\n' });
  expect(existsSync(out)).toBe(false);

  copyFileSync(join(ROOT, 'tests/export/plan.json'), join(dir, 'plan.json'));
  // the paths are from the folder they were typed in
  const good = await runExport(['plan.json', 'out'], dir);
  expect(good.code, good.said).toBe(0);
  for (const f of ['roadmap.html', 'roadmap.json', 'roadmapper.js']) writeFileSync(join(out, f), 'an export before');
  const again = await runExport(['plan.json', 'out'], dir);
  expect(again.code, again.said).toBe(0);
  expect(readdirSync(out).sort()).toEqual(['roadmap.html', 'roadmap.json', 'roadmapper.js']);
  for (const f of ['roadmap.html', 'roadmap.json', 'roadmapper.js']) expect(readFileSync(join(out, f), 'utf8'), f).toBe(readFileSync(join(DIR, f), 'utf8'));
});

test('the export writes nothing into a folder that holds a file of its own, or only a part of an export, and prints the error with those files', async () => {
  const dir = test.info().outputPath('typed-here');
  const out = join(dir, 'out');
  mkdirSync(join(dir, 'deeper', 'down'), { recursive: true });
  copyFileSync(join(ROOT, 'tests/export/plan.json'), join(dir, 'plan.json'));
  expect((await runExport(['plan.json', 'out'], dir)).code).toBe(0);
  writeFileSync(join(out, 'notes.txt'), 'mine');
  const before = Object.fromEntries(readdirSync(out).map(f => [f, readFileSync(join(out, f), 'utf8')]));
  expect(await runExport(['plan.json', 'out'], dir)).toEqual({ code: 1, said: 'out  Folder not empty  notes.txt\n' });
  expect(Object.fromEntries(readdirSync(out).map(f => [f, readFileSync(join(out, f), 'utf8')]))).toEqual(before);

  // a roadmap.json alone may be someone's roadmap file
  mkdirSync(join(dir, 'theirs'));
  writeFileSync(join(dir, 'theirs', 'roadmap.json'), 'their roadmap');
  expect(await runExport(['plan.json', 'theirs'], dir)).toEqual({ code: 1, said: 'theirs  Folder not empty  roadmap.json\n' });
  expect(readFileSync(join(dir, 'theirs', 'roadmap.json'), 'utf8')).toBe('their roadmap');

  expect(await runExport(['plan.json', '.'], dir)).toEqual({ code: 1, said: '.  Folder not empty  deeper/, out/, plan.json, theirs/\n' });
  const down = join(dir, 'deeper', 'down');
  expect(await runExport(['../../plan.json', '..'], down)).toEqual({ code: 1, said: '..  Folder not empty  down/\n' });
  expect(readdirSync(dir).sort()).toEqual(['deeper', 'out', 'plan.json', 'theirs']);
  expect(readdirSync(join(dir, 'deeper'))).toEqual(['down']);
});

test('the export writes nothing when everything is private, and never writes over the roadmap it reads', async () => {
  const dir = test.info().outputPath('typed-here');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'all.json'), JSON.stringify({ title: 'All mine', branches: [{ name: 'Mine', private: true, items: [{ id: 'a', name: 'A' }] }] }));
  const all = await runExport(['all.json', 'out'], dir);
  expect(all).toEqual({ code: 1, said: 'all.json  Nothing public  \n' });
  expect(existsSync(join(dir, 'out'))).toBe(false);

  const plan = readFileSync(join(ROOT, 'tests/export/plan.json'), 'utf8');
  writeFileSync(join(dir, 'roadmap.json'), plan);
  const over = await runExport(['roadmap.json', '.'], dir);
  expect(over).toEqual({ code: 1, said: '.  Folder not empty  all.json\n' });
  expect(readFileSync(join(dir, 'roadmap.json'), 'utf8')).toBe(plan);

  // the same file by another name, through a link, in a folder that holds an export
  mkdirSync(join(dir, 'linked'));
  for (const f of ['roadmap.html', 'roadmapper.js']) copyFileSync(join(DIR, f), join(dir, 'linked', f));
  linkSync(join(dir, 'roadmap.json'), join(dir, 'linked', 'roadmap.json'));
  const linked = await runExport(['roadmap.json', 'linked'], dir);
  expect(linked).toEqual({ code: 1, said: 'linked  Folder not empty  roadmap.json\n' });
  expect(readFileSync(join(dir, 'roadmap.json'), 'utf8')).toBe(plan);
});

test('a roadmap file that is not there: the export prints its error as npm run validate does, also into a folder that holds an export', async () => {
  const dir = test.info().outputPath('typed-here');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(ROOT, 'tests/export/plan.json'), join(dir, 'plan.json'));
  expect((await runExport(['plan.json', 'out'], dir)).code).toBe(0);
  const typo = await runExport(['plna.json', 'out'], dir);
  expect(typo.code).toBe(1);
  expect(typo.said).toBe('plna.json:      Unreadable file  \n');
});
