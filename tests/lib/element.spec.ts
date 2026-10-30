// <roadmapper-view> in a box on another page (src/lib/element.ts), on the made-up React app of tests/pages/embed/: the box keeps the view in its shadow root,
// the page keeps its wheel, its scroll, its looks and its keys while the box has not the focus, and nothing of the view gets out of the box.
import type { Locator, Page } from '@playwright/test';
import { boxesDrawn, EMBED, errorList, errorRows, expect, level, levels, openEmbed, popup, settle, side, step, test, tip, zoomTo } from '../support/helpers';
import { flat, full } from '../support/plans';

/** The background of the view and the ring of a step, in each mode, as the theme sets them. */
const BG = { light: 'rgb(244, 246, 251)', dark: 'rgb(10, 18, 36)' };
const LINE = { light: 'rgb(11, 122, 140)', dark: 'rgb(86, 207, 225)' };

/** The box: the tag <roadmapper-view>, the first on the page. */
const theBox = (page: Page): Locator => page.locator('roadmapper-view').first();
/** How far down the page is scrolled. */
const scrolled = (page: Page): Promise<number> => page.evaluate(() => scrollY);
/** The ring of the first step in a box. */
const ring = (box: Locator): Locator => box.locator('svg.plan g.zn .node .ring').first();

/** Clicks and waits until the plan is at rest. */
async function press(page: Page, where: Locator): Promise<void> {
  await where.click();
  await settle(page);
}
/** Presses a key and waits until the plan is at rest. */
async function key(page: Page, name: string): Promise<void> {
  await page.keyboard.press(name);
  await settle(page);
}
/** Clicks the title of a box, where a click picks nothing: the box takes the focus. */
async function focusIn(page: Page, box: Locator): Promise<void> {
  await press(page, box.locator('.roadmap .title'));
}
/** Where a step is in the box, and how wide: its place from the corner of the box, which a scroll of the page does not change. */
async function inBox(page: Page, id: string): Promise<{ x: number; y: number; width: number }> {
  const s = (await step(page, id).boundingBox())!, b = (await theBox(page).boundingBox())!;
  return { x: s.x - b.x, y: s.y - b.y, width: s.width };
}
/** Is a part of the view inside the box? */
async function insideBox(page: Page, part: Locator): Promise<void> {
  const p = (await part.boundingBox())!, b = (await theBox(page).boundingBox())!;
  expect(p.x, 'inside the box').toBeGreaterThanOrEqual(b.x);
  expect(p.y).toBeGreaterThanOrEqual(b.y);
  expect(p.x + p.width).toBeLessThanOrEqual(b.x + b.width);
  expect(p.y + p.height).toBeLessThanOrEqual(b.y + b.height);
}
/** The middle of the box on the screen. */
async function middleOfBox(page: Page): Promise<[number, number]> {
  const b = (await theBox(page).boundingBox())!;
  return [b.x + b.width / 2, b.y + b.height / 2];
}
/** Turns the wheel a notch with Ctrl held, as a pinch does, at a point, and waits for the view to rest. */
async function ctrlWheel(page: Page, [x, y]: [number, number], dy: number): Promise<void> {
  await page.mouse.move(x, y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, dy);
  await page.keyboard.up('Control');
  await settle(page);
}

/** What the parts of the page compute to, each by its place in the page: all but the place of the box and what is in it.
 * The page, its body and its main part hold the box, so they are as high as it makes them. */
const pageLooks = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() => {
    const keys = ['display', 'position', 'z-index', 'width', 'height', 'box-sizing', 'font-family', 'font-size', 'line-height', 'letter-spacing',
      'text-align', 'text-transform', 'color', 'background-color', 'fill', 'border-radius', 'transform'];
    const place = document.querySelector('#app')!, root = getComputedStyle(document.documentElement), looks: Record<string, string> = {};
    for (const v of ['--bg', '--ink', '--line', '--name']) looks[`:root ${v}`] = root.getPropertyValue(v);
    [...document.querySelectorAll('html, body, body *')].filter(e => !place.contains(e)).forEach((e, i) => {
      const s = getComputedStyle(e), holds = e.contains(place);
      for (const k of keys) if (!(holds && k === 'height')) looks[`${i} ${e.localName}.${e.className} ${k}`] = s.getPropertyValue(k);
    });
    return looks;
  });
/** How many points on the screen, 40 px apart, show the box. */
const boxShows = (page: Page): Promise<number> =>
  page.evaluate(() => {
    let n = 0;
    for (let x = 2; x < innerWidth; x += 40) for (let y = 2; y < innerHeight; y += 40) if (document.elementFromPoint(x, y)?.closest('roadmapper-view')) n++;
    return n;
  });

