// The keys, the right button and the double click: + and − zoom, a double click goes one level in around its point,
// a click never zooms, and a press that shuts the popup does nothing else. A key typed into a text field of the page is that field's.
import type { Page } from '@playwright/test';
import {
  caption, expect, group, iconsSwitch, level, openPlan, openTools, pill, play, popup, save, settle, side, step, stopClock, test, toolsButton, zoomTo,
} from '../support/helpers';
import { full, plain } from '../support/plans';

type Box = { x: number; y: number; width: number; height: number };
const middle = (b: Box): [number, number] => [b.x + b.width / 2, b.y + b.height / 2];
const markAt = async (page: Page, id: string): Promise<[number, number]> => middle((await step(page, id).locator('.st').boundingBox())!);
const near = (a: [number, number], b: [number, number]): void => {
  expect(Math.abs(a[0] - b[0]), `x: ${a[0]} against ${b[0]}`).toBeLessThan(1);
  expect(Math.abs(a[1] - b[1]), `y: ${a[1]} against ${b[1]}`).toBeLessThan(1);
};
const width = (page: Page): Promise<string | null> => page.locator('svg.plan').getAttribute('width');
/** Empty space on the plan 'full': between its two top-level branches, wherever the plan is scrolled across. */
const EMPTY = { x: 700, y: 480 };

/** The frame of an open group, found by the name over its top left corner. */
const frameOf = (page: Page, name: string): Promise<Box> =>
  page.evaluate(n => {
    const drawn = (e: Element): boolean => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
    const a = [...document.querySelectorAll('svg.plan text.gname')].find(e => e.textContent === n && drawn(e))!.getBoundingClientRect();
    const f = [...document.querySelectorAll('svg.plan rect.group')].filter(drawn).map(e => e.getBoundingClientRect())
      .find(f => f.left <= a.left + 0.5 && a.left - f.left < 30 && a.bottom <= f.top + 4 && f.top - a.bottom < 16)!;
    return { x: f.x, y: f.y, width: f.width, height: f.height };
  }, name);

