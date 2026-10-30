// The zoom control: its stops, + and −, the grip that hides it, and the tools button with its popup of the parts 'Key', 'View' and 'Export'.
// Each control in the popup acts on its own and leaves the popup open; a press out of it shuts it and does nothing else.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { icons as tabler } from '@iconify-json/tabler';
import type { Locator, Page } from '@playwright/test';
import { STATE_NAME, STATES, type State } from '../../src/roadmap/types';
import {
  expect, iconsSwitch, labelsSwitch, level, levels, openPlan, openTools, popup, reload, save, settle, side, step, STORE, stored, test, toolsButton, zoomTo,
} from '../support/helpers';
import { edit, flat, full, nodeOf, nodesOf, plain, versions } from '../support/plans';

/** The plan 'full' with no step canceled: a key of six. */
const six = edit(full, p => { for (const n of nodesOf(p)) if (n.state === 'canceled') n.state = 'done'; });
/** The same, with links on 'Plan', so its side bar has the part 'Links'. */
const linked = edit(six, p => { nodeOf(p, 'plan').links = [{ name: 'Plan doc', url: 'https://example.com/plan' }]; });
/** The parts of the popup where the page makes the export, in their order. */
const PARTS = ['Key', 'View', 'Export'];
/** The lines of the Tabler icon 'settings', the gear. */
const GEAR = [...tabler.icons.settings.body.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
/** The folder of the export of tests/fixtures/export.json, which npm test writes. */
const EXPORT = fileURLToPath(new URL('../../dist/tests/export/', import.meta.url));

/** Opens the export on a made-up site, which serves its three files, and waits until the plan is drawn and at rest. */
async function openExport(page: Page): Promise<void> {
  const types: Record<string, string> = { 'roadmap.html': 'text/html; charset=utf-8', 'roadmap.json': 'application/json', 'roadmapper.js': 'text/javascript; charset=utf-8' };
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://landing.test/**', r => {
    const name = new URL(r.request().url()).pathname.slice(1);
    return Object.hasOwn(types, name) ? r.fulfill({ contentType: types[name], body: readFileSync(join(EXPORT, name)) }) : r.fulfill({ status: 404, body: 'Not found' });
  });
  await page.goto('https://landing.test/roadmap.html');
  await expect(page.locator('svg.plan')).toBeVisible();
  await settle(page);
}

type Box = { x: number; y: number; width: number; height: number };
const boxOf = async (l: Locator): Promise<Box> => (await l.first().boundingBox())!;
const bar = (page: Page): Locator => page.locator('.roadmap .zoom');
const stop = (page: Page, name: string): Locator => page.locator('.zoom').getByRole('button', { name, exact: true });
const grip = (page: Page): Locator => page.locator('.roadmap .zoom .grip');
const zoomIn = (page: Page): Locator => page.getByRole('button', { name: 'Zoom in' });
const zoomOut = (page: Page): Locator => page.getByRole('button', { name: 'Zoom out' });
const radio = (page: Page, name: string): Locator => popup(page).getByRole('radio', { name, includeHidden: true });
const stageScroll = (page: Page): Promise<[number, number]> => page.locator('.roadmap .stage').evaluate(s => [s.scrollLeft, s.scrollTop]);
/** Is the element inert, as a hidden zoom control makes its buttons? */
const inert = (l: Locator): Promise<boolean> => l.evaluate(e => (e as HTMLElement).inert);

/** The headings of the parts of the popup, found also while the popup is shut. */
const headings = (page: Page): Locator => popup(page).locator('button.fold');
const heading = (page: Page, name: string): Locator => headings(page).filter({ hasText: name });
/** A part of the popup, by the name of its heading. */
const part = (page: Page, name: string): Locator => popup(page).locator('section').filter({ has: page.locator('button.fold', { hasText: name }) });
/** Each part of the popup as its heading, open or not, its body shown or not and the turn of its chevron; and the bottom edge of the popup. */
const folds = (page: Page): Promise<{ bottom: number; parts: string[] }> =>
  popup(page).evaluate(p => ({
    bottom: p.getBoundingClientRect().bottom,
    parts: [...p.querySelectorAll('section')].map(s => {
      const h = s.querySelector('button.fold')!;
      return [h.textContent, h.getAttribute('aria-expanded'), (h.nextElementSibling as HTMLElement).checkVisibility() ? 'shown' : 'hidden', getComputedStyle(h.querySelector('svg')!).transform].join(' ');
    }),
  }));
