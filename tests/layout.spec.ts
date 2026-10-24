// 'Layout tests': the head on one row; the popup at the end of the zoom control, with the key in 'Key', and in 'View' the switches 'Hide node icons' and 'Hide labels', the mode and the pair of layouts,
// each of which acts on its own and leaves the popup open; the layout a view first draws, across or down, by its size; the pick of the pair, which holds for the visit and which the app keeps;
// 'Hide labels', which draws no word but the names of the versions, plays as a move and is kept; a pinch on a phone, which scales the plan and not the page;
// and in both layouts, with the labels shown and hidden, no line crosses another, runs through a name, and no name touches another.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { STATE_NAME, STATES, type Roadmap, type State } from '../src/roadmap/types';
import {
  everywhere, expect, flowOf, iconsSwitch, toolsButton, labelsSwitch, level, levels, nameOf, nameSize, openApp, openEmbed, openTools, openPlan, pickLayout, play, popup, reload,
  settle, showLabels, side, step, stopClock, stored, test, tip, words, zoomTo,
} from './helpers';
import { columns, edit, full, nodeOf, nodesOf, plain, plans, shownAtFirst } from './plans';

type Box = { x: number; y: number; width: number; height: number };
const boxOf = async (page: Page, css: string): Promise<Box> => (await page.locator(css).first().boundingBox())!;
const stageScroll = (page: Page): Promise<[number, number]> => page.locator('.roadmap .stage').evaluate(s => [s.scrollLeft, s.scrollTop]);
/** The radio of the pair that is chosen. */
const chosen = (page: Page): Promise<string | null> =>
  popup(page).getByRole('radiogroup', { name: 'Layout', includeHidden: true }).getByRole('radio', { checked: true, includeHidden: true }).getAttribute('aria-label');
/** Is the step on the stage, whole? */
async function inSight(page: Page, id: string): Promise<boolean> {
  const s = (await step(page, id).boundingBox())!, r = await boxOf(page, '.roadmap .stage');
  return s.x >= r.x && s.y >= r.y && s.x + s.width <= r.x + r.width && s.y + s.height <= r.y + r.height;
}
/** The middle of the mark of a step on the screen. */
async function markAt(page: Page, id: string): Promise<[number, number]> {
  const m = (await step(page, id).locator('.st').boundingBox())!;
  return [m.x + m.width / 2, m.y + m.height / 2];
}
/** The plan 'full' with no step canceled: a key of six, as his page has. */
const six = edit(full, p => { for (const n of nodesOf(p)) if (n.state === 'canceled') n.state = 'done'; });
/** His roadmap, as the app draws it. */
const HIS = JSON.parse(readFileSync(new URL('./roadmapper.json', import.meta.url), 'utf8')) as Roadmap;

/** What the three controls in the popup say: the icons shown or hidden, the labels shown or hidden, and the layout. Each is checked against what the plan draws. */
async function said(page: Page): Promise<{ icons: boolean; labels: boolean; flow: string | null }> {
  const s = {
    icons: (await iconsSwitch(page).getAttribute('aria-checked')) === 'false',
    labels: (await labelsSwitch(page).getAttribute('aria-checked')) === 'false',
    flow: await flowOf(page),
  };
  expect(await page.locator('svg.plan g.zn[data-id] .coin:visible').count() > 0, 'coins, where the icons show').toBe(s.icons);
  expect((await words(page)).includes('Kickoff'), 'names, where the labels show').toBe(s.labels);
  expect(await chosen(page), 'the chosen one of the pair is the layout drawn').toBe(s.flow === 'v' ? 'Vertical' : 'Horizontal');
  return s;
}
/** Presses one of the three controls, and checks that it changed its own state and no other, that the plan draws what they say, and that the popup is still open. */
async function pressed(page: Page, what: 'icons' | 'labels' | 'flow', press: () => Promise<void>): Promise<void> {
  const before = await said(page);
  await press();
  await settle(page);
  const want = { ...before, [what]: what === 'flow' ? (before.flow === 'v' ? 'h' : 'v') : !before[what] };
  expect(await said(page), `a press of ${what}`).toEqual(want);
  await expect(popup(page), `a press of ${what}`).toBeVisible();
}

