// What draw.ts and frame.ts draw on the page, in the fonts the page has: no name clashes at any level, in either view or layout;
// coins, marks and milestones; the drawings of groups far out; the switch 'Hide node icons'; and the stops of the zoom control.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { icons as tabler } from '@iconify-json/tabler';
import type { Locator, Page } from '@playwright/test';
import type { Roadmap } from '../../src/roadmap/types';
import {
  clashes, errorList, expect, group, iconsSwitch, labelsSwitch, level, levels, nameOf, openApp, openPlan, openTools, pickLayout, popup, reload, save, settle, showLabels,
  step, stored, test, tip, toolsButton, words, zoomTo,
} from '../support/helpers';
import { levelsOf, planOf } from '../support/layout';
import { edit, flat, full, long, nested, nodeOf, nodesOf, plain, shownAtFirst } from '../support/plans';

const roadmap = JSON.parse(readFileSync(new URL('../fixtures/roadmap.json', import.meta.url), 'utf8')) as Roadmap;

/** The drawing of an icon in Tabler: its own, or that of the icon an alias renames. */
const tablerArt = (name: string): string => tabler.icons[name]?.body ?? tabler.icons[tabler.aliases![name].parent].body;
const coinOf = (s: Locator): Locator => s.locator('.coin');
const drawingOf = (s: Locator): Locator => s.locator('.ic .art');
const markOf = (s: Locator): Locator => s.locator('.st');
type Seen = { x: number; y: number; w: number } | null;
/** Of each step: its coin, its mark and its drawing, each as its middle and width where it is drawn, or null; and the drawing as the set has it, as the browser reads it back.
 * All read at once, in the page. */
const parts = (page: Page, ids: string[]): Promise<Record<string, { coin: Seen; mark: Seen; art: Seen; drawing: string; asSet: string }>> =>
  page.evaluate(([ids, arts]) => {
    const seen = (e: Element | null): Seen => {
      const r = e?.getBoundingClientRect();
      return e && r && r.width > 0 && e.checkVisibility({ visibilityProperty: true }) ? { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width } : null;
    };
    const read = (art: string): string => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = art;
      return g.innerHTML;
    };
    return Object.fromEntries(ids.map((id, i) => {
      const g = document.querySelector(`svg.plan g.zn[data-id="${id}"]`)!, art = g.querySelector('.ic .art');
      return [id, { coin: seen(g.querySelector('.coin')), mark: seen(g.querySelector('.st')), art: seen(art), drawing: art?.innerHTML ?? '', asSet: read(arts[i]) }];
    }));
  }, [ids, ids.map(id => { const icon = nodeOf(full, id).icon; return icon && icon !== 'no-such-icon' ? tablerArt(icon) : ''; })] as const);

