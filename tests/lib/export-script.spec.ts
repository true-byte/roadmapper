// The page of the HTML export and its lib (src/lib/export-script.ts): what the page draws and does, on a made-up site, in a box on a page of that site, and from disk.
// npm test exports tests/fixtures/export.json into dist/tests/export. The tests serve those files from https://landing.test themselves, or open them from disk.
/// <reference types="node" />
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { errorList, expect, flowOf, labelsSwitch, level, nameOf, pickLayout, popup, settle, showLabels, side, step, test } from '../support/helpers';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIR = join(ROOT, 'dist/tests/export');
const FAIL = 'The roadmap could not load: roadmapper.js did not run.';
/** The ids the export gives the steps of tests/fixtures/export.json that a stranger sees: s1, s2 and on, in reading order. */
const ID = { idea: 's1', tricky: 's2', 'code-1': 's3', 'tests-1': 's6', 'tests-2': 's7', release: 's9', party: 's11' };
/** The background of the view and the line of a step, in each mode, as the theme sets them. */
const BG = { light: 'rgb(244, 246, 251)', dark: 'rgb(10, 18, 36)' };
const LINE = { light: 'rgb(11, 122, 140)', dark: 'rgb(86, 207, 225)' };

/** A file of the export, as text. */
const exported = (name: string): string => readFileSync(join(DIR, name), 'utf8');
/** The line the page shows until the lib runs, or when it does not. */
const waitLine = (page: Page): Locator => page.locator('#roadmapper-wait');
/** A button of the mode in the popup: 'Device', 'Light' or 'Dark'. */
const mode = (page: Page, name: string): Locator => popup(page).getByRole('radio', { name, includeHidden: true });
/** The lines of an icon, as its paths draw them. */
const linesOf = (art: string): string[] => [...art.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
/** The roadmap the tag of the page holds, parsed. */
const held = (page: Page): Promise<unknown[]> => page.locator('roadmapper-view > script[type="application/json"]').evaluateAll(s => s.map(e => JSON.parse(e.textContent!)));
/** The name of a step, all its lines as one text. */
const nameText = async (page: Page, id: string): Promise<string> => (await nameOf(page, id).allTextContents()).join(' ');

/** How big a step's name is on the screen right now, in px: the plan is in the shadow root of the tag, where the helper's document.querySelector does not look. */
const nameSize = (page: Page): Promise<number> =>
  page.locator('svg.plan').evaluate(svg => {
    const plan = svg as SVGSVGElement, label = plan.querySelector('text.label')!;
    return (parseFloat(getComputedStyle(label).fontSize) * plan.getBoundingClientRect().width) / plan.viewBox.baseVal.width;
  });

/** Drops the one error the browser logs for a page opened from disk: it does not let the page read roadmap.json. The lib itself logs none. */
const fromDisk = (errors: string[]): void => {
  errors.splice(0, errors.length, ...errors.filter(e => !/^Fetch API cannot load file:.*\/roadmap\.json\. URL scheme "file" is not supported\.$/.test(e)));
};

/** Waits until the plan is drawn and at rest. */
async function drawn(page: Page): Promise<void> {
  await expect(page.locator('svg.plan')).toBeVisible();
  await settle(page);
}
/** Goes to 'Every step' with the keys, which are the page's with no click first. */
async function everyStep(page: Page): Promise<void> {
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await settle(page);
}
/** Clicks a step and waits until the plan is at rest. */
async function pick(page: Page, id: string): Promise<void> {
  await step(page, id).click();
  await settle(page);
}

/** A made-up site at https://landing.test: the export's files in the folder `at`, the page also without its .html, and the pages in `pages`,
 * and for any other address a 404, or with `ownPage` the site's own page, as a host that serves a one-page app does. `files` puts other text in place of a file. */
async function landing(page: Page, at = '/', o: { lib?: boolean; ownPage?: boolean; files?: Record<string, string>; pages?: Record<string, string> } = {}): Promise<void> {
  const file = (name: string): string | Buffer => o.files?.[name] ?? readFileSync(join(DIR, name));
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
/** Opens the export at an address of the made-up site, with the export in the folder of that address, and waits until the plan is drawn and at rest. */
async function openExport(page: Page, address = '/roadmap.html', files?: Record<string, string>): Promise<void> {
  await landing(page, address.replace(/[^/]*$/, ''), { files });
  await page.goto(`https://landing.test${address}`);
  await drawn(page);
}

/** Runs `npx roadmapper export <file> out` from the package's own command, in the folder `dir`. */
function runExport(dir: string, file: string): Promise<void> {
  return new Promise((done, failed) => {
    execFile(process.execPath, [join(ROOT, 'dist/cli/roadmapper.js'), 'export', file, 'out'], { cwd: dir }, (e, out, err) => (e ? failed(new Error(out + err)) : done()));
  });
}

test.use({ offline: false });
// the web fonts of the theme never come, as in the specs that run offline: the page draws in the fallback fonts, and never draws its names again at a moment that the network sets
test.beforeEach(async ({ context }) => {
  await context.route('https://fonts.googleapis.com/**', r => r.abort());
});

test('the page draws the public roadmap', async ({ page }) => {
  await openExport(page);

  await test.step('the page fills the window', async () => {
    expect(await page.locator('roadmapper-view').boundingBox()).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
    await expect(waitLine(page)).toBeHidden();
  });

  await test.step('the head holds the title, and the about line as its description', async () => {
    expect(await page.title()).toBe('Launch &amp; </title> <Grow> · roadmap');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'A made-up plan for the export tests: "quotes", <tags> and & in its words.');
    await expect(page.locator('.roadmap .head')).not.toContainText('A made-up plan');
  });

  await test.step("a title and a name with '</script>' and '<!--' are drawn whole", async () => {
    await expect(page.locator('.roadmap .title')).toHaveText(/Launch &amp; <\/title> <Grow>/i);
    expect(await nameText(page, ID.tricky)).toBe('Ends </script><!-- here');
  });

  await test.step('the gear draws from the icons in roadmap.json', async () => {
    const last = page.locator('.zoom > :last-child');
    await expect(last).toHaveAttribute('aria-label', 'Tools');
    const lines = await last.locator('svg path').evaluateAll(ps => ps.map(p => p.getAttribute('d')));
    expect(lines).toEqual(linesOf(JSON.parse(exported('roadmap.json')).icons.icons.settings));
  });

  await test.step('the steps draw the icons in roadmap.json', async () => {
    await everyStep(page);
    for (const id of [ID.idea, ID.tricky, ID['code-1'], ID['tests-1'], ID.release]) await expect(step(page, id).locator('.coin'), id).toBeVisible();
    expect(await step(page, ID['code-1']).locator('.ic .art').innerHTML()).toContain('m7 8l-4 4l4 4');
    await expect(step(page, ID['tests-2']).locator('.coin'), 'an icon the set has not keeps the mark').toHaveCount(0);
  });

  await test.step('only the public steps are drawn', async () => {
    const names = await page.locator('svg.plan text').allTextContents();
    expect(names.join(' ')).not.toMatch(/Secret|Payroll|Hidden|Pricing|Internal/);
    expect(await page.locator('svg.plan g.zn[data-id]').count()).toBe(11);
  });

  await test.step('a step that waits for private work shows blocked, not by what', async () => {
    await expect(nameOf(page, ID.party)).toHaveClass(/\bblocked\b/);
    await pick(page, ID.party);
    await expect(side(page)).toContainText('Launch party');
    await expect(side(page).locator('.facts')).toHaveText('Blocked');
    await expect(side(page).locator('section.part h3', { hasText: 'Blocked by' })).toHaveCount(0);
    // a step whose line holds shown open work too is as the file says
    await expect(nameOf(page, ID.release)).toHaveClass(/\btodo\b/);
  });

  await test.step('the side bar of a step shows no days', async () => {
    await pick(page, ID['code-1']);
    await expect(side(page).locator('h2')).toHaveText('Code one');
    await expect(side(page).locator('section.part h3', { hasText: /Planned|Deadline/ })).toHaveCount(0);
  });

  await test.step("the side bar draws a step's links with their icons", async () => {
    await pick(page, ID.release);
    const rows = side(page).locator('a.row');
    await expect(rows).toHaveText(['Release notes', 'Tag']);
    await expect(rows.first()).toHaveAttribute('href', 'https://example.com/notes');
    // each row draws its icon and the arrow, and the heading its chevron: no sign in place of a drawing the export left out
    for (const row of await rows.all()) await expect(row.locator('svg')).toHaveCount(2);
    await expect(side(page).locator('.fold svg')).toHaveCount(1);
    expect(await rows.nth(0).locator('svg').first().innerHTML()).not.toBe(await rows.nth(1).locator('svg').first().innerHTML());
  });
});

test("the popup holds 'Key' and 'View', and the page keeps nothing", async ({ page }) => {
  await openExport(page);

  await test.step("the popup holds 'Key' and 'View', and no 'Export'", async () => {
    await page.locator('.zoom .tools').click();
    await expect(popup(page)).toBeVisible();
    const folds = popup(page).locator('button.fold');
    await expect(folds).toHaveText(['Key', 'View']);
    await expect(popup(page).locator('hr')).toHaveCount(1);
    await expect(popup(page).locator('section').last().getByRole('radiogroup', { name: 'Mode' })).toBeVisible();
    await expect(popup(page).getByRole('switch', { name: 'Include private items', includeHidden: true })).toHaveCount(0);
    await expect(popup(page).locator('button.export')).toHaveCount(0);
    await expect(popup(page).getByRole('button', { name: 'Export', includeHidden: true })).toHaveCount(0);
    await folds.first().click();
    await expect(folds.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(popup(page).locator('.key')).toBeHidden();
    await expect(folds.first().locator('svg'), 'the chevron, from the icons in roadmap.json').toHaveCSS('transform', 'matrix(0, -1, 1, 0, 0, 0)');
  });

  const view = page.locator('.roadmap');
  await test.step("'Light' and 'Dark' draw the page in that mode, whatever the device", async () => {
    await expect(view).toHaveCSS('background-color', BG.dark);
    await mode(page, 'Light').click();
    await expect(view).toHaveCSS('background-color', BG.light);
    await expect(view).toHaveCSS('color-scheme', 'light');
    await expect(view.locator('svg.plan .lane').first()).toHaveCSS('stroke', LINE.light);
    await expect(popup(page)).toHaveCSS('color', 'rgb(16, 27, 51)');
    await page.emulateMedia({ colorScheme: 'light' });
    await mode(page, 'Dark').click();
    await expect(view).toHaveCSS('background-color', BG.dark);
    await expect(view.locator('svg.plan .lane').first()).toHaveCSS('stroke', LINE.dark);
  });

  await test.step('the next visit starts with labels shown, as the device is set', async () => {
    // a pick of the layout and hidden labels hold only for the visit
    await pickLayout(page, 'Vertical');
    expect(await flowOf(page)).toBe('v');
    await showLabels(page, false);
    await expect(nameOf(page, ID.idea).first()).toBeHidden();
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    await page.reload();
    await drawn(page);
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(nameOf(page, ID.idea).first()).toBeVisible();
    expect(await flowOf(page)).toBe('h');
    await expect(view).toHaveCSS('background-color', BG.light);
    await expect(mode(page, 'Device')).toHaveAttribute('aria-checked', 'true');
  });
});

test('the keys and the wheel move the plan with no click first', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  // the page also without its .html
  await openExport(page, '/roadmap');
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
  expect(await page.evaluate(() => [scrollX, scrollY]), 'the window never scrolls').toEqual([0, 0]);
});

test('Ctrl and the wheel scale the plan; the wheel scrolls it sideways', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  // in a folder of the site, the page also without its .html
  await openExport(page, '/en/plans/roadmap');
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
  expect(await page.evaluate(() => [scrollX, scrollY]), 'the window never scrolls').toEqual([0, 0]);
});

