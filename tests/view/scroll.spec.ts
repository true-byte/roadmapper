// At rest: the host of the view has data-moving while a move to a level, a change of view, a scale or a smooth scroll is on its way, and not at rest.
// This is what settle() waits on.
import { expect, level, openPlan, play, settle, step, stopClock, test } from '../support/helpers';
import { wordy } from '../support/plans';

test('data-moving is on while the plan moves, and off at rest', async ({ page }) => {
  // with motion, on a stopped clock: a move that the view plays itself goes on only as the clock does.
  // The plan 'wordy' fits the window at each level, at reading size, and is wide enough that its last step is under the side bar.
  await openPlan(page, wordy, { store: null, motion: true, clock: true });
  await stopClock(page);
  const host = page.locator('.roadmap'), stage = page.locator('.stage');
  /** Goes to a level by its stop, with the move played out. */
  const go = async (name: string): Promise<void> => {
    await page.locator('.zoom').getByRole('button', { name, exact: true }).click();
    await play(page, 2000);
  };
  /** A smooth scroll is the browser's own and runs in real time, not on the clock: each time the host gets data-moving or loses it, from here on, is written down as 'on' or 'off'. */
  const watch = (): Promise<void> => host.evaluate(h => {
    const w = window as unknown as { moves: string[]; watch?: MutationObserver };
    w.watch?.disconnect();
    w.moves = [];
    w.watch = new MutationObserver(rs => { for (const r of rs) w.moves.push(r.oldValue === null ? 'on' : 'off'); });
    w.watch.observe(h, { attributeFilter: ['data-moving'], attributeOldValue: true });
  });
  /** Waits until the host has got data-moving and lost it again: the smooth scroll was on its way, and has ended. */
  const ended = (): Promise<void> => expect.poll(() => page.evaluate(() => (window as unknown as { moves: string[] }).moves), 'on its way, then at rest').toEqual(['on', 'off']);
  /** The step drawn furthest right on the screen, where the side bar comes. */
  const rightmost = (): Promise<string> => page.evaluate(() => {
    const st = document.querySelector('.stage')!.getBoundingClientRect();
    return [...document.querySelectorAll<SVGGElement>('svg.plan g.zn[data-id]')].map(g => ({ id: g.dataset.id!, r: g.getBoundingClientRect().right })).filter(g => g.r > 0 && g.r < st.right).sort((a, b) => b.r - a.r)[0].id;
  });
  await expect(host, 'at rest').not.toHaveAttribute('data-moving');

  await test.step('at a level that fits, a smooth scroll clears the side bar', async () => {
    await go('Tracks');
    await expect(stage, 'the level fits').toHaveCSS('overflow', 'hidden');
    const last = await rightmost();
    await watch();
    await step(page, last).click();
    await ended();
    expect(await stage.evaluate(s => s.scrollLeft), 'it scrolled').toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await settle(page);
  });

  for (const [what, act] of [
    ['a move to a level', () => page.keyboard.press('+')],
    ['a change of view', () => page.keyboard.press('i')],
    // Ctrl and the wheel, as a pinch does: one notch in
    ['a scale', async () => {
      await page.mouse.move(720, 400);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -100);
      await page.keyboard.up('Control');
    }],
  ] as const) {
    await test.step(`${what} is on its way, then at its end`, async () => {
      await act();
      await expect(host, 'on its way').toHaveAttribute('data-moving');
      await page.clock.fastForward(1000);
      await expect(host, 'at its end').not.toHaveAttribute('data-moving');
    });
  }

  await test.step('at a level that scrolls, a smooth scroll clears the side bar', async () => {
    // 'Every step', scaled in a notch: wider than the window
    expect(await level(page)).toBe('Every step');
    await expect(stage, 'the level scrolls').not.toHaveCSS('overflow', 'hidden');
    await stage.evaluate(s => { s.scrollLeft = 0; });
    await settle(page);
    const last = await rightmost();
    await watch();
    await step(page, last).click();
    await ended();
    expect(await stage.evaluate(s => s.scrollLeft), 'it scrolled').toBeGreaterThan(0);
  });
});