/** A part as folds() tells it, open or closed. */
const told = (name: string, open: boolean): string => `${name} ${open} ${open ? 'shown' : 'hidden'} ${open ? 'none' : 'matrix(0, -1, 1, 0, 0, 0)'}`;
/** The look of a heading: the button, its word and its chevron. */
const headLook = (fold: Locator): Promise<Record<string, string>> =>
  fold.evaluate(f => {
    const out: Record<string, string> = {};
    for (const [e, props] of [[f, ['display', 'align-items', 'column-gap', 'color']], [f.querySelector('h3')!, ['color', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-transform']],
      [f.querySelector('svg')!, ['width', 'height', 'color']]] as const) for (const p of props) out[`${e.tagName} ${p}`] = getComputedStyle(e).getPropertyValue(p);
    return out;
  });

/** What the switches and the pair say, what the plan draws, and whether the popup is open. */
const said = (page: Page): Promise<{ icons: boolean; coins: boolean; labels: boolean; names: boolean; flow: string; pair: string; open: boolean }> =>
  page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('.roadmap')!, svg = host.querySelector('svg.plan')!, pop = host.querySelector<HTMLElement>('.popup')!;
    const on = (name: string): boolean => pop.querySelector(`[aria-label="${name}"]`)!.getAttribute('aria-checked') === 'true';
    const seen = (e: Element): boolean => {
      for (let x: Element | null = e; x && x !== svg; x = x.parentElement) if (getComputedStyle(x).display === 'none' || Number(x.getAttribute('opacity') ?? 1) < 0.01) return false;
      return true;
    };
    return {
      icons: !on('Hide node icons'),
      coins: [...svg.querySelectorAll('g.zn[data-id] .coin')].some(c => c.getBoundingClientRect().width > 0 && c.checkVisibility({ visibilityProperty: true })),
      labels: !on('Hide labels'),
      names: [...svg.querySelectorAll('text')].some(t => t.textContent === 'Kickoff' && seen(t)),
      flow: host.dataset.flow!,
      pair: on('Vertical') ? 'v' : 'h',
      open: !pop.hidden,
    };
  });
/** Presses a switch or the pair, and checks that it changed its own state and no other, that the plan draws what they say, and that the popup is still open. */
async function pressed(page: Page, what: 'icons' | 'labels' | 'flow', press: () => Promise<void>): Promise<void> {
  const before = await said(page);
  await press();
  await settle(page);
  const now = await said(page), flip = { icons: !before.icons, labels: !before.labels, flow: before.flow === 'v' ? 'h' : 'v' }[what];
  expect(now, `a press of ${what}`).toEqual({ ...before, [what]: flip, coins: now.icons, names: now.labels, pair: now.flow, open: true });
  expect([before.coins, before.names, before.pair], `before a press of ${what}`).toEqual([before.icons, before.labels, before.flow]);
}

