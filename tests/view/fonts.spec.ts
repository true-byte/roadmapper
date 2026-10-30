// What fonts.ts does on the page: a font of the theme that loads after a draw wraps the names again, and the view stays where it was.
import { clashes, expect, level, nameOf, nameSize, openPlan, settle, side, step, test } from '../support/helpers';
import { wordy } from '../support/plans';

test('a font that loads later wraps names again, keeping the view', async ({ page }) => {
  await openPlan(page, wordy, { store: 'fonts', kept: { level: 1, icons: true, scale: 1.5, id: 'w-1', fx: 0.3, fy: 0.5 } });
  await step(page, 'w-1').click();
  await settle(page);
  const size = await nameSize(page), at = (await step(page, 'w-1').boundingBox())!;
  await expect(nameOf(page, 'w-6')).toHaveCount(1);
  // the theme's font draws wider, as a web font may once it has loaded
  await page.addStyleTag({ content: '.label { letter-spacing: 3px; }' });
  await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
  await settle(page);

  await test.step('a name is wrapped again in the new font', async () => {
    expect(await nameOf(page, 'w-6').count()).toBeGreaterThan(1);
    expect(await clashes(page)).toEqual([]);
  });

  await test.step('the level, the scale, the place and the pick stay', async () => {
    expect(await level(page)).toBe('Tracks');
    expect(await nameSize(page)).toBeCloseTo(size, 3);
    const now = (await step(page, 'w-1').boundingBox())!;
    expect([Math.abs(now.x - at.x) < 1, Math.abs(now.y - at.y) < 1]).toEqual([true, true]);
    await expect(side(page).locator('h2')).toHaveText('Start');
  });
});
