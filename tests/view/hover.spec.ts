// Hover: the pointer over a step, the line or the gold name of a branch, or a pill lights it and shows its tip over it. A mark with no label answers 14 px off.
import type { Locator, Page } from '@playwright/test';
import { caption, expect, iconsSwitch, level, nameOf, openPlan, pill, popup, settle, showLabels, step, test, tip, zoomTo } from '../support/helpers';
import { full } from '../support/plans';

/** Empty space on the plan at 'Tracks': between its two top-level branches, wherever the plan is scrolled across. */
const EMPTY = { x: 700, y: 480 };

/** The gold of the theme, as the browser gives back a color. */
const gold = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const e = document.createElement('i');
    e.style.color = 'var(--name)';
    document.body.append(e);
    const c = getComputedStyle(e).color;
    e.remove();
    return c;
  });
/** The ring that lights a step when it is pointed at or picked. */
const ringOf = (page: Page, id: string): Locator => step(page, id).locator('.aura').first();

/** A point on the drawn line of a branch, by its caption, where nothing else lies over the line. */
async function onLine(page: Page, branch: string): Promise<{ x: number; y: number }> {
  const key = await caption(page, branch).getAttribute('data-bar');
  const at = await page.evaluate(k => {
    for (const p of document.querySelectorAll<SVGPathElement>(`svg.plan path.hit[data-bar="${k}"]`)) {
      if (p.style.display === 'none') continue;
      const m = p.getScreenCTM()!, len = p.getTotalLength();
      for (let f = 0.5; f < 1; f += 0.05) for (const g of [f, 1 - f]) {
        const q = p.getPointAtLength(len * g), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
        if (document.elementFromPoint(x, y) === p) return { x, y };
      }
    }
    return null;
  }, key);
  if (!at) throw new Error(`no free point on the line of '${branch}'`);
  return at;
}
/** The pointer goes to empty space, and the tip hides. */
async function away(page: Page): Promise<void> {
  await page.mouse.move(EMPTY.x, EMPTY.y);
  await expect(tip(page)).toBeHidden();
}

test('a hover lights a step or a branch, and shows its tip', async ({ page }) => {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Tracks');

  await test.step('a hover on a step lights it, with its tip over it', async () => {
    await step(page, 'review').hover();
    await expect(ringOf(page, 'review')).toHaveCSS('opacity', '0.4');
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText('Review');
    await expect(tip(page)).toContainText('Blocked');
    const t = (await tip(page).boundingBox())!, s = (await step(page, 'review').boundingBox())!, n = (await nameOf(page, 'review').boundingBox())!;
    expect(t.y + t.height, 'the tip ends over the step and its name').toBeLessThanOrEqual(Math.min(s.y, n.y) + 0.5);
    expect(t.x).toBeLessThanOrEqual(s.x + s.width / 2);
    expect(t.x + t.width).toBeGreaterThanOrEqual(s.x + s.width / 2);
  });

  await test.step('the pointer leaving the step hides the tip and the light', async () => {
    await away(page);
    await expect(ringOf(page, 'review')).toHaveCSS('opacity', '0');
  });

  await test.step('a hover on a branch line lights it and shows its tip', async () => {
    const p = await onLine(page, 'Main');
    await page.mouse.move(p.x, p.y);
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText('Main');
    await expect(tip(page)).toContainText('The first top-level branch.');
    // its lines are drawn thicker and its gold name turns to the ink of the page
    await expect(page.locator('svg.plan path.lane').filter({ visible: true }).and(page.locator('.hot')).first()).toHaveCSS('stroke-width', '3.5px');
    await expect(caption(page, 'Main')).not.toHaveCSS('fill', await gold(page));
    await away(page);
  });

});

test('branch names, pills and marks with no labels show a tip', async ({ page }) => {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Tracks');

  await test.step('a hover on the gold name of a branch shows its tip', async () => {
    await caption(page, 'Path A').hover();
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText('Path A');
    await expect(tip(page)).toContainText('0 of 1 done');
    await away(page);
  });

  await test.step("a hover on a pill shows its track's tip over it", async () => {
    await pill(page, 'Quad').hover();
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText('Quad');
    await expect(tip(page)).toContainText('1 of 4 done');
    await expect(tip(page)).toContainText('Four steps, one done.');
    const t = (await tip(page).boundingBox())!, s = (await pill(page, 'Quad').boundingBox())!;
    expect(t.y + t.height, 'the tip ends over the pill').toBeLessThanOrEqual(s.y + 0.5);
    await away(page);
  });

  await test.step('with no labels, hovering 14 px off a mark shows its tip', async () => {
    await showLabels(page, false);
    await iconsSwitch(page).click();
    await settle(page);
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    const m = (await step(page, 'plan').locator('.st').boundingBox())!, x = m.x + m.width / 2, y = m.y + m.height / 2;
    expect(m.width / 2, 'the mark is less than 14 px across from its middle').toBeLessThan(14);
    for (const [dx, dy] of [[0, -14], [14, 0]]) {
      await page.mouse.move(x + dx, y + dy);
      await expect(tip(page), `${dx}, ${dy}`).toBeVisible();
      await expect(tip(page), `${dx}, ${dy}`).toContainText('Plan');
      await page.mouse.move(700, 880);
      await expect(tip(page)).toBeHidden();
    }
    expect(await level(page)).toBe('Tracks');
  });
});