/** Turns 'Hide node icons' with a click, in the popup, which stays open. */
async function flip(page: Page): Promise<void> {
  await openTools(page);
  await iconsSwitch(page).click();
  await settle(page);
}
/** No step has a coin or a drawing, and no group far out has its drawing. */
async function allMarks(page: Page): Promise<void> {
  await expect(page.locator('svg.plan g.zn[data-id] .coin:visible')).toHaveCount(0);
  await expect(page.locator('svg.plan g.zn .ic:visible')).toHaveCount(0);
}
/** The popup has no switch 'Hide node icons': only 'Hide labels' and the pair of layouts. */
async function noSwitch(page: Page): Promise<void> {
  await openTools(page);
  await expect(popup(page).getByRole('switch')).toHaveCount(1);
  await expect(iconsSwitch(page)).toBeHidden();
  await expect(labelsSwitch(page)).toBeVisible();
  await expect(popup(page).getByRole('radiogroup', { name: 'Layout' })).toBeVisible();
}
/** Draws the plan in a layout, and shuts the popup. */
async function turnTo(page: Page, flow: 'Horizontal' | 'Vertical'): Promise<void> {
  await pickLayout(page, flow);
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
}
/** At every level, in both views: the check. The plan starts with its icons shown, goes in by '+', turns to its marks by I, and comes out by '-'. */
async function everyLevel(page: Page, check: (where: string) => Promise<void>): Promise<void> {
  const names = await levels(page);
  if ((await level(page)) !== names[0]) await zoomTo(page, names[0]);
  for (const view of ['icons', 'marks']) {
    const order = view === 'icons' ? names : [...names].reverse();
    for (const [i, name] of order.entries()) {
      if (i) {
        await page.keyboard.press(view === 'icons' ? '+' : '-');
        await settle(page);
      }
      expect(await level(page)).toBe(name);
      await check(`${view}, '${name}'`);
    }
    if (view === 'icons') {
      await page.keyboard.press('i');
      await settle(page);
    }
  }
}
/** How far the page, the side bar and the list of branches scroll sideways: 0 where they do not. */
const sideways = (page: Page): Promise<Record<string, number>> =>
  page.evaluate(() => {
    const over = (e: Element | null): number => (e ? e.scrollWidth - e.clientWidth : 0);
    return { page: document.documentElement.scrollWidth - window.innerWidth, body: over(document.body), side: over(document.querySelector('.side')), branches: over(document.querySelector('.branches')) };
  });

