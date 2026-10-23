// 'Dark and light': the mode in the popup, 'Device', 'Light' or 'Dark'. 'Light' and 'Dark' draw every part of the view in that mode, whatever the device is set to,
// and 'Device' draws it as the device is set, also as that setting changes. The app keeps the pick; a box of the lib keeps nothing, and its mode is its own.
// The export: export.spec.ts. No color outside the theme: theme.spec.ts.
import type { Locator, Page } from '@playwright/test';
import { APP_STORE, boxesDrawn, expect, openApp, openKey, openPlan, PLAIN, popup, reload, settle, side, step, stored, test } from './helpers';
import { full, links } from './plans';

type Scheme = 'light' | 'dark';
/** The background of the view and the line of a step, in each mode, as the theme sets them. */
const BG = { light: 'rgb(244, 246, 251)', dark: 'rgb(10, 18, 36)' };
const LINE = { light: 'rgb(11, 122, 140)', dark: 'rgb(86, 207, 225)' };

/** A button of the mode in the popup: 'Device', 'Light' or 'Dark'. */
const mode = (page: Page, name: string): Locator => popup(page).getByRole('radio', { name, includeHidden: true });
/** The root of the view on the page. */
const root = (page: Page): Locator => page.locator('.roadmap').first();
/** The ring of a step on the plan. */
const ring = (view: Locator): Locator => view.locator('svg.plan g.zn .node .ring').first();

/** Every part of the view, each by its CSS inside the root of the view, with the colors it is drawn in. */
const PARTS = ['', '.head .title', '.head .progress', '.zoom', '.zoom .knob', '.zoom .stop', '.popup', '.popup .key', '.popup .switch', '.popup .opt[aria-checked="true"]', '.popup .seg',
  '.picker', '.grip', '.tip', '.side', '.errors', 'svg.plan .lane', 'svg.plan g.zn .node .ring', 'svg.plan text.label', 'svg.plan .cap', '.names', '.show-all'];
const looks = (view: Locator): Promise<Record<string, string>> =>
  view.evaluate((r, parts) => {
    const out: Record<string, string> = {};
    for (const part of parts) {
      const e = part ? r.querySelector(part) : r;
      if (!e) continue;
      const s = getComputedStyle(e);
      for (const p of ['color', 'background-color', 'border-top-color', 'fill', 'stroke', 'color-scheme']) out[`${part || 'root'} ${p}`] = s.getPropertyValue(p);
    }
    return out;
  }, PARTS);

for (const device of ['dark', 'light'] as const) {
  test(`on a ${device} device, 'Light' and 'Dark' draw every part of the view as 'Device' does on a device set to that mode, and 'Device' draws it as this device is set`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: device });
    await openPlan(page, full, { store: null });
    await openKey(page);
    await expect(mode(page, 'Device'), 'the first pick').toHaveAttribute('aria-checked', 'true');
    // what 'Device' draws as the device is set to each mode
    const as = {} as Record<Scheme, Record<string, string>>;
    for (const s of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: s });
      await expect(root(page)).toHaveCSS('background-color', BG[s]);
      as[s] = await looks(root(page));
    }
    expect(Object.keys(as.light).length, 'every part').toBe(PARTS.length * 6);
    expect(as.light, 'the two modes differ').not.toEqual(as.dark);
    await page.emulateMedia({ colorScheme: device });

    for (const [name, s] of [['Light', 'light'], ['Dark', 'dark'], ['Device', device]] as const) {
      await mode(page, name).click();
      await expect(mode(page, name)).toHaveAttribute('aria-checked', 'true');
      await expect(popup(page).getByRole('radio', { checked: true, includeHidden: true })).toHaveCount(2);
      await expect(root(page), name).toHaveCSS('background-color', BG[s]);
      await expect(ring(root(page)), name).toHaveCSS('stroke', LINE[s]);
      await expect(root(page), `${name}: the browser's scroll bars and fields`).toHaveCSS('color-scheme', s === device && name === 'Device' ? 'light dark' : s);
      const now = await looks(root(page));
      // the root's color-scheme is the one thing that tells a pick from the device's setting
      for (const k of Object.keys(now)) if (k.endsWith('color-scheme')) delete now[k], delete as[s][k];
      expect(now, name).toEqual(as[s]);
    }
  });
}

