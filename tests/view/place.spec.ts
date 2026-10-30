// What holds the plan in place while it changes: the step in progress, or what stands for it, stays in sight at every level and through a turn;
// the switches in the popup, pressed and pressed back, put the plan back where it was; a picked step holds the plan when a switch goes back.
import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import type { Roadmap } from '../../src/roadmap/types';
import { expect, flowOf, iconsSwitch, labelsSwitch, level, nameOf, openPlan, openTools, pickLayout, popup, settle, showLabels, side, step, test, zoomTo } from '../support/helpers';
import { columns } from '../support/plans';

/** The roadmap of the app page. */
const ROADMAP = JSON.parse(readFileSync(new URL('../fixtures/roadmap.json', import.meta.url), 'utf8')) as Roadmap;

/** Is the step in progress, or what stands for it (far out the step of its group, at 'Tracks' the pill of its track), in the room: on the stage and over the zoom control? */
const busyInRoom = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const svg = document.querySelector('svg.plan')!, st = document.querySelector('.roadmap .stage')!.getBoundingClientRect(), bar = document.querySelector('.roadmap .zoom')!.getBoundingClientRect();
    const seen = (e: Element): boolean => {
      for (let x: Element | null = e; x && x !== svg; x = x.parentElement) if (getComputedStyle(x).display === 'none' || Number(x.getAttribute('opacity') ?? 1) < 0.5) return false;
      return true;
    };
    return [...svg.querySelectorAll('g.node.in-progress')].filter(seen).some(m => {
      const b = m.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
      return b.width > 0 && x >= st.left && x <= st.right && y >= st.top && y <= Math.min(st.bottom, bar.top);
    });
  });
/** Where the middle of the mark of a step is on the screen, drawn or not. */
const pointOf = (page: Page, id: string): Promise<[number, number]> =>
  step(page, id).evaluate(g => {
    const m = g.querySelector('.st')!.getBoundingClientRect();
    return [m.left + m.width / 2, m.top + m.height / 2];
  });
/** Which of these steps are whole in the room: their body on the stage and over the zoom control. */
const inRoom = (page: Page, ids: string[]): Promise<string[]> =>
  page.evaluate(ids => {
    const st = document.querySelector('.roadmap .stage')!.getBoundingClientRect(), bar = document.querySelector('.roadmap .zoom')!.getBoundingClientRect();
    return ids.filter(id => {
      const g = document.querySelector(`svg.plan g.zn[data-id="${id}"]`), b = (g?.querySelector('.coin') ?? g?.querySelector('.st'))?.getBoundingClientRect();
      return !!b && b.width > 0 && b.left >= st.left - 0.5 && b.right <= st.right + 0.5 && b.top >= st.top - 0.5 && b.bottom <= Math.min(st.bottom, bar.top) + 0.5;
    });
  }, ids);
const moved = (a: [number, number], b: [number, number]): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Presses a key and waits for the view to rest. */
async function key(page: Page, k: string): Promise<void> {
  await page.keyboard.press(k);
  await settle(page);
}

/** A plan wider than the window at each level. At 'Main steps' the group 'Mid' is near the middle of the window and holds 'hid', the first step in progress, which is not drawn there.
 * Further on, near the right of the window, the step in progress 'b-3' is drawn at every level. */
const busy: Roadmap = {
  title: 'Busy plan',
  branches: [{ name: 'Row', items: [
    ...Array.from({ length: 4 }, (_, i) => ({ id: `a-${i}`, name: `Before ${i}` })),
    { name: 'Mid', split: [{ name: 'A', items: [{ id: 'hid', name: 'Hidden', state: 'in-progress' }] }, { name: 'B', items: [{ id: 'hid-b', name: 'Hidden too' }] }] },
    ...Array.from({ length: 24 }, (_, i) => ({ id: `b-${i}`, name: `Step ${i}`, state: i === 3 ? 'in-progress' as const : 'todo' as const })),
  ] }],
};

for (const [width, height] of [[1440, 900], [844, 390], [390, 664]]) {
  const at = `${width}x${height}`;
  test(`at ${at}, the step in progress stays in sight through changes`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPlan(page, columns('Three-c'), { store: null });

    await test.step('the first view has the step in progress in the room', async () => {
      expect(await busyInRoom(page)).toBe(true);
    });

    if (width !== 844) {
      await test.step('the switches pressed and pressed back put the plan back', async () => {
        await openTools(page);
        const start = await pointOf(page, 'start'), first = await flowOf(page);
        const press = async (sw: Locator): Promise<void> => {
          await sw.click();
          await settle(page);
        };
        for (const sw of [labelsSwitch(page), iconsSwitch(page), labelsSwitch(page), iconsSwitch(page)]) await press(sw);
        expect(moved(await pointOf(page, 'start'), start), 'labels, icons, labels, icons').toBeLessThan(1);
        await press(labelsSwitch(page));
        await pickLayout(page, first === 'v' ? 'Horizontal' : 'Vertical');
        await press(labelsSwitch(page));
        await pickLayout(page, first === 'v' ? 'Vertical' : 'Horizontal');
        expect(moved(await pointOf(page, 'start'), start), 'labels, the layout, labels, the layout').toBeLessThan(1);
      });
    }

    await test.step('the step in progress stays in sight through zooms and turns', async () => {
      for (const to of ['Tracks', 'Every step']) {
        await zoomTo(page, to);
        expect(await busyInRoom(page), `'${to}'`).toBe(true);
      }
      await pickLayout(page, (await flowOf(page)) === 'v' ? 'Horizontal' : 'Vertical');
      await page.keyboard.press('Escape');
      await expect(popup(page)).toBeHidden();
      expect(await busyInRoom(page), 'turned').toBe(true);
      for (const to of ['Tracks', 'Main steps']) {
        await zoomTo(page, to);
        expect(await busyInRoom(page), `turned, '${to}'`).toBe(true);
      }
    });
  });
}

