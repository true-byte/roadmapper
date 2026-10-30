// A save draws the new text at the same level and place, and a page held still by its address stays held.
// A step whose state changed has the just-changed look, a ring, for 3 s: on its pill or its group step where it is not drawn.
import type { Locator, Page } from '@playwright/test';
import { expect, group, level, levels, openPlan, pill, play, save, step, stopClock, test } from '../support/helpers';
import { edit, flat, nested, nodeOf, plain } from '../support/plans';

/** The plan 'plain' with a group inside its group, in the track 'Left'. It has the same three levels. */
const deeper = edit(plain, p => {
  const pair = p.branches[0].items[1];
  if (!('split' in pair)) throw new Error("'Pair' is not a group");
  pair.split[0].items.push({ name: 'Inner', split: [{ name: 'In A', items: [{ id: 'p-in', name: 'Inner one' }] }, { name: 'In B', items: [{ id: 'p-in-b', name: 'Inner two' }] }] });
});

interface Box { x: number; y: number; width: number; height: number }
const inside = (a: Box, b: Box): boolean =>
  a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y + a.height <= b.y + b.height + 0.5;
const middle = (b: Box): [number, number] => [b.x + b.width / 2, b.y + b.height / 2];
const box = async (l: Locator): Promise<Box> => {
  const b = await l.boundingBox();
  if (!b) throw new Error(`${l} is not drawn`);
  return b;
};
/** The rings of the just-changed look that show. */
const rings = (page: Page): Locator => page.locator('svg.plan .halo').locator('visible=true');
/** Goes to a level by its stop, on a stopped clock. */
async function go(page: Page, name: string): Promise<void> {
  await page.locator('.zoom').getByRole('button', { name, exact: true }).click();
  await play(page, 100);
}
/** The outer HTML of the plan. */
const drawing = (page: Page): Promise<string> => page.locator('svg.plan').evaluate(e => e.outerHTML);

test('a save draws the new text in place, with the just-changed look', async ({ page }) => {
  await test.step('a page held still by its address stays held through a save', async () => {
    // halfway between two levels, and halfway between marks and icons
    for (const [plan, hash] of [[nested, 'z=1.5'], [flat, 'u=0.5']] as const) {
      await openPlan(page, plan, { hash, store: null });
      const held = await drawing(page);
      await save(page, plan);
      expect(await drawing(page), hash).toBe(held);
    }
  });

  // on a stopped clock, so a look lasts as long as the clock is moved on
  await openPlan(page, plain, { store: null, clock: true });
  await stopClock(page);

  await test.step("a changed step rings its group step at 'Main steps'", async () => {
    await save(page, edit(plain, p => { nodeOf(p, 'p-4').state = 'done'; }));
    expect(await level(page)).toBe('Main steps');
    await expect(step(page, 'p-4')).toBeHidden();
    await expect(rings(page)).toHaveCount(1);
    await expect(group(page, 'Pair').locator('.halo')).toBeVisible();
    const [rx, ry] = middle(await box(rings(page))), [gx, gy] = middle(await box(group(page, 'Pair').locator('.coin, .aura').first()));
    expect(Math.abs(rx - gx)).toBeLessThan(1.5);
    expect(Math.abs(ry - gy)).toBeLessThan(1.5);
    await play(page, 3000);
    await expect(page.locator('svg.plan .halo')).toHaveCount(0);
  });

  await test.step('a save keeps the level, and the pill shows a new count', async () => {
    await go(page, 'Tracks');
    await save(page, edit(plain, p => {
      nodeOf(p, 'p-4').state = 'done';
      nodeOf(p, 'p-3').state = 'done';
    }));
    expect(await level(page)).toBe('Tracks');
    await expect(page.locator('.zoom').getByRole('button', { name: 'Tracks', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(pill(page, 'Left').locator('text')).toHaveText('2/2');
    await expect(pill(page, 'Left').locator('svg.mark g.node')).toHaveClass(/(^| )done( |$)/);
    await expect(step(page, 'p-3')).toBeHidden();
    await expect(rings(page)).toHaveCount(1);
    // the bar of the pill takes the pointer a little past its edge, so its box is bigger than what shows: the ring is checked around what the pill holds, on the middle of the bar
    const bar = page.locator(`svg.plan rect.zbar[data-bar="${await pill(page, 'Left').getAttribute('data-bar')}"]`);
    const ring = await box(rings(page)), at = await box(bar);
    expect(inside(await box(pill(page, 'Left')), ring), 'the ring is around the pill').toBe(true);
    const [rx, ry] = middle(ring), [px, py] = middle(at);
    expect(Math.abs(rx - px)).toBeLessThan(1.5);
    expect(Math.abs(ry - py)).toBeLessThan(1.5);
    await play(page, 3000);
  });

  await test.step("'Every step' stays when a save adds a group inside a group", async () => {
    await go(page, 'Every step');
    await save(page, deeper);
    expect(await levels(page)).toEqual(['Main steps', 'Tracks', 'Every step']);
    expect(await level(page)).toBe('Every step');
    await expect(step(page, 'p-in')).toBeVisible();
    await play(page, 3000);
  });

  await test.step('a second save keeps the look of the first step going', async () => {
    // with motion, so the ring plays
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const once = edit(deeper, p => { nodeOf(p, 'p-3').state = 'in-progress'; });
    await save(page, once);
    await play(page, 1000);
    await save(page, edit(once, p => { nodeOf(p, 'p-5').state = 'done'; }));
    // the ring of the first step goes on from where it was: it does not start again
    const ringAt = await step(page, 'p-3').locator('.halo').evaluate(e => {
      const a = e.getAnimations()[0];
      // how long it has run: since it was drawn again, plus the time before that, which its delay gives back
      return a ? Number(a.currentTime) - Number(a.effect?.getTiming().delay ?? 0) : 0;
    });
    expect(ringAt, 'the ring of the first step has run for about 1 s').toBeGreaterThan(600);
    const fresh = (id: string): Promise<boolean> => step(page, id).evaluate(e => e.classList.contains('fresh'));
    await play(page, 1999);
    expect(await fresh('p-3'), 'the first step keeps its look until 3 s after its change').toBe(true);
    await play(page, 1);
    expect(await fresh('p-3'), 'and loses it then').toBe(false);
    expect(await fresh('p-5'), 'the second step still has its look').toBe(true);
    await expect(step(page, 'p-3').locator('.halo')).toHaveCount(0);
    await play(page, 1000);
    expect(await fresh('p-5'), 'the second step loses its look 3 s after its own change').toBe(false);
    await expect(page.locator('svg.plan .halo, svg.plan .fresh')).toHaveCount(0);
  });
});
