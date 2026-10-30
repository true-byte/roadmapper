// <Roadmap> in a React app (src/lib/react.ts), on the made-up app of tests/pages/embed/: a new roadmap prop, the same roadmap again,
// and unmount, which takes off all the box put on the page, then remount.
import type { CDPSession, Locator, Page } from '@playwright/test';
import { boxesDrawn, expect, level, levels, openEmbed, settle, side, step, test } from '../support/helpers';
import { flat, full, plain } from '../support/plans';

/** The box: the tag <roadmapper-view> that <Roadmap> renders. */
const theBox = (page: Page): Locator => page.locator('roadmapper-view').first();

/** Clicks and waits until the plan is at rest. */
async function press(page: Page, where: Locator): Promise<void> {
  await where.click();
  await settle(page);
}
/** Gives the box the focus with a click on its title, and presses + there. */
async function closer(page: Page): Promise<void> {
  await press(page, theBox(page).locator('.roadmap .title'));
  await page.keyboard.press('+');
  await settle(page);
}

/** How many listeners the page's own script has on the window, the document and its fonts: a view puts some there, and takes them off when it goes.
 * Playwright's own are left out: the script of the page is the one window.remount() is in. */
async function pageListeners(cdp: CDPSession): Promise<number> {
  const object = async (expression: string): Promise<string> => (await cdp.send('Runtime.evaluate', { expression })).result.objectId!;
  const { internalProperties } = await cdp.send('Runtime.getProperties', { objectId: await object('window.remount') });
  const script = (internalProperties!.find(p => p.name === '[[FunctionLocation]]')!.value!.value as { scriptId: string }).scriptId;
  let n = 0;
  for (const expression of ['window', 'document', 'document.fonts']) {
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: await object(expression) });
    n += listeners.filter(l => l.scriptId === script).length;
  }
  return n;
}

test('<Roadmap> redraws in place, and unmount takes off all it put on', async ({ page }) => {
  await openEmbed(page);
  const cdp = await page.context().newCDPSession(page), none = await pageListeners(cdp);
  await page.evaluate(p => { window.setRoadmap(p); window.remount(); }, full);
  await boxesDrawn(page);
  const box = theBox(page), view = box.locator('.roadmap');
  expect(await pageListeners(cdp), 'the view listens on the page').toBeGreaterThan(none);

  await test.step("the same roadmap again leaves 'Show only blockers' on", async () => {
    await press(page, step(page, 'review'));
    await press(page, side(page).getByRole('button', { name: 'Show only blockers' }));
    await expect(view).toHaveClass(/\bonly\b/);
    // a new object of an app that renders again
    await page.evaluate(p => window.setRoadmap(JSON.parse(JSON.stringify(p))), full);
    await settle(page);
    await expect(view).toHaveClass(/\bonly\b/);
  });

  await test.step('a new roadmap object or text redraws the box in place', async () => {
    const at = await box.boundingBox();
    // a mark on the element, to know it again
    await box.evaluate(b => { (b as HTMLElement & { seen?: boolean }).seen = true; });
    await page.evaluate(p => window.setRoadmap(p), flat);
    await settle(page);
    await expect(box.locator('.roadmap .title')).toHaveText('Flat plan');
    await expect(box).toHaveAttribute('aria-label', 'Roadmap: Flat plan');
    expect(await levels(page)).toEqual(['Every step']);
    await expect(step(page, 'f-1')).toBeVisible();
    await expect(step(page, 'kickoff')).toHaveCount(0);
    await page.evaluate(t => window.setRoadmap(t), JSON.stringify(plain));
    await settle(page);
    await expect(box.locator('.roadmap .title')).toHaveText('Plain plan');
    expect(await box.evaluate(b => 'seen' in b), 'the same element').toBe(true);
    expect(await box.boundingBox()).toEqual(at);
  });

  await test.step('unmount takes off the box, its drawing and its listeners', async () => {
    await closer(page);
    expect(await level(page)).toBe('Tracks');
    const gone = (await box.elementHandle())!;
    await page.evaluate(() => window.unmount());
    await expect(page.locator('roadmapper-view')).toHaveCount(0);
    await expect.poll(() => gone.evaluate(b => b.shadowRoot!.childElementCount), { intervals: [20] }).toBe(0);
    expect(await pageListeners(cdp)).toBe(none);
  });

  await test.step("after unmount, the keys, the pointer and the wheel are the page's", async () => {
    for (const key of ['+', '-', 'i', 'Escape', 'ArrowRight']) await page.keyboard.press(key);
    await page.mouse.move(700, 400);
    await page.mouse.down();
    await page.mouse.move(400, 300, { steps: 4 });
    await page.mouse.up();
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => scrollY), { intervals: [20] }).toBeGreaterThan(0);
  });

  await test.step('remount draws a new box at the first level', async () => {
    await page.evaluate(() => { scrollTo(0, 0); window.remount(); });
    await boxesDrawn(page);
    await expect(theBox(page)).toHaveAttribute('aria-label', 'Roadmap: Plain plan');
    expect(await level(page)).toBe('Main steps');
    await closer(page);
    expect(await level(page)).toBe('Tracks');
  });
});
