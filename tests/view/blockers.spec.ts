// 'Show only blockers': all goes soft but a blocked step and the steps that block it, scaled out only as far as they need to be in sight, with their names at reading size.
// 'Show all', Escape or a click on empty space brings all back; on a phone the layout holds while it shows.
import type { Locator, Page } from '@playwright/test';
import type { Roadmap } from '../../src/roadmap/types';
import { expect, flowOf, labelsSwitch, level, nameSize, openPlan, READ_PX, settle, showLabels, side, step, test, toolsButton, words } from '../support/helpers';
import { full, long, nodeOf, sideBySide } from '../support/plans';

/** Two branches: 'Long', 60 steps in a row, and 'Late', whose first step waits for the last of 'Long'. They are too far apart to be in sight at the least scale of the view. */
const far: Roadmap = {
  title: 'Far plan',
  branches: [
    { name: 'Long', items: Array.from({ length: 60 }, (_, i) => ({ id: `l-${i + 1}`, name: `Long ${i + 1}`, state: 'todo' as const })) },
    { name: 'Late', items: [{ id: 'late', name: 'Late start', state: 'todo', waitsFor: ['l-60'] }, { id: 'late-2', name: 'Late two', state: 'tbd' }] },
  ],
};
/** What a page keeps to open at 'Every step'. */
const EVERY = { level: 2, last: true, id: '-', fx: 0, fy: 0 };

/** Clicks and waits until the plan is at rest. */
async function press(page: Page, where: Locator): Promise<void> {
  await where.click();
  await settle(page);
}
const showOnly = (page: Page): Locator => side(page).getByRole('button', { name: 'Show only blockers' });
const showAll = (page: Page): Locator => page.getByRole('button', { name: 'Show all' });
/** The names that show at reading size while only some steps show. */
const names = (page: Page): Locator => page.locator('.roadmap .names div');

/** Is each box inside the window? */
async function inWindow(page: Page, boxes: Locator): Promise<void> {
  const v = page.viewportSize()!;
  for (const b of await boxes.all()) {
    const r = (await b.boundingBox())!;
    expect(r.x, `${await b.textContent()} is in the window`).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(v.width);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.height).toBeLessThanOrEqual(v.height);
  }
}
/** Which of these steps are whole in the room: their body on the stage and over the zoom control. */
const inRoom = (page: Page, ids: string[]): Promise<string[]> =>
  page.evaluate(ids => {
    const st = document.querySelector('.roadmap .stage')!.getBoundingClientRect(), bar = document.querySelector('.roadmap .zoom')!.getBoundingClientRect();
    return ids.filter(id => {
      const g = document.querySelector(`svg.plan g.zn[data-id="${id}"]`), b = (g?.querySelector('.coin') ?? g?.querySelector('.st'))?.getBoundingClientRect();
      return !!b && b.width > 0 && b.left >= st.left - 0.5 && b.right <= st.right + 0.5 && b.top >= st.top - 0.5 && b.bottom <= Math.min(st.bottom, bar.top) + 0.5;
    });
  }, ids);
/** How each name of 'Show only blockers' is written: its text, its lines, and whether it is cut; and where it sits across. */
const namesOf = (page: Page) =>
  names(page).evaluateAll(ds => ds.map(d => {
    const b = d.getBoundingClientRect();
    return { name: d.textContent, lines: Math.round(b.height / parseFloat(getComputedStyle(d).lineHeight)), cut: d.scrollHeight > d.clientHeight + 1, l: b.left, r: b.right };
  }));
/** How far the page, the side bar and the list of branches scroll sideways: 0 where they do not. */
const sideways = (page: Page): Promise<Record<string, number>> =>
  page.evaluate(() => {
    const over = (e: Element | null): number => (e ? e.scrollWidth - e.clientWidth : 0);
    return { page: document.documentElement.scrollWidth - window.innerWidth, body: over(document.body), side: over(document.querySelector('.side')), branches: over(document.querySelector('.branches')) };
  });

/** 'Show only blockers' on 'Long text design', picked: each name on 3 lines at most, cut with "…", as on the plan, and nothing scrolls sideways. */
async function longNames(page: Page): Promise<void> {
  await press(page, step(page, 'long-text'));
  await press(page, showOnly(page));
  const all = await namesOf(page);
  expect(all.map(n => n.name)).toEqual(['long-text', 'remember', 'html-export-design'].map(id => nodeOf(long, id).name));
  for (const n of all) {
    expect(n.lines, n.name!).toBeLessThanOrEqual(3);
    expect(n.cut, `${n.name} is cut`).toBe(true);
  }
  expect(await sideways(page)).toEqual({ page: 0, body: 0, side: 0, branches: 0 });
}

test("'Show only blockers' shows the step and its blockers, then all again", async ({ page }) => {
  await openPlan(page, full, { store: 'blockers.full', kept: EVERY });
  await press(page, step(page, 'review'));
  const size = await nameSize(page);

  await test.step('the step and its blockers stay sharp, and their names show', async () => {
    await press(page, showOnly(page));
    for (const id of ['review', 'q-4', 'pb-1']) await expect(step(page, id)).toHaveClass(/\bkeep\b/);
    await expect(step(page, 'kickoff')).not.toHaveClass(/\bkeep\b/);
    await expect(step(page, 'kickoff')).toHaveCSS('filter', 'blur(3px)');
    await expect(side(page)).toBeHidden();
    await expect(showAll(page)).toBeVisible();
    await expect(names(page)).toHaveText(['Review', 'Quad four', 'Path B one']);
    await inWindow(page, names(page));
    await inWindow(page, page.locator('svg.plan .zn.keep:visible'));
  });

  await test.step('the level keys do nothing', async () => {
    await page.keyboard.press('-');
    await settle(page);
    expect(await level(page)).toBe('Every step');
  });

  await test.step("'Show all' brings back the side bar and the scale", async () => {
    await press(page, showAll(page));
    await expect(side(page)).toBeVisible();
    await expect(showAll(page)).toBeHidden();
    await expect(step(page, 'kickoff')).toHaveCSS('filter', 'none');
    expect(await nameSize(page)).toBeCloseTo(size, 1);
  });
});