test('roadmap.json on the site wins over the copy the page holds', async ({ page }) => {
  const roadmap = JSON.parse(exported('roadmap.json'));
  roadmap.title = 'A new title';
  roadmap.branches[0].items[0].name = 'A new idea';
  // icons that are more than a drawing
  roadmap.icons.icons.bulb = '<image href="data:," onerror="window.ran = 1"/>';
  roadmap.icons.icons.code = '<path d="M1 1h2"/><script>window.ran = 2</script>';
  roadmap.icons.icons.rocket = '<foreignObject><img src="x" onerror="window.ran = 3"></foreignObject>';
  expect(exported('roadmap.html'), 'the copy is the roadmap before').not.toContain('A new');
  // in a folder of the site
  await openExport(page, '/en/plans/roadmap.html', { 'roadmap.json': JSON.stringify(roadmap) });

  await test.step('a new roadmap.json alone shows its title and its names', async () => {
    await expect(page.locator('.roadmap .title')).toHaveText(/A new title/i);
    expect(await page.title()).toBe('A new title · roadmap');
    expect(await nameText(page, ID.idea)).toBe('A new idea');
  });

  await test.step('an icon with more than a drawing runs nothing: the mark shows', async () => {
    await everyStep(page);
    for (const id of [ID.idea, ID.tricky, ID.release]) await expect(step(page, id).locator('.coin'), id).toHaveCount(0);
    await expect(step(page, ID['tests-1']).locator('.coin'), 'a plain drawing is drawn').toBeVisible();
    expect(await page.evaluate(() => (window as { ran?: number }).ran)).toBeUndefined();
  });
});

