// The app page (src/app/main.ts), as npm test builds it on tests/fixtures/roadmap.json: it draws the roadmap file, names the page after it,
// and opens in the mode it keeps before its first paint.
import { errorList, expect, level, levels, openApp, test } from '../support/helpers';

test('the app page draws its roadmap file in the kept mode', async ({ page }) => {
  // when the root of the view gets its mode
  await page.addInitScript(() => {
    const w = window as unknown as { modeAt?: number };
    new MutationObserver(() => (w.modeAt ??= performance.now())).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-mode'] });
  });
  // a page that paints before the view has its mode does so at full speed too; `npm run test:push` also runs it 4 times slower
  await openApp(page, { kept: { level: 0, id: 'kickoff', fx: 0.5, fy: 0.5, mode: 'light' } });

  await test.step("the page draws the roadmap, at 'Main steps'", async () => {
    await expect(page.locator('.roadmap .title')).toHaveText('Roadmapper');
    expect(await page.title()).toBe('Roadmapper · roadmap');
    expect(await levels(page)).toEqual(['Main steps', 'Tracks', 'Every step']);
    expect(await level(page)).toBe('Main steps');
    await expect(page.locator('svg.plan g.zn[data-id]').first()).toBeAttached();
    await expect(errorList(page)).toBeHidden();
  });

  await test.step('the first paint comes after the view is in the kept mode', async () => {
    await expect(page.locator('.roadmap')).toHaveCSS('background-color', 'rgb(244, 246, 251)');
    const [modeAt, painted] = await page.evaluate(() => [(window as unknown as { modeAt: number }).modeAt, performance.getEntriesByName('first-paint')[0]?.startTime]);
    expect(painted).toBeGreaterThan(modeAt);
  });
});
