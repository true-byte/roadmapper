// The lib on another project's page: <Roadmap> in a React app, and <roadmapper-view> on a page with no bundler. The view sits in a box there:
// the page keeps its wheel, its scroll, its looks and its keys while the box has not the focus, and nothing of the view gets out of the box.
import type { CDPSession, Locator, Page } from '@playwright/test';
import { boxesDrawn, EMBED, errorList, errorRows, expect, level, levels, openEmbed, PLAIN, settle, side, step, test, tip, zoomTo } from './helpers';
import { flat, full, plain } from './plans';

/** The box: the tag <roadmapper-view>, the first on the page. */
const theBox = (page: Page): Locator => page.locator('roadmapper-view').first();
/** How far down the page is scrolled. */
const scrolled = (page: Page): Promise<number> => page.evaluate(() => scrollY);
/** The name of the level asked for in one box, on a page with more than one. */
const levelIn = (box: Locator): Promise<string> => box.locator('.zoom .stop[aria-current="true"]').innerText();

/** Clicks and waits until the plan is at rest. */
async function press(page: Page, where: Locator): Promise<void> {
  await where.click();
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
/** How many listeners the page's own script has on the window, the document and its fonts: a view puts some there, and takes them off when it goes.
 * Playwright's own are left out: the script of the page is the one window.remount() is in. */
async function pageListeners(cdp: CDPSession): Promise<number> {
  const object = async (expression: string): Promise<string> => (await cdp.send('Runtime.evaluate', { expression })).result.objectId!;
  const { internalProperties } = await cdp.send('Runtime.getProperties', { objectId: await object('window.remount') });
  const script = (internalProperties!.find(p => p.name === '[[FunctionLocation]]')!.value!.value as { scriptId: string }).scriptId;
  let n = 0;
  for (const expression of ['window', 'document', 'document.fonts']) {
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: await object(expression) });
    n += listeners.filter(l => l.scriptId === script).length;
  }
  return n;
}

