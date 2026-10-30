// The app page (src/app/main.ts), as npm test builds it on tests/fixtures/roadmap.json: it draws the roadmap file, names the page after it,
// and opens in the mode it keeps before its first paint.
// The view of each roadmap file is kept apart, under the key of the file (src/cli/key.ts), so a save of the file keeps its view.
// The view kept under the one name of every file before is read once: the first page opened starts from it, where its file has nothing kept yet.
/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { folder, removeFolders, roadmapper } from '../support/cli';
import { BLANK, errorList, expect, level, levels, openApp, openTools, popup, settle, test } from '../support/helpers';
import { plain } from '../support/plans';

test.afterEach(removeFolders);

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

test('each roadmap file keeps a view of its own, by its path', async ({ page }) => {
  const dir = folder();
  /** Writes the roadmap file of a folder and builds its app page there, as `roadmapper build` does. Gives the address of the page. */
  const build = async (name: string, title: string): Promise<string> => {
    const here = join(dir, name);
    mkdirSync(here, { recursive: true });
    writeFileSync(join(here, 'roadmap.json'), JSON.stringify({ ...plain, title }));
    expect((await roadmapper(['build'], here)).code).toBe(0);
    return pathToFileURL(join(here, 'dist/app/index.html')).href;
  };
  const open = async (url: string): Promise<void> => {
    await page.goto(url);
    await expect(page.locator('.roadmap .head .title')).toBeVisible();
    await settle(page);
  };
  const view = async (): Promise<(string | null)[]> => [await level(page), await page.locator('.roadmap').getAttribute('data-mode')];
  await page.goto(BLANK);
  await page.evaluate(() => localStorage.setItem('roadmapper.app', JSON.stringify({ level: 2, mode: 'light' })));
  // two files with the same text, in two folders
  const shop = await build('shop', 'Plain plan'), bakery = await build('bakery', 'Plain plan');
  await open(shop);
  expect(await view(), 'the view kept under the old name').toEqual(['Every step', 'light']);
  expect(await page.evaluate(() => localStorage.getItem('roadmapper.app')), 'the old name, read once').toBeNull();
  await openTools(page);
  await popup(page).getByRole('radio', { name: 'Dark' }).click();
  await open(bakery);
  expect(await view(), 'a first visit').toEqual(['Main steps', 'device']);
  // a save of the file, and a new build of its page
  await build('shop', 'Plain plan, saved');
  await open(shop);
  await expect(page.locator('.roadmap .head .title')).toHaveText('Plain plan, saved');
  expect(await view(), 'its own view').toEqual(['Every step', 'dark']);
});