test('a zoom or a switch holds the plan by the right step', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });

  await test.step('on a phone, a zoom keeps the column in progress whole', async () => {
    // at 'Tracks' and 'Every step' one column fits a phone, two do not
    await openPlan(page, columns('Three-d'), { store: null });
    expect(await flowOf(page)).toBe('v');
    for (const to of ['Tracks', 'Every step']) {
      // the bar of a phone has no + button: the key
      await key(page, '+');
      expect(await level(page)).toBe(to);
      // the texts of the column 'Three' as drawn: its caption, the names of its steps, its group name and the captions of its tracks
      const cut = await page.evaluate(() => {
        const st = document.querySelector('.roadmap .stage')!, r = st.getBoundingClientRect(), right = r.left + st.clientWidth;
        const seen = (e: Element): boolean => getComputedStyle(e).display !== 'none' && Number(e.getAttribute('opacity') ?? 1) > 0.5;
        const texts = [...document.querySelectorAll('svg.plan text')].filter(t => seen(t) && /^(Three|Code|Tests)/.test(t.textContent ?? ''));
        // the captions 'Code' and 'Tests' of the column 'Three': those right of its own caption and before the next column's
        const three = texts.find(t => t.textContent === 'Three')!.getBoundingClientRect().left;
        const four = [...document.querySelectorAll('svg.plan text')].find(t => t.textContent === 'Four')?.getBoundingClientRect().left ?? Infinity;
        return texts.filter(t => { const b = t.getBoundingClientRect(); return b.left >= three - 40 && b.left < four - 20; })
          .filter(t => { const b = t.getBoundingClientRect(); return b.left < r.left - 0.5 || b.right > right + 0.5; }).map(t => t.textContent);
      });
      expect(cut, `${to}: cut at an edge`).toEqual([]);
      await expect(nameOf(page, 'Three-d')).toBeVisible();
    }
  });

  await test.step('+ and − hold the view by the nearest step in progress', async () => {
    // 'hid' sits where its group is, and the group opens wider at 'Tracks': a view held by 'hid' would move 'b-3' by as much as the group opens.
    // At a new level the page may tidy the place a little, so nothing is cut in two at an edge; back at 'Main steps', 'b-3' is where it was
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlan(page, busy, { store: null });
    const x = (await pointOf(page, 'b-3'))[0];
    for (const k of ['+', '+', '-', '-']) {
      await key(page, k);
      const to = await level(page);
      expect(Math.abs((await pointOf(page, 'b-3'))[0] - x), `after ${k}, at '${to}'`).toBeLessThan(to === 'Main steps' ? 1 : 40);
    }
  });
});

test('a picked step holds the plan when a switch goes back', async ({ page }) => {
  await openPlan(page, ROADMAP, { store: 'place.kept', kept: { level: 2, icons: true, labels: true, flow: 'h', scale: 1, id: '-', fx: 0, fy: 0 } });
  const swap: [string, () => Promise<void>, () => Promise<void>][] = [
    ['a flip of the labels', () => showLabels(page, false), () => showLabels(page, true)],
    ['a turn', () => pickLayout(page, 'Vertical'), () => pickLayout(page, 'Horizontal')],
  ];
  for (const [what, there, back] of swap) {
    await test.step(`${what} and back keeps the picked step in the room`, async () => {
      await there();
      await page.keyboard.press('Escape');
      await expect(popup(page)).toBeHidden();
      // the step nearest the middle of the lower half of the stage
      const id = await page.evaluate(() => {
        const st = document.querySelector('.roadmap .stage')!.getBoundingClientRect(), x0 = st.left + st.width / 2, y0 = st.top + st.height * 0.6;
        let best = '', d = Infinity;
        for (const g of document.querySelectorAll<SVGGElement>('svg.plan g.zn[data-id]')) {
          if (getComputedStyle(g).display === 'none') continue;
          const b = g.getBoundingClientRect(), dn = Math.hypot(b.left + b.width / 2 - x0, b.top + b.height / 2 - y0);
          if (b.width && dn < d) { d = dn; best = g.dataset.id!; }
        }
        return best;
      });
      await step(page, id).click();
      await settle(page);
      await expect(side(page)).toBeVisible();
      await back();
      await page.keyboard.press('Escape');
      await expect(popup(page)).toBeHidden();
      expect(await inRoom(page, [id]), `${id} after ${what} and back`).toEqual([id]);
      await key(page, 'Escape');
    });
  }
});