test("a click on empty space or a blocker ends 'Show only blockers'", async ({ page }) => {
  await openPlan(page, full, { store: 'blockers.end', kept: EVERY });
  await press(page, step(page, 'review'));

  await test.step('a click on empty space ends it, and the side bar stays', async () => {
    await press(page, showOnly(page));
    await page.mouse.click(700, 860);
    await settle(page);
    await expect(showAll(page)).toBeHidden();
    await expect(side(page)).toBeVisible();
  });

  await test.step('a click on a blocker picks it, and all comes back', async () => {
    await press(page, showOnly(page));
    await press(page, step(page, 'pb-1'));
    await expect(side(page).locator('h2')).toHaveText('Path B one');
    await expect(showAll(page)).toBeHidden();
  });
});

test("with the labels hidden, 'Show only blockers' writes no names", async ({ page }) => {
  await openPlan(page, full, { store: 'blockers.hidden', kept: { ...EVERY, labels: false } });

  await test.step('the step and its blockers stay sharp, with no name', async () => {
    await press(page, step(page, 'review'));
    await press(page, showOnly(page));
    for (const id of ['review', 'q-4', 'pb-1']) await expect(step(page, id)).toHaveClass(/\bkeep\b/);
    await expect(step(page, 'kickoff')).not.toHaveClass(/\bkeep\b/);
    await expect(showAll(page)).toBeVisible();
    await expect(page.locator('.roadmap .names')).toBeHidden();
    await expect(names(page)).toHaveCount(0);
    expect((await words(page)).sort()).toEqual(['Later', 'Main']);
  });

  await test.step('Escape brings all back, and a second Escape closes the side bar', async () => {
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(showAll(page)).toBeHidden();
    await expect(step(page, 'review')).not.toHaveClass(/\bkeep\b/);
    await expect(side(page), 'the first Escape leaves the side bar').toBeVisible();
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    expect((await words(page)).sort()).toEqual(['Later', 'Main']);
    await page.keyboard.press('Escape');
    await expect(side(page), 'a second Escape closes it').toBeHidden();
  });
});

test('blockers far apart scale out past the least scale, and back', async ({ page }) => {
  await openPlan(page, far, { store: null });
  await press(page, step(page, 'late'));
  await press(page, showOnly(page));
  expect(await nameSize(page), 'past the least scale, a fourth of reading size').toBeLessThan(READ_PX / 4);
  await expect(names(page)).toHaveText(['Late start', 'Long 60']);
  await inWindow(page, names(page));
  await press(page, showAll(page));
  expect(await nameSize(page)).toBeCloseTo(READ_PX, 1);
});

test("'Show only blockers' cuts a long name at 3 lines", async ({ page }) => {
  await test.step('at 1440x900, a long name is cut at 3 lines', async () => {
    await openPlan(page, long, { store: 'blockers.long', kept: { level: 2, last: true, id: 'long-text', fx: 0.4, fy: 0.4 } });
    await longNames(page);
  });

  await test.step('at 390x844, a long name is cut at 3 lines', async () => {
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page);
    await longNames(page);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test("'Show only blockers' keeps each blocker in the room", async ({ page }) => {
    const kept = ['k-c', 'l-c', 'l-t'];

    await test.step('at 320 px wide, each blocker and its name fit the room', async () => {
      await page.setViewportSize({ width: 320, height: 568 });
      await openPlan(page, sideBySide, { store: 'blockers.phone', kept: EVERY });
      expect(await flowOf(page)).toBe('v');
      await press(page, step(page, 'k-c'));
      await press(page, showOnly(page));
      expect(await inRoom(page, kept)).toEqual(kept);
      const all = await namesOf(page);
      expect(all).toHaveLength(3);
      for (const n of all) {
        expect(n.l, n.name!).toBeGreaterThanOrEqual(0);
        expect(n.r, n.name!).toBeLessThanOrEqual(320);
      }
      await page.keyboard.press('Escape');
      await settle(page);
    });

    await test.step('the layout holds as the phone turns, then follows the size', async () => {
      await page.setViewportSize({ width: 360, height: 640 });
      await showLabels(page, false);
      await toolsButton(page).click();
      await press(page, step(page, 'k-c'));
      await press(page, showOnly(page));
      expect(await inRoom(page, kept), 'upright').toEqual(kept);
      await page.setViewportSize({ width: 640, height: 360 });
      await settle(page);
      expect(await flowOf(page), 'on its side, the layout stays').toBe('v');
      expect(await inRoom(page, kept), 'on its side').toEqual(kept);
      await page.setViewportSize({ width: 360, height: 640 });
      await settle(page);
      expect(await inRoom(page, kept), 'upright again').toEqual(kept);
      await page.setViewportSize({ width: 640, height: 360 });
      await settle(page);
      await page.keyboard.press('Escape');
      await settle(page);
      await expect(showAll(page)).toBeHidden();
      expect(await flowOf(page), 'all back, the layout of the size').toBe('h');
    });
  });
});
