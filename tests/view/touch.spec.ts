// Touch on a phone: a tap near a small mark picks it, two fingers scale the plan and never the page, and a double tap that shuts the popup does nothing else.
import type { Page } from '@playwright/test';
import { expect, iconsSwitch, level, nameSize, openPlan, play, popup, settle, showLabels, side, step, stopClock, test, toolsButton, zoomTo } from '../support/helpers';
import { full } from '../support/plans';

test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

/** The middle of the mark of a step on the screen. */
async function markAt(page: Page, id: string): Promise<[number, number]> {
  const m = (await step(page, id).locator('.st').boundingBox())!;
  return [m.x + m.width / 2, m.y + m.height / 2];
}
/** Scrolls the plan to its start, so that the room over an open popup holds its first steps. */
async function toTop(page: Page): Promise<void> {
  await page.locator('.roadmap .stage').evaluate(s => s.scrollTo(0, 0));
  await settle(page);
}

test('fingers pick, pinch and tap the plan', async ({ page }) => {
  // the clock keeps the real time until the last step, which counts the time between two taps on it
  await openPlan(page, full, { store: null, clock: true });

  await test.step('with no labels, a tap 17 px off a mark picks it', async () => {
    await showLabels(page, false);
    await iconsSwitch(page).click();
    await settle(page);
    await toolsButton(page).click();
    await expect(popup(page)).toBeHidden();
    // the tidy after each switch keeps the plan clear of the open popup: the top of the plan comes back into sight
    await toTop(page);
    const m = (await step(page, 'plan').locator('.st').boundingBox())!, [x, y] = await markAt(page, 'plan');
    expect(m.width / 2, 'the mark is less than 17 px across from its middle').toBeLessThan(17);
    // a tap waits 300 ms before it picks: on the stopped clock, until play(). Then the clock goes on in real time
    await stopClock(page);
    await page.touchscreen.tap(x + 17, y);
    await play(page, 400);
    await page.clock.resume();
    await expect(side(page)).toBeVisible();
    await expect(side(page).locator('h2')).toHaveText('Plan');
    expect(await level(page)).toBe('Main steps');
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(side(page)).toBeHidden();
  });

  await test.step('a pinch scales the plan around the fingers, and never the page', async () => {
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
    expect(Math.abs(ax - (cx + off[0] * 2)), 'the point between the fingers stays put').toBeLessThan(4);
    expect(Math.abs(ay - (cy + off[1] * 2))).toBeLessThan(4);
    expect(await level(page)).toBe('Main steps');
  });

  await test.step('a double tap that shuts the popup picks and zooms nothing', async () => {
    await zoomTo(page, 'Tracks');
    await toTop(page);
    await toolsButton(page).tap();
    await expect(popup(page)).toBeVisible();
    // a step, a group step or a pill in the room, over the popup
    const [x, y] = await page.evaluate(() => {
      const st = document.querySelector('.roadmap .stage')!.getBoundingClientRect(), low = document.querySelector('.roadmap .popup')!.getBoundingClientRect().top;
      for (const g of document.querySelectorAll('svg.plan g.zn, svg.plan g.tally')) {
        const b = g.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        if (getComputedStyle(g).display !== 'none' && b.width && x > st.left + 20 && x < st.right - 20 && y > st.top + 20 && y < low - 20) return [x, y];
      }
      return [0, 0];
    });
    expect(x, 'a thing to tap in the room').toBeGreaterThan(0);
    // on a stopped clock the page reads the two taps as 120 ms apart however long each takes, and a tap that waits to pick waits for play().
    // It stops a second on from the time of the page, which play() has put ahead of the real time
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    await page.touchscreen.tap(x, y);
    await expect(popup(page)).toBeHidden();
    await page.clock.runFor(120);
    await page.touchscreen.tap(x, y);
    // past the 300 ms that a tap waits before it picks
    await play(page, 1000);
    await expect(popup(page)).toBeHidden();
    await expect(side(page), 'no sheet').toBeHidden();
    expect(await level(page), 'no zoom').toBe('Tracks');
  });
});
