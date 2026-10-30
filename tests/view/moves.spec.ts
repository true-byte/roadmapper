// The moves: a turn to the other layout and a flip of the labels each play from where the page is to where it rests, and a press during one ends it where it was going.
// A turn keeps the level, the view and the pick, and a turn held by the address shows the plan on its way.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { Roadmap } from '../../src/roadmap/types';
import { expect, flowOf, labelsSwitch, level, nameOf, openPlan, openTools, pickLayout, play, popup, settle, side, step, stopClock, test } from '../support/helpers';
import { edit, full, nodeOf, nodesOf } from '../support/plans';

/** The roadmap of the app page, with one step in progress, 'Layout code', inside the group 'Layout build'. */
const busyLayout = edit(JSON.parse(readFileSync(new URL('../fixtures/roadmap.json', import.meta.url), 'utf8')) as Roadmap, p => {
  for (const n of nodesOf(p)) if (n.state === 'in-progress') n.state = 'todo';
  nodeOf(p, 'layout-build').state = 'in-progress';
});

/** The radio of the pair that is chosen. */
const chosen = (page: Page): Promise<string | null> =>
  popup(page).getByRole('radiogroup', { name: 'Layout', includeHidden: true }).getByRole('radio', { checked: true, includeHidden: true }).getAttribute('aria-label');
/** Is the step on the stage, whole? */
async function inSight(page: Page, id: string): Promise<boolean> {
  const s = (await step(page, id).boundingBox())!, r = (await page.locator('.roadmap .stage').boundingBox())!;
  return s.x >= r.x && s.y >= r.y && s.x + s.width <= r.x + r.width && s.y + s.height <= r.y + r.height;
}

test('a turn held halfway by the address shows the step in progress', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await openPlan(page, busyLayout, { store: null, hash: 't=0.5' });
  const [shown, busy] = await page.evaluate(() => {
    const st = document.querySelector('.roadmap .stage')!.getBoundingClientRect(), bar = document.querySelector('.roadmap .zoom')!.getBoundingClientRect(), svg = document.querySelector('svg.plan')!;
    const onStage = [...document.querySelectorAll('svg.plan g.zn')].filter(g => {
      const b = g.getBoundingClientRect();
      return getComputedStyle(g).display !== 'none' && b.width > 0 && b.right > st.left && b.left < st.right && b.bottom > st.top && b.top < st.bottom;
    }).length;
    // the step in progress, or what stands for it, in the room: on the stage and over the zoom control
    const seen = (e: Element): boolean => {
      for (let x: Element | null = e; x && x !== svg; x = x.parentElement) if (getComputedStyle(x).display === 'none' || Number(x.getAttribute('opacity') ?? 1) < 0.5) return false;
      return true;
    };
    const inRoom = [...svg.querySelectorAll('g.node.in-progress')].filter(seen).some(m => {
      const b = m.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
      return b.width > 0 && x >= st.left && x <= st.right && y >= st.top && y <= Math.min(st.bottom, bar.top);
    });
    return [onStage, inRoom];
  });
  expect(shown, 'steps on the stage').toBeGreaterThan(4);
  expect(busy, 'the step in progress in the room').toBe(true);
});

test('the pair turns the plan, and the level, view and pick stay', async ({ page }) => {
  // at 'Tracks', in marks
  await openPlan(page, full, { store: 'moves.kept', kept: { level: 1, icons: false, id: 'kickoff', fx: 0.5, fy: 0.5 } });
  expect(await level(page)).toBe('Tracks');
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

test('a turn plays 600 ms, and a press during it ends it', async ({ page }) => {
  const host = page.locator('.roadmap');
  // with motion, on a stopped clock: each move plays in the time the clock is moved on by
  await openPlan(page, full, { store: null, motion: true, clock: true });
  await stopClock(page);
  await openTools(page);
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
  const r = (await page.locator('.roadmap .stage').boundingBox())!;
  await page.mouse.move(r.x + 40, r.y + r.height / 2);
  await page.mouse.down();
  await expect(host, 'the press ends the turn').not.toHaveAttribute('data-moving');
  await page.mouse.up();
  expect(await flowOf(page)).toBe('h');
  await expect(nameOf(page, 'kickoff').first()).toBeVisible();
});

test('the labels flip for 420 ms, and a zoom ends it', async ({ page }) => {
  const host = page.locator('.roadmap');
  // with motion, on a stopped clock: each move plays in the time the clock is moved on by
  await openPlan(page, full, { store: null, motion: true, clock: true });
  await stopClock(page);
  // the width of the plan runs straight from the one with the labels shown to the one with them hidden, as the flip does
  const width = (): Promise<number> => page.locator('svg.plan').evaluate(s => (s as SVGSVGElement).viewBox.baseVal.width);
  const shown = await width();
  await openTools(page);
  await labelsSwitch(page).click();
  await page.clock.runFor(200);
  const part = await width();
  await expect(host).toHaveAttribute('data-moving');
  await page.clock.runFor(400);
  await expect(host, 'done by 600 ms').not.toHaveAttribute('data-moving');
  const hidden = await width();
  expect(hidden, 'the plan closes up').toBeLessThan(shown * 0.9);
  const w = (part - shown) / (hidden - shown);
  expect(w, 'part of the way at 200 ms').toBeGreaterThan(0.05);
  expect(w, 'part of the way at 200 ms').toBeLessThan(0.95);

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