test('keys typed elsewhere and plain clicks never zoom', async ({ page }) => {
  await openPlan(page, full, { store: null });

  await test.step('keys typed into a text field of the page stay in it', async () => {
    // a text field of a project that embeds the view
    await page.evaluate(() => {
      const i = document.createElement('input');
      i.id = 'field';
      i.style.cssText = 'position: fixed; top: 4px; left: 600px; z-index: 9';
      document.body.append(i);
    });
    await page.locator('#field').click();
    await page.keyboard.type('hi+');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('X-i');
    await settle(page);
    await expect(page.locator('#field'), 'the arrows move the caret').toHaveValue('hX-ii+');
    expect(await level(page), 'no zoom').toBe('Main steps');
    await expect(iconsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await page.locator('#field').evaluate(i => i.remove());
  });

  await test.step('a right click shuts the popup, and the next key acts', async () => {
    const r = (await page.locator('.roadmap .stage').boundingBox())!;
    await openTools(page);
    await page.mouse.click(r.x + 20, r.y + r.height - 20, { button: 'right' });
    await expect(popup(page)).toBeHidden();
    await toolsButton(page).press('Enter');
    await expect(popup(page), 'the first Enter opens it').toBeVisible();
    await page.mouse.click(r.x + 20, r.y + r.height - 20, { button: 'right' });
    await expect(popup(page)).toBeHidden();
    await page.locator('.zoom').getByRole('button', { name: 'Every step', exact: true }).press('Enter');
    await settle(page);
    expect(await level(page), 'the first Enter zooms').toBe('Every step');
  });

  await test.step('a double click shuts the popup, with no pick and no zoom', async () => {
    await zoomTo(page, 'Tracks');
    await openTools(page);
    await step(page, 'kickoff').dblclick();
    await settle(page);
    await expect(popup(page)).toBeHidden();
    await expect(side(page), 'no pick').toBeHidden();
    expect(await level(page), 'no zoom').toBe('Tracks');
  });

  // at 'Every step', the last level, no click can zoom in: a test below checks that a double click there changes nothing
  await test.step('no click zooms: the level and the size of the plan stay', async () => {
    // a zoom would leave the level and the size changed: one look after all the clicks of a level tells
    await zoomTo(page, 'Main steps');
    let was = await width(page);
    await group(page, 'Two deep').click();
    await step(page, 'plan').click();
    await caption(page, 'Path A').click();
    await side(page).locator('button.row').first().click();
    await page.mouse.click(EMPTY.x, EMPTY.y);
    await settle(page);
    expect(await level(page), 'after a click on a group step, a step, a branch, a row and empty space').toBe('Main steps');
    expect(await width(page)).toBe(was);
    await zoomTo(page, 'Tracks');
    was = await width(page);
    await pill(page, 'Quad').click();
    await step(page, 'plan').click();
    await page.mouse.click(EMPTY.x, EMPTY.y);
    await settle(page);
    expect(await level(page), "after a click on a pill, a step and empty space at 'Tracks'").toBe('Tracks');
    expect(await width(page)).toBe(was);
  });

});

test('a double click goes one level in around its point', async ({ page }) => {
  // a window lower than the plan at 'Tracks', so the plan does not stop the step from staying put
  await page.setViewportSize({ width: 1440, height: 600 });
  await openPlan(page, full, { store: null });

  await test.step('a double click goes one level in, and the step stays put', async () => {
    const at = await markAt(page, 'plan');
    await page.mouse.dblclick(at[0], at[1]);
    await settle(page);
    expect(await level(page)).toBe('Tracks');
    near(await markAt(page, 'plan'), at);
    await expect(side(page).locator('h2'), 'its first click picks the step').toHaveText('Plan');
    await page.mouse.dblclick(at[0], at[1]);
    await settle(page);
    expect(await level(page)).toBe('Every step');
    near(await markAt(page, 'plan'), at);
  });

  await test.step('a double click at the last level does nothing', async () => {
    const was = await width(page), at = await markAt(page, 'review');
    await page.mouse.dblclick(at[0], at[1]);
    await settle(page);
    expect(await level(page)).toBe('Every step');
    expect(await width(page)).toBe(was);
  });

  await test.step('a double click on empty space zooms, and closes the side bar', async () => {
    await zoomTo(page, 'Main steps');
    await step(page, 'kickoff').click();
    await expect(side(page)).toBeVisible();
    const k = await markAt(page, 'kickoff');
    // a little under the step, where nothing is drawn
    await page.mouse.dblclick(k[0], k[1] + 40);
    await settle(page);
    await expect(side(page)).toBeHidden();
    expect(await level(page)).toBe('Tracks');
    near(await markAt(page, 'kickoff'), k);
  });

  await test.step('a double click on a group step opens it in place', async () => {
    await save(page, plain);
    await zoomTo(page, 'Main steps');
    const at = middle((await group(page, 'Pair').locator('.st').boundingBox())!);
    await page.mouse.dblclick(at[0], at[1]);
    await settle(page);
    expect(await level(page)).toBe('Tracks');
    await expect(side(page).locator('h2')).toHaveText('Pair');
    // the first track of the group, which was in the group step, sits around where the group step was
    const f = await frameOf(page, 'Pair');
    expect(f.x).toBeLessThan(at[0]);
    expect(f.x + f.width).toBeGreaterThan(at[0]);
    await page.keyboard.press('Escape');
  });

});

test('+ and − zoom one level, also during a move', async ({ page }) => {
  // with motion, on a stopped clock: each move plays in the time the clock is moved on by
  await openPlan(page, full, { store: null, motion: true, clock: true });
  await stopClock(page);
  const press = async (key: string): Promise<void> => {
    await page.keyboard.press(key);
    await play(page, 1000);
  };
  await press('+');
  expect(await level(page)).toBe('Tracks');
  await press('+');
  expect(await level(page)).toBe('Every step');
  await press('-');
  expect(await level(page)).toBe('Tracks');
  // a key pressed while a move is on its way goes one level on from where that move goes, and no further than the end
  for (const [key, to] of [['-', 'Main steps'], ['+', 'Every step']]) {
    await page.keyboard.press(key);
    await page.clock.fastForward(200);
    await expect(page.locator('.roadmap')).toHaveAttribute('data-moving');
    await press(key);
    expect(await level(page)).toBe(to);
  }
});