test.describe('the head and the popup', () => {
  test('the head is one row, the title and how far the plan is; the key is not in it', async ({ page }) => {
    for (const [width, height] of [[1440, 900], [390, 664], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await openPlan(page, full, { store: null });
      const head = page.locator('.roadmap .head');
      expect(await head.evaluate(h => [...h.children].map(c => c.className)), `${width}x${height}`).toEqual(['title', 'progress']);
      expect((await head.boundingBox())!.height, `${width}x${height}: one row`).toBeLessThanOrEqual(44.5);
      await expect(head.locator('.key')).toHaveCount(0);
    }
  });

  test('the button at the end of the zoom control opens the popup and shuts it; the popup holds the key of the states on the plan, the switches and the pair', async ({ page }) => {
    await openPlan(page, plain, { store: null });
    const button = toolsButton(page);
    await expect(page.locator('.zoom > :last-child')).toHaveAttribute('aria-label', 'Tools');
    await expect(popup(page)).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(await button.getAttribute('aria-controls')).toBe(await popup(page).getAttribute('id'));
    await button.click();
    await expect(popup(page)).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    // the states 'plain' uses, in the order of the key, and its milestone
    const used = new Set<State>(nodesOf(plain).map(n => n.state ?? 'todo'));
    expect(await popup(page).locator('.key li').allInnerTexts()).toEqual([...STATES.filter(s => used.has(s)).map(s => STATE_NAME[s]), 'Milestone']);
    // 'plain' names no icon: 'Hide labels' is the one switch
    await expect(popup(page).getByRole('switch')).toHaveText(['Hide labels']);
    await expect(popup(page).getByRole('radiogroup', { name: 'Layout' }).getByRole('radio')).toHaveCount(2);
    await button.click();
    await expect(popup(page)).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    // a plan with icons has both switches, 'Hide node icons' first
    await openPlan(page, full, { store: null });
    await openTools(page);
    await expect(popup(page).getByRole('switch')).toHaveText(['Hide node icons', 'Hide labels']);
  });

  test('the popup lies 30 px over the end of the zoom control, clear of the grip: on a laptop its right edge on the control\'s, on a phone as wide as the control', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await openTools(page);
    let bar = await boxOf(page, '.roadmap .zoom'), pop = await boxOf(page, '.roadmap .popup');
    expect(Math.abs(pop.x + pop.width - (bar.x + bar.width)), 'right edges').toBeLessThan(1);
    expect(Math.abs(bar.y - (pop.y + pop.height) - 30), 'over the control, clear of the grip').toBeLessThan(1);
    expect(pop.width).toBeCloseTo(320, 0);
    await page.setViewportSize({ width: 390, height: 664 });
    await settle(page);
    bar = await boxOf(page, '.roadmap .zoom');
    pop = await boxOf(page, '.roadmap .popup');
    expect(Math.abs(pop.x - bar.x), 'left edges').toBeLessThan(1);
    expect(Math.abs(pop.width - bar.width), 'as wide').toBeLessThan(1);
    expect(Math.abs(bar.y - (pop.y + pop.height) - 30), 'over the control, clear of the grip').toBeLessThan(1);
  });

  test("with icons the popup is 'Key', a hairline, then 'View': 'Hide node icons' over 'Hide labels', each a row of 44 px, and a row under them: the mode at the left and the pair at the right. With a key of six it is 337 px high, and at 320 px wide the rows still fit", async ({ page }) => {
    for (const [width, height] of [[1440, 900], [844, 390], [390, 664], [360, 640], [320, 568]]) {
      const at = `${width}x${height}`;
      await page.setViewportSize({ width, height });
      await openPlan(page, six, { store: null });
      await openTools(page);
      await expect(popup(page).locator('.key li')).toHaveCount(6);
      const b = await popup(page).evaluate(p => {
        const box = (e: Element): { l: number; r: number; t: number; b: number } => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
        const opts = p.querySelector('.opts')!, [hide, hideL] = [...opts.querySelectorAll('.switch')], group = (name: string): Element => p.querySelector(`[role="radiogroup"][aria-label="${name}"]`)!;
        return {
          pop: box(p), opts: box(opts), hide: box(hide), hideL: box(hideL), mode: box(group('Mode')), pair: box(group('Layout')),
          over: Math.max(p.scrollWidth - p.clientWidth, opts.scrollWidth - opts.clientWidth), whole: p.scrollHeight + (p as HTMLElement).offsetHeight - p.clientHeight,
        };
      });
      expect(b.whole, `${at}: high, where a short view scrolls it too`).toBeCloseTo(337, 0);
      expect(b.hide.b - b.hide.t, at).toBeCloseTo(44, 0);
      expect(b.hideL.b - b.hideL.t, at).toBeCloseTo(44, 0);
      expect(b.hide.t, `${at}: 'Hide node icons' on the first row`).toBeCloseTo(b.opts.t, 0);
      expect(b.hideL.t, `${at}: 'Hide labels' under it`).toBeCloseTo(b.hide.b, 0);
      expect(b.hide.l, `${at}: at the left`).toBeCloseTo(b.opts.l, 0);
      expect(b.hideL.l, `${at}: at the left`).toBeCloseTo(b.opts.l, 0);
      expect(b.mode.t, `${at}: the mode under 'Hide labels'`).toBeGreaterThanOrEqual(b.hideL.b);
      expect(b.mode.l, `${at}: the mode at the left`).toBeCloseTo(b.opts.l, 0);
      expect(b.pair.r, `${at}: the pair at the right`).toBeCloseTo(b.opts.r, 0);
      expect(Math.abs((b.mode.t + b.mode.b) / 2 - (b.pair.t + b.pair.b) / 2), `${at}: the mode and the pair on one row`).toBeLessThanOrEqual(1);
      expect(b.mode.r, `${at}: the mode left of the pair`).toBeLessThan(b.pair.l);
      expect(b.pair.b, `${at}: the row in the popup`).toBeLessThanOrEqual(b.opts.b + 0.5);
      expect(b.over, `${at}: nothing runs over`).toBeLessThanOrEqual(0);
      expect(b.pop.l, `${at}: in the window`).toBeGreaterThanOrEqual(0);
      expect(b.pop.r, `${at}: in the window`).toBeLessThanOrEqual(width);
    }
  });

  test("on a plan with no icons 'Hide labels' is the only switch, with the mode and the pair under it, so the popup is 44 px lower; the keyboard opens the popup on it", async ({ page }) => {
    const rowOf = async (): Promise<{ high: number; under: number; row: number }> => popup(page).evaluate(p => {
      const r = (e: Element): DOMRect => e.getBoundingClientRect(), last = r([...p.querySelectorAll('.opts .switch:not([hidden])')].at(-1)!), row = r(p.querySelector('.looks')!);
      return { high: r(p).height, under: last.bottom, row: row.top };
    });
    // 'plain' with an icon on its first step: the same key, and both switches
    await openPlan(page, edit(plain, p => { nodeOf(p, 'p-1').icon = 'rocket'; }), { store: null });
    await openTools(page);
    const two = await rowOf();
    await openPlan(page, plain, { store: null });
    await openTools(page);
    await expect(popup(page).getByRole('switch')).toHaveText(['Hide labels']);
    await expect(iconsSwitch(page)).toBeHidden();
    const one = await rowOf();
    expect(two.high - one.high).toBeCloseTo(44, 0);
    expect(one.row - one.under, 'the mode and the pair under the switch').toBeCloseTo(two.row - two.under, 0);
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    await toolsButton(page).press('Enter');
    await expect(labelsSwitch(page)).toBeFocused();
  });

  test('the zoom control is a part of the popup: its stops and + act and leave it open, and so do the switches, the key I and the pair', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await openTools(page);
    await zoomTo(page, 'Tracks');
    await expect(popup(page)).toBeVisible();
    await page.locator('.zoom').getByRole('button', { name: 'Zoom in' }).click();
    await settle(page);
    expect(await level(page)).toBe('Every step');
    await expect(popup(page)).toBeVisible();
    const sw = popup(page).getByRole('switch', { name: 'Hide node icons' });
    await sw.click();
    await settle(page);
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(popup(page)).toBeVisible();
    await page.keyboard.press('i');
    await settle(page);
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(popup(page)).toBeVisible();
    await labelsSwitch(page).click();
    await settle(page);
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(popup(page)).toBeVisible();
    await pickLayout(page, 'Vertical');
    expect(await flowOf(page)).toBe('v');
    await expect(popup(page)).toBeVisible();
  });

  test('a press out of the popup shuts it and does nothing else: no pick and no zoom; the next press picks; a drag from out of it still moves the plan', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await openTools(page);
    await step(page, 'kickoff').click();
    await settle(page);
    await expect(popup(page)).toBeHidden();
    await expect(side(page), 'no pick').toBeHidden();
    await step(page, 'kickoff').click();
    await settle(page);
    await expect(side(page), 'the next press picks').toBeVisible();
    await page.keyboard.press('Escape');
    await settle(page);

    await openTools(page);
    await step(page, 'kickoff').dblclick();
    await settle(page);
    await expect(popup(page)).toBeHidden();
    expect(await level(page), 'no zoom').toBe('Main steps');
    await page.keyboard.press('Escape');
    await settle(page);

    await zoomTo(page, 'Every step');
    await openTools(page);
    // from the middle of the stage between its left edge and the popup
    const before = await stageScroll(page), r = await boxOf(page, '.roadmap .stage'), x = (r.x + (await boxOf(page, '.roadmap .popup')).x) / 2;
    await page.mouse.move(x, r.y + r.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x - 20 * i, r.y + r.height / 2);
    await page.mouse.up();
    await settle(page);
    await expect(popup(page)).toBeHidden();
    await expect(side(page)).toBeHidden();
    expect((await stageScroll(page))[0], 'the plan moved').toBeGreaterThan(before[0]);
  });

  test('Escape shuts the popup first, then the side bar; from the keyboard the focus goes into the popup and back to its button', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await step(page, 'kickoff').click();
    await settle(page);
    await expect(side(page)).toBeVisible();
    await openTools(page);
    await expect(side(page), 'over an open side bar').toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    await expect(side(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(side(page)).toBeHidden();

    await toolsButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(popup(page)).toBeVisible();
    await expect(popup(page).getByRole('switch', { name: 'Hide node icons' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(labelsSwitch(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(popup(page).getByRole('radio', { name: 'Device' }), 'the chosen one of the mode').toBeFocused();
    await page.keyboard.press('Tab');
    await expect(popup(page).getByRole('radio', { name: 'Horizontal' }), 'the chosen one of the pair').toBeFocused();
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    await expect(toolsButton(page)).toBeFocused();
  });
});

test.describe("the switches in the popup, 'Hide node icons' and 'Hide labels', and the pair of layouts: each press changes its own state and no other, and the popup stays open", () => {
  const radio = (page: Page, name: string): Locator => popup(page).getByRole('radio', { name });

  test('by a click', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await openTools(page);
    await pressed(page, 'icons', () => iconsSwitch(page).click());
    await pressed(page, 'labels', () => labelsSwitch(page).click());
    await pressed(page, 'flow', () => radio(page, 'Vertical').click());
    await pressed(page, 'icons', () => iconsSwitch(page).click());
    await pressed(page, 'labels', () => labelsSwitch(page).click());
    await pressed(page, 'flow', () => radio(page, 'Horizontal').click());
  });

  test('by the keyboard: Space and Enter on a switch, the arrows in the pair', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await toolsButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(iconsSwitch(page)).toBeFocused();
    await pressed(page, 'icons', () => page.keyboard.press('Space'));
    await page.keyboard.press('Tab');
    await expect(labelsSwitch(page)).toBeFocused();
    await pressed(page, 'labels', () => page.keyboard.press('Enter'));
    await page.keyboard.press('Tab');
    await expect(radio(page, 'Device')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(radio(page, 'Horizontal')).toBeFocused();
    await pressed(page, 'flow', () => page.keyboard.press('ArrowRight'));
    await expect(radio(page, 'Vertical')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(labelsSwitch(page)).toBeFocused();
    await pressed(page, 'labels', () => page.keyboard.press('Space'));
    await page.keyboard.press('Shift+Tab');
    await expect(iconsSwitch(page)).toBeFocused();
    await pressed(page, 'icons', () => page.keyboard.press('Enter'));
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    await expect(radio(page, 'Vertical'), 'the chosen one of the pair').toBeFocused();
    await pressed(page, 'flow', () => page.keyboard.press('ArrowLeft'));
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

    test('by a tap of a finger', async ({ page }) => {
      await openPlan(page, full, { store: null });
      expect(await flowOf(page)).toBe('v');
      await toolsButton(page).tap();
      await expect(popup(page)).toBeVisible();
      await pressed(page, 'icons', () => iconsSwitch(page).tap());
      await pressed(page, 'labels', () => labelsSwitch(page).tap());
      await pressed(page, 'flow', () => radio(page, 'Horizontal').tap());
      await pressed(page, 'icons', () => iconsSwitch(page).tap());
      await pressed(page, 'labels', () => labelsSwitch(page).tap());
      await pressed(page, 'flow', () => radio(page, 'Vertical').tap());
    });
  });
});

test.describe('the two layouts', () => {
  test('a view first draws down on an upright screen under 664 px wide, and across on a wider one, on one that lies, and in a box at any size', async ({ page }) => {
    const sizes: [number, number, string][] = [[390, 664, 'v'], [360, 640, 'v'], [500, 900, 'v'], [844, 390, 'h'], [700, 900, 'h'], [1440, 900, 'h']];
    for (const [width, height, flow] of sizes) {
      await page.setViewportSize({ width, height });
      await openPlan(page, full, { store: null });
      expect(await flowOf(page), `${width}x${height}`).toBe(flow);
      expect(await chosen(page), `${width}x${height}: the chosen one of the pair`).toBe(flow === 'v' ? 'Vertical' : 'Horizontal');
      await expect(nameOf(page, 'kickoff').first()).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 664 });
    await openEmbed(page, { plan: full });
    expect(await flowOf(page), 'a box').toBe('h');
  });

  test('a pick of the pair turns the plan, with the level, the view, the pick and its side bar as they were, and the picked step in sight', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await zoomTo(page, 'Tracks');
    await page.keyboard.press('i');
    await settle(page);
    await step(page, 'kickoff').click();
    await settle(page);
    for (const [name, flow] of [['Vertical', 'v'], ['Horizontal', 'h']] as const) {
      await pickLayout(page, name);
      expect(await flowOf(page), name).toBe(flow);
      expect(await chosen(page)).toBe(name);
      expect(await level(page), name).toBe('Tracks');
      await expect(popup(page).getByRole('switch', { name: 'Hide node icons' }), name).toHaveAttribute('aria-checked', 'true');
      await expect(side(page).locator('h2'), name).toHaveText('Kickoff');
      expect(await inSight(page, 'kickoff'), name).toBe(true);
      // down, the name starts right of its step; across, it is centred over it
      const s = (await step(page, 'kickoff').boundingBox())!, n = (await nameOf(page, 'kickoff').first().boundingBox())!;
      if (flow === 'v') expect(n.x, 'right of the step').toBeGreaterThan(s.x + s.width / 2);
      else expect(n.y + n.height, 'over the step').toBeLessThan(s.y + s.height / 2);
    }
  });

  test('the pick holds when the window changes size; with no pick, the layout follows the size, and a phone turned back draws its first view again', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await pickLayout(page, 'Vertical');
    await page.setViewportSize({ width: 1200, height: 900 });
    await settle(page);
    expect(await flowOf(page), 'picked down, at 1200 px').toBe('v');
    await pickLayout(page, 'Horizontal');
    await page.setViewportSize({ width: 500, height: 900 });
    await settle(page);
    expect(await flowOf(page), 'picked across, at 500 px').toBe('h');

    await page.setViewportSize({ width: 390, height: 664 });
    await openPlan(page, full, { store: null });
    expect(await flowOf(page)).toBe('v');
    const first = await stageScroll(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await settle(page);
    expect(await flowOf(page), 'on its side').toBe('h');
    await page.setViewportSize({ width: 390, height: 664 });
    await settle(page);
    expect(await flowOf(page), 'upright again').toBe('v');
    const again = await stageScroll(page);
    expect(Math.abs(again[0] - first[0]) + Math.abs(again[1] - first[1]), 'the same first view').toBeLessThan(2);
  });

  test('the app keeps the pick and draws it again after a reload; a store from before the pair draws by the size, at its level', async ({ page }) => {
    await openPlan(page, full);
    await pickLayout(page, 'Vertical');
    expect((await stored(page))?.flow).toBe('v');
    await reload(page);
    expect(await flowOf(page), 'after a reload').toBe('v');

    await page.setViewportSize({ width: 390, height: 664 });
    await openPlan(page, full, { store: 'layout.across', kept: { level: 1, icons: true, flow: 'h', scale: 1, id: 'kickoff', fx: 0.5, fy: 0.5 } });
    expect(await flowOf(page), 'kept across, on a phone').toBe('h');
    expect(await level(page)).toBe('Tracks');
    await openPlan(page, full, { store: 'layout.before', kept: { level: 1, icons: true, scale: 1, id: 'kickoff', fx: 0.5, fy: 0.5 } });
    expect(await flowOf(page), 'kept with no pick, on a phone').toBe('v');
    expect(await level(page)).toBe('Tracks');
  });

  test('down on a phone, a new level keeps the column of the step in progress whole on the screen: what an edge cuts is of the columns beside it', async ({ page }) => {
    // at 'Tracks' and 'Every step' one column fits a phone, two do not
    await page.setViewportSize({ width: 390, height: 664 });
    await openPlan(page, columns('Three-d'), { store: null });
    expect(await flowOf(page)).toBe('v');
    for (const at of ['Tracks', 'Every step']) {
      // the bar of a phone has no + button: the key
      await page.keyboard.press('+');
      await settle(page);
      expect(await level(page)).toBe(at);
      // the texts of the column 'Three' as drawn: its caption, the names of its steps, its group name and the captions of its tracks
      const cut = await page.evaluate(() => {
        const st = document.querySelector('.roadmap .stage')!, r = st.getBoundingClientRect(), right = r.left + st.clientWidth;
        const seen = (e: Element): boolean => getComputedStyle(e).display !== 'none' && Number(e.getAttribute('opacity') ?? 1) > 0.5;
        const texts = [...document.querySelectorAll('svg.plan text')].filter(t => seen(t) && /^(Three|Code|Tests)/.test(t.textContent ?? ''));
        // the captions 'Code' and 'Tests' of the column 'Three': those right of its own caption and before the next column's
        const three = texts.find(t => t.textContent === 'Three')!.getBoundingClientRect().left;
        const four = [...document.querySelectorAll('svg.plan text')].find(t => t.textContent === 'Four')?.getBoundingClientRect().left ?? Infinity;
        return texts.filter(t => { const b = t.getBoundingClientRect(); return b.left >= three - 40 && b.left < four - 20; })
          .filter(t => { const b = t.getBoundingClientRect(); return b.left < r.left - 0.5 || b.right > right + 0.5; }).map(t => t.textContent);
      });
      expect(cut, `${at}: cut at an edge`).toEqual([]);
      await expect(nameOf(page, 'Three-d')).toBeVisible();
    }
  });

  test('with motion, a turn plays for 600 ms, and a press during it ends it where it was going', async ({ page }) => {
    await openPlan(page, full, { store: null, motion: true, clock: true });
    await stopClock(page);
    await openTools(page);
    const host = page.locator('.roadmap');
    await popup(page).getByRole('radio', { name: 'Vertical' }).click();
    await page.clock.runFor(300);
    await expect(host, 'half way').toHaveAttribute('data-moving');
    await play(page, 400);
    expect(await flowOf(page)).toBe('v');
    await expect(host).not.toHaveAttribute('data-moving');
    await expect(nameOf(page, 'kickoff').first()).toBeVisible();

    await popup(page).getByRole('radio', { name: 'Horizontal' }).click();
    await page.clock.runFor(100);
    await expect(host).toHaveAttribute('data-moving');
    const r = await boxOf(page, '.roadmap .stage');
    await page.mouse.move(r.x + 40, r.y + r.height / 2);
    await page.mouse.down();
    await expect(host, 'the press ends the turn').not.toHaveAttribute('data-moving');
    await page.mouse.up();
    expect(await flowOf(page)).toBe('h');
    await expect(nameOf(page, 'kickoff').first()).toBeVisible();
  });
});

test.describe("'Hide labels'", () => {
  test('on his page, with the labels hidden, the plan draws no word but the names of the versions that show: at every level, in both layouts and in both views', async ({ page }) => {
    // a version whose steps are all done or canceled is hidden at first
    const versions = shownAtFirst(HIS).sort();
    await openApp(page);
    expect((await words(page)).length, 'with the labels shown, the names').toBeGreaterThan(versions.length);
    await showLabels(page, false);
    for (const flow of ['Horizontal', 'Vertical'] as const) {
      await pickLayout(page, flow);
      for (const view of ['icons', 'marks']) {
        if (view === 'marks') {
          await page.keyboard.press('i');
          await settle(page);
        }
        for (const at of await levels(page)) {
          await zoomTo(page, at);
          expect((await words(page)).sort(), `${flow}, ${view}, '${at}'`).toEqual(versions);
        }
        if (view === 'marks') {
          await page.keyboard.press('i');
          await settle(page);
        }
      }
    }
  });

  test('the app keeps the labels hidden and draws them so after a reload, and shown again; what an older page kept, with no labels, opens with them shown', async ({ page }) => {
    await openPlan(page, full);
    await showLabels(page, false);
    expect((await stored(page))?.labels).toBe(false);
    await reload(page);
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    expect((await words(page)).sort(), 'after a reload').toEqual(['Later', 'Main']);
    await showLabels(page, true);
    expect((await stored(page))?.labels).toBe(true);
    await reload(page);
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(nameOf(page, 'kickoff').first()).toBeVisible();

    await openPlan(page, full, { store: 'labels.before', kept: { level: 1, icons: true, flow: 'h', scale: 1, id: 'kickoff', fx: 0.5, fy: 0.5 } });
    expect(await level(page)).toBe('Tracks');
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(nameOf(page, 'kickoff').first()).toBeVisible();
  });

  test('with motion, the flip plays for 420 ms: part of the way at 200 ms, done by 600; a level press during it ends it where it was going, and then zooms', async ({ page }) => {
    await openPlan(page, full, { store: null, motion: true, clock: true });
    await stopClock(page);
    const host = page.locator('.roadmap');
    // the width of the plan runs straight from the one with the labels shown to the one with them hidden, as the flip does
    const width = (): Promise<number> => page.locator('svg.plan').evaluate(s => (s as SVGSVGElement).viewBox.baseVal.width);
    const shown = await width();
    await openTools(page);
    await labelsSwitch(page).click();
    await play(page, 1000);
    const hidden = await width();
    expect(hidden, 'the plan closes up').toBeLessThan(shown * 0.9);
    await labelsSwitch(page).click();
    await play(page, 1000);
    expect(await width()).toBeCloseTo(shown, 1);

    await labelsSwitch(page).click();
    await page.clock.runFor(200);
    const w = ((await width()) - shown) / (hidden - shown);
    expect(w, 'part of the way at 200 ms').toBeGreaterThan(0.05);
    expect(w, 'part of the way at 200 ms').toBeLessThan(0.95);
    await expect(host).toHaveAttribute('data-moving');
    await page.clock.runFor(400);
    expect(await width(), 'done by 600 ms').toBeCloseTo(hidden, 1);
    await expect(host).not.toHaveAttribute('data-moving');

    // back on the way to the labels shown, a level press 120 ms in
    await labelsSwitch(page).click();
    await page.clock.runFor(120);
    expect(await width(), 'on its way').toBeLessThan(shown - 1);
    await page.locator('.zoom').getByRole('button', { name: 'Tracks', exact: true }).click();
    expect(await width(), "the flip ends at once, at 'Main steps' with the labels shown").toBeCloseTo(shown, 1);
    await expect(host, 'and the zoom is on its way').toHaveAttribute('data-moving');
    await play(page, 1500);
    expect(await level(page)).toBe('Tracks');
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(nameOf(page, 'kickoff').first()).toBeVisible();
  });

  test('with the labels and the icons hidden, a hover 14 px off a mark shows its tip, and the level stays', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await showLabels(page, false);
    await iconsSwitch(page).click();
    await settle(page);
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    const m = (await step(page, 'plan').locator('.st').boundingBox())!, [x, y] = await markAt(page, 'plan');
    expect(m.width / 2, 'the mark is less than 14 px across from its middle').toBeLessThan(14);
    for (const [dx, dy] of [[0, -14], [14, 0]]) {
      await page.mouse.move(x + dx, y + dy);
      await expect(tip(page), `${dx}, ${dy}`).toBeVisible();
      await expect(tip(page), `${dx}, ${dy}`).toContainText('Plan');
      await page.mouse.move(700, 880);
      await expect(tip(page)).toBeHidden();
    }
    expect(await level(page)).toBe('Main steps');
  });

  test("'Show only blockers' with the labels hidden lights the step and its blockers, and writes no names; Escape brings all back with the labels still hidden", async ({ page }) => {
    await openPlan(page, full, { store: null });
    await zoomTo(page, 'Every step');
    await showLabels(page, false);
    await page.keyboard.press('Escape');
    await step(page, 'review').click();
    await settle(page);
    await side(page).getByRole('button', { name: 'Show only blockers' }).click();
    await settle(page);
    for (const id of ['review', 'q-4', 'pb-1']) await expect(step(page, id)).toHaveClass(/\bkeep\b/);
    await expect(step(page, 'kickoff')).not.toHaveClass(/\bkeep\b/);
    await expect(page.getByRole('button', { name: 'Show all' })).toBeVisible();
    await expect(page.locator('.roadmap .names')).toBeHidden();
    await expect(page.locator('.roadmap .names div')).toHaveCount(0);
    expect((await words(page)).sort()).toEqual(['Later', 'Main']);
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(page.getByRole('button', { name: 'Show all' })).toBeHidden();
    await expect(step(page, 'review')).not.toHaveClass(/\bkeep\b/);
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    expect((await words(page)).sort()).toEqual(['Later', 'Main']);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

    test('with the labels and the icons hidden, a tap 17 px off a mark opens its sheet, and the level stays', async ({ page }) => {
      await openPlan(page, full, { store: null });
      expect(await flowOf(page)).toBe('v');
      await showLabels(page, false);
      await iconsSwitch(page).click();
      await settle(page);
      await toolsButton(page).click();
      // the tidy after each switch keeps the plan clear of the open popup: the top of the plan comes back into sight
      await page.locator('.roadmap .stage').evaluate(s => { s.scrollTop = 0; });
      await settle(page);
      await expect(popup(page)).toBeHidden();
      const m = (await step(page, 'plan').locator('.st').boundingBox())!, [x, y] = await markAt(page, 'plan');
      expect(m.width / 2, 'the mark is less than 17 px across from its middle').toBeLessThan(17);
      await page.touchscreen.tap(x + 17, y);
      await expect(side(page)).toBeVisible();
      await expect(side(page).locator('h2')).toHaveText('Plan');
      expect(await level(page)).toBe('Main steps');
    });
  });
});

test.describe('on a phone, a pinch of two fingers', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test("scales the plan, not the page: the page's own zoom stays at 1, the point between the fingers stays put, and the level stays", async ({ page }) => {
    await openPlan(page, full, { store: null });
    const before = await nameSize(page), r = (await page.locator('.roadmap .stage').boundingBox())!;
    const [cx, cy] = [r.x + r.width / 2, r.y + r.height / 2];
    // the step nearest the point between the fingers, and how far it is from it
    const [sx, sy] = await markAt(page, 'plan'), off = [sx - cx, sy - cy];
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', at: [number, number][]): Promise<unknown> =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: at.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    // from 40 px apart to 80
    await touch('touchStart', [[cx - 20, cy], [cx + 20, cy]]);
    for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx - 20 - 2 * i, cy], [cx + 20 + 2 * i, cy]]);
    await touch('touchEnd', []);
    await settle(page);
    expect(await page.evaluate(() => window.visualViewport?.scale), "the page's own zoom").toBe(1);
    expect(await nameSize(page), 'the plan is twice as big').toBeCloseTo(before * 2, 0);
    const [ax, ay] = await markAt(page, 'plan');
    expect(Math.abs(ax - (cx + off[0] * 2)), 'the plan scales around the point between the fingers').toBeLessThan(4);
    expect(Math.abs(ay - (cy + off[1] * 2))).toBeLessThan(4);
    expect(await level(page)).toBe('Main steps');
  });
});