test("far out, 'full' draws groups and keeps the choice of icons", async ({ page }) => {
  // kept under the page's store, so a reload keeps the view
  await openPlan(page, full);

  await test.step("the page opens at 'Main steps', with the icons shown", async () => {
    expect(await levels(page)).toEqual(levelsOf(planOf(full)));
    expect(await level(page)).toBe('Main steps');
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(coinOf(step(page, 'kickoff'))).toBeVisible();
  });

  await test.step("'Tools' at the end of the zoom control holds 'Hide node icons'", async () => {
    await expect(page.locator('.zoom > :last-child')).toHaveAttribute('aria-label', 'Tools');
    const plus = (await page.locator('.zoom').getByRole('button', { name: 'Zoom in' }).boundingBox())!, at = (await toolsButton(page).boundingBox())!;
    expect(at.x).toBeGreaterThanOrEqual(plus.x + plus.width);
    await expect(popup(page)).toBeHidden();
    await openTools(page);
    await expect(iconsSwitch(page)).toBeVisible();
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(iconsSwitch(page)).toHaveText('Hide node icons');
  });

  await test.step('far out, tracks side by side draw as lines that part', async () => {
    for (const name of ['Two deep', 'Four steps']) {
      const art = drawingOf(group(page, name));
      await expect(art, name).toBeVisible();
      await expect(art.locator('circle'), name).toHaveCount(0);
      // one line from the left, two lines out on the right: one above the middle, one below it
      const ends = await art.evaluate(a => {
        const pts = [...a.querySelectorAll('path')].flatMap(p => {
          const len = p.getTotalLength();
          return Array.from({ length: 41 }, (_, i) => p.getPointAtLength((len * i) / 40));
        });
        const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
        const left = pts.filter(p => p.x < minX + 1).map(p => p.y), right = pts.filter(p => p.x > maxX - 1).map(p => p.y);
        return { left: Math.max(...left) - Math.min(...left), up: Math.min(...right), down: Math.max(...right), mid: left[0] };
      });
      expect(ends.left, `${name}: one line on the left`).toBeLessThan(1);
      expect(ends.up, name).toBeLessThan(ends.mid - 3);
      expect(ends.down, name).toBeGreaterThan(ends.mid + 3);
    }
  });

  await test.step('far out, steps in a row draw as three dots', async () => {
    const art = drawingOf(group(page, 'In a row'));
    await expect(art).toBeVisible();
    const dots = await art.locator('circle').evaluateAll(cs => cs.map(c => ({ x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')) })));
    expect(dots).toHaveLength(3);
    expect(new Set(dots.map(d => d.y)).size, 'on one line').toBe(1);
    expect(dots[0].x).toBeLessThan(dots[1].x);
    expect(dots[1].x).toBeLessThan(dots[2].x);
  });

  await test.step("far out, 'Hide node icons' hides the drawing of a group too", async () => {
    await flip(page);
    await allMarks(page);
    await expect(markOf(group(page, 'Two deep'))).toBeVisible();
  });

  await test.step('the choice of icons comes back after a reload', async () => {
    await reload(page);
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await allMarks(page);
    // and the choice to show them again is kept
    await flip(page);
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(coinOf(step(page, 'kickoff'))).toBeVisible();
    expect((await stored(page))?.icons).toBe(true);
  });
});

test("at 'Every step', 'full' draws coins, marks and milestones", async ({ page }) => {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Every step');
  // the steps of 'full' that name an icon that Tabler has; '24-hours' is an alias of 'hours-24'
  const iconed = nodesOf(full).filter(n => n.icon && n.icon !== 'no-such-icon'), ids = nodesOf(full).map(n => n.id);

  await test.step('a step with a known icon is a coin with its drawing', async () => {
    expect(iconed.map(n => n.id)).toEqual(['kickoff', 'plan', 'oa-1', 'pa-1', 'launch', 'later-1']);
    const now = await parts(page, iconed.map(n => n.id));
    for (const [id, p] of Object.entries(now)) expect([!!p.coin, !!p.art, p.drawing], id).toEqual([true, true, p.asSet]);
  });

  const now = await parts(page, ids);

  await test.step('a step with no known icon keeps its mark at full size', async () => {
    for (const id of ['review', 'ob-1', 'ia-1']) expect([!!now[id].mark, now[id].coin, now[id].art], id).toEqual([true, null, null]);
    expect(now.review.mark!.w).toBeGreaterThan(now.plan.mark!.w * 1.6);
  });

  await test.step('a milestone with an icon is a bigger coin', async () => {
    expect(now.kickoff.coin!.w).toBeGreaterThan(now.plan.coin!.w * 1.1);
    expect(now.launch.coin!.w).toBeCloseTo(now.kickoff.coin!.w, 0);
  });

  await test.step("the mark of the state sits small at the coin's bottom right", async () => {
    for (const id of ['kickoff', 'plan', 'oa-1']) {
      const { coin, mark } = now[id], dx = mark!.x - coin!.x, dy = mark!.y - coin!.y, out = Math.hypot(dx, dy) / (coin!.w / 2);
      expect([dx > 0, dy > 0], id).toEqual([true, true]);
      expect(out, `${id}: how far out the mark is, against the radius of the coin`).toBeGreaterThan(0.8);
      expect(out, id).toBeLessThan(1.2);
      expect(mark!.w, `${id}: the mark is small`).toBeLessThan(now.review.mark!.w * 0.6);
    }
  });

  await test.step("'Hide node icons' turns every step to its mark and back", async () => {
    await flip(page);
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await allMarks(page);
    const marks = await parts(page, ids);
    expect(ids.filter(id => !marks[id].mark), 'steps with no mark').toEqual([]);
    expect(marks.kickoff.mark!.w).toBeCloseTo(marks.review.mark!.w, 0);
    await flip(page);
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    const back = await parts(page, iconed.map(n => n.id));
    expect(Object.entries(back).filter(([, p]) => !p.coin).map(([id]) => id), 'steps with no coin').toEqual([]);
  });

  await test.step('the key I turns the switch as a click does', async () => {
    await page.keyboard.press('i');
    await settle(page);
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await allMarks(page);
    await page.keyboard.press('Shift+I');
    await settle(page);
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(coinOf(step(page, 'kickoff'))).toBeVisible();
  });

  await test.step("the name of a blocked step has the class 'blocked'", async () => {
    await expect(nameOf(page, 'launch')).toHaveClass(/\bblocked\b/);
    await expect(nameOf(page, 'kickoff')).toHaveClass(/\bdone\b/);
  });
});

for (const flow of ['Horizontal', 'Vertical'] as const) {
  test(`'full' has no clash, '${flow}', at every level and view`, async ({ page }) => {
    await openPlan(page, full, { store: null });
    await turnTo(page, flow);
    await everyLevel(page, async where => expect(await clashes(page), where).toEqual([]));
  });
}

test('the stops of the zoom control are the levels of the plan', async ({ page }) => {
  await openPlan(page, nested, { store: null });
  for (const plan of [nested, flat, plain]) {
    if (plan !== nested) await save(page, plan);
    const stops = levelsOf(planOf(plan));
    await expect(page.locator('.roadmap .title')).toHaveText(plan.title);
    expect(await levels(page), plan.title).toEqual(stops);
    expect(await level(page), plan.title).toBe(stops[0]);
    // each step is drawn once, shown or not at this level
    await expect(page.locator('svg.plan g.zn[data-id]')).toHaveCount(nodesOf(plan).length);
    await expect(errorList(page)).toBeHidden();
  }
});

test("a plan with no known icon has no 'Hide node icons'", async ({ page }) => {
  // 'plain', then 'plain' with an icon the set does not have
  await openPlan(page, plain, { store: null });
  await noSwitch(page);
  await allMarks(page);
  await save(page, edit(plain, p => { nodeOf(p, 'p-1').icon = 'no-such-icon'; }));
  await expect(page.locator('.roadmap .title')).toHaveText('Plain plan');
  await noSwitch(page);
  await allMarks(page);
});

test('the tip shows a cut name whole, inside the window', async ({ page }) => {
  await openPlan(page, long, { store: null });
  await zoomTo(page, 'Every step');
  // across, as the page first draws it, then down on a phone
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    if (width < 664) await turnTo(page, 'Vertical');
    expect(await nameOf(page, 'long-text').last().textContent(), 'cut on the plan').toMatch(/…$/);
    await step(page, 'long-text').scrollIntoViewIfNeeded();
    await step(page, 'long-text').hover();
    await expect(tip(page).locator('strong')).toHaveText(nodeOf(long, 'long-text').name);
    const t = (await tip(page).boundingBox())!;
    expect([t.x >= 0, t.x + t.width <= width], `${width}x${height}`).toEqual([true, true]);
    expect(await sideways(page), `${width}x${height}`).toEqual({ page: 0, body: 0, side: 0, branches: 0 });
  }
});

for (const flow of ['Horizontal', 'Vertical'] as const) {
  test(`the app page has no clash, '${flow}', at every level and view`, async ({ page }) => {
    await openApp(page);
    await turnTo(page, flow);
    await everyLevel(page, async where => expect(await clashes(page), where).toEqual([]));
  });
}

test("with 'Hide labels' the app page draws only the names of versions", async ({ page }) => {
  // down: layout.test.ts checks both layouts
  await openApp(page);
  const versions = shownAtFirst(roadmap).sort();
  expect((await words(page)).length, 'with the labels shown, the names').toBeGreaterThan(versions.length);
  await showLabels(page, false);
  await turnTo(page, 'Vertical');
  await everyLevel(page, async where => {
    expect((await words(page)).sort(), where).toEqual(versions);
    expect(await clashes(page), where).toEqual([]);
  });
});

test("an unknown icon set draws marks and hides 'Hide node icons'", async ({ page }) => {
  // the theme's variable, set on the page before the view starts
  await page.addInitScript(() => {
    const set = (): void => document.documentElement.style.setProperty('--icon-set', 'no-such-set');
    if (document.documentElement) set();
    else document.addEventListener('readystatechange', set, { once: true });
  });
  await openPlan(page, full);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.roadmap')!).getPropertyValue('--icon-set').trim())).toBe('no-such-set');
  await noSwitch(page);
  await allMarks(page);
  await zoomTo(page, 'Every step');
  await allMarks(page);
  await expect(page.locator('svg.plan g.zn[data-id] .st:visible')).toHaveCount(nodesOf(full).length);
});