test("'Device' follows the device's setting as it changes; 'Light' and 'Dark' do not", async ({ page }) => {
  await openPlan(page, full, { store: null });
  await expect(root(page)).toHaveCSS('background-color', BG.dark);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root(page)).toHaveCSS('background-color', BG.light);
  await expect(ring(root(page))).toHaveCSS('stroke', LINE.light);
  await openKey(page);
  await mode(page, 'Dark').click();
  await expect(root(page)).toHaveCSS('background-color', BG.dark);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root(page)).toHaveCSS('background-color', BG.dark);
  await mode(page, 'Light').click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root(page)).toHaveCSS('background-color', BG.light);
  await mode(page, 'Device').click();
  await expect(root(page)).toHaveCSS('background-color', BG.dark);
});

test('the arrows move the pick in the mode, as in the pair of layouts, and do not move the plan; a click leaves the focus on the button of the popup', async ({ page }) => {
  await openPlan(page, full, { store: null });
  const scroll = (): Promise<number[]> => page.locator('.roadmap .stage').evaluate(s => [s.scrollLeft, s.scrollTop]);
  const before = await scroll();
  await openKey(page);
  await mode(page, 'Device').focus();
  for (const [key, name, s] of [['ArrowRight', 'Light', 'light'], ['ArrowRight', 'Dark', 'dark'], ['ArrowRight', 'Device', 'dark'], ['ArrowLeft', 'Dark', 'dark'], ['ArrowUp', 'Light', 'light']] as const) {
    await page.keyboard.press(key);
    await expect(mode(page, name), key).toBeFocused();
    await expect(mode(page, name), key).toHaveAttribute('aria-checked', 'true');
    await expect(root(page), `${key} to ${name}`).toHaveCSS('background-color', BG[s]);
  }
  await expect(popup(page)).toBeVisible();
  expect(await scroll(), 'the plan stays').toEqual(before);
  await mode(page, 'Dark').click();
  await expect(page.locator('.zoom').getByRole('button', { name: 'Key', exact: true })).toBeFocused();
});

test("the app keeps the pick, and after a reload the view is in it before it draws anything; what an older page kept, with no mode, opens as the device is set", async ({ page }) => {
  // in the order they happen: each mode the root of the view is set to, and each time the plan gets what it draws
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
  const seen = async (): Promise<string[]> => (await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).filter((s, i, a) => s !== 'drawn' || a[i - 1] !== 'drawn');
  await openApp(page);
  expect((await seen()).slice(0, 2), 'a first visit').toEqual(['device', 'drawn']);
  await openKey(page);
  await mode(page, 'Light').click();
  await settle(page);
  expect((await stored(page, APP_STORE))?.mode).toBe('light');

  await reload(page);
  expect(await seen(), 'only the kept mode, before the first draw').toEqual(['light', 'drawn']);
  await expect(root(page)).toHaveCSS('background-color', BG.light);
  await expect(mode(page, 'Light')).toHaveAttribute('aria-checked', 'true');

  await openKey(page);
  await mode(page, 'Device').click();
  await reload(page);
  await expect(root(page)).toHaveCSS('background-color', BG.dark);
  await expect(mode(page, 'Device')).toHaveAttribute('aria-checked', 'true');

  // what a page kept before the mode, in place of a kept 'Light'
  await openKey(page);
  await mode(page, 'Light').click();
  await openApp(page, { kept: { level: 0, id: 'kickoff', fx: 0.5, fy: 0.5 } });
  await expect(root(page)).toHaveCSS('background-color', BG.dark);
  await expect(mode(page, 'Device')).toHaveAttribute('aria-checked', 'true');
});

test("the mode, 'Links' open or closed and 'Include private items' are kept together: a pick of one keeps the others, and a reload brings back all three", async ({ page }) => {
  const privateSwitch = popup(page).getByRole('switch', { name: 'Include private items', includeHidden: true }), fold = side(page).getByRole('button', { name: 'Links' });
  const kept = async (): Promise<unknown[]> => (k => [k?.mode, k?.links, k?.private])(await stored(page));
  const pickSpec = async (): Promise<void> => {
    await step(page, 'spec').click();
    await settle(page);
    await expect(fold).toBeVisible();
  };
  await openPlan(page, links, { exporting: true });
  await openKey(page);
  await mode(page, 'Light').click();
  expect(await kept()).toEqual(['light', true, false]);
  await privateSwitch.click();
  expect(await kept()).toEqual(['light', true, true]);
  await page.keyboard.press('Escape');
  await pickSpec();
  await fold.click();
  expect(await kept()).toEqual(['light', false, true]);

  await reload(page);
  await expect(root(page)).toHaveCSS('background-color', BG.light);
  await pickSpec();
  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await openKey(page);
  await expect(mode(page, 'Light')).toHaveAttribute('aria-checked', 'true');
  await expect(privateSwitch).toHaveAttribute('aria-checked', 'true');
  await mode(page, 'Dark').click();
  expect(await kept()).toEqual(['dark', false, true]);
});