/** What is wrong with the plan as drawn: a line that crosses another, a line through a name, a caption, a group name or a count, a line through a step other than
 * the lane it sits on, and a name on another, on a step, on a pill or across the edge of a frame. In the units of the plan. Two lines that lie on each other, as at a shared corner, do not cross. */
async function faults(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('svg.plan')!, vb = svg.viewBox.baseVal, sr = svg.getBoundingClientRect(), k = sr.width / vb.width;
    const seen = (e: Element): boolean => {
      for (let x: Element | null = e; x && x !== svg; x = x.parentElement) {
        if (getComputedStyle(x).display === 'none' || Number(x.getAttribute('opacity') ?? 1) <= 0.5) return false;
      }
      return true;
    };
    type B = { k: string; who: string; x0: number; y0: number; x1: number; y1: number };
    const toPlan = (r: DOMRect, key: string, who = key): B => ({ k: key, who, x0: (r.left - sr.left) / k, y0: (r.top - sr.top) / k, x1: (r.right - sr.left) / k, y1: (r.bottom - sr.top) / k });
    // a text: across its drawn letters, and from the top of its capitals to under its baseline
    const UP: Record<string, [number, number]> = { label: [10, 3.2], cap: [8.6, 0.5], gname: [9.5, 3], count: [8.4, 2.6] };
    const texts: B[] = [];
    for (const cls of Object.keys(UP)) for (const t of svg.querySelectorAll<SVGTextElement>(`text.${cls}`)) {
      if (!t.textContent || !seen(t)) continue;
      const b = t.getBBox(), y = Number(t.getAttribute('y'));
      if (!b.width) continue;
      const who = t.dataset.id ?? t.dataset.pod ?? t.dataset.bar ?? t.textContent;
      texts.push({ k: `${cls} '${t.textContent}'`, who: `${cls}:${who}`, x0: b.x, x1: b.x + b.width, y0: y - UP[cls][0], y1: y + UP[cls][1] });
    }
    // a step as drawn: not the clear disc around it that takes a finger where the labels are hidden
    const drawn = (g: Element): DOMRect => {
      const rs = [...g.querySelectorAll('*')].filter(c => c.tagName !== 'g' && !c.classList.contains('tap')).map(c => c.getBoundingClientRect()).filter(r => r.width || r.height);
      if (!rs.length) return g.getBoundingClientRect();
      const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
      return new DOMRect(l, t, Math.max(...rs.map(r => r.right)) - l, Math.max(...rs.map(r => r.bottom)) - t);
    };
    const things = [...svg.querySelectorAll('g.zn, g.tally')].filter(seen).map(g => toPlan(drawn(g), `the step ${(g as SVGGElement).dataset.id ?? (g as SVGGElement).dataset.pod ?? (g as SVGGElement).dataset.bar}`));
    const frames = [...svg.querySelectorAll('rect.group')].filter(seen).map(f => toPlan(f.getBoundingClientRect(), 'a frame'));
    const on = (a: B, b: B, pad = 0.5): boolean => a.x0 < b.x1 - pad && b.x0 < a.x1 - pad && a.y0 < b.y1 - pad && b.y0 < a.y1 - pad;
    const out: string[] = [];
    texts.forEach((a, i) => {
      for (const b of texts.slice(i + 1)) if (a.who !== b.who && on(a, b)) out.push(`${a.k} on ${b.k}`);
      for (const s of things) if (on(a, s)) out.push(`${a.k} on ${s.k}`);
      for (const f of frames) {
        const across = (a.x0 < f.x0 && a.x1 > f.x0) || (a.x0 < f.x1 && a.x1 > f.x1), down = (a.y0 < f.y0 && a.y1 > f.y0) || (a.y0 < f.y1 && a.y1 > f.y1);
        if ((across && a.y1 > f.y0 && a.y0 < f.y1) || (down && a.x1 > f.x0 && a.x0 < f.x1)) out.push(`${a.k} across the edge of a frame`);
      }
    });
    // each line, a point every 2 px on the screen
    const step = 2 / k, end = 3 / k;
    const lines = [...svg.querySelectorAll<SVGPathElement>('path.lane')].filter(seen).map((e, i) => {
      const n = e.getTotalLength(), pts: [number, number, number][] = [];
      for (let s = 0; s < n; s += step) { const q = e.getPointAtLength(s); pts.push([q.x, q.y, s]); }
      const q = e.getPointAtLength(n);
      pts.push([q.x, q.y, n]);
      // the box of its points
      const box = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
      return { k: `line ${i} (${(e.getAttribute('d') ?? '').slice(0, 24)})`, n, pts, box };
    });
    for (const l of lines) for (const t of texts) if (l.pts.some(([x, y]) => x > t.x0 + 0.8 && x < t.x1 - 0.8 && y > t.y0 + 0.8 && y < t.y1 - 0.8)) out.push(`${l.k} through ${t.k}`);
    // a step as a body: its coin, or else its mark with the ring of a milestone. A line through it, but for the lane it sits on, which runs through its middle,
    // makes the branches seem to part or join at it
    const bodies = [...svg.querySelectorAll<SVGGElement>('g.zn')].filter(seen).flatMap(g => {
      const coin = g.querySelector('.coin'), parts = coin && seen(coin) && coin.getBoundingClientRect().width > 1 ? [coin] : [...g.querySelectorAll('.st, .ms')].filter(seen);
      const rs = parts.map(c => c.getBoundingClientRect()).filter(r => r.width > 0.5);
      if (!rs.length) return [];
      const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), b = toPlan(new DOMRect(l, t, Math.max(...rs.map(r => r.right)) - l, Math.max(...rs.map(r => r.bottom)) - t), 'body');
      return [{ k: `the step ${g.dataset.id ?? g.dataset.pod}`, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, r: Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 }];
    });
    for (const l of lines) for (const s of bodies) {
      let near = Infinity;
      for (const [x, y] of l.pts) near = Math.min(near, Math.hypot(x - s.x, y - s.y));
      if (near > 1.5 && near < s.r - 1.5) out.push(`${l.k} through ${s.k}`);
    }
    const cross = (p: number[], q: number[], r: number[], s: number[]): number => {
      const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
      if (Math.abs(d) < 1e-9) return 0;
      const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
      if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return 0;
      let a = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0]) - Math.atan2(s[1] - r[1], s[0] - r[0])) % Math.PI;
      a = Math.min(a, Math.PI - a);
      return (a * 180) / Math.PI;
    };
    const far = (p: number[], a: number[], b: number[]): number => {
      const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    /** Do the points of P from its `from`-th to its `to`-th all lie on Q? */
    const along = (P: number[][], from: number, to: number, Q: number[][]): boolean => {
      for (let m = Math.max(0, from); m <= Math.min(P.length - 1, to); m++) {
        let best = Infinity;
        for (let q = 0; q + 1 < Q.length; q++) best = Math.min(best, far(P[m], Q[q], Q[q + 1]));
        if (best > 0.8) return false;
      }
      return true;
    };
    // the points of P near its i-th all lie on Q
    const lies = (P: number[][], i: number, Q: number[][]): boolean => along(P, i - 3, i + 4, Q);
    // where a line comes onto another and runs on along it, or leaves it, the two only touch: on one side of the point the two are one line.
    // The point every 2 px cuts the curve that comes onto the other line, so the piece between two points seems to cross it there
    const touch = (A: number[][], a: number, B: number[][], b: number): boolean =>
      (along(A, a + 1, a + 4, B) && along(B, b + 1, b + 4, A)) || (along(A, a - 3, a, B) && along(B, b - 3, b, A));
    lines.forEach((A, i) => {
      for (const B of lines.slice(i + 1)) {
        // two lines whose boxes do not meet cannot cross, so their points are not compared
        if (A.box[2] < B.box[0] || B.box[2] < A.box[0] || A.box[3] < B.box[1] || B.box[3] < A.box[1]) continue;
        let hit = false;
        for (let a = 0; a + 1 < A.pts.length && !hit; a++) {
          if (A.pts[a][2] < end || A.pts[a + 1][2] > A.n - end) continue;
          for (let b = 0; b + 1 < B.pts.length && !hit; b++) {
            if (B.pts[b][2] < end || B.pts[b + 1][2] > B.n - end) continue;
            if (cross(A.pts[a], A.pts[a + 1], B.pts[b], B.pts[b + 1]) > 10 && !(lies(A.pts, a, B.pts) && lies(B.pts, b, A.pts)) && !touch(A.pts, a, B.pts, b)) hit = true;
          }
        }
        if (hit) out.push(`${A.k} crosses ${B.k}`);
      }
    });
    return out;
  });
}