test('the wait line says the roadmap loads, or could not load', async ({ page, errors }) => {
  await test.step('the wait line says it loads until roadmap.json comes', async () => {
    let send = (): void => {};
    const sent = new Promise<void>(done => { send = done; });
    await landing(page);
    await page.route('https://landing.test/roadmap.json', async r => {
      await sent;
      await r.fulfill({ contentType: 'application/json', body: exported('roadmap.json') });
    });
    await page.goto('https://landing.test/roadmap.html');
    await page.waitForFunction(() => !!customElements.get('roadmapper-view'));
    await expect(waitLine(page)).toHaveText('Loading the roadmap…');
    await expect(waitLine(page)).toBeVisible();
    send();
    await drawn(page);
    await expect(waitLine(page)).toBeHidden();
  });

  await test.step('with its lib missing, the line says the roadmap could not load', async () => {
    await page.unrouteAll();
    await landing(page, '/', { lib: false });
    await page.goto('https://landing.test/roadmap.html');
    await expect(waitLine(page)).toHaveText(FAIL);
    // the browser says the lib did not come
    errors.splice(0, errors.length, ...errors.filter(e => !e.includes('404')));
  });

  await test.step('a host page in place of the lib gets the same line', async () => {
    await page.unrouteAll();
    await landing(page, '/', { lib: false, ownPage: true });
    await page.goto('https://landing.test/roadmap');
    await expect(waitLine(page)).toHaveText(FAIL);
    // the browser runs the host's page as the script, which fails
    expect(errors.length).toBeGreaterThan(0);
    errors.length = 0;
  });
});

