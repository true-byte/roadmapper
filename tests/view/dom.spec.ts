// The page of a view: the head on one row, and the mode in the popup, 'Device', 'Light' or 'Dark'. 'Light' and 'Dark' draw every part of the view
// in that mode whatever the device is set to, and 'Device' draws it as the device is set, also as that setting changes.
import type { Locator, Page } from '@playwright/test';
import { expect, openPlan, openTools, popup, settle, test, toolsButton } from '../support/helpers';
import { full } from '../support/plans';

type Scheme = 'light' | 'dark';
/** The background of the view and the line of a step, in each mode, as the theme sets them. */
const BG = { light: 'rgb(244, 246, 251)', dark: 'rgb(10, 18, 36)' };
const LINE = { light: 'rgb(11, 122, 140)', dark: 'rgb(86, 207, 225)' };

/** A button of the mode in the popup: 'Device', 'Light' or 'Dark'. */
const mode = (page: Page, name: string): Locator => popup(page).getByRole('radio', { name, includeHidden: true });
const root = (page: Page): Locator => page.locator('.roadmap').first();
/** The ring of a step on the plan. */
const ring = (page: Page): Locator => page.locator('svg.plan g.zn .node .ring').first();

/** Every part of the view, each by its CSS inside the root of the view, with the colors it is drawn in. */
const PARTS = ['', '.head .title', '.head .progress', '.zoom', '.zoom .knob', '.zoom .stop', '.popup', '.popup .fold', '.popup .key', '.popup .switch', '.popup .opt[aria-checked="true"]', '.popup .seg',
  '.picker', '.grip', '.tip', '.side', '.errors', 'svg.plan .lane', 'svg.plan g.zn .node .ring', 'svg.plan text.label', 'svg.plan .cap', '.names', '.show-all'];
const looks = (page: Page): Promise<Record<string, string>> =>
  root(page).evaluate((r, parts) => {
    const out: Record<string, string> = {};
    for (const part of parts) {
      const e = part ? r.querySelector(part) : r;
      if (!e) continue;
      const s = getComputedStyle(e);
      for (const p of ['color', 'background-color', 'border-top-color', 'fill', 'stroke', 'color-scheme']) out[`${part || 'root'} ${p}`] = s.getPropertyValue(p);
    }
    return out;
  }, PARTS);

test('the head is one row, and the mode draws every part', async ({ page }) => {
  await openPlan(page, full, { store: null });

  await test.step('the head is one row: the title and the progress', async () => {
    const head = page.locator('.roadmap .head');
    for (const [width, height] of [[390, 664], [844, 390], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await settle(page);
      expect(await head.evaluate(h => [...h.children].map(c => c.className)), `${width}x${height}`).toEqual(['title', 'progress']);
      expect((await head.boundingBox())!.height, `${width}x${height}: one row`).toBeLessThanOrEqual(44.5);
    }
    await expect(head.locator('.key'), 'the key is not in the head').toHaveCount(0);
  });

  // what 'Device' draws as the device is set to each mode
  const as = {} as Record<Scheme, Record<string, string>>;
  await test.step("'Device' draws every part as the device is set", async () => {
    await openTools(page);
    await expect(mode(page, 'Device'), 'the first pick').toHaveAttribute('aria-checked', 'true');
    for (const s of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: s });
      await expect(root(page)).toHaveCSS('background-color', BG[s]);
      as[s] = await looks(page);
    }
    expect(Object.keys(as.light).length, 'every part').toBe(PARTS.length * 6);
    expect(as.light, 'the two modes differ').not.toEqual(as.dark);
  });

  // the pick of the device's own mode draws as 'Device' does there: the other mode is the one that tells
  for (const [device, other] of [['dark', ['Light', 'light']], ['light', ['Dark', 'dark']]] as const) {
    await test.step(`on a ${device} device, '${other[0]}' draws as 'Device' on a ${other[1]} one`, async () => {
      await page.emulateMedia({ colorScheme: device });
      for (const [name, s] of [other, ['Device', device]] as const) {
        await mode(page, name).click();
        await expect(mode(page, name)).toHaveAttribute('aria-checked', 'true');
        await expect(popup(page).getByRole('radio', { checked: true, includeHidden: true }), 'one of the mode and one of the pair').toHaveCount(2);
        await expect(root(page), name).toHaveCSS('background-color', BG[s]);
        await expect(ring(page), name).toHaveCSS('stroke', LINE[s]);
        await expect(root(page), `${name}: the browser's scroll bars and fields`).toHaveCSS('color-scheme', s === device && name === 'Device' ? 'light dark' : s);
        // the root's color-scheme is the one thing that tells a pick from the device's setting
        const now = await looks(page), want = { ...as[s] };
        for (const k of Object.keys(now)) if (k.endsWith('color-scheme')) delete now[k], delete want[k];
        expect(now, name).toEqual(want);
      }
    });
  }

});

test("'Device' follows the device, and a pick turns the view at once", async ({ page }) => {
  await openPlan(page, full, { store: null });
  await openTools(page);

  await test.step("'Device' follows a change of the device; 'Light' and 'Dark' do not", async () => {
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(root(page)).toHaveCSS('background-color', BG.light);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(root(page)).toHaveCSS('background-color', BG.dark);
    await expect(ring(page)).toHaveCSS('stroke', LINE.dark);
    await mode(page, 'Light').click();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(root(page)).toHaveCSS('background-color', BG.light);
    await mode(page, 'Dark').click();
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(root(page)).toHaveCSS('background-color', BG.dark);
    await mode(page, 'Device').click();
    await expect(root(page)).toHaveCSS('background-color', BG.light);
    await page.emulateMedia({ colorScheme: 'dark' });
  });

  await test.step('the arrows move the pick in the mode, and the plan stays', async () => {
    const scroll = (): Promise<number[]> => page.locator('.roadmap .stage').evaluate(s => [s.scrollLeft, s.scrollTop]);
    const before = await scroll();
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
    await expect(toolsButton(page), 'a click leaves the focus on the tools button').toBeFocused();
  });

  await test.step('with motion, a pick turns every part at once, with no fade', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const name of ['Light', 'Dark', 'Device']) {
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
});