test('the check of a plan as drawn finds a name moved onto another step, a line drawn across the plan, and a line through a step off its middle', async ({ page }) => {
  await openPlan(page, full, { store: null });
  await pickLayout(page, 'Vertical');
  expect(await faults(page)).toEqual([]);
  // the name of the first step, put on the coin of the next one
  await page.evaluate(() => {
    const name = document.querySelector('.roadmap[data-flow="v"] svg.plan text.label.down[data-id="kickoff"]')!, coin = document.querySelector('svg.plan g.zn[data-id="plan"]')!;
    const svg = document.querySelector<SVGSVGElement>('svg.plan')!, k = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width, c = coin.getBoundingClientRect(), s = svg.getBoundingClientRect();
    name.setAttribute('x', String((c.left - s.left) / k));
    name.setAttribute('y', String((c.top + c.height / 2 - s.top) / k));
  });
  expect(await faults(page)).toContainEqual(expect.stringContaining("label 'Kickoff' on the step plan"));
  await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('svg.plan')!, vb = svg.viewBox.baseVal;
    const e = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    e.setAttribute('class', 'lane');
    e.setAttribute('d', `M 0 ${vb.height * 0.55} L ${vb.width} ${vb.height * 0.55 - vb.width * Math.tan(Math.PI / 9)}`);
    svg.append(e);
  });
  expect((await faults(page)).filter(f => f.includes('crosses')).length).toBeGreaterThan(0);
  // a short line across the coin of 'Launch', a third of its radius under its middle
  await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('svg.plan')!, k = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width, s = svg.getBoundingClientRect();
    const c = document.querySelector('svg.plan g.zn[data-id="launch"] .coin')!.getBoundingClientRect(), r = c.width / 2 / k;
    const x = (c.left + c.width / 2 - s.left) / k, y = (c.top + c.height / 2 - s.top) / k + r / 3;
    const e = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    e.setAttribute('class', 'lane');
    e.setAttribute('d', `M ${x - 2 * r} ${y} L ${x + 2 * r} ${y}`);
    svg.append(e);
  });
  expect(await faults(page)).toContainEqual(expect.stringContaining('through the step launch'));
});