test('the box draws, and takes the keys only with the focus', async ({ page }) => {
  await openEmbed(page, { plan: full });
  const box = theBox(page), search = page.locator('#search');

  await test.step('the box draws in its own shadow root, 560 px high', async () => {
    await expect(page.getByRole('region', { name: 'Roadmap: Test plan' })).toBeVisible();
    await expect(box.locator('.roadmap .title')).toHaveText('Test plan');
    expect(await levels(page)).toEqual(['Main steps', 'Tracks', 'Every step']);
    await expect(step(page, 'kickoff').locator('.ic .art')).toBeVisible();
    await expect(errorList(page)).toBeHidden();
    // nothing of the view is in the page itself
    expect(await page.evaluate(() => [!!document.querySelector('.roadmap, svg.plan'), !!document.querySelector('roadmapper-view')!.shadowRoot!.querySelector('.roadmap svg.plan')]))
      .toEqual([false, true]);
    const b = (await box.boundingBox())!, place = (await page.locator('#app').boundingBox())!;
    expect(b.height).toBe(560);
    expect(b.width).toBe(place.width);
  });

  await test.step('with the page focused, + does nothing and the arrows scroll it', async () => {
    await key(page, '+');
    expect(await level(page)).toBe('Main steps');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => scrolled(page), { intervals: [20] }).toBe(40);
    await page.evaluate(() => scrollTo(0, 0));
  });

  await test.step("a click in the box gives it the keys: + shows 'Tracks'", async () => {
    await focusIn(page, box);
    await expect(box).toBeFocused();
    await key(page, '+');
    expect(await level(page)).toBe('Tracks');
    await key(page, 'ArrowDown');
    expect(await scrolled(page), 'the arrows leave the page where it is').toBe(0);
  });

  await test.step("+, − and i typed into the page's search field stay there", async () => {
    await search.click();
    await page.keyboard.type('+-i');
    await settle(page);
    await expect(search).toHaveValue('+-i');
    expect(await level(page)).toBe('Tracks');
    // the switch is in the popup, shut: its state is read without a click, which would take the focus
    await expect(popup(page).getByRole('switch', { name: 'Hide node icons', includeHidden: true })).toHaveAttribute('aria-checked', 'false');
  });

  await test.step('a click out of the box takes the keys from it', async () => {
    await page.locator('main > h1').click();
    await expect(box).not.toBeFocused();
    await key(page, '-');
    expect(await level(page)).toBe('Tracks');
  });
});

test('the pointer moves or scales the plan, or scrolls the page', async ({ page }) => {
  await openEmbed(page, { plan: full });
  const box = theBox(page);

  await test.step('Ctrl and the wheel scale the plan, and the page stays', async () => {
    await page.evaluate(() => scrollTo(0, 100));
    const was = await inBox(page, 'kickoff');
    await ctrlWheel(page, await middleOfBox(page), -100);
    expect((await inBox(page, 'kickoff')).width, 'scaled in').toBeGreaterThan(was.width * 1.1);
    expect(await scrolled(page)).toBe(100);
    await ctrlWheel(page, await middleOfBox(page), 100);
    expect((await inBox(page, 'kickoff')).width, 'and out').toBeCloseTo(was.width, 0);
    expect(await scrolled(page)).toBe(100);
    expect(await level(page)).toBe('Main steps');
    await page.evaluate(() => scrollTo(0, 0));
  });

  await test.step('the wheel over the box scrolls the page, and the plan stays', async () => {
    // a plan wider and higher than the box
    await zoomTo(page, 'Every step');
    const was = await inBox(page, 'kickoff');
    await page.mouse.move(...(await middleOfBox(page)));
    await page.mouse.wheel(0, 200);
    await expect.poll(() => scrolled(page), { intervals: [20] }).toBe(200);
    expect(await inBox(page, 'kickoff')).toEqual(was);
    await page.mouse.wheel(0, -200);
    await expect.poll(() => scrolled(page), { intervals: [20] }).toBe(0);
    expect(await inBox(page, 'kickoff')).toEqual(was);
  });

  await test.step('a drag in the box moves the plan, and not the page', async () => {
    await box.locator('.stage').evaluate(s => { s.scrollLeft = 0; s.scrollTop = 0; });
    await settle(page);
    const was = await inBox(page, 'kickoff'), [x, y] = await middleOfBox(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 300, y - 60, { steps: 6 });
    await page.mouse.up();
    await settle(page);
    const now = await inBox(page, 'kickoff');
    expect(now.x).toBeCloseTo(was.x - 300, 0);
    expect(now.y).toBeCloseTo(was.y - 60, 0);
    expect(await scrolled(page)).toBe(0);
  });
});

