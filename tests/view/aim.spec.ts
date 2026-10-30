// A name pointed at in the side bar shows where its thing is: a ring around it where it is in sight, or else an arrow at the edge toward it.
import type { Locator, Page } from '@playwright/test';
import type { Roadmap } from '../../src/roadmap/types';
import { expect, openPlan, settle, side, step, test } from '../support/helpers';

/** Two branches: 'Long', 60 steps in a row, and 'Late', whose first step waits for the last of 'Long', far out of sight. */
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
/** The ring around a thing on the plan, and the arrow at the edge toward it. */
const ring = (page: Page): Locator => page.locator('.roadmap .aim .ring');
const arrow = (page: Page): Locator => page.locator('.roadmap .aim .arrow span');

test('a hover on a side bar name shows where its step is', async ({ page }) => {
  await openPlan(page, far, { store: null });
  await press(page, step(page, 'late'));

  await test.step('a step out of sight gets an arrow at the edge', async () => {
    await side(page).locator('.row', { hasText: 'Long 60' }).hover();
    await expect(arrow(page)).toBeVisible();
    await expect(ring(page)).toBeHidden();
    const a = (await arrow(page).boundingBox())!, s = (await side(page).boundingBox())!;
    expect(a.x + a.width, 'the arrow is left of the side bar').toBeLessThanOrEqual(s.x);
    expect(a.x, 'and at the right edge, toward the step').toBeGreaterThan(s.x - 120);
  });

  await test.step('a step in sight gets a ring around it', async () => {
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

  await test.step('the ring and the arrow go when the pointer leaves', async () => {
    await page.mouse.move(700, 860);
    await expect(ring(page)).toBeHidden();
    await expect(arrow(page)).toBeHidden();
  });
});
