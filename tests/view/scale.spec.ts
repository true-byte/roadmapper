// The scale: Ctrl and the wheel, as a pinch on a trackpad sends it, scale the plan around the pointer at the level it is at,
// from where the whole level fits, or a fourth of reading size, up to 3 times reading size.
import type { Page } from '@playwright/test';
import type { Roadmap } from '../../src/roadmap/types';
import { expect, level, nameSize, openPlan, play, READ_PX, settle, step, stopClock, test, zoomTo } from '../support/helpers';
import { columns } from '../support/plans';

/** Wider and higher than the window at 'Tracks' and 'Every step': in its middle, no end of it stops the point under the pointer. */
const big = columns('One-d');
/** One branch of 90 steps: too long to fit the window even at a fourth of reading size. */
const long: Roadmap = { title: 'Long plan', branches: [{ name: 'Row', items: Array.from({ length: 90 }, (_, i) => ({ id: `s-${i}`, name: `Step ${i}` })) }] };

type Box = { x: number; y: number; width: number; height: number };
const box = async (page: Page, css: string): Promise<Box> => (await page.locator(css).boundingBox())!;
const middle = (b: Box): [number, number] => [b.x + b.width / 2, b.y + b.height / 2];

/** Turns the wheel with Ctrl held at a point. One turn of 100 is one notch. The page has heard each turn when wheel() returns. */
async function turnWheel(page: Page, at: [number, number], dy: number, turns: number): Promise<void> {
  await page.mouse.move(at[0], at[1]);
  await page.keyboard.down('Control');
  for (let i = 0; i < turns; i++) await page.mouse.wheel(0, dy);
  await page.keyboard.up('Control');
}
/** Turns the wheel with Ctrl held, and waits for the plan to rest at its new scale. */
async function ctrlWheel(page: Page, at: [number, number], dy: number, turns = 1): Promise<void> {
  await turnWheel(page, at, dy, turns);
  await settle(page);
}
/** The step drawn nearest the middle of the room, and where the middle of its mark is on the screen. */
const stepNearMiddle = (page: Page): Promise<{ id: string; at: [number, number] }> =>
  page.evaluate(() => {
    const st = document.querySelector('.stage')!.getBoundingClientRect(), mx = st.left + st.width / 2, my = st.top + (st.height - 112) / 2;
    let best = { id: '', at: [0, 0] as [number, number], d: Infinity };
    for (const g of document.querySelectorAll<SVGGElement>('svg.plan g.zn[data-id]')) {
      if (getComputedStyle(g).display === 'none') continue;
      const r = g.querySelector('.st')!.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, d = Math.hypot(x - mx, y - my);
      if (d < best.d) best = { id: g.dataset.id!, at: [x, y], d };
    }
    return { id: best.id, at: best.at };
  });
const markAt = async (page: Page, id: string): Promise<[number, number]> => middle((await step(page, id).locator('.st').boundingBox())!);
const near = (a: [number, number], b: [number, number]): void => {
  expect(Math.abs(a[0] - b[0]), `x: ${a[0]} against ${b[0]}`).toBeLessThan(1);
  expect(Math.abs(a[1] - b[1]), `y: ${a[1]} against ${b[1]}`).toBeLessThan(1);
};

// A notch scales by a fourth more or less, so 5 notches go from reading size to 3 times it. Each check turns further than it needs to.
test('a notch scales the plan around the pointer, never the page', async ({ page }) => {
  // the clock keeps the real time until the last step, which plays the scale with motion on it
  await openPlan(page, big, { store: null, clock: true });

  await test.step('a notch scales around the pointer, and the point under it stays', async () => {
    await zoomTo(page, 'Every step');
    await page.locator('.stage').evaluate(s => s.scrollTo((s.scrollWidth - s.clientWidth) / 2, (s.scrollHeight - s.clientHeight) / 2));
    await settle(page);
    const { id, at } = await stepNearMiddle(page);
    await ctrlWheel(page, at, -100);
    expect(await nameSize(page), 'about a fourth more').toBeCloseTo(READ_PX * Math.exp(0.25), 2);
    near(await markAt(page, id), at);
    expect(await level(page)).toBe('Every step');
    await ctrlWheel(page, at, 100);
    expect(await nameSize(page), 'back at reading size').toBeCloseTo(READ_PX, 2);
    near(await markAt(page, id), at);
    expect(await level(page)).toBe('Every step');
  });

  await test.step("the wheel takes the place of the browser's own zoom", async () => {
    // a listener after the view's own: it sees whether the view stopped the browser's zoom
    await page.evaluate(() => window.addEventListener('wheel', e => { (window as unknown as { stopped: boolean }).stopped = e.defaultPrevented; }, { passive: true }));
    // on the step in the middle, which stays there for the next step
    await ctrlWheel(page, (await stepNearMiddle(page)).at, -100);
    expect(await page.evaluate(() => (window as unknown as { stopped: boolean }).stopped)).toBe(true);
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  });

  await test.step('with motion, many small turns scale smoothly around the pointer', async () => {
    // on a stopped clock: the scale moves on as the clock does
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClock(page);
    const before = await nameSize(page), { id, at } = await stepNearMiddle(page);
    await turnWheel(page, at, -4, 8);
    // two frames on, it is part of the way there
    await page.clock.runFor(32);
    const part = await nameSize(page);
    expect(part).toBeGreaterThan(before * 1.05);
    expect(part).toBeLessThan(before * Math.exp(0.32) * 0.97);
    await play(page, 1000);
    expect(await nameSize(page)).toBeCloseTo(before * Math.exp(0.32), 2);
    near(await markAt(page, id), at);
    expect(await level(page)).toBe('Every step');
  });

});

test('the scale stops at 3 times reading size and where levels fit', async ({ page }) => {
  await openPlan(page, big, { store: null });
  const mid = middle(await box(page, '.stage'));

  await test.step('the scale stops at 3 times reading size, at the same level', async () => {
    await ctrlWheel(page, mid, -100, 5);
    expect(await nameSize(page)).toBeCloseTo(READ_PX * 3, 2);
    expect(await level(page)).toBe('Main steps');
  });

  await test.step('the scale stops where the level fits, at the same level', async () => {
    await zoomTo(page, 'Every step');
    await ctrlWheel(page, mid, 100, 8);
    const plan = await box(page, 'svg.plan'), stage = await page.locator('.stage').evaluate((s: HTMLElement) => {
      const c = getComputedStyle(s);
      return { w: s.offsetWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight), h: s.offsetHeight - parseFloat(c.paddingTop) - parseFloat(c.paddingBottom) };
    });
    // it fits, and on one side it fills the room
    expect(plan.width).toBeLessThanOrEqual(stage.w + 0.5);
    expect(plan.height).toBeLessThanOrEqual(stage.h + 0.5);
    expect(Math.max(plan.width / stage.w, plan.height / stage.h)).toBeGreaterThan(0.99);
    expect(await level(page)).toBe('Every step');
  });

});

test('the scale never goes under a fourth of reading size', async ({ page }) => {
  await openPlan(page, long, { store: null });
  const mid = middle(await box(page, '.stage'));
  await ctrlWheel(page, mid, 100, 7);
  expect(await nameSize(page)).toBeCloseTo(READ_PX / 4, 2);
  expect((await box(page, 'svg.plan')).width, 'the level does not fit').toBeGreaterThan((await box(page, '.stage')).width);
});