/** The layouts, in the order the plan turns to them: 'Horizontal' after 'Vertical', so it is drawn after a turn. */
const FLOWS = ['Vertical', 'Horizontal'] as const;
/** Draws the plan in a layout, through the layouts before it in FLOWS, and shuts the popup. */
async function turnTo(page: Page, flow: (typeof FLOWS)[number]): Promise<void> {
  for (const f of FLOWS.slice(0, FLOWS.indexOf(flow) + 1)) await pickLayout(page, f);
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
}

// a test for each layout: the work of one test grows as the computer gets slower, and this keeps it well inside the time a test has
for (const [name, plan] of Object.entries(plans)) for (const flow of FLOWS) {
  test(`'${name}', '${flow}': at every level and in both views, no line crosses another or runs through a name, and no name touches another, a step, a pill or the edge of a frame`, async ({ page }) => {
    await openPlan(page, plan, { store: null });
    await turnTo(page, flow);
    await everywhere(page, async where => expect(await faults(page), `${flow}, ${where}`).toEqual([]));
  });

  test(`'${name}', '${flow}': with the labels hidden, at every level and in both views, the plan draws no word but the names of its versions that show, and no line crosses another or runs through one`, async ({ page }) => {
    const versions = shownAtFirst(plan).sort();
    // a long name of a version is written on one line, cut with "…": it stands for the name it starts
    const whole = (w: string): string => versions.find(v => v === w || (w.endsWith('…') && v.startsWith(w.slice(0, -1)))) ?? w;
    await openPlan(page, plan, { store: null });
    await showLabels(page, false);
    await turnTo(page, flow);
    await everywhere(page, async where => {
      expect((await words(page)).map(whole).sort(), `${flow}, ${where}`).toEqual(versions);
      expect(await faults(page), `${flow}, ${where}`).toEqual([]);
    });
  });
}