test.describe('<Roadmap> in a React app', () => {
  test("the box draws the roadmap in its own shadow root, with the icons of its steps, 560 px high, as a region named 'Roadmap: Test plan'", async ({ page }) => {
    await openEmbed(page, { plan: full });
    await expect(page.getByRole('region', { name: 'Roadmap: Test plan' })).toBeVisible();
    await expect(theBox(page).locator('.roadmap .title')).toHaveText('Test plan');
    expect(await levels(page)).toEqual(['Main steps', 'Tracks', 'Every step']);
    await expect(step(page, 'kickoff').locator('.ic .art')).toBeVisible();
    await expect(errorList(page)).toBeHidden();
    // nothing of the view is in the page itself
    expect(await page.evaluate(() => [!!document.querySelector('.roadmap, svg.plan'), !!document.querySelector('roadmapper-view')!.shadowRoot!.querySelector('.roadmap svg.plan')]))
      .toEqual([false, true]);
    const b = (await theBox(page).boundingBox())!, place = (await page.locator('#app').boundingBox())!;
    expect(b.height).toBe(560);
    expect(b.width).toBe(place.width);
  });

  test('the wheel up and down over the box scrolls the page, and the plan stays where it was', async ({ page }) => {
    await openEmbed(page, { plan: full });
    // a plan wider and higher than the box
    await zoomTo(page, 'Every step');
    const was = await inBox(page, 'kickoff');
    await page.mouse.move(...(await middleOfBox(page)));
    await page.mouse.wheel(0, 200);
    await expect.poll(() => scrolled(page)).toBe(200);
    expect(await inBox(page, 'kickoff')).toEqual(was);
    await page.mouse.wheel(0, -200);
    await expect.poll(() => scrolled(page)).toBe(0);
    expect(await inBox(page, 'kickoff')).toEqual(was);
  });

  test('a drag in the box moves the plan, and not the page', async ({ page }) => {
    await openEmbed(page, { plan: full });
    await zoomTo(page, 'Every step');
    await page.locator('roadmapper-view .stage').evaluate(s => { s.scrollLeft = 0; s.scrollTop = 0; });
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

  test('Ctrl and the wheel over the box scale the plan, and the page does not scroll', async ({ page }) => {
    await openEmbed(page, { plan: full });
    await page.evaluate(() => scrollTo(0, 100));
    const was = await inBox(page, 'kickoff');
    await ctrlWheel(page, await middleOfBox(page), -100);
    expect((await inBox(page, 'kickoff')).width, 'scaled in').toBeGreaterThan(was.width * 1.1);
    expect(await scrolled(page)).toBe(100);
    await ctrlWheel(page, await middleOfBox(page), 100);
    expect((await inBox(page, 'kickoff')).width, 'and out').toBeCloseTo(was.width, 0);
    expect(await scrolled(page)).toBe(100);
    expect(await level(page)).toBe('Main steps');
  });

  test("the keys are the box's only while it has the focus: a click in it gives it the focus, and what is typed into the page's search field stays there", async ({ page }) => {
    await openEmbed(page, { plan: full });
    const box = theBox(page), search = page.locator('#search');

    await test.step('with the focus on the page, + does nothing, and the arrows scroll the page', async () => {
      await page.keyboard.press('+');
      await settle(page);
      expect(await level(page)).toBe('Main steps');
      await page.keyboard.press('ArrowDown');
      await expect.poll(() => scrolled(page)).toBe(40);
      await page.evaluate(() => scrollTo(0, 0));
    });

    await test.step("a click in the box gives it the focus: + goes to 'Tracks', and the arrows leave the page where it is", async () => {
      await focusIn(page, box);
      await expect(box).toBeFocused();
      await page.keyboard.press('+');
      await settle(page);
      expect(await level(page)).toBe('Tracks');
      await page.keyboard.press('ArrowDown');
      await settle(page);
      expect(await scrolled(page)).toBe(0);
    });

    await test.step('typed into the search field of the page, + − and i stay in the field', async () => {
      await search.click();
      await page.keyboard.type('+-i');
      await settle(page);
      await expect(search).toHaveValue('+-i');
      expect(await level(page)).toBe('Tracks');
      // the switch is in the popup, shut: its state is read without a click, which would take the focus
      await expect(page.getByRole('switch', { name: 'Hide node icons', includeHidden: true })).toHaveAttribute('aria-checked', 'false');
    });

    await test.step('a click on the page out of the box takes the keys from it', async () => {
      await page.locator('main > h1').click();
      await expect(box).not.toBeFocused();
      await page.keyboard.press('-');
      await settle(page);
      expect(await level(page)).toBe('Tracks');
    });
  });

  test('a click on a step opens the side bar inside the box, as the tip and the zoom control are, and × closes it with the page where it was and the focus on the box', async ({ page }) => {
    await openEmbed(page, { plan: full });
    await page.evaluate(() => scrollTo(0, 120));
    await step(page, 'kickoff').hover();
    await expect(tip(page)).toBeVisible();
    await insideBox(page, tip(page));
    await press(page, step(page, 'kickoff'));
    await expect(side(page)).toBeVisible();
    await insideBox(page, side(page));
    await insideBox(page, page.locator('roadmapper-view .zoom'));
    expect(await scrolled(page)).toBe(120);
    await press(page, side(page).getByRole('button', { name: 'Close' }));
    await expect(side(page)).toBeHidden();
    expect(await scrolled(page)).toBe(120);
    await expect(theBox(page)).toBeFocused();
    await page.keyboard.press('+');
    await settle(page);
    expect(await level(page)).toBe('Tracks');
  });

  test('the page looks the same before and after the box is drawn, and its CSS does not reach into the box', async ({ page }) => {
    await openEmbed(page);
    const before = await pageLooks(page);
    await page.evaluate(p => { window.setRoadmap(p); window.remount(); }, full);
    await boxesDrawn(page);
    expect(await pageLooks(page)).toEqual(before);

    // the page's root of 10 px, its font, its colors under the theme's names, its border-box, its round buttons in capitals, its fill of svg and its class names
    const view = page.locator('roadmapper-view .roadmap');
    for (const [prop, value] of [['font-size', '16px'], ['line-height', '24px'], ['letter-spacing', 'normal'], ['text-align', 'start'],
      ['background-color', 'rgb(10, 18, 36)'], ['color', 'rgb(232, 238, 249)']]) await expect(view, prop).toHaveCSS(prop, value);
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

  test("the popup of the box ends with the layouts: it has no hairline after them, no switch 'Include private items' and no button 'Export'", async ({ page }) => {
    await openEmbed(page, { plan: full });
    await press(page, theBox(page).locator('.zoom .info'));
    const key = theBox(page).getByRole('dialog', { name: 'Key' });
    await expect(key).toBeVisible();
    await expect(key.locator('hr')).toHaveCount(1);
    await expect(key.getByRole('switch', { name: 'Include private items', includeHidden: true })).toHaveCount(0);
    await expect(key.locator('button.export')).toHaveCount(0);
    await expect(key.getByRole('button', { name: 'Export', includeHidden: true })).toHaveCount(0);
  });

  test("scrolled under the page's header and past, nothing of the box shows: not the side bar, the tip or the zoom control", async ({ page }) => {
    await openEmbed(page, { plan: full });
    await press(page, step(page, 'plan'));
    await step(page, 'kickoff').hover();
    await expect(side(page)).toBeVisible();
    await expect(tip(page)).toBeVisible();
    const b = (await theBox(page).boundingBox())!, header = (await page.locator('header.top').boundingBox())!;
    const parts = [side(page), tip(page), page.locator('roadmapper-view .zoom')];
    expect(await boxShows(page), 'in sight at first').toBeGreaterThan(0);

    await test.step('its foot under the header: the header shows over it', async () => {
      await page.evaluate(y => scrollTo(0, y), b.y + b.height - 40);
      expect(await boxShows(page)).toBe(0);
      for (const part of parts) {
        const r = await part.boundingBox();
        if (r) expect(r.y + r.height, 'under the header').toBeLessThanOrEqual(header.height);
      }
    });

    await test.step('past it: no part of it is on the screen', async () => {
      await page.evaluate(y => scrollTo(0, y), b.y + b.height + 200);
      expect(await boxShows(page)).toBe(0);
      for (const part of parts) {
        const r = await part.boundingBox();
        if (r) expect(r.y + r.height, 'above the screen').toBeLessThanOrEqual(0);
      }
    });
  });

  test('a new roadmap prop redraws the box in place: an object or the text of a file', async ({ page }) => {
    await openEmbed(page, { plan: full });
    const box = theBox(page), at = await box.boundingBox();
    // a mark on the element, to know it again
    await box.evaluate(b => { (b as HTMLElement & { seen?: boolean }).seen = true; });
    await page.evaluate(p => window.setRoadmap(p), flat);
    await settle(page);
    await expect(box.locator('.roadmap .title')).toHaveText('Flat plan');
    await expect(box).toHaveAttribute('aria-label', 'Roadmap: Flat plan');
    expect(await levels(page)).toEqual(['Every step']);
    await expect(step(page, 'f-1')).toBeVisible();
    await expect(step(page, 'kickoff')).toHaveCount(0);
    await page.evaluate(t => window.setRoadmap(t), JSON.stringify(plain));
    await settle(page);
    await expect(box.locator('.roadmap .title')).toHaveText('Plain plan');
    expect(await box.evaluate(b => 'seen' in b), 'the same element').toBe(true);
    expect(await box.boundingBox()).toEqual(at);
  });

  test("the same roadmap again, as a new object of an app that renders again, leaves the box as it is: 'Show only blockers' stays", async ({ page }) => {
    await openEmbed(page, { plan: full });
    await press(page, step(page, 'review'));
    await press(page, side(page).getByRole('button', { name: 'Show only blockers' }));
    const view = page.locator('roadmapper-view .roadmap');
    await expect(view).toHaveClass(/\bonly\b/);
    await page.evaluate(p => window.setRoadmap(JSON.parse(JSON.stringify(p))), full);
    await settle(page);
    await expect(view).toHaveClass(/\bonly\b/);
  });

  test('Escape on × closes the side bar, and the keys stay with the box', async ({ page }) => {
    await openEmbed(page, { plan: full });
    await press(page, step(page, 'kickoff'));
    await side(page).getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
    await expect(theBox(page)).toBeFocused();
    await page.keyboard.press('+');
    await settle(page);
    expect(await level(page)).toBe('Tracks');
  });

  test("the page's own address, its name for the box and its hidden attribute are the page's: the box reads no address, keeps the name and hides", async ({ page }) => {
    // an address that would hold the app's page at 'Every step' with no icons
    await page.goto(`${EMBED}?${new URLSearchParams({ plan: JSON.stringify(full) })}#/settings&z=2&u=0`);
    await boxesDrawn(page);
    expect(await level(page)).toBe('Main steps');
    await expect(theBox(page).locator('svg.plan .zn .art').first()).toBeVisible();

    await page.evaluate(p => {
      const named = document.createElement('roadmapper-view') as HTMLElement & { roadmap: unknown };
      named.id = 'named';
      named.setAttribute('aria-label', 'Our plan');
      named.roadmap = p;
      document.querySelector('main')!.append(named);
    }, flat);
    const named = page.locator('#named');
    await expect(named.locator('.roadmap .title')).toHaveText('Flat plan');
    await expect(named).toHaveAttribute('aria-label', 'Our plan');

    await theBox(page).evaluate(b => { (b as HTMLElement).hidden = true; });
    await expect(theBox(page)).toBeHidden();
  });

  test("unmount takes the box off with all it put on the page, so the keys and the wheel are the page's again, and remount draws it again at the first level", async ({ page }) => {
    await openEmbed(page);
    const cdp = await page.context().newCDPSession(page), none = await pageListeners(cdp);
    await page.evaluate(p => { window.setRoadmap(p); window.remount(); }, full);
    await boxesDrawn(page);
    expect(await pageListeners(cdp), 'the view listens on the page').toBeGreaterThan(none);
    await focusIn(page, theBox(page));
    await page.keyboard.press('+');
    await settle(page);
    expect(await level(page)).toBe('Tracks');
    const gone = (await theBox(page).elementHandle())!;

    await test.step('unmount: the box, what it drew and what it listened to are off the page', async () => {
      await page.evaluate(() => window.unmount());
      await expect(page.locator('roadmapper-view')).toHaveCount(0);
      await expect.poll(() => gone.evaluate(b => b.shadowRoot!.childElementCount)).toBe(0);
      expect(await pageListeners(cdp)).toBe(none);
    });

    await test.step("the keys, the pointer and the wheel are the page's, with no error", async () => {
      for (const key of ['+', '-', 'i', 'Escape', 'ArrowRight']) await page.keyboard.press(key);
      await page.mouse.move(700, 400);
      await page.mouse.down();
      await page.mouse.move(400, 300, { steps: 4 });
      await page.mouse.up();
      await page.mouse.wheel(0, 300);
      await expect.poll(() => scrolled(page)).toBeGreaterThan(0);
    });

    await test.step('remount: a new box draws, at the first level', async () => {
      await page.evaluate(() => { scrollTo(0, 0); window.remount(); });
      await boxesDrawn(page);
      await expect(theBox(page)).toHaveAttribute('aria-label', 'Roadmap: Test plan');
      expect(await level(page)).toBe('Main steps');
      await focusIn(page, theBox(page));
      await page.keyboard.press('+');
      await settle(page);
      expect(await level(page)).toBe('Tracks');
    });
  });

  test('a broken roadmap shows its error list in the box, and the plan comes back once it is fixed', async ({ page }) => {
    await openEmbed(page, { plan: full });
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

  test('a src that does not come: the error list in the box says so', async ({ page, errors }) => {
    await openEmbed(page, { src: 'missing.json' });
    await expect(errorList(page).locator('.file')).toHaveText('missing.json');
    expect(await errorRows(page)).toEqual(['      Unreadable file  missing.json']);
    await insideBox(page, errorList(page));
    // the browser and the box say so on the console as well: errors that are meant
    expect(errors).toContainEqual(expect.stringContaining('Roadmapper: the roadmap at missing.json did not come.'));
    errors.splice(0, errors.length, ...errors.filter(e => !e.includes('missing.json')));
  });
});

test.describe('<roadmapper-view> on a page with no bundler', () => {
  test('both boxes draw the JSON inside them, with their icons, also the box with a src it cannot read from disk, and the keys go only to the box with the focus', async ({ page, errors }) => {
    await page.goto(PLAIN);
    await boxesDrawn(page);
    // the browser says it does not let the page read garden.json; the box says nothing
    errors.splice(0, errors.length, ...errors.filter(e => !/^Fetch API cannot load file:.*\/garden\.json\./.test(e)));
    const garden = page.locator('roadmapper-view').nth(0), kitchen = page.locator('roadmapper-view').nth(1), field = page.locator('#field');
    await expect(garden).toHaveAttribute('aria-label', 'Roadmap: Garden plan');
    await expect(kitchen).toHaveAttribute('aria-label', 'Roadmap: Kitchen plan');
    await expect(garden.locator('.roadmap .title')).toHaveText('Garden plan');
    await expect(kitchen.locator('.roadmap .title')).toHaveText('Kitchen plan');
    await expect(garden.locator('.roadmap .errors')).toBeHidden();
    // the script holds the whole icon set
    await expect(step(page, 'dig').locator('.ic .art')).toBeVisible();
    await expect(step(page, 'eat').locator('.ic .art')).toBeVisible();

    await focusIn(page, kitchen);
    await page.keyboard.press('+');
    await settle(page);
    expect([await levelIn(garden), await levelIn(kitchen)]).toEqual(['Main steps', 'Tracks']);

    await field.click();
    await page.keyboard.type('+-');
    await settle(page);
    await expect(field).toHaveValue('+-');
    expect([await levelIn(garden), await levelIn(kitchen)]).toEqual(['Main steps', 'Tracks']);

    await focusIn(page, garden);
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await settle(page);
    expect([await levelIn(garden), await levelIn(kitchen)]).toEqual(['Every step', 'Tracks']);
  });
});