test('the zoom control moves between levels', async ({ page }) => {
  await openPlan(page, plain, { store: null });

  await test.step('+ and − move one level, and are off at the ends', async () => {
    await expect(zoomOut(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomIn(page)).toHaveAttribute('aria-disabled', 'false');
    // a button that is off can still be pressed: it does nothing
    await zoomOut(page).click({ force: true });
    for (const name of ['Tracks', 'Every step']) {
      await zoomIn(page).click();
      await settle(page);
      expect(await level(page)).toBe(name);
    }
    await expect(zoomIn(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomOut(page)).toHaveAttribute('aria-disabled', 'false');
    await zoomIn(page).click({ force: true });
    await settle(page);
    expect(await level(page)).toBe('Every step');
    await zoomOut(page).click();
    await settle(page);
    expect(await level(page)).toBe('Tracks');
    await expect(zoomIn(page)).toHaveAttribute('aria-disabled', 'false');
  });

  await test.step('a stop goes to its level, and only that stop is current', async () => {
    const names = await levels(page);
    for (const name of [...names].reverse()) {
      await zoomTo(page, name);
      expect(await page.locator('.zoom .stop').evaluateAll(ss => ss.map(s => s.getAttribute('aria-current'))), name).toEqual(names.map(n => String(n === name)));
    }
  });

  await test.step('a one-level plan has one stop, with + and − off', async () => {
    await save(page, flat);
    await expect(page.locator('.zoom .stop')).toHaveText(['Every step']);
    await expect(page.locator('.zoom .stop')).toHaveAttribute('aria-current', 'true');
    await expect(zoomOut(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomIn(page)).toHaveAttribute('aria-disabled', 'true');
    await zoomIn(page).click({ force: true });
    await settle(page);
    expect(await level(page)).toBe('Every step');
  });
});

test('the grip hides the zoom control, and a reload keeps it hidden', async ({ page }) => {
  await openPlan(page, plain);

  await test.step('the grip hides the control; keys work; a reload keeps it hidden', async () => {
    const vh = page.viewportSize()!.height;
    await expect(grip(page)).toHaveAttribute('aria-label', 'Hide toolbar');
    await openTools(page);
    await grip(page).click();
    await expect(popup(page)).toBeHidden();
    await expect(grip(page)).toHaveAttribute('aria-label', 'Show toolbar');
    expect((await boxOf(bar(page))).y, 'the control under the bottom of the view').toBeGreaterThanOrEqual(vh - 0.5);
    const g = await boxOf(grip(page));
    // its open bottom, where it meets the control, may run 2 px under the edge
    expect(g.y + g.height, 'the grip at the bottom').toBeLessThanOrEqual(vh + 2.5);
    expect(g.y).toBeLessThan(vh - 20);
    expect(await inert(toolsButton(page)), 'the buttons take no focus').toBe(true);
    await page.keyboard.press('+');
    await settle(page);
    expect(await level(page)).toBe('Tracks');
    expect((await stored(page))?.tucked).toBe(true);
    await reload(page);
    await expect(grip(page)).toHaveAttribute('aria-label', 'Show toolbar');
    await grip(page).click();
    await expect(grip(page)).toHaveAttribute('aria-label', 'Hide toolbar');
    const b = await boxOf(bar(page));
    expect(b.y + b.height).toBeCloseTo(vh - 20, 0);
    expect(await inert(toolsButton(page))).toBe(false);
    expect((await stored(page))?.tucked).toBe(false);
  });

  await test.step('a double click on the grip keeps the level, and nothing scrolls', async () => {
    await grip(page).dblclick();
    await settle(page);
    expect(await level(page)).toBe('Tracks');
    await expect(page.locator('.roadmap.tucked')).toHaveCount(1);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBe(0);
    await page.mouse.move(200, 20);
    await page.mouse.wheel(0, 400);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await grip(page).click();
  });

  await test.step("the grip shuts the open list, and 'Branches' takes no focus", async () => {
    await save(page, versions);
    const layers = page.locator('.zoom').getByRole('button', { name: 'Branches', exact: true }), list = page.getByRole('dialog', { name: 'Branches', includeHidden: true });
    await layers.click();
    await expect(list).toBeVisible();
    await grip(page).click();
    await expect(list).toBeHidden();
    expect(await inert(layers)).toBe(true);
    await grip(page).click();
  });
});

test('the gear opens a popup that fits at every size', async ({ page }) => {
  await test.step('the gear is the last button of the zoom control', async () => {
    // the export ships the icons it draws: the gear among them
    await openExport(page);
    const last = page.locator('.zoom > :last-child');
    await expect(last).toHaveAttribute('aria-label', 'Tools');
    await expect(last).toHaveClass('tools');
    expect(await last.locator('svg path').evaluateAll(ps => ps.map(p => p.getAttribute('d'))), 'the Tabler icon settings').toEqual(GEAR);
  });

  await openPlan(page, plain, { store: null });

  await test.step("on a plan with no icons 'Hide labels' is the one switch", async () => {
    const rowOf = async (): Promise<{ high: number; under: number; row: number }> => popup(page).evaluate(p => {
      const r = (e: Element): DOMRect => e.getBoundingClientRect(), last = r([...p.querySelectorAll('.opts .switch:not([hidden])')].at(-1)!), row = r(p.querySelector('.looks')!);
      return { high: r(p).height, under: last.bottom, row: row.top };
    });
    await expect(popup(page), 'shut when the page opens').toBeHidden();
    await toolsButton(page).press('Enter');
    await expect(labelsSwitch(page), "the keyboard opens the popup on 'Hide labels'").toBeFocused();
    await expect(popup(page).getByRole('switch')).toHaveText(['Hide labels']);
    await expect(iconsSwitch(page)).toBeHidden();
    const one = await rowOf();
    await page.keyboard.press('Escape');
    // the same key, and an icon on the first step: both switches
    await save(page, edit(plain, p => { nodeOf(p, 'p-1').icon = 'rocket'; }));
    await openTools(page);
    await expect(popup(page).getByRole('switch')).toHaveText(['Hide node icons', 'Hide labels']);
    const two = await rowOf();
    expect(two.high - one.high, 'a switch less is 44 px lower').toBeCloseTo(44, 0);
    expect(one.row - one.under, 'the mode and the pair under the switch').toBeCloseTo(two.row - two.under, 0);
    await page.keyboard.press('Escape');
  });

  await test.step('the tools button opens the popup and shuts it', async () => {
    await save(page, six);
    await expect(toolsButton(page)).toHaveAttribute('aria-controls', (await popup(page).getAttribute('id'))!);
    await expect(toolsButton(page)).toHaveAttribute('aria-expanded', 'false');
    await toolsButton(page).click();
    await expect(popup(page)).toBeVisible();
    await expect(toolsButton(page)).toHaveAttribute('aria-expanded', 'true');
    await toolsButton(page).click();
    await expect(popup(page)).toBeHidden();
    await expect(toolsButton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  await test.step('the key lists the states on the plan, then the milestone', async () => {
    await openTools(page);
    const used = new Set<State>(['done', 'in-progress', 'todo', 'blocked', 'tbd']);
    await expect(popup(page).locator('.key li')).toHaveText([...STATES.filter(s => used.has(s)).map(s => STATE_NAME[s]), 'Milestone']);
    await expect(popup(page).getByRole('switch')).toHaveText(['Hide node icons', 'Hide labels']);
    await expect(popup(page).getByRole('radiogroup', { name: 'Layout' }).getByRole('radio')).toHaveCount(2);
  });

  await test.step("on a laptop the popup lies 30 px over the control's end", async () => {
    const z = await boxOf(bar(page)), pop = await boxOf(popup(page));
    expect(Math.abs(pop.x + pop.width - (z.x + z.width)), 'right edges').toBeLessThan(1);
    expect(Math.abs(z.y - (pop.y + pop.height) - 30), 'over the control, clear of the grip').toBeLessThan(1);
    expect(pop.width).toBeCloseTo(320, 0);
  });

  for (const [width, height] of [[1440, 900], [844, 390], [390, 664], [360, 640], [320, 568]]) {
    await test.step(`at ${width}x${height} 'View' keeps its rows in a popup 337 px high`, async () => {
      await page.setViewportSize({ width, height });
      await settle(page);
      const b = await popup(page).evaluate(p => {
        const box = (e: Element): { l: number; r: number; t: number; b: number } => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
        const opts = p.querySelector('.opts')!, [hide, hideL] = [...opts.querySelectorAll('.switch')], group = (name: string): Element => p.querySelector(`[role="radiogroup"][aria-label="${name}"]`)!;
        return {
          open: !(p as HTMLElement).hidden, pop: box(p), opts: box(opts), hide: box(hide), hideL: box(hideL), mode: box(group('Mode')), pair: box(group('Layout')),
          over: Math.max(p.scrollWidth - p.clientWidth, opts.scrollWidth - opts.clientWidth), whole: p.scrollHeight + (p as HTMLElement).offsetHeight - p.clientHeight,
        };
      });
      expect(b.open).toBe(true);
      expect(b.whole, 'high, where a short view scrolls it too').toBeCloseTo(337, 0);
      expect(b.hide.b - b.hide.t).toBeCloseTo(44, 0);
      expect(b.hideL.b - b.hideL.t).toBeCloseTo(44, 0);
      expect(b.hide.t, "'Hide node icons' on the first row").toBeCloseTo(b.opts.t, 0);
      expect(b.hideL.t, "'Hide labels' under it").toBeCloseTo(b.hide.b, 0);
      expect(b.hide.l, 'at the left').toBeCloseTo(b.opts.l, 0);
      expect(b.hideL.l, 'at the left').toBeCloseTo(b.opts.l, 0);
      expect(b.mode.t, "the mode under 'Hide labels'").toBeGreaterThanOrEqual(b.hideL.b);
      expect(b.mode.l, 'the mode at the left').toBeCloseTo(b.opts.l, 0);
      expect(b.pair.r, 'the pair at the right').toBeCloseTo(b.opts.r, 0);
      expect(Math.abs((b.mode.t + b.mode.b) / 2 - (b.pair.t + b.pair.b) / 2), 'the mode and the pair on one row').toBeLessThanOrEqual(1);
      expect(b.mode.r, 'the mode left of the pair').toBeLessThan(b.pair.l);
      expect(b.pair.b, 'the row in the popup').toBeLessThanOrEqual(b.opts.b + 0.5);
      expect(b.over, 'nothing runs over').toBeLessThanOrEqual(0);
      expect(b.pop.l, 'in the window').toBeGreaterThanOrEqual(0);
      expect(b.pop.r, 'in the window').toBeLessThanOrEqual(width);
    });
  }

  await test.step('on a short window the popup scrolls inside itself', async () => {
    await page.setViewportSize({ width: 1440, height: 420 });
    await settle(page);
    const pop = await boxOf(popup(page)), z = await boxOf(bar(page)), lastOne = radio(page, 'Vertical');
    expect(pop.y, 'in the window').toBeGreaterThanOrEqual(0);
    expect(pop.y + pop.height, 'over the zoom control').toBeLessThan(z.y);
    expect(await popup(page).evaluate(p => p.scrollHeight - p.clientHeight), 'it scrolls').toBeGreaterThan(0);
    await expect(lastOne).not.toBeInViewport({ ratio: 1 });
    await popup(page).evaluate(p => p.scrollTo(0, p.scrollHeight));
    await expect(lastOne, 'the last control comes into sight').toBeInViewport({ ratio: 1 });
    await expect(heading(page, 'Key')).not.toBeInViewport({ ratio: 1 });
    await popup(page).evaluate(p => p.scrollTo(0, 0));
    await heading(page, 'Key').click();
    expect(await popup(page).evaluate(p => p.scrollHeight - p.clientHeight), "'Key' closed: no scroll").toBeLessThanOrEqual(0);
    await expect(lastOne).toBeInViewport({ ratio: 1 });
    await heading(page, 'Key').press('Enter');
    await page.setViewportSize({ width: 740, height: 300 });
    await settle(page);
    expect((await boxOf(popup(page))).y, 'never off the top').toBeGreaterThanOrEqual(0);
  });
});

test('the popup parts fold, and stay as left through a reload', async ({ page }) => {
  await openPlan(page, linked, { exporting: true });

  await test.step("the popup holds 'Key', 'View' and 'Export', a hairline between each two", async () => {
    await openTools(page);
    expect((await folds(page)).parts).toEqual(PARTS.map(name => told(name, true)));
    expect(await popup(page).evaluate(p => [...p.children].map(c => c.tagName))).toEqual(['SECTION', 'HR', 'SECTION', 'HR', 'SECTION']);
    await expect(part(page, 'Key').locator('.key li .mark').first(), 'the marks of the states').toBeVisible();
    await expect(part(page, 'View').getByRole('switch')).toHaveText(['Hide node icons', 'Hide labels']);
    await expect(part(page, 'View').getByRole('radiogroup', { name: 'Mode' }).getByRole('radio')).toHaveCount(3);
    await expect(part(page, 'View').getByRole('radiogroup', { name: 'Layout' }).getByRole('radio')).toHaveCount(2);
    await expect(part(page, 'Export').getByRole('switch')).toHaveText(['Include private items']);
    // the plan page has no icon for the button: its sign stands first
    await expect(part(page, 'Export').locator('button.export > span')).toHaveText('Export');
    for (const name of ['Key', 'Export']) await expect(part(page, name).getByRole('radiogroup'), `no mode or layout in '${name}'`).toHaveCount(0);
  });

  await test.step("each heading looks as 'Links' in the side bar", async () => {
    await page.keyboard.press('Escape');
    await step(page, 'plan').click();
    const linksLook = await headLook(side(page).getByRole('button', { name: 'Links' }));
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
    await openTools(page);
    for (const name of PARTS) expect(await headLook(heading(page, name)), name).toEqual(linksLook);
  });

  await test.step('a click on a heading folds its part and turns its chevron', async () => {
    const { bottom } = await folds(page);
    for (const name of PARTS) {
      await heading(page, name).click();
      const closed = await folds(page);
      expect(closed.parts, `'${name}' closed, the others open`).toEqual(PARTS.map(n => told(n, n !== name)));
      expect(closed.bottom, `${name}: the popup keeps its bottom edge`).toBeCloseTo(bottom, 0);
      await heading(page, name).click();
      expect((await folds(page)).parts, `'${name}' open again`).toEqual(PARTS.map(n => told(n, true)));
    }
    for (const name of PARTS) await heading(page, name).click();
    const closed = await folds(page);
    expect(closed.parts, 'all three closed').toEqual(PARTS.map(n => told(n, false)));
    expect(closed.bottom).toBeCloseTo(bottom, 0);
    // from the keyboard: a click of the pointer this near the last one, this soon, is the second of a double click
    for (const name of PARTS) await heading(page, name).press('Enter');
    expect((await folds(page)).parts).toEqual(PARTS.map(n => told(n, true)));
  });

  await test.step('a double click on a heading folds only its part', async () => {
    // what the popup and the plan show: each heading and switch, the mode, the layout, the level and the side bar
    const shown = (): Promise<string[]> => page.evaluate(() => {
      const host = document.querySelector<HTMLElement>('.roadmap')!, pop = host.querySelector<HTMLElement>('.popup')!;
      return [`popup ${!pop.hidden}`, ...[...pop.querySelectorAll('button.fold, [role="switch"]')].map(b => `${b.textContent} ${b.getAttribute('aria-expanded') ?? b.getAttribute('aria-checked')}`),
        `mode ${host.dataset.mode}`, `layout ${host.dataset.flow}`, `level ${host.querySelector('.zoom .stop[aria-current="true"]')!.textContent}`, `side ${!host.querySelector<HTMLElement>('.side')!.hidden}`];
    });
    for (const name of PARTS) {
      const before = await shown();
      const at = await boxOf(heading(page, name)), x = at.x + 12, y = at.y + at.height / 2;
      await page.mouse.dblclick(x, y);
      await settle(page);
      expect(await heading(page, name).evaluate((h, [x, y]) => h.contains(document.elementFromPoint(x, y)), [x, y]), `${name}: the heading moved from under the pointer`).toBe(false);
      expect(await shown(), name).toEqual(before.map(s => (s === `${name} true` ? `${name} false` : s)));
      // the next click, away from the point of the double click, opens the part again
      await heading(page, name).click();
      await expect(heading(page, name)).toHaveAttribute('aria-expanded', 'true');
    }
  });

  await test.step('the keyboard reaches each heading, and Enter or Space folds it', async () => {
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
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
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    await expect(toolsButton(page), 'Escape gives the focus back to the gear').toBeFocused();
  });

  await test.step("with 'View' closed the keyboard opens the popup on the first heading", async () => {
    await page.keyboard.press('Enter');
    await expect(heading(page, 'View'), 'still closed').toHaveAttribute('aria-expanded', 'false');
    await expect(heading(page, 'Key'), 'the first heading').toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(heading(page, 'Key'), "'Key' closed too").toBeFocused();
  });

  await test.step('a folded part stays folded as the popup closes, and after a reload', async () => {
    const open = (): Promise<(string | null)[]> => headings(page).evaluateAll(h => h.map(b => b.getAttribute('aria-expanded')));
    await toolsButton(page).click();
    await expect(popup(page)).toBeHidden();
    await openTools(page);
    expect(await open()).toEqual(['false', 'false', 'true']);
    await toolsButton(page).click();
    await reload(page);
    await expect(popup(page), 'shut after the reload, as it was left').toBeHidden();
    expect((await stored(page))?.parts).toEqual({ Key: false, View: false, Export: true });
    expect(await page.evaluate(() => [Object.keys(localStorage), sessionStorage.length]), 'nothing else is kept').toEqual([[STORE], 0]);
    await openTools(page);
    expect(await open()).toEqual(['false', 'false', 'true']);
  });
});

test('each control leaves the popup open, and a press outside shuts it', async ({ page }) => {
  await openPlan(page, six, { store: null });
  await openTools(page);

  await test.step("the stops, + and 'I' act and leave the popup open", async () => {
    await zoomTo(page, 'Tracks');
    await zoomIn(page).click();
    await settle(page);
    expect(await level(page)).toBe('Every step');
    await page.keyboard.press('i');
    await settle(page);
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await zoomTo(page, 'Main steps');
    await expect(popup(page)).toBeVisible();
  });

  await test.step('a click on a switch or the pair changes only its state', async () => {
    await pressed(page, 'icons', () => iconsSwitch(page).click());
    await pressed(page, 'labels', () => labelsSwitch(page).click());
    await pressed(page, 'flow', () => radio(page, 'Vertical').click());
  });

  await test.step('Space, Enter and the arrows change only their own state', async () => {
    await page.keyboard.press('Escape');
    await toolsButton(page).press('Enter');
    await expect(iconsSwitch(page)).toBeFocused();
    await pressed(page, 'icons', () => page.keyboard.press('Space'));
    await page.keyboard.press('Tab');
    await expect(labelsSwitch(page)).toBeFocused();
    await pressed(page, 'labels', () => page.keyboard.press('Enter'));
    await page.keyboard.press('Tab');
    await expect(radio(page, 'Device'), 'the chosen one of the mode').toBeFocused();
    await page.keyboard.press('Tab');
    await expect(radio(page, 'Vertical'), 'the chosen one of the pair').toBeFocused();
    await pressed(page, 'flow', () => page.keyboard.press('ArrowLeft'));
    await expect(radio(page, 'Horizontal')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(labelsSwitch(page), 'Shift and Tab go back').toBeFocused();
  });

  await test.step('a press outside the popup shuts it, and picks and zooms nothing', async () => {
    await step(page, 'kickoff').click();
    await expect(popup(page)).toBeHidden();
    await expect(side(page), 'no pick').toBeHidden();
    await step(page, 'kickoff').click();
    await expect(side(page), 'the next press picks').toBeVisible();
    await page.keyboard.press('Escape');
    await openTools(page);
    await step(page, 'kickoff').dblclick();
    await settle(page);
    await expect(popup(page)).toBeHidden();
    await expect(side(page), 'no pick').toBeHidden();
    expect(await level(page), 'no zoom').toBe('Main steps');
  });

  await test.step('a drag out of the popup shuts it and moves the plan', async () => {
    await openTools(page);
    // from the middle of the stage between its left edge and the popup
    const before = await stageScroll(page), r = await boxOf(page.locator('.roadmap .stage')), x = (r.x + (await boxOf(popup(page))).x) / 2, y = r.y + r.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 4; i++) await page.mouse.move(x - 50 * i, y);
    await page.mouse.up();
    await settle(page);
    await expect(popup(page)).toBeHidden();
    await expect(side(page)).toBeHidden();
    expect((await stageScroll(page))[0], 'the plan moved').toBeGreaterThan(before[0]);
  });

  await test.step('Escape shuts the popup first, then the side bar', async () => {
    await step(page, 'kickoff').click();
    await expect(side(page)).toBeVisible();
    await openTools(page);
    await expect(side(page), 'over an open side bar').toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    await expect(side(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test('a tap works each control, and the popup spans the zoom control', async ({ page }) => {
    await openPlan(page, full, { store: null });

    await test.step('a tap on a switch or the pair changes only its state', async () => {
      expect((await said(page)).flow, 'down on a phone').toBe('v');
      await toolsButton(page).tap();
      await expect(popup(page)).toBeVisible();
      await pressed(page, 'icons', () => iconsSwitch(page).tap());
      await pressed(page, 'labels', () => labelsSwitch(page).tap());
      await pressed(page, 'flow', () => radio(page, 'Horizontal').tap());
    });

    await test.step('the popup spans the zoom control, 30 px over it', async () => {
      const z = await boxOf(bar(page)), pop = await boxOf(popup(page));
      expect(Math.abs(pop.x - z.x), 'left edges').toBeLessThan(1);
      expect(Math.abs(pop.width - z.width), 'as wide').toBeLessThan(1);
      expect(Math.abs(z.y - (pop.y + pop.height) - 30), 'over the control, clear of the grip').toBeLessThan(1);
    });

    await test.step('at 320 px the zoom control keeps its height at every level', async () => {
      await page.setViewportSize({ width: 320, height: 568 });
      await settle(page);
      await expect(popup(page)).toBeVisible();
      let high: number | null = null;
      for (const at of ['Tracks', 'Every step', 'Main steps']) {
        await stop(page, at).tap();
        await settle(page);
        const z = await boxOf(bar(page)), pop = await boxOf(popup(page));
        high ??= z.height;
        expect(z.height, `'${at}'`).toBeCloseTo(high, 0);
        expect(z.y - (pop.y + pop.height), `'${at}': the popup over the control, clear of the grip`).toBeCloseTo(30, 0);
      }
    });
  });
});
