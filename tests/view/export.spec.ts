// The part 'Export' of the popup (src/view/export.ts), on the plan page with its stand-in for roadmap.zip: the switch 'Include private items',
// the button 'Export', 'Saved', and the error of a roadmap where everything is private. What the app saves: tests/app/export.spec.ts.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import type { Download, Locator, Page } from '@playwright/test';
import type { Roadmap } from '../../src/roadmap/types';
import { expect, openPlan, openTools, play, popup, save as draw, stopClock, test, toolsButton } from '../support/helpers';
import { full } from '../support/plans';

/** The button 'Export' in the popup, found also while the popup is shut, by its class: its name changes to 'Saved' and to an error. */
const exportButton = (page: Page): Locator => popup(page).locator('button.export');
/** The word of the button: 'Export', 'Saved' or an error. The plan page has not the icons of the button, so it draws a sign before the word in their place. */
const face = (page: Page): Locator => exportButton(page).locator('span');
/** The switch 'Include private items' in the popup, found also while the popup is shut. */
const privateSwitch = (page: Page): Locator => popup(page).getByRole('switch', { name: 'Include private items', includeHidden: true });
/** Gold, the --name of the theme, and red, its --stop. */
const GOLD = 'rgb(232, 184, 74)', RED = 'rgb(255, 122, 122)';

/** Presses 'Export' and gives the file the page saves. */
async function save(page: Page): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()]);
  return download;
}
/** Closes the popup with Escape, and opens it again with the tools button. */
async function reopen(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
  await toolsButton(page).click();
  await expect(popup(page)).toBeVisible();
}

/** A roadmap with one branch, private or not. */
const plan = (secret: boolean): Roadmap => ({ title: 'Plant care app', branches: [{ name: 'Plant data deal', ...(secret ? { private: true } : {}), items: [
  { id: 'pick-a-supplier', name: 'Pick a supplier' }, { id: 'sign-the-deal', name: 'Sign the deal' },
] }] });

test("'Export' ends the popup, and says 'Saved' or why it cannot save", async ({ page }) => {
  // the clock stands, so 'Saved' ends only by play()
  await openPlan(page, full, { exporting: true, store: null, clock: true });
  await stopClock(page);
  await openTools(page);

  await test.step("a hairline, then 'Export': the switch, off, and the button", async () => {
    await expect(popup(page).locator('hr')).toHaveCount(2);
    expect(await popup(page).evaluate(p => [...p.children].slice(-2).map(e => e.tagName))).toEqual(['HR', 'SECTION']);
    const part = popup(page).locator('section').last();
    await expect(part.locator('button.fold')).toHaveText('Export');
    expect(await part.locator('.exporting').evaluate(e => [...e.children].map(c => c.className))).toEqual(['switch', 'export']);
    await expect(privateSwitch(page)).toBeVisible();
    await expect(privateSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(face(page)).toHaveText('Export');
  });

  await test.step('the button is as wide as the popup', async () => {
    const inner = await popup(page).evaluate(p => p.clientWidth - parseFloat(getComputedStyle(p).paddingLeft) - parseFloat(getComputedStyle(p).paddingRight));
    expect((await exportButton(page).boundingBox())!.width).toBeCloseTo(inner, 0);
  });

  await test.step("a press makes the button 'Saved' in gold for 2 s", async () => {
    await save(page);
    await expect(face(page)).toHaveText('Saved');
    await expect(exportButton(page)).toHaveClass(/\bsaved\b/);
    // as the knob and the switches that are on
    await expect(exportButton(page)).toHaveCSS('color', GOLD);
    await expect(exportButton(page)).toHaveCSS('border-color', GOLD);
    await play(page, 1990);
    await expect(face(page)).toHaveText('Saved');
    await play(page, 10);
    await expect(face(page)).toHaveText('Export');
    await expect(exportButton(page)).not.toHaveClass(/\bsaved\b/);
  });

  await test.step("'Saved' goes when the popup closes", async () => {
    await save(page);
    await expect(face(page)).toHaveText('Saved');
    await reopen(page);
    await expect(face(page)).toHaveText('Export');
  });

  await test.step("a popup closed while the export is made opens on 'Export'", async () => {
    // Escape in the same task as the press: the popup is closed before the export is made
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).evaluate((b: HTMLElement) => {
      b.click();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    })]);
    expect(download.suggestedFilename()).toBe('roadmap.zip');
    await expect(popup(page)).toBeHidden();
    await toolsButton(page).click();
    await expect(face(page)).toHaveText('Export');
    await expect(exportButton(page)).not.toHaveClass(/\bsaved\b/);
  });

  const downloads: Download[] = [];
  await test.step("a roadmap where everything is private shows 'Nothing public' in red", async () => {
    await draw(page, plan(true));
    page.on('download', d => downloads.push(d));
    await exportButton(page).click();
    await expect(face(page)).toHaveText('Nothing public');
    await expect(exportButton(page)).toHaveClass(/\bfailed\b/);
    await expect(exportButton(page).locator('svg.mark g.node.blocked')).toBeVisible();
    // as the mark of a blocked step
    await expect(exportButton(page)).toHaveCSS('color', RED);
    await expect(exportButton(page)).toHaveCSS('border-color', RED);
  });

  await test.step('the error stays, and nothing is saved', async () => {
    await play(page, 5000);
    await expect(face(page)).toHaveText('Nothing public');
    expect(downloads).toEqual([]);
  });

  await test.step("'Include private items' clears the error and saves the whole roadmap", async () => {
    await privateSwitch(page).click();
    await expect(face(page)).toHaveText('Export');
    await expect(exportButton(page)).not.toHaveClass(/\bfailed\b/);
    const saved = JSON.parse(readFileSync(await (await save(page)).path(), 'utf8'));
    expect(saved.branches[0].name).toBe('Plant data deal');
    await privateSwitch(page).click();
  });

  await test.step('the error goes when the popup closes, and comes back', async () => {
    await exportButton(page).click();
    await expect(face(page)).toHaveText('Nothing public');
    await reopen(page);
    await expect(face(page)).toHaveText('Export');
    await exportButton(page).click();
    await expect(face(page)).toHaveText('Nothing public');
  });

  await test.step('the error goes when a saved file makes a branch public', async () => {
    await draw(page, plan(false));
    await expect(popup(page)).toBeVisible();
    await expect(exportButton(page)).not.toHaveClass(/\bfailed\b/);
    await expect(face(page)).not.toHaveText('Nothing public');
  });
});
