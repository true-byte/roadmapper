// The theme's variables and view.css set the shadows and sizes of the view, so a new theme changes them with no change to the code.
import { caption, expect, openPlan, settle, test } from '../support/helpers';
import { full } from '../support/plans';

test('the theme sets the shadows and the size of branch names', async ({ page }) => {
  await openPlan(page, full, { store: null });

  await test.step('the theme sets the zoom control, side bar and tip shadows', async () => {
    await page.addStyleTag({ content: ':root { --shadow: none; --tip-shadow: none; }' });
    await page.locator('svg.plan g.zn[data-id="plan"]').click();
    await page.locator('svg.plan g.zn[data-id="kickoff"]').hover();
    for (const part of ['.zoom', '.side', '.tip']) await expect(page.locator(`.roadmap ${part}`), part).toHaveCSS('box-shadow', 'none');
  });

  await test.step('the theme sets the size of a branch name at every level', async () => {
    await page.addStyleTag({ content: '.cap { font-size: 20px; }' });
    await expect(caption(page, 'Main')).toHaveCSS('font-size', '20px');
    await page.keyboard.press('+');
    await settle(page);
    await expect(caption(page, 'Quad')).toHaveCSS('font-size', '20px');
  });
});
