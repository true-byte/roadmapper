// The lib as one plain script (src/lib/script.ts), on tests/pages/embed/plain.html, a page with no bundler: two <roadmapper-view> tags,
// each with the JSON of a roadmap inside it.
import type { Locator } from '@playwright/test';
import { boxesDrawn, expect, PLAIN, settle, step, test } from '../support/helpers';

/** The name of the level asked for in one box. */
const levelIn = (box: Locator): Promise<string> => box.locator('.zoom .stop[aria-current="true"]').innerText();

test('each box draws its JSON, and the focused box takes the keys', async ({ page, errors }) => {
  await page.goto(PLAIN);
  await boxesDrawn(page);
  // the browser says it does not let the page read garden.json; the box says nothing
  errors.splice(0, errors.length, ...errors.filter(e => !/^Fetch API cannot load file:.*\/garden\.json\./.test(e)));
  const garden = page.locator('roadmapper-view').nth(0), kitchen = page.locator('roadmapper-view').nth(1), field = page.locator('#field');
  const levelsNow = async (): Promise<string[]> => [await levelIn(garden), await levelIn(kitchen)];
  const press = async (keys: string[]): Promise<void> => {
    for (const key of keys) await page.keyboard.press(key);
    await settle(page);
  };

  await test.step('a box that cannot read its src draws the JSON inside it', async () => {
    await expect(garden).toHaveAttribute('aria-label', 'Roadmap: Garden plan');
    await expect(kitchen).toHaveAttribute('aria-label', 'Roadmap: Kitchen plan');
    await expect(garden.locator('.roadmap .title')).toHaveText('Garden plan');
    await expect(kitchen.locator('.roadmap .title')).toHaveText('Kitchen plan');
    await expect(garden.locator('.roadmap .errors')).toBeHidden();
  });

  await test.step('the script draws icons from the whole icon set', async () => {
    await expect(step(page, 'dig').locator('.ic .art')).toBeVisible();
    await expect(step(page, 'eat').locator('.ic .art')).toBeVisible();
  });

  await test.step('the keys go only to the box with the focus', async () => {
    await kitchen.locator('.roadmap .title').click();
    await press(['+']);
    expect(await levelsNow()).toEqual(['Main steps', 'Tracks']);
    await field.click();
    await page.keyboard.type('+-');
    await settle(page);
    await expect(field).toHaveValue('+-');
    expect(await levelsNow()).toEqual(['Main steps', 'Tracks']);
    await garden.locator('.roadmap .title').click();
    await press(['+', '+']);
    expect(await levelsNow()).toEqual(['Every step', 'Tracks']);
  });
});
