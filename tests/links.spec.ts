// Links: a step lists the pages it produced, such as a doc or a demo. The check takes only an address that starts with https:// or http://.
// The side bar of a step with links has a 'Links' part before 'Why': a row for each link, which opens its page in a new tab. Its heading closes and opens it,
// and the view keeps which, so a reload shows it as it was left. On a phone, the picked step stays clear of the sheet as it grows, and a double tap opens no link.
// The cut for strangers keeps the links of a shown step, and takes those of a private one with it.
import { test as plain } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { checkRoadmap, parseRoadmap } from '../src/roadmap/check';
import { sayError } from '../src/roadmap/errors';
import { publicRoadmap } from '../src/roadmap/public';
import { errorRows, expect, openPlan, play, reload, settle, side, step, stopClock, stored, test } from './helpers';
import { links as plan } from './plans';

/** A part of the drawing of an icon of Tabler Icons, which tells it from the others. */
const ART = { 'file-text': 'M14 3v4a1', link: 'm9 15l6-6' };

/** The parts of the side bar, by their headings. */
const parts = (page: Page): Locator => side(page).locator('section.part h3');
/** The rows of the 'Links' part. */
const rows = (page: Page): Locator => side(page).locator('a.row');
/** The heading of the 'Links' part, which closes and opens it. */
const fold = (page: Page): Locator => side(page).getByRole('button', { name: 'Links' });

async function pick(page: Page, id: string): Promise<void> {
  await step(page, id).click();
  await settle(page);
  await expect(side(page)).toBeVisible();
}

plain.describe('the check', () => {
  plain('takes a link with a name and an address that starts with https:// or http://, with or without an icon, and a step with no link', () => {
    expect(checkRoadmap(JSON.stringify(plan)).errors).toEqual([]);
  });

  plain('finds each wrong link, on its line, in the fixed format, with the name of the link after the path of its step', () => {
    const text = `{
  "title": "Links",
  "branches": [
    { "name": "Main", "items": [
      { "id": "a", "name": "Spec", "links": [
        { "name": "Doc", "url": "ftp://example.com/doc" },
        { "name": "Demo", "url": "javascript:alert(1)", "icon": 7 },
        { "url": "https://example.com/no-name" },
        { "name": "", "url": "https://" },
        { "name": "Page", "href": "https://example.com" },
        "https://example.com/bare",
        { "name": "Site", "url": "example.com" },
        { "name": "Number", "url": 42 }
      ] },
      { "id": "b", "name": "Build", "links": { "name": "Doc", "url": "https://example.com" } }
    ] }
  ]
}`;
    expect(checkRoadmap(text).errors.map(sayError)).toEqual([
      '6  Main › Spec › Doc  url  Invalid URL  "ftp://example.com/doc"',
      '7  Main › Spec › Demo  url  Invalid URL  "javascript:alert(1)"',
      '7  Main › Spec › Demo  icon  Wrong type  7',
      '8  Main › Spec  name  Missing key  ',
      '9  Main › Spec  name  Invalid value  ""',
      '9  Main › Spec  url  Invalid URL  "https://"',
      '10  Main › Spec › Page  href  Unknown key  ',
      '10  Main › Spec › Page  url  Missing key  ',
      '11  Main › Spec    Wrong type  "https://example.com/bare"',
      '12  Main › Spec › Site  url  Invalid URL  "example.com"',
      '13  Main › Spec › Number  url  Wrong type  42',
      '15  Main › Build  links  Wrong type  {"name":"Doc","url":"https://example.com"}',
    ]);
  });

  plain('a roadmap given as data throws its first wrong link', () => {
    const r = { title: 'Plan', branches: [{ name: 'Main', items: [{ id: 'a', name: 'A', links: [{ name: 'Doc', url: 'file:///home/doc.md' }] }] }] };
    expect(() => parseRoadmap(r)).toThrow('Main › A › Doc  url  Invalid URL  "file:///home/doc.md"');
  });
});