test('the popup, tip, side bar and error list stay inside the box', async ({ page, errors }) => {
  await openEmbed(page, { plan: full });
  const box = theBox(page);

  await test.step("the popup holds 'Key' and 'View', and no 'Export'", async () => {
    await press(page, box.locator('.zoom .tools'));
    const tools = box.getByRole('dialog', { name: 'Tools' });
    await expect(tools).toBeVisible();
    await expect(tools.locator('button.fold')).toHaveText(['Key', 'View']);
    await expect(tools.locator('hr')).toHaveCount(1);
    await expect(tools.getByRole('switch', { name: 'Include private items', includeHidden: true })).toHaveCount(0);
    await expect(tools.locator('button.export')).toHaveCount(0);
    await expect(tools.getByRole('button', { name: 'Export', includeHidden: true })).toHaveCount(0);
    const view = tools.locator('button.fold', { hasText: 'View' });
    await view.click();
    await expect(view).toHaveAttribute('aria-expanded', 'false');
    await expect(tools.getByRole('switch', { name: 'Hide labels' })).toBeHidden();
    await key(page, 'Escape');
    await expect(tools).toBeHidden();
  });

  await test.step("nothing of the box shows under the page's header or past it", async () => {
    await press(page, step(page, 'plan'));
    await step(page, 'kickoff').hover();
    await expect(side(page)).toBeVisible();
    await expect(tip(page)).toBeVisible();
    const b = (await box.boundingBox())!, header = (await page.locator('header.top').boundingBox())!;
    const parts = [side(page), tip(page), box.locator('.zoom')];
    expect(await boxShows(page), 'in sight at first').toBeGreaterThan(0);
    // its foot under the header: the header shows over it
    await page.evaluate(y => scrollTo(0, y), b.y + b.height - 40);
    expect(await boxShows(page)).toBe(0);
    for (const part of parts) {
      const r = await part.boundingBox();
      if (r) expect(r.y + r.height, 'under the header').toBeLessThanOrEqual(header.height);
    }
    // past it: no part of it is on the screen
    await page.evaluate(y => scrollTo(0, y), b.y + b.height + 200);
    expect(await boxShows(page)).toBe(0);
    for (const part of parts) {
      const r = await part.boundingBox();
      if (r) expect(r.y + r.height, 'above the screen').toBeLessThanOrEqual(0);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await press(page, side(page).getByRole('button', { name: 'Close' }));
  });

  await test.step('the tip, side bar and zoom control show inside the box', async () => {
    await page.evaluate(() => scrollTo(0, 120));
    await step(page, 'kickoff').hover();
    await expect(tip(page)).toBeVisible();
    await insideBox(page, tip(page));
    await press(page, step(page, 'kickoff'));
    await expect(side(page)).toBeVisible();
    await insideBox(page, side(page));
    await insideBox(page, box.locator('.zoom'));
    expect(await scrolled(page)).toBe(120);
  });

  await test.step('× closes the side bar, and the box keeps the focus', async () => {
    await press(page, side(page).getByRole('button', { name: 'Close' }));
    await expect(side(page)).toBeHidden();
    expect(await scrolled(page)).toBe(120);
    await expect(box).toBeFocused();
    await key(page, '+');
    expect(await level(page)).toBe('Tracks');
  });

  await test.step('Escape on × closes the side bar; the box keeps the keys', async () => {
    await press(page, step(page, 'kickoff'));
    await side(page).getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
    await expect(box).toBeFocused();
    await key(page, '+');
    expect(await level(page)).toBe('Every step');
  });

  await test.step('a broken roadmap shows its error list until it is fixed', async () => {
    await page.evaluate(() => window.setRoadmap('{ "title": "T", "branches": [] }'));
    await expect(errorList(page)).toBeVisible();
    await expect(errorList(page).locator('.title')).toHaveText('T');
    await expect(errorList(page).locator('.file')).toHaveCount(0);
    expect(await errorRows(page)).toEqual(['1    branches  Invalid value  []']);
    await insideBox(page, errorList(page));
    await expect(step(page, 'kickoff')).toBeHidden();
    await page.evaluate(p => window.setRoadmap(p), full);
    await settle(page);
    await expect(errorList(page)).toBeHidden();
    await expect(step(page, 'kickoff')).toBeVisible();
  });

  await test.step('a src that does not come shows the error in the box', async () => {
    // as <Roadmap src> writes it
    await box.evaluate(b => b.setAttribute('src', 'missing.json'));
    await expect(errorList(page).locator('.file')).toHaveText('missing.json');
    expect(await errorRows(page)).toEqual(['      Unreadable file  missing.json']);
    await insideBox(page, errorList(page));
    // the browser and the box say so on the console as well: errors that are meant
    expect(errors).toContainEqual(expect.stringContaining('Roadmapper: the roadmap at missing.json did not come.'));
    errors.splice(0, errors.length, ...errors.filter(e => !e.includes('missing.json')));
  });
});

test('the box changes nothing of the page, and keeps its own mode', async ({ page }) => {
  // an address that would hold the app's page at 'Every step' with no icons
  await page.goto(`${EMBED}#/settings&z=2&u=0`);
  const before = await pageLooks(page);
  await page.evaluate(p => { window.setRoadmap(p); window.remount(); }, full);
  await boxesDrawn(page);
  const box = theBox(page), view = box.locator('.roadmap');

  await test.step('the page looks the same before and after the box draws', async () => {
    expect(await pageLooks(page)).toEqual(before);
  });

  await test.step("the page's CSS does not reach into the box", async () => {
    // the page's root of 10 px, its font, its colors under the theme's names, its border-box, its round buttons in capitals, its fill of svg and its class names
    for (const [prop, value] of [['font-size', '16px'], ['line-height', '24px'], ['letter-spacing', 'normal'], ['text-align', 'start'],
      ['background-color', BG.dark], ['color', 'rgb(232, 238, 249)']]) await expect(view, prop).toHaveCSS(prop, value);
    await expect(view).toHaveCSS('font-family', /^"Atkinson Hyperlegible"/);
    await expect(view.locator('.title')).toHaveCSS('font-size', '12.8px');
    await expect(view.locator('.title')).toHaveCSS('color', 'rgb(132, 148, 178)');
    await expect(view.locator('.stage')).toHaveCSS('box-sizing', 'content-box');
    await expect(view.locator('.zoom .step').first()).toHaveCSS('border-radius', '12px');
    await expect(view.locator('.zoom .stop').first()).toHaveCSS('text-transform', 'none');
    await expect(view.locator('.zoom .stop').first()).toHaveCSS('font-size', '13.6px');
    await expect(view.locator('svg.plan')).toHaveCSS('fill', 'rgb(0, 0, 0)');
    await expect(view.locator('.popup .key')).toHaveCSS('display', 'grid');
    await expect(view.locator('.zoom')).toHaveCSS('position', 'absolute');
  });

  await test.step("the box reads no address: it opens at 'Main steps', with icons", async () => {
    expect(await level(page)).toBe('Main steps');
    await expect(box.locator('svg.plan .zn .art').first()).toBeVisible();
  });

  const named = page.locator('#named');
  await test.step('a box the page names keeps that name', async () => {
    await page.evaluate(p => {
      const box = document.createElement('roadmapper-view') as HTMLElement & { roadmap: unknown };
      box.id = 'named';
      box.setAttribute('aria-label', 'Our plan');
      box.roadmap = p;
      document.querySelector('main')!.append(box);
    }, flat);
    await expect(named.locator('.roadmap .title')).toHaveText('Flat plan');
    await expect(named).toHaveAttribute('aria-label', 'Our plan');
  });

  await test.step("'Light' draws only its own box, and the page stays", async () => {
    await settle(page);
    const looks = await pageLooks(page);
    await box.locator('.zoom').getByRole('button', { name: 'Tools', exact: true }).click();
    await box.getByRole('radio', { name: 'Light' }).click();
    await expect(view).toHaveCSS('background-color', BG.light);
    await expect(view).toHaveCSS('color-scheme', 'light');
    await expect(ring(box)).toHaveCSS('stroke', LINE.light);
    await expect(box.locator('.popup')).toHaveCSS('color', 'rgb(16, 27, 51)');
    await expect(named.locator('.roadmap'), 'the other box').toHaveCSS('background-color', BG.dark);
    await expect(ring(named), 'the other box').toHaveCSS('stroke', LINE.dark);
    expect(await pageLooks(page)).toEqual(looks);
  });

  await test.step('the hidden attribute hides the box', async () => {
    await box.evaluate(b => { (b as HTMLElement).hidden = true; });
    await expect(box).toBeHidden();
  });

  await test.step("the box keeps nothing: a new box starts in 'Device'", async () => {
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    await page.evaluate(() => { window.unmount(); window.remount(); });
    await boxesDrawn(page);
    await expect(theBox(page).locator('.roadmap')).toHaveCSS('background-color', BG.dark);
    await expect(theBox(page).getByRole('radio', { name: 'Device', includeHidden: true })).toHaveAttribute('aria-checked', 'true');
  });
});
