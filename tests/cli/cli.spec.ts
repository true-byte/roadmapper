// The pages the commands of src/cli/cli.ts give: the page `build` writes, opened from disk, and what `dev` and `preview` serve.
// No test starts a server: Playwright's routes answer for a made-up host with what the request listener of `dev` or `preview` answers.
/// <reference types="node" />
import { copyFileSync, readFileSync } from 'node:fs';
import type { RequestListener } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { ask, cliSource, folder, removeFolders, roadmapper, ROOT } from '../support/cli';
import { errorList, errorRows, expect, settle, side, step, test } from '../support/helpers';

/** A folder that the commands are typed in, which holds the export fixture as roadmap.json: a step's name holds `</script><!--`, and some items are private. */
function withFixture(): string {
  const here = folder();
  copyFileSync(join(ROOT, 'tests/fixtures/export.json'), join(here, 'roadmap.json'));
  return here;
}
const plan = (title: string): string => JSON.stringify({ title, branches: [{ name: 'Main', items: [{ id: 'a', name: 'Alpha step' }] }] }, null, 2);
const TITLE = 'Launch &amp; </title> <Grow>';

/** Serves what a listener answers at https://<host>/ to the page. `events` gives what /events sends to each request of the page. */
async function routeTo(page: Page, host: string, listener: RequestListener, events?: () => string): Promise<void> {
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route(`https://${host}/**`, r => {
    const path = new URL(r.request().url()).pathname;
    // a short retry, so the page asks again soon
    if (events && path === '/events') return r.fulfill({ contentType: 'text/event-stream', body: `retry: 50\n\n${events()}` });
    const got = ask(listener, path);
    return r.fulfill({ status: got.status, contentType: got.type, body: got.body() });
  });
}

// one load of the source for the file: its tests run in order, in one worker
test.describe.configure({ mode: 'default' });
test.afterEach(removeFolders);

test('the page that build writes draws the plan from disk', async ({ page }) => {
  const here = withFixture();
  expect((await roadmapper(['build'], here)).code).toBe(0);
  await page.goto(pathToFileURL(join(here, 'dist/app/index.html')).href);
  await expect(page.locator('.roadmap .title')).toHaveText(TITLE);
  await settle(page);
  await expect(step(page, 'idea')).toBeVisible();
  await expect(errorList(page)).toBeHidden();
  await step(page, 'tricky').click();
  await settle(page);
  await expect(side(page).locator('h2')).toHaveText('Ends </script><!-- here');
});

test('dev redraws each save, and lists the errors of a broken one', async ({ page }) => {
  const { devServer } = await cliSource();
  let now = { text: plan('First plan'), file: 'roadmap.json' };
  const dev = devServer(readFileSync(join(ROOT, 'dist/cli/app.html'), 'utf8'), () => now);
  // a page that listens, as the browser's does: each time the page asks again, it gets the saves since it last asked, as a stream that stays open sends them
  const stream = ask(dev.listener, '/events');
  let sent = 0;
  const fresh = (): string => {
    const all = stream.body();
    const part = all.slice(sent);
    sent = all.length;
    return part;
  };
  await routeTo(page, 'dev.test', dev.listener, fresh);
  await page.goto('https://dev.test/');
  await expect(page.locator('.roadmap .title')).toHaveText('First plan');
  await settle(page);

  now = { text: plan('Saved plan'), file: 'roadmap.json' };
  dev.send(now);
  await expect(page.locator('.roadmap .title')).toHaveText('Saved plan');
  dev.send({ text: '{ "title": "Broken", "branches": [], "about": 5 }', file: 'roadmap.json' });
  await expect(errorList(page)).toBeVisible();
  await expect(errorList(page).locator('.file')).toHaveText('roadmap.json');
  expect(await errorRows(page)).toEqual(['1    about  Wrong type  5', '1    branches  Invalid value  []']);
  dev.send(now);
  await expect(errorList(page)).toBeHidden();
  await expect(step(page, 'a')).toBeVisible();
});

test('the private export that preview serves draws every item from a site', async ({ page }) => {
  const { previewServer } = await cliSource();
  const here = withFixture();
  expect((await roadmapper(['export', '--private'], here)).code).toBe(0);
  await routeTo(page, 'preview.test', previewServer(join(here, 'dist/export-private')));
  await page.goto('https://preview.test/roadmap.html');
  await expect(page.locator('svg.plan')).toBeVisible();
  await settle(page);
  await expect(page.locator('.roadmap .title')).toHaveText(TITLE);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await settle(page);
  // the whole roadmap as written: every step, with its own id
  expect(await page.locator('svg.plan g.zn[data-id]').count()).toBe(14);
  for (const id of ['secret-price', 'payroll', 'hidden-prep']) {
    await step(page, id).click();
    await settle(page);
    await expect(side(page).locator('.facts .tag'), id).toHaveText(['Private']);
  }
  await step(page, 'code-1').click();
  await settle(page);
  await expect(side(page).locator('section.part h3', { hasText: /Planned|Deadline/ })).toHaveText(['Planned', 'Deadline']);
});