test('on a slow device, the app paints nothing before the view is in the kept mode: no frame shows the mode of the device', async ({ page }) => {
  // when the root of the view gets its mode
  await page.addInitScript(() => {
    const w = window as unknown as { modeAt?: number };
    new MutationObserver(() => (w.modeAt ??= performance.now())).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-mode'] });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await openApp(page, { kept: { level: 0, id: 'kickoff', fx: 0.5, fy: 0.5, mode: 'light' } });
  await expect(root(page)).toHaveCSS('background-color', BG.light);
  const [modeAt, painted] = await page.evaluate(() => [(window as unknown as { modeAt: number }).modeAt, performance.getEntriesByName('first-paint')[0]?.startTime]);
  expect(painted, 'the first paint, after the mode').toBeGreaterThan(modeAt);
});

test('with motion, a pick turns every part of the view at once: no color fades from the mode before', async ({ page }) => {
  await openPlan(page, full, { store: null, motion: true });
  await openKey(page);
  for (const name of ['Light', 'Dark', 'Device', 'Light']) {
    // right after the click: the transitions of a color that run, and the colors of every part
    const [fades, now] = await root(page).evaluate((r, name) => {
      r.querySelector<HTMLElement>(`.popup .mode[aria-label="${name}"]`)!.click();
      const colors = [...r.querySelectorAll('*')].map(e => (s => [s.color, s.backgroundColor, s.fill, s.stroke].join(' '))(getComputedStyle(e)));
      return [document.getAnimations().filter(a => a instanceof CSSTransition && /color|fill|stroke/.test(a.transitionProperty)).length, colors] as const;
    }, name);
    expect(fades, name).toBe(0);
    await settle(page);
    expect(await root(page).evaluate(r => [...r.querySelectorAll('*')].map(e => (s => [s.color, s.backgroundColor, s.fill, s.stroke].join(' '))(getComputedStyle(e)))), name).toEqual(now);
  }
});

test("in the tag of the lib, the mode is the box's own: a pick draws that box in its shadow root, and the other box and the page stay as they were; a visit after starts as the device is set", async ({ page, errors }) => {
  await page.goto(PLAIN);
  await boxesDrawn(page);
  const [a, b] = [page.locator('roadmapper-view').nth(0), page.locator('roadmapper-view').nth(1)];
  const body = await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor);
  for (const box of [a, b]) await expect(box.locator('.roadmap'), 'as the device is set').toHaveCSS('background-color', BG.dark);
  await a.locator('.zoom').getByRole('button', { name: 'Key', exact: true }).click();
  await a.getByRole('radio', { name: 'Light' }).click();
  await expect(a.locator('.roadmap')).toHaveCSS('background-color', BG.light);
  await expect(a.locator('.roadmap')).toHaveCSS('color-scheme', 'light');
  await expect(ring(a.locator('.roadmap'))).toHaveCSS('stroke', LINE.light);
  await expect(a.locator('.popup')).toHaveCSS('color', 'rgb(16, 27, 51)');
  await expect(b.locator('.roadmap'), 'the other box').toHaveCSS('background-color', BG.dark);
  await expect(ring(b.locator('.roadmap')), 'the other box').toHaveCSS('stroke', LINE.dark);
  expect(await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor), 'the page').toBe(body);
  // the box keeps nothing
  await page.reload();
  await boxesDrawn(page);
  await expect(a.locator('.roadmap')).toHaveCSS('background-color', BG.dark);
  await expect(a.getByRole('radio', { name: 'Device', includeHidden: true })).toHaveAttribute('aria-checked', 'true');
  // from disk, the browser does not let the page read garden.json, and the box draws the roadmap it holds
  errors.splice(0, errors.length, ...errors.filter(e => !/^Fetch API cannot load file:.*\/garden\.json\./.test(e)));
});
