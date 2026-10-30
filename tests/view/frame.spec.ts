// Reading size: every level draws a step's name at 15.6 px on the screen, in both views, and a level is as big in a small window as in a big one.
import { readFileSync } from 'node:fs';
import type { Roadmap } from '../../src/roadmap/types';
import { expect, level, levels, nameSize, openPlan, READ_PX, settle, test, zoomTo } from '../support/helpers';

/** The roadmap of the app page. */
const ROADMAP = JSON.parse(readFileSync(new URL('../fixtures/roadmap.json', import.meta.url), 'utf8')) as Roadmap;

test('every level draws at reading size, whatever the size of the window', async ({ page }) => {
  // the width of the plan at each level, in each view, at the first size
  const widths = new Map<string, string | null>();
  /** At each level, in the view the page is in: a name at reading size, and the plan as wide as at the first size, so no level is sized to fit the window. */
  const everyLevel = async (view: string): Promise<void> => {
    // from the level the page is at, which is the first or the last, to the other end
    const all = await levels(page), at = await level(page);
    for (const name of at === all[0] ? all : [...all].reverse()) {
      if (name !== at) await zoomTo(page, name);
      const where = `${view}, '${name}'`;
      expect(await nameSize(page), where).toBeCloseTo(READ_PX, 2);
      const w = await page.locator('svg.plan').getAttribute('width');
      if (widths.has(where)) expect(w, `${where}: as wide as at 1024x700`).toBe(widths.get(where));
      else widths.set(where, w);
    }
  };
  const turnView = async (): Promise<void> => {
    await page.keyboard.press('i');
    await settle(page);
  };

  await test.step('at 1024x700, each level draws at reading size', async () => {
    await page.setViewportSize({ width: 1024, height: 700 });
    await openPlan(page, ROADMAP, { store: null });
    await everyLevel('icons');
    await turnView();
    await everyLevel('marks');
  });

  await test.step('a new size of 1920x1080 keeps each level as it was', async () => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await settle(page);
    await everyLevel('marks');
    await turnView();
    await everyLevel('icons');
  });
});
