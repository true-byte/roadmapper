// The theme: the view takes its shadows from the theme's variables and its sizes from view.css, so a new theme can change them with no change to the code.
import { caption, expect, openPlan, settle, test } from './helpers';
import { full } from './plans';

test('the theme sets the shadows of the zoom control, the side bar and the tip, and the size of the name of a branch, at every level', async ({ page }) => {
  await openPlan(page, full, { store: null });

  await test.step('the theme sets the shadows of the zoom control, the side bar and the tip', async () => {
    await page.addStyleTag({ content: ':root { --shadow: none; --tip-shadow: none; }' });
    await page.locator('svg.plan g.zn[data-id="plan"]').click();
    await page.locator('svg.plan g.zn[data-id="kickoff"]').hover();
    for (const part of ['.zoom', '.side', '.tip']) await expect(page.locator(`.roadmap ${part}`), part).toHaveCSS('box-shadow', 'none');
  });

  await test.step('the theme sets the size of the name of a branch, at every level', async () => {
    await page.addStyleTag({ content: '.cap { font-size: 20px; }' });
    await expect(caption(page, 'Main')).toHaveCSS('font-size', '20px');
    await page.keyboard.press('+');
    await settle(page);
    await expect(caption(page, 'Quad')).toHaveCSS('font-size', '20px');
  });
});
