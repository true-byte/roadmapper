// The app page (src/app/main.ts), as npm test builds it on tests/fixtures/roadmap.json: it draws the roadmap file, names the page after it,
// and opens in the mode it keeps before its first paint.
// The view of each roadmap file is kept apart, under the key of the file (src/cli/key.ts), so a save of the file keeps its view.
// The view kept under the one name of every file before is read once: the first page opened starts from it, where its file has nothing kept yet.
// On a dev server, the page has 'Edit', and 'Save' writes the file.
/// <reference types="node" />
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import type { Page, Request } from '@playwright/test';
import type { Roadmap } from '../../src/roadmap/types';
import { cliSource, folder, removeFolders, roadmapper, ROOT } from '../support/cli';
import { BLANK, errorList, expect, level, levels, nameOf, openApp, openTools, popup, settle, side, step, test } from '../support/helpers';
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

/** The address of the dev server: an IP address, as `npx roadmapper dev --host` serves to the network. */
const SITE = 'https://192.168.1.20';
const plan = (title: string): Roadmap => ({ title, branches: [{ name: 'Shop', items: [{ id: 'lease', name: 'Sign the lease' }, { id: 'open', name: 'Opening day' }] }] });
const text = (r: Roadmap): string => `${JSON.stringify(r, null, 2)}\n`;

/** What a listener answers to a request of the page, with no server. */
function answer(listener: RequestListener, r: Request): Promise<{ status: number; type: string; body: string }> {
  const url = new URL(r.url());
  const body = r.postDataBuffer();
  const req = Object.assign(Readable.from(body ? [body] : []), { method: r.method(), url: url.pathname, headers: { ...r.headers(), host: url.host } }) as unknown as IncomingMessage;
  return new Promise(done => {
    const got = { status: 0, type: '', body: '' };
    const res = {
      writeHead: (status: number, headers: Record<string, string>) => Object.assign(got, { status, type: headers['content-type'] }),
      end: (b?: string | Buffer) => done({ ...got, body: got.body + (b?.toString() ?? '') }),
    } as unknown as ServerResponse;
    listener(req, res);
  });
}

/** Serves the page of `npx roadmapper dev` on the file, through routes, and opens it. 'Save' writes the file, or `saveTo` in its place.
 * `send` is a save of the file, as the dev server sends it; `taken` resolves once the page has taken in all that was sent: it has asked for the saves again after it got them. */
async function openDev(page: Page, file: string, saveTo = file): Promise<{ send: (r: Roadmap) => void; taken: () => Promise<void> }> {
  const { devServer } = await cliSource();
  const dev = devServer(readFileSync(join(ROOT, 'dist/cli/app.html'), 'utf8'), () => ({ text: readFileSync(file, 'utf8'), file: 'roadmap.json' }), saveTo);
  // the stream of saves stays open: each time the page asks again, it gets the saves since it last asked
  let stream = '';
  const events = { url: '/events', on: () => events } as unknown as IncomingMessage;
  dev.listener(events, { writeHead: () => {}, write: (b: string) => (stream += b) } as unknown as ServerResponse);
  let sent = 0;
  let asks = 0;
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route(`${SITE}/**`, async r => {
    if (new URL(r.request().url()).pathname === '/events') {
      asks++;
      const part = stream.slice(sent);
      sent = stream.length;
      // a short retry, so the page asks again soon
      return r.fulfill({ contentType: 'text/event-stream', body: `retry: 50\n\n${part}` });
    }
    const got = await answer(dev.listener, r.request());
    return r.fulfill({ status: got.status, contentType: got.type, body: got.body });
  });
  await page.goto(`${SITE}/`);
  await expect(title(page)).toHaveText('First plan');
  await settle(page);
  return {
    send: r => dev.send({ text: text(r), file: 'roadmap.json' }),
    taken: async () => {
      const from = asks;
      await expect.poll(() => asks).toBeGreaterThan(from + 1);
    },
  };
}

const title = (page: Page) => page.locator('.roadmap .title');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
/** The name of the step 'lease' on the plan, over all its lines. */
const leaseName = (page: Page) => expect.poll(async () => (await nameOf(page, 'lease').allTextContents()).join(' '));

/** In edit mode, a new name for the step 'lease', typed in the side bar. */
async function rename(page: Page, name: string): Promise<void> {
  await step(page, 'lease').click();
  await side(page).getByLabel('Name', { exact: true }).fill(name);
}

// 'Edit' and 'Save' on the page that the dev server of `npx roadmapper dev` serves (src/cli/cli.ts), and no 'Edit' on a built file.
// No server: Playwright's routes give the page what the server's listener answers, and the roadmap file is in a folder of the test's own.
test.describe('on a dev server', () => {
  let dir = '';
  let file = '';
  test.beforeEach(() => {
    dir = folder();
    file = join(dir, 'roadmap.json');
    writeFileSync(file, text(plan('First plan')));
  });

  test('a built file has no Edit; the dev server page has it', async ({ page }) => {
    await openApp(page);
    await expect(button(page, 'Edit')).toHaveCount(0);
    await openDev(page, file);
    await expect(button(page, 'Edit')).toBeVisible();
  });

  test('Save writes the edited plan over a file saved in edit mode', async ({ page }) => {
    const dev = await openDev(page, file);
    await button(page, 'Edit').click();
    writeFileSync(file, text(plan('Other plan')));
    dev.send(plan('Other plan'));
    await dev.taken();
    await expect(title(page)).toHaveText('First plan');
    await rename(page, 'Sign the new lease');
    await button(page, 'Save').click();
    await expect(button(page, 'Edit')).toBeVisible();
    const saved = plan('First plan');
    saved.branches[0].items[0] = { id: 'lease', name: 'Sign the new lease' };
    expect(readFileSync(file, 'utf8')).toBe(text(saved));
    await leaseName(page).toBe('Sign the new lease');
  });

  test('Cancel draws the save of the file made in edit mode', async ({ page }) => {
    const dev = await openDev(page, file);
    await button(page, 'Edit').click();
    await rename(page, 'Sign the new lease');
    dev.send(plan('Other plan'));
    await dev.taken();
    await expect(title(page)).toHaveText('First plan');
    await button(page, 'Cancel').click();
    await expect(title(page)).toHaveText('Other plan');
    await leaseName(page).toBe('Sign the lease');
  });

  test('a save the server cannot write keeps edit mode and the file', async ({ page }) => {
    // a folder in place of the file: the server cannot write it
    await openDev(page, file, dir);
    await button(page, 'Edit').click();
    await rename(page, 'Sign the new lease');
    await button(page, 'Save').click();
    await expect(button(page, 'Save')).toHaveText('Not saved');
    await expect(button(page, 'Cancel')).toBeVisible();
    expect(readFileSync(file, 'utf8')).toBe(text(plan('First plan')));
  });
});
