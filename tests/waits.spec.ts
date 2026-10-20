// Waits on others: a step that waits for one not done is blocked by itself. Its side bar lists what blocks it, and 'Show only blockers' blurs all but it and them,
// scaled out as far as they need to be in sight. A name pointed at in the side bar shows where its thing is, and the back arrow shows again what the side bar showed before.
import type { Locator, Page } from '@playwright/test';
import type { Roadmap } from '../src/roadmap/types';
import { expect, level, nameOf, nameSize, openPlan, READ_PX, save, settle, side, step, test, zoomTo } from './helpers';
import { edit, full, nodeOf } from './plans';

/** Two branches: 'Long', 60 steps in a row, and 'Late', whose first step waits for the last of 'Long'. They are too far apart to be in sight at the least scale of the view. */
const far: Roadmap = {
  title: 'Far plan',
  branches: [
    { name: 'Long', items: Array.from({ length: 60 }, (_, i) => ({ id: `l-${i + 1}`, name: `Long ${i + 1}`, state: 'todo' as const })) },
    { name: 'Late', items: [{ id: 'late', name: 'Late start', state: 'todo', waitsFor: ['l-60'] }, { id: 'late-2', name: 'Late two', state: 'tbd' }] },
  ],
};

/** Clicks and waits until the plan is at rest. */
async function press(page: Page, where: Locator): Promise<void> {
  await where.click();
  await settle(page);
}
/** A part of the side bar, by its heading. */
const part = (page: Page, name: string): Locator => side(page).locator('section.part').filter({ has: page.locator('h3', { hasText: name }) });
const showOnly = (page: Page): Locator => side(page).getByRole('button', { name: 'Show only blockers' });
const showAll = (page: Page): Locator => page.getByRole('button', { name: 'Show all' });
/** The names that show at reading size while only some steps show. */
const names = (page: Page): Locator => page.locator('.roadmap .names div');
/** The ring around a thing on the plan, and the arrow at the edge toward it. */
const ring = (page: Page): Locator => page.locator('.roadmap .aim .ring');
const arrow = (page: Page): Locator => page.locator('.roadmap .aim .arrow span');

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

test('a step that waits for one not done is blocked by itself, and is not once that one is done', async ({ page }) => {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Every step');
  // the file says 'todo', and it waits for 'review', which is not done
  expect(nodeOf(full, 'launch').state).toBe('todo');
  await expect(nameOf(page, 'launch')).toHaveClass(/\bblocked\b/);
  await save(page, edit(full, c => { nodeOf(c, 'review').state = 'done'; }));
  await expect(nameOf(page, 'launch')).toHaveClass(/\btodo\b/);
  // a step that is done stays done, and is blocked by nothing
  await save(page, edit(full, c => { nodeOf(c, 'kickoff').waitsFor = ['launch']; }));
  await expect(nameOf(page, 'kickoff')).toHaveClass(/\bdone\b/);
  await press(page, step(page, 'kickoff'));
  await expect(part(page, 'Blocked by')).toHaveCount(0);
});

test('the side bar of a blocked step lists first what blocks it: the steps it waits for that are not done, and the button to show only them', async ({ page }) => {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Every step');
  await press(page, step(page, 'review'));
  await expect(side(page).locator('section.part h3').first()).toHaveText('Blocked by');
  await expect(part(page, 'Blocked by').locator('.row')).toHaveText(['Quad four', 'Path B one']);
  await expect(showOnly(page)).toBeVisible();
  // a step it waits for that is done blocks it no more
  await save(page, edit(full, c => { nodeOf(c, 'pb-1').state = 'done'; }));
  await expect(part(page, 'Blocked by').locator('.row')).toHaveText(['Quad four']);
});

test("'Show only blockers': all goes soft but the step and its blockers, their names show, the level stays, and 'Show all', Escape or empty space brings all back", async ({ page }) => {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Every step');
  await press(page, step(page, 'review'));
  const size = await nameSize(page);

  await test.step('pressed: the step and its blockers stay sharp, the rest and the side bar step aside, and their names show in the window', async () => {
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

  await test.step('Escape brings all back, and only a second one closes the side bar', async () => {
    await press(page, showOnly(page));
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(side(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
  });

  await test.step('a click on empty space brings all back, and the side bar stays', async () => {
    await press(page, step(page, 'review'));
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

test("'Show only blockers' scales out past the least scale of the view where the blockers are far apart, and back", async ({ page }) => {
  await openPlan(page, far, { store: null });
  await press(page, step(page, 'late'));
  await press(page, showOnly(page));
  expect(await nameSize(page), 'past the least scale, a fourth of reading size').toBeLessThan(READ_PX / 4);
  await expect(names(page)).toHaveText(['Late start', 'Long 60']);
  await inWindow(page, names(page));
  await press(page, showAll(page));
  expect(await nameSize(page)).toBeCloseTo(READ_PX, 1);
});

test('a name pointed at in the side bar: a ring around its step where it is in sight, or else an arrow at the edge toward it', async ({ page }) => {
  await openPlan(page, far, { store: null });
  await press(page, step(page, 'late'));

  await test.step('out of sight: an arrow at the edge, on the side of the step', async () => {
    await side(page).locator('.row', { hasText: 'Long 60' }).hover();
    await expect(arrow(page)).toBeVisible();
    await expect(ring(page)).toBeHidden();
    const a = (await arrow(page).boundingBox())!, s = (await side(page).boundingBox())!;
    expect(a.x + a.width, 'the arrow is left of the side bar').toBeLessThanOrEqual(s.x);
    expect(a.x, 'and at the right edge, toward the step').toBeGreaterThan(s.x - 120);
  });

  await test.step('in sight: a ring around it', async () => {
    await press(page, side(page).getByRole('button', { name: 'Close' }));
    await press(page, step(page, 'l-2'));
    await press(page, step(page, 'late'));
    // the back arrow stands for 'Long 2', which is in sight
    await side(page).getByRole('button', { name: 'Back' }).hover();
    await expect(ring(page)).toBeVisible();
    await expect(arrow(page)).toBeHidden();
    const r = (await ring(page).boundingBox())!, g = (await step(page, 'l-2').boundingBox())!;
    expect(r.x).toBeLessThanOrEqual(g.x);
    expect(r.x + r.width).toBeGreaterThanOrEqual(g.x + g.width);
  });

  await test.step('the pointer leaves: neither shows', async () => {
    await page.mouse.move(700, 860);
    await expect(ring(page)).toBeHidden();
    await expect(arrow(page)).toBeHidden();
  });
});

test('the back arrow shows again what the side bar showed before, and a closed side bar forgets', async ({ page }) => {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Every step');
  const back = side(page).getByRole('button', { name: 'Back' });
  await press(page, step(page, 'review'));
  await expect(back).toHaveCount(0);
  await press(page, part(page, 'Blocked by').locator('.row', { hasText: 'Quad four' }));
  await expect(side(page).locator('h2')).toHaveText('Quad four');
  await expect(back).toHaveAttribute('title', 'Back to Review');
  await press(page, back);
  await expect(side(page).locator('h2')).toHaveText('Review');
  await expect(back).toHaveCount(0);
  await press(page, part(page, 'Blocked by').locator('.row', { hasText: 'Quad four' }));
  await page.keyboard.press('Escape');
  await press(page, step(page, 'review'));
  await expect(back).toHaveCount(0);
});
