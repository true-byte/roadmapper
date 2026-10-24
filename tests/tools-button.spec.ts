// 'Tools button': the gear at the end of the zoom control, and its popup with the parts 'Key', 'View' and, in the app, 'Export', a hairline between each two.
// Each part has a heading as 'Links' in the side bar, which closes and opens it; each part is open when the view starts, also after a reload.
// The page of the HTML export and a box of the lib have the parts 'Key' and 'View'.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { icons as tabler } from '@iconify-json/tabler';
import type { Locator, Page } from '@playwright/test';
import { APP_STORE, expect, iconsSwitch, labelsSwitch, level, openApp, openEmbed, openPlan, openTools, popup, reload, settle, side, step, stored, test, toolsButton } from './helpers';
import { full, links } from './plans';

/** The folder of the export of tests/export/plan.json, which npm test writes. */
const DIR = fileURLToPath(new URL('../dist/tests/export/', import.meta.url));
/** The parts of the popup, in their order. */
const PARTS = ['Key', 'View', 'Export'];

/** The lines of the Tabler icon 'settings', the gear, as its paths draw them. */
const GEAR = [...tabler.icons.settings.body.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
/** The lines an icon drawn on the page draws. */
const linesOf = (icon: Locator): Promise<(string | null)[]> => icon.locator('path').evaluateAll(ps => ps.map(p => p.getAttribute('d')));

/** The headings of the parts of the popup, found also while the popup is shut. */
const headings = (page: Page): Locator => popup(page).locator('button.fold');
/** The heading of a part of the popup, by its name. */
const heading = (page: Page, name: string): Locator => headings(page).filter({ hasText: name });
/** A part of the popup, by the name of its heading. */
const part = (page: Page, name: string): Locator => popup(page).locator('section').filter({ has: page.locator('button.fold', { hasText: name }) });
/** What a part shows while it is open: the marks of 'Key', the switch 'Hide labels' of 'View', the button 'Export' of 'Export'. */
const body = (page: Page, name: string): Locator => ({ Key: popup(page).locator('.key'), View: labelsSwitch(page), Export: popup(page).locator('button.export') })[name]!;

/** The look of a heading that closes and opens its part: the button, its word and its chevron. */
const headLook = (fold: Locator): Promise<Record<string, string>> =>
  fold.evaluate(f => {
    const out: Record<string, string> = {};
    for (const [e, props] of [[f, ['display', 'align-items', 'column-gap', 'color']], [f.querySelector('h3')!, ['color', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-transform']],
      [f.querySelector('svg')!, ['width', 'height', 'color']]] as const) for (const p of props) out[`${e.tagName} ${p}`] = getComputedStyle(e).getPropertyValue(p);
    return out;
  });

/** Opens the export on a made-up site, which serves its three files, and waits until the plan is drawn and at rest. */
async function openExport(page: Page): Promise<void> {
  const types: Record<string, string> = { 'roadmap.html': 'text/html; charset=utf-8', 'roadmap.json': 'application/json', 'roadmapper.js': 'text/javascript; charset=utf-8' };
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://landing.test/**', r => {
    const name = new URL(r.request().url()).pathname.slice(1);
    return Object.hasOwn(types, name) ? r.fulfill({ contentType: types[name], body: readFileSync(join(DIR, name)) }) : r.fulfill({ status: 404, body: 'Not found' });
  });
  await page.goto('https://landing.test/roadmap.html');
  await expect(page.locator('svg.plan')).toBeVisible();
  await settle(page);
}

test("the tools button is a gear, the last button of the zoom control, named 'Tools'; it opens the popup and closes it", async ({ page }) => {
  await openApp(page);
  const last = page.locator('.zoom > :last-child');
  await expect(last).toHaveAttribute('aria-label', 'Tools');
  await expect(last).toHaveClass('tools');
  expect(await linesOf(last.locator('svg')), 'the Tabler icon settings').toEqual(GEAR);
  await expect(last).toHaveAttribute('aria-controls', (await popup(page).getAttribute('id'))!);
  await expect(last).toHaveAttribute('aria-expanded', 'false');
  await expect(popup(page), 'shut when the page opens').toBeHidden();
  await toolsButton(page).click();
  await expect(popup(page)).toBeVisible();
  await expect(last).toHaveAttribute('aria-expanded', 'true');
  await toolsButton(page).click();
  await expect(popup(page)).toBeHidden();
  await expect(last).toHaveAttribute('aria-expanded', 'false');
});

test("in the app the popup holds 'Key', 'View' and 'Export' in that order, each open, a hairline between each two; each holds its own controls", async ({ page }) => {
  await openApp(page);
  await openTools(page);
  await expect(headings(page)).toHaveText(PARTS);
  for (const name of PARTS) await expect(heading(page, name), name).toHaveAttribute('aria-expanded', 'true');
  expect(await popup(page).evaluate(p => [...p.children].map(c => c.tagName))).toEqual(['SECTION', 'HR', 'SECTION', 'HR', 'SECTION']);

  await expect(part(page, 'Key').locator('.key li .mark').first(), 'the marks of the states').toBeVisible();
  await expect(part(page, 'View').getByRole('switch')).toHaveText(['Hide node icons', 'Hide labels']);
  await expect(part(page, 'View').getByRole('radiogroup', { name: 'Mode' }).getByRole('radio')).toHaveCount(3);
  await expect(part(page, 'View').getByRole('radiogroup', { name: 'Layout' }).getByRole('radio')).toHaveCount(2);
  await expect(part(page, 'Export').getByRole('switch')).toHaveText(['Include private items']);
  await expect(part(page, 'Export').locator('button.export')).toHaveText('Export');
  for (const name of ['Key', 'Export']) await expect(part(page, name).getByRole('radiogroup'), `no mode or layout in '${name}'`).toHaveCount(0);
});

test("each heading looks as 'Links' in the side bar: the same word and the same chevron", async ({ page }) => {
  await openPlan(page, links, { store: null, exporting: true });
  await step(page, 'spec').click();
  await settle(page);
  const linksLook = await headLook(side(page).getByRole('button', { name: 'Links' }));
  await page.keyboard.press('Escape');
  await expect(side(page)).toBeHidden();
  await openTools(page);
  for (const name of PARTS) expect(await headLook(heading(page, name)), name).toEqual(linksLook);
});

test("a click on a heading closes its part and turns its chevron, and the next click opens it again; the popup stays open, over the end of the zoom control", async ({ page }) => {
  await openApp(page);
  await openTools(page);
  const bottom = async (): Promise<number> => { const b = (await popup(page).boundingBox())!; return b.y + b.height; };
  const at = await bottom();
  for (const name of PARTS) {
    const head = heading(page, name);
    await head.click();
    await expect(head, name).toHaveAttribute('aria-expanded', 'false');
    await expect(body(page, name), `${name}: closed`).toBeHidden();
    await expect(head.locator('svg'), `${name}: the chevron turned`).toHaveCSS('transform', 'matrix(0, -1, 1, 0, 0, 0)');
    await expect(popup(page)).toBeVisible();
    expect(await bottom(), `${name}: the popup keeps its bottom edge`).toBeCloseTo(at, 0);
    for (const other of PARTS.filter(o => o !== name)) await expect(body(page, other), `${name} closed: '${other}' stays open`).toBeVisible();
    await head.click();
    await expect(head, name).toHaveAttribute('aria-expanded', 'true');
    await expect(body(page, name), `${name}: open`).toBeVisible();
    await expect(head.locator('svg')).toHaveCSS('transform', 'none');
  }

  await test.step('all three closed: the popup is the three headings', async () => {
    for (const name of PARTS) await heading(page, name).click();
    for (const name of PARTS) await expect(heading(page, name)).toBeVisible();
    for (const name of PARTS) await expect(body(page, name)).toBeHidden();
    expect(await bottom()).toBeCloseTo(at, 0);
  });
});

test('a double click on a heading closes only its part: its second click does nothing on what moved under the pointer, in the popup or on the plan', async ({ page }) => {
  await openApp(page);
  /** What the popup and the plan show: the popup, each heading and switch, the mode, the layout, the level and the side bar. */
  const shown = async (): Promise<string[]> => [
    ...(await page.evaluate(() => {
      const pop = document.querySelector<HTMLElement>('.popup')!, host = document.querySelector<HTMLElement>('.roadmap')!;
      return [`popup ${!pop.hidden}`, ...[...pop.querySelectorAll('button.fold, [role="switch"]')].map(b => `${b.textContent} ${b.getAttribute('aria-expanded') ?? b.getAttribute('aria-checked')}`),
        `mode ${host.dataset.mode}`, `layout ${host.dataset.flow}`];
    })),
    `level ${await level(page)}`,
    `side ${await side(page).isVisible()}`,
  ];
  for (const name of PARTS) {
    await openTools(page);
    const before = await shown();
    const at = (await heading(page, name).boundingBox())!, x = at.x + 12, y = at.y + at.height / 2;
    await page.mouse.dblclick(x, y);
    await settle(page);
    expect(await heading(page, name).evaluate((h, [x, y]) => h.contains(document.elementFromPoint(x, y)), [x, y]), `${name}: the heading moved from under the pointer`).toBe(false);
    expect(await shown(), name).toEqual(before.map(s => (s === `${name} true` ? `${name} false` : s)));
    // the next click, away from the point of the double click, opens the part again
    await heading(page, name).click();
    await expect(heading(page, name)).toHaveAttribute('aria-expanded', 'true');
  }
});

test('the headings are buttons that the keyboard reaches, and Enter or Space closes and opens a part', async ({ page }) => {
  await openApp(page);
  await toolsButton(page).press('Enter');
  await expect(iconsSwitch(page), "the focus on 'Hide node icons'").toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(heading(page, 'View')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(heading(page, 'View')).toHaveAttribute('aria-expanded', 'false');
  await expect(heading(page, 'View'), 'the focus stays on the heading').toBeFocused();
  await page.keyboard.press('Tab');
  await expect(heading(page, 'Export'), "'View' closed: the next heading").toBeFocused();
  await page.keyboard.press('Space');
  await expect(heading(page, 'Export')).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(heading(page, 'Export')).toHaveAttribute('aria-expanded', 'true');
});

test("from the keyboard the popup opens with the focus on 'Hide node icons'; with 'View' closed, on the first heading; Escape gives the focus back to the gear", async ({ page }) => {
  await openApp(page);
  await toolsButton(page).press('Enter');
  await expect(iconsSwitch(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
  await expect(toolsButton(page)).toBeFocused();

  await openTools(page);
  await heading(page, 'View').click();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
  await toolsButton(page).press('Enter');
  await expect(heading(page, 'View'), 'still closed').toHaveAttribute('aria-expanded', 'false');
  await expect(heading(page, 'Key'), 'the first heading').toBeFocused();

  await test.step("'Key' closed too: the focus still goes to the first heading", async () => {
    await heading(page, 'Key').click();
    await page.keyboard.press('Escape');
    await toolsButton(page).press('Enter');
    await expect(heading(page, 'Key')).toBeFocused();
  });
});

test('a part closed stays closed while the popup closes and opens again, comes back open after a reload, and the browser keeps nothing of it', async ({ page }) => {
  await openApp(page);
  // the view keeps itself as the page goes, and also when a move of its own ends, so compare what two reloads keep, not one moment with the next
  await reload(page);
  const keys = Object.keys((await stored(page, APP_STORE)) ?? {}).sort();
  expect(keys, 'the view is kept').not.toEqual([]);
  await openTools(page);
  await heading(page, 'Key').click();
  await heading(page, 'Export').click();
  await toolsButton(page).click();
  await expect(popup(page)).toBeHidden();
  await openTools(page);
  expect(await headings(page).evaluateAll(h => h.map(b => b.getAttribute('aria-expanded')))).toEqual(['false', 'true', 'false']);
  await reload(page);
  expect(Object.keys((await stored(page, APP_STORE)) ?? {}).sort(), 'nothing kept for the parts').toEqual(keys);
  await expect(popup(page), 'shut after the reload').toBeHidden();
  await openTools(page);
  for (const name of PARTS) await expect(heading(page, name), name).toHaveAttribute('aria-expanded', 'true');
});

test('on a short window the popup scrolls inside itself, between the top of the view and the zoom control', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 });
  await openApp(page);
  await openTools(page);
  const pop = (await popup(page).boundingBox())!, bar = (await page.locator('.zoom').boundingBox())!;
  expect(pop.y, 'in the window').toBeGreaterThanOrEqual(0);
  expect(pop.y + pop.height, 'over the zoom control').toBeLessThan(bar.y);
  expect(await popup(page).evaluate(p => p.scrollHeight - p.clientHeight), 'it scrolls').toBeGreaterThan(0);
  await expect(part(page, 'Export').locator('button.export')).not.toBeInViewport({ ratio: 1 });
  await popup(page).evaluate(p => p.scrollTo(0, p.scrollHeight));
  await expect(part(page, 'Export').locator('button.export'), 'the last control comes into sight').toBeInViewport({ ratio: 1 });
  await expect(heading(page, 'Key')).not.toBeInViewport({ ratio: 1 });

  await test.step("closed, 'Key' and 'View' leave room for the whole popup", async () => {
    await popup(page).evaluate(p => p.scrollTo(0, 0));
    await heading(page, 'Key').click();
    await heading(page, 'View').click();
    expect(await popup(page).evaluate(p => p.scrollHeight - p.clientHeight)).toBeLessThanOrEqual(0);
    await expect(part(page, 'Export').locator('button.export')).toBeInViewport({ ratio: 1 });
  });
});

test("the page of the HTML export has the gear, and its popup holds 'Key' and 'View', each with its heading", async ({ page }) => {
  await openExport(page);
  const last = page.locator('.zoom > :last-child');
  await expect(last).toHaveAttribute('aria-label', 'Tools');
  expect(await linesOf(last.locator('svg')), 'the gear, from the icons in roadmap.json').toEqual(GEAR);
  await openTools(page);
  await expect(headings(page)).toHaveText(['Key', 'View']);
  await expect(popup(page).locator('hr')).toHaveCount(1);
  await expect(part(page, 'View').getByRole('radiogroup', { name: 'Mode' })).toBeVisible();
  await expect(popup(page).getByRole('switch', { name: 'Include private items', includeHidden: true })).toHaveCount(0);
  await heading(page, 'Key').click();
  await expect(heading(page, 'Key')).toHaveAttribute('aria-expanded', 'false');
  await expect(popup(page).locator('.key')).toBeHidden();
  await expect(heading(page, 'Key').locator('svg'), 'the chevron, from the icons in roadmap.json').toHaveCSS('transform', 'matrix(0, -1, 1, 0, 0, 0)');
});

test("a box of the lib has the gear, and its popup holds 'Key' and 'View', each with its heading", async ({ page }) => {
  await openEmbed(page, { plan: full });
  const box = page.locator('roadmapper-view').first();
  await box.locator('.zoom .tools').click();
  const pop = box.getByRole('dialog', { name: 'Tools' });
  await expect(pop).toBeVisible();
  await expect(pop.locator('button.fold')).toHaveText(['Key', 'View']);
  await pop.locator('button.fold', { hasText: 'View' }).click();
  await expect(pop.locator('button.fold', { hasText: 'View' })).toHaveAttribute('aria-expanded', 'false');
  await expect(pop.getByRole('switch', { name: 'Hide labels' })).toBeHidden();
});
