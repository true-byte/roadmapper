// What the view keeps under its store: the level, the scale, the layout, the labels, the mode, 'Links' and 'Include private items', all brought back by a reload.
// What an older page kept, with fewer of them, opens with the rest as a first visit has them. With no store, nothing is kept.
import type { Locator, Page } from '@playwright/test';
import {
  expect, flowOf, labelsSwitch, level, nameOf, nameSize, openPlan, openTools, pickLayout, popup, READ_PX, reload, settle, showLabels, side, step, stored, test, words, zoomTo,
} from '../support/helpers';
import { edit, full, nodeOf, plain } from '../support/plans';

/** The plan 'full' with links on 'Plan', so its side bar has the part 'Links'. */
const linked = edit(full, p => { nodeOf(p, 'plan').links = [{ name: 'Plan doc', url: 'https://example.com/plan' }]; });
/** The background of the view in each mode, as the theme sets it. */
const BG = { light: 'rgb(244, 246, 251)', dark: 'rgb(10, 18, 36)' };

const root = (page: Page): Locator => page.locator('.roadmap').first();
const mode = (page: Page, name: string): Locator => popup(page).getByRole('radio', { name, includeHidden: true });
const privateSwitch = (page: Page): Locator => popup(page).getByRole('switch', { name: 'Include private items', includeHidden: true });
/** The heading of the part 'Links' in the side bar, which closes and opens it. */
const fold = (page: Page): Locator => side(page).getByRole('button', { name: 'Links' });
/** What the page keeps of the mode, 'Links' and 'Include private items'. */
const kept3 = async (page: Page): Promise<unknown[]> => (k => [k?.mode, k?.links, k?.private])(await stored(page));
/** Picks 'Plan', whose side bar has 'Links'. */
async function pickPlan(page: Page): Promise<void> {
  await step(page, 'plan').click();
  await settle(page);
  await expect(fold(page)).toBeVisible();
}
/** Each mode the root of the view is set to, and each time the plan gets what it draws, in the order they happen since the page started. */
const seen = async (page: Page): Promise<string[]> =>
  (await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).filter((s, i, a) => s !== 'drawn' || a[i - 1] !== 'drawn');