test('from disk, the page draws the copy it holds', async ({ page, errors }) => {
  // the color of the text of the page, which the browser gives by the color-scheme of the page: as the lib starts, when it makes <roadmapper-view> known,
  // so before it draws, and at the first frame. The lib can draw before the first frame or after it: nothing sets which comes first
  await page.addInitScript(() => {
    const w = window as unknown as { lib?: string; first?: string }, color = (): string => getComputedStyle(document.documentElement).color;
    const define = customElements.define.bind(customElements);
    customElements.define = (name, ...rest) => {
      if (name === 'roadmapper-view') w.lib ??= color();
      define(name, ...rest);
    };
    requestAnimationFrame(() => { w.first = color(); });
  });
  const seen = (): Promise<(string | undefined)[]> => page.evaluate(() => { const w = window as unknown as { lib?: string; first?: string }; return [w.lib, w.first]; });
  const view = page.locator('.roadmap');
  /** Opens a page of an export from disk on a device in a mode, and checks the mode as the lib starts, at the first frame, and once it draws. */
  async function openOn(device: 'light' | 'dark', file: string): Promise<void> {
    await page.emulateMedia({ colorScheme: device });
    await page.goto(pathToFileURL(file).href);
    // the lib comes as the page loads it from disk: a plain script with src
    await drawn(page);
    const text = device === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)';
    await expect.poll(seen, { message: 'as the lib starts, and at the first frame', intervals: [20] }).toEqual([text, text]);
    await expect(view).toHaveCSS('background-color', BG[device]);
    await expect(view.locator('svg.plan .lane').first()).toHaveCSS('stroke', LINE[device]);
  }

  await test.step('on a dark device, the page is dark from the first frame', async () => {
    await openOn('dark', join(DIR, 'roadmap.html'));
  });

  await test.step('the page draws its copy with its icons, and shows no error', async () => {
    await expect(waitLine(page)).toBeHidden();
    await expect(errorList(page)).toBeHidden();
    expect(await page.title()).toBe('Launch &amp; </title> <Grow> · roadmap');
    expect(await held(page), 'the copy is roadmap.json').toEqual([JSON.parse(exported('roadmap.json'))]);
    await everyStep(page);
    for (const id of [ID.idea, ID.tricky, ID['code-1'], ID['tests-1'], ID.release]) await expect(step(page, id).locator('.coin'), id).toBeVisible();
    expect(await nameText(page, ID.tricky)).toBe('Ends </script><!-- here');
  });

  // the export of a roadmap whose title and names hold the ends of the tags the page has
  const dir = mkdtempSync(join(tmpdir(), 'roadmapper-export-'));
  try {
    const title = '</script><script>window.ran = 1</script>';
    const names = ['Ends </SCRIPT > here', 'Opens <!--<script> here', 'Ends </roadmapper-view> here'];
    writeFileSync(join(dir, 'tricky.json'), JSON.stringify({ title, branches: [{ name: 'Main', items: names.map((name, i) => ({ id: `n${i}`, name })) }] }));
    await runExport(dir, 'tricky.json');

    await test.step('on a light device, the page is light from the first frame', async () => {
      await openOn('light', join(dir, 'out', 'roadmap.html'));
    });

    await test.step('no text of the roadmap ends the copy or runs a script', async () => {
      // the tag holds the copy whole, and what comes after it
      expect(await held(page)).toEqual([JSON.parse(readFileSync(join(dir, 'out', 'roadmap.json'), 'utf8'))]);
      await expect(page.locator('roadmapper-view > #roadmapper-wait')).toHaveCount(1);
      expect(await page.evaluate(() => (window as { ran?: number }).ran)).toBeUndefined();
      expect(await page.title()).toBe(`${title} · roadmap`);
      // the export gives the steps new ids, s1 and on; a long word of a name may break over two lines
      const bare = (s: string): string => s.replace(/\s/g, '');
      for (const [i, name] of names.entries()) expect(bare((await nameOf(page, `s${i + 1}`).allTextContents()).join(''))).toBe(bare(name));
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  fromDisk(errors);
});

test('a page of the site shows the roadmap with two lines', async ({ page }) => {
  const about = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>About us</title>
<script src="roadmapper.js" defer></script></head>
<body><h1>About us</h1><roadmapper-view src="roadmap.json"></roadmapper-view><p>More about us.</p></body></html>`;
  await landing(page, '/', { pages: { '/about.html': about } });
  await page.goto('https://landing.test/about.html');
  await drawn(page);

  await test.step('the box draws its icons, and leaves the title of the page', async () => {
    expect(await page.title()).toBe('About us');
    expect((await page.locator('roadmapper-view').boundingBox())?.height).toBe(560);
    await expect(step(page, ID.idea).locator('.coin')).toBeVisible();
  });

  await test.step('a new src draws the icons that the first file had not', async () => {
    const roadmap = JSON.parse(exported('roadmap.json'));
    roadmap.branches[0].items[1].icon = 'new-icon';
    roadmap.icons.icons['new-icon'] = '<path fill="none" stroke="currentColor" d="M1 1h22"/>';
    await page.route('https://landing.test/other.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...roadmap, title: 'Other' }) }));
    await page.locator('roadmapper-view').evaluate(e => e.setAttribute('src', 'other.json'));
    await expect(page.locator('.roadmap .title')).toHaveText(/Other/i);
    await settle(page);
    await expect(step(page, ID.tricky).locator('.coin')).toBeVisible();
    expect(await step(page, ID.tricky).locator('.ic .art').innerHTML()).toContain('M1 1h22');
  });
});