plain('the cut for strangers keeps the links of a shown step as written, and takes a private step with its links', () => {
  const cut = publicRoadmap(parseRoadmap({ title: 'Plan', branches: [{ name: 'Main', items: [
    { id: 'a', name: 'A', links: [{ name: 'Doc', url: 'https://example.com/doc', icon: 'file-text' }] },
    { id: 'b', name: 'B', private: true, links: [{ name: 'Secret', url: 'https://example.com/secret' }] },
  ] }] }));
  expect(cut.branches[0].items).toEqual([{ id: 's1', name: 'A', links: [{ name: 'Doc', url: 'https://example.com/doc', icon: 'file-text' }] }]);
  expect(JSON.stringify(cut)).not.toContain('secret');
});

test('the error list shows a wrong address as npm run validate does', async ({ page }) => {
  await openPlan(page, '{ "title": "T", "branches": [ { "name": "Main", "items": [\n  { "id": "a", "name": "A", "links": [ { "name": "Doc", "url": "www.example.com" } ] }\n] } ] }', { store: null });
  expect(await errorRows(page)).toEqual(['2  Main › A › Doc  url  Invalid URL  "www.example.com"']);
});

test("a step with links has a 'Links' part before 'Why': each link a row with its icon, its name in bold and the arrow right after it, which opens its page in a new tab", async ({ page }) => {
  await openPlan(page, plan, { store: null });
  await pick(page, 'spec');
  await expect(parts(page)).toHaveText(['Links', 'Why']);
  await expect(rows(page)).toHaveText(['Spec doc', 'Demo', 'Mock']);
  for (const [i, url] of ['https://example.com/spec', 'http://example.com/demo', 'https://example.com/mock?v=2#top'].entries()) {
    await expect(rows(page).nth(i)).toHaveAttribute('href', url);
    await expect(rows(page).nth(i)).toHaveAttribute('target', '_blank');
    await expect(rows(page).nth(i)).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(rows(page).first().locator('.strong')).toHaveCSS('font-weight', '700');

  await test.step('the icon a link names; the icon of a link where it names none, or one the set has not', async () => {
    const icon = (i: number): Promise<string> => rows(page).nth(i).locator('svg').first().innerHTML();
    expect(await icon(0)).toContain(ART['file-text']);
    expect(await icon(1)).toContain(ART.link);
    expect(await icon(2)).toContain(ART.link);
  });

  await test.step('the arrow comes right after the name, and no row is wider than the side bar, so it never scrolls sideways', async () => {
    const box = (l: Locator) => l.evaluate(e => e.getBoundingClientRect().toJSON() as DOMRect);
    for (const row of await rows(page).all()) {
      const name = await box(row.locator('.strong')), go = await box(row.locator('.go')), r = await box(row);
      expect(go.left - name.right).toBeLessThanOrEqual(8.5);
      expect(go.right).toBeLessThan(r.right - 40);
    }
    const bar = await side(page).evaluate(e => ({ scroll: e.scrollWidth, width: e.clientWidth, right: e.getBoundingClientRect().right }));
    expect(bar.scroll).toBe(bar.width);
    for (const row of await rows(page).all()) expect((await box(row)).right).toBeLessThan(bar.right);
  });

  await test.step('a click opens the page in a new tab, with no way back to this one, and the side bar stays', async () => {
    await page.context().route('https://example.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>Spec</title>' }));
    const [tab] = await Promise.all([page.context().waitForEvent('page'), rows(page).first().click()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe('https://example.com/spec');
    expect(await tab.evaluate(() => window.opener)).toBeNull();
    await tab.close();
    expect(page.url()).toMatch(/^file:/);
    await expect(rows(page)).toHaveCount(3);
  });

  await test.step("a step with no link, or an empty list, has no 'Links' part", async () => {
    await pick(page, 'ship');
    await expect(parts(page)).toHaveText(['Why']);
    await pick(page, 'party');
    await expect(fold(page)).toHaveCount(0);
  });
});

test("the heading closes and opens 'Links', its chevron turned while it is closed, and the next step's links open or close as it was left", async ({ page }) => {
  await openPlan(page, plan, { store: null });
  await pick(page, 'spec');
  const chevron = fold(page).locator('svg');
  await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(chevron).toHaveCSS('transform', 'none');

  await fold(page).click();
  await expect(fold(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(rows(page)).toHaveCount(3);
  for (const row of await rows(page).all()) await expect(row).toBeHidden();
  // turned a fourth to the left: it points right
  await expect(chevron).toHaveCSS('transform', 'matrix(0, -1, 1, 0, 0, 0)');
  await expect(parts(page)).toHaveText(['Links', 'Why']);

  await pick(page, 'build');
  await expect(fold(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(rows(page).first()).toBeHidden();

  // the heading is a button: the keys work it too
  await fold(page).focus();
  await page.keyboard.press('Enter');
  await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(rows(page)).toHaveText(['Branch']);
  await expect(rows(page).first()).toBeVisible();
});

test("'Links' closed stays closed through a reload, and a page kept before links opens it", async ({ page }) => {
  await openPlan(page, plan, { kept: { level: 0, id: 'spec', fx: 0.5, fy: 0.5 } });
  await pick(page, 'spec');
  await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
  await fold(page).click();
  expect((await stored(page))?.links).toBe(false);

  await reload(page);
  await pick(page, 'spec');
  await expect(fold(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(rows(page).first()).toBeHidden();

  await fold(page).click();
  expect((await stored(page))?.links).toBe(true);
  await reload(page);
  await pick(page, 'spec');
  await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(rows(page).first()).toBeVisible();
});

test.describe('on a phone, where the side bar is a sheet at the bottom', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  /** Where the step 'Spec' and the top of the sheet are, up and down. */
  const look = (page: Page) => page.evaluate(() => ({
    bottom: document.querySelector('svg.plan g.zn[data-id="spec"]')!.getBoundingClientRect().bottom,
    sheet: document.querySelector('.side')!.getBoundingClientRect().top,
  }));

  test("'Links' that opens makes the sheet taller, and the picked step moves clear of it", async ({ page }) => {
    // 'Spec' a little over the top of the sheet with 'Links' closed: the open sheet reaches over where it was
    await openPlan(page, plan, { kept: { level: 0, id: 'spec', fx: 0.5, fy: 0.4, links: false } });
    await step(page, 'spec').tap();
    await expect(side(page)).toBeVisible();
    await settle(page);
    const closed = await look(page);
    expect(closed.bottom, 'clear of the closed sheet').toBeLessThanOrEqual(closed.sheet);

    await fold(page).tap();
    await settle(page);
    const opened = await look(page);
    expect(opened.sheet, 'the open sheet over where the step was').toBeLessThan(closed.bottom);
    expect(opened.bottom, 'clear of the open sheet').toBeLessThanOrEqual(opened.sheet);
  });

  test("the second tap of a double tap on 'Links' lands on the link that moved under it, and opens no tab", async ({ page }) => {
    await page.context().route('https://example.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>Spec</title>' }));
    // on a stopped clock: the page reads the two taps as 120 ms apart however long it takes over each
    await openPlan(page, plan, { kept: { level: 0, id: 'spec', fx: 0.5, fy: 0.4, links: false }, clock: true });
    await stopClock(page);
    await step(page, 'spec').tap();
    // a tap picks 300 ms after it
    await play(page, 300);
    await expect(side(page)).toBeVisible();
    // each click on a link, once the page has heard it: its name, and whether the page let it open its page
    await page.evaluate(() => {
      const w = window as unknown as { links: string[] };
      w.links = [];
      window.addEventListener('click', e => {
        const a = (e.target as Element).closest('a.row');
        if (a) w.links.push(`${a.textContent} ${e.defaultPrevented ? 'stopped' : 'opened'}`);
      });
    });
    const at = (await fold(page).boundingBox())!, x = at.x + at.width / 2, y = at.y + at.height / 2;
    await page.touchscreen.tap(x, y);
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('a.row')?.textContent, [x, y]), 'a link under the finger').toBe('Spec doc');
    await page.clock.runFor(120);
    await page.touchscreen.tap(x, y);
    await expect.poll(() => page.evaluate(() => (window as unknown as { links: string[] }).links), 'the second tap, on the link').toEqual(['Spec doc stopped']);
    expect(page.context().pages()).toHaveLength(1);
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
  });
});