/** Scales the plan one notch in, with Ctrl and the wheel in the middle of the stage. */
async function notchIn(page: Page): Promise<void> {
  const r = (await page.locator('.stage').boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await settle(page);
}

test('a reload brings back what the view kept', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { seen: string[] };
    w.seen = [];
    new MutationObserver(ms => {
      for (const m of ms) {
        const e = m.target as Element;
        if (m.type === 'attributes' && e.classList.contains('roadmap')) w.seen.push(e.getAttribute('data-mode')!);
        else if (m.type === 'childList' && m.addedNodes.length && e.closest?.('svg.plan')) w.seen.push('drawn');
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-mode'] });
  });
  await openPlan(page, linked, { exporting: true });
  const big = READ_PX * Math.exp(0.25);

  await test.step("a first visit is in the device's mode before it draws", async () => {
    expect((await seen(page)).slice(0, 2)).toEqual(['device', 'drawn']);
  });

  await test.step('the scale stays as the level changes, and the page keeps both', async () => {
    await zoomTo(page, 'Tracks');
    expect((await stored(page))?.level).toBe(1);
    await notchIn(page);
    expect(await nameSize(page)).toBeCloseTo(big, 2);
    await page.keyboard.press('+');
    await settle(page);
    expect(await level(page)).toBe('Every step');
    expect(await nameSize(page)).toBeCloseTo(big, 2);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await settle(page);
    expect(await nameSize(page)).toBeCloseTo(big, 2);
    expect((await stored(page))?.scale).toBeCloseTo(Math.exp(0.25), 2);
  });

  await test.step('a pick of the layout, the labels and the mode is kept', async () => {
    await pickLayout(page, 'Vertical');
    expect((await stored(page))?.flow).toBe('v');
    await showLabels(page, false);
    expect((await stored(page))?.labels).toBe(false);
    await mode(page, 'Light').click();
    expect(await kept3(page)).toEqual(['light', true, false]);
  });

  await test.step("the mode, 'Links' and 'Include private items' are kept together", async () => {
    await privateSwitch(page).click();
    expect(await kept3(page)).toEqual(['light', true, true]);
    await page.keyboard.press('Escape');
    await pickPlan(page);
    await fold(page).click();
    expect(await kept3(page)).toEqual(['light', false, true]);
  });

  await test.step('a reload brings all of them back, in the kept mode first', async () => {
    await reload(page);
    expect(await seen(page), 'only the kept mode, before the first draw').toEqual(['light', 'drawn']);
    await expect(root(page)).toHaveCSS('background-color', BG.light);
    expect(await level(page)).toBe('Tracks');
    expect(await nameSize(page)).toBeCloseTo(big, 2);
    expect(await flowOf(page)).toBe('v');
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    expect((await words(page)).sort(), 'no word but the names of the branches').toEqual(['Later', 'Main']);
    await pickPlan(page);
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(side(page).locator('a.row').first()).toBeHidden();
    await page.keyboard.press('Escape');
    await openTools(page);
    await expect(mode(page, 'Light')).toHaveAttribute('aria-checked', 'true');
    await expect(privateSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await mode(page, 'Dark').click();
    expect(await kept3(page), 'a pick of one keeps the others').toEqual(['dark', false, true]);
  });

});

test('what is shown again stays shown after a reload', async ({ page }) => {
  await openPlan(page, linked, { exporting: true, kept: { level: 0, labels: false, links: false, mode: 'light', id: 'kickoff', fx: 0.5, fy: 0.5 } });

  await test.step("labels, 'Links' and 'Device' picked again come back after a reload", async () => {
    await showLabels(page, true);
    expect((await stored(page))?.labels).toBe(true);
    await mode(page, 'Device').click();
    await page.keyboard.press('Escape');
    await pickPlan(page);
    await fold(page).click();
    expect((await stored(page))?.links).toBe(true);
    await reload(page);
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(nameOf(page, 'kickoff').first()).toBeVisible();
    await expect(root(page)).toHaveCSS('background-color', BG.dark);
    await expect(mode(page, 'Device')).toHaveAttribute('aria-checked', 'true');
    await pickPlan(page);
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(side(page).locator('a.row').first()).toBeVisible();
  });

  await test.step("a page left at 'Every step' opens at the last level", async () => {
    await page.keyboard.press('Escape');
    await zoomTo(page, 'Every step');
    expect(await stored(page)).toMatchObject({ level: 2, last: true });
    // by the next visit the file may have more levels: the last one wins over the number
    await openPlan(page, full, { store: 'store.more', kept: { level: 0, last: true, id: 'p-1', fx: 0.5, fy: 0.5 } });
    expect(await level(page)).toBe('Every step');
  });

});

test('an older store opens with the rest as a first visit', async ({ page }) => {
  // on a phone, where the size of the view draws the plan down
  await page.setViewportSize({ width: 390, height: 664 });

  await test.step('an older store opens at its level, the rest as at first', async () => {
    await openPlan(page, linked, { store: 'store.older', exporting: true, kept: { level: 1, icons: true, id: 'kickoff', fx: 0.5, fy: 0.5 } });
    expect(await level(page)).toBe('Tracks');
    expect(await nameSize(page), 'at reading size').toBeCloseTo(READ_PX, 2);
    expect(await flowOf(page), 'the layout of the size').toBe('v');
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(nameOf(page, 'kickoff').first(), 'the labels shown').toBeVisible();
    await expect(root(page), "in the device's mode").toHaveCSS('background-color', BG.dark);
    await expect(mode(page, 'Device')).toHaveAttribute('aria-checked', 'true');
    await expect(privateSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await pickPlan(page);
    await expect(fold(page), "'Links' open").toHaveAttribute('aria-expanded', 'true');
  });

  await test.step('with no store, a reload starts at the first level', async () => {
    await openPlan(page, plain, { store: null });
    await zoomTo(page, 'Every step');
    await reload(page);
    expect(await level(page)).toBe('Main steps');
  });
});
