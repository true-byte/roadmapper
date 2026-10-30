// A new size of the view: the plan is put in the room again, and takes the layout the size wants, until the user picks one.
// A phone turned on its side and back keeps its place, and a new size while a move plays ends the move where it was going.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { publicRoadmap } from '../../src/roadmap/public';
import type { Roadmap } from '../../src/roadmap/types';
import { expect, flowOf, labelsSwitch, level, nameOf, openEmbed, openPlan, openTools, pickLayout, play, popup, reload, save, settle, showLabels, step, stopClock, test, toolsButton } from '../support/helpers';
import { columns, edit, full, nodeOf, nodesOf } from '../support/plans';

/** The roadmap of the app page. */
const ROADMAP = JSON.parse(readFileSync(new URL('../fixtures/roadmap.json', import.meta.url), 'utf8')) as Roadmap;
/** The roadmap with one step in progress, 'Layout code', inside the group 'Layout build'. */
const busyLayout = edit(ROADMAP, p => {
  for (const n of nodesOf(p)) if (n.state === 'in-progress') n.state = 'todo';
  nodeOf(p, 'layout-build').state = 'in-progress';
});
/** What a stranger sees of the roadmap as its first version goes out: all done but 'Release v1', the last step of the plan, which the page opens on. */
const releasing = edit(publicRoadmap(ROADMAP), p => {
  for (const n of nodesOf(p)) if (n.state !== 'canceled') n.state = n.name === 'Release v1' ? 'todo' : 'done';
});

/** The radio of the pair that is chosen. */
const chosen = (page: Page): Promise<string | null> =>
  popup(page).getByRole('radiogroup', { name: 'Layout', includeHidden: true }).getByRole('radio', { checked: true, includeHidden: true }).getAttribute('aria-label');
const stageScroll = (page: Page): Promise<[number, number]> => page.locator('.roadmap .stage').evaluate(s => [s.scrollLeft, s.scrollTop]);
/** Where the middle of the mark of a step is on the screen, drawn or not. */
const pointOf = (page: Page, id: string): Promise<[number, number]> =>
  step(page, id).evaluate(g => {
    const m = g.querySelector('.st')!.getBoundingClientRect();
    return [m.left + m.width / 2, m.top + m.height / 2];
  });
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
/** What an edge of the stage or the zoom control cuts now, as the view takes it: each name, count, step, pill and tally less than 1 px past an edge, and more than 2 px out. */
const cutNow = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const stage = document.querySelector('.roadmap .stage')!, s = stage.getBoundingClientRect(), bar = document.querySelector('.roadmap .zoom')!.getBoundingClientRect();
    const V = { l: s.left, t: s.top, r: s.left + stage.clientWidth, b: s.top + stage.clientHeight };
    const seen = (e: Element): boolean => {
      for (let x: Element | null = e; x && x.tagName !== 'svg'; x = x.parentElement) if (getComputedStyle(x).display === 'none' || Number(x.getAttribute('opacity') ?? 1) < 0.5) return false;
      return true;
    };
    const cut = (e: Element): boolean => {
      const r = e.getBoundingClientRect();
      if (!seen(e) || Math.min(r.right, V.r) - Math.max(r.left, V.l) <= -1 || Math.min(r.bottom, V.b) - Math.max(r.top, V.t) <= -1) return false;
      if (r.left < V.l - 2 || r.right > V.r + 2 || r.top < V.t - 2 || r.bottom > V.b + 2) return true;
      const under = Math.min(r.right, bar.right) - Math.max(r.left, bar.left) > 2 && Math.min(r.bottom, bar.bottom) - Math.max(r.top, bar.top) > 2;
      return under && !(r.left >= bar.left && r.right <= bar.right && r.top >= bar.top && r.bottom <= bar.bottom);
    };
    return [...document.querySelectorAll('svg.plan text, svg.plan .coin, svg.plan g.zn > .st, svg.plan .zbar, svg.plan .tally')].filter(cut)
      .map(e => e.textContent || `${e.getAttribute('class')} ${e.closest('[data-id]')?.getAttribute('data-id') ?? e.closest('[data-bar]')?.getAttribute('data-bar') ?? ''}`);
  });
/** Gives the view a new size, and waits for it to rest. */
async function resize(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await settle(page);
}
/** Stops the clock that the page was opened with, a second on from the time on the page, which may be ahead of the real time. */
async function pause(page: Page): Promise<void> {
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
}

test('the layout follows the size until the user picks one', async ({ page }) => {
  /** The layout drawn, and the one of the pair that is chosen, at a size; and the name of a step shows. */
  const draws = async (flow: string): Promise<void> => {
    expect(await flowOf(page)).toBe(flow);
    expect(await chosen(page), 'the chosen one of the pair').toBe(flow === 'v' ? 'Vertical' : 'Horizontal');
    await expect(nameOf(page, 'kickoff').first()).toBeVisible();
  };

  await test.step('a view first draws down at 390x664', async () => {
    await page.setViewportSize({ width: 390, height: 664 });
    await openPlan(page, full, { store: null });
    await draws('v');
  });

  await test.step('a phone turned and back draws its first view again', async () => {
    const first = await stageScroll(page);
    await resize(page, 844, 390);
    expect(await flowOf(page), 'on its side').toBe('h');
    await resize(page, 390, 664);
    expect(await flowOf(page), 'upright again').toBe('v');
    const again = await stageScroll(page);
    expect(Math.abs(again[0] - first[0]) + Math.abs(again[1] - first[1]), 'the same first view').toBeLessThan(2);
  });

  // with no pick, a new size draws the layout that a first view at that size draws
  for (const [width, height, flow] of [[360, 640, 'v'], [500, 900, 'v'], [844, 390, 'h'], [700, 900, 'h']] as const) {
    await test.step(`with no pick, ${width}x${height} draws ${flow === 'v' ? 'down' : 'across'}`, async () => {
      await resize(page, width, height);
      await draws(flow);
    });
  }

  await test.step('a view first draws across at 1440x900', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlan(page, full, { store: null });
    await draws('h');
  });

  await test.step('a picked layout holds when the window changes size', async () => {
    await pickLayout(page, 'Vertical');
    await resize(page, 1200, 900);
    expect(await flowOf(page), 'picked down, at 1200 px').toBe('v');
    await pickLayout(page, 'Horizontal');
    await resize(page, 500, 900);
    expect(await flowOf(page), 'picked across, at 500 px').toBe('h');
  });

  await test.step('a box draws across at any size', async () => {
    await page.setViewportSize({ width: 390, height: 664 });
    await openEmbed(page, { plan: full });
    expect(await flowOf(page)).toBe('h');
  });
});

test('the first view past the end of the plan stays there', async ({ page }) => {
  const id = nodesOf(releasing).find(n => n.name === 'Release v1')!.id!;
  await openPlan(page, releasing, { store: 'resize.end' });
  const first = await pointOf(page, id);
  expect(await cutNow(page), 'the first view').toEqual([]);
  await reload(page);
  expect(await pointOf(page, id), 'a visit after').toEqual(first);
  // the user moves the plan a little toward its start, and the file is saved
  await page.locator('.roadmap .stage').evaluate(s => s.scrollBy(-30, 0));
  await settle(page);
  const moved = await pointOf(page, id);
  await save(page, edit(releasing, p => { p.about = 'Saved again.'; }));
  expect(await pointOf(page, id), 'a redraw').toEqual(moved);
  await resize(page, 1440, 880);
  expect(Math.abs((await pointOf(page, id))[0] - moved[0]), 'a new size').toBeLessThan(2);
  // the step under the pointer stays under it
  const [x, y] = await pointOf(page, id);
  await page.mouse.move(x, y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 2);
  await page.keyboard.up('Control');
  await settle(page);
  const scaled = await pointOf(page, id);
  expect(Math.abs(scaled[0] - x) + Math.abs(scaled[1] - y), 'a scale').toBeLessThan(2);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  /** The user moves the plan, so the first view is not put again: the step in progress low in the room, where the room on its side does not reach. Then the phone turns and back. */
  async function turned(page: Page): Promise<void> {
    await page.evaluate(() => {
      const st = document.querySelector('.roadmap .stage')!, r = st.getBoundingClientRect(), bar = document.querySelector('.roadmap .zoom')!.getBoundingClientRect();
      const m = [...document.querySelectorAll('svg.plan g.node.in-progress')].map(e => e.getBoundingClientRect()).find(b => b.width > 0)!;
      st.scrollBy(0, m.top + m.height / 2 - (r.top + 0.75 * (bar.top - r.top)));
    });
    await settle(page);
    expect(await busyInRoom(page), 'upright').toBe(true);
    await resize(page, 568, 320);
    expect(await flowOf(page)).toBe('h');
    expect(await busyInRoom(page), 'on its side').toBe(true);
    await resize(page, 320, 568);
    expect(await flowOf(page)).toBe('v');
    expect(await busyInRoom(page), 'upright again').toBe(true);
  }
  /** Hides the labels with the switch in the popup, and shuts the popup. */
  async function hide(page: Page): Promise<void> {
    await showLabels(page, false);
    await toolsButton(page).click();
    await expect(popup(page)).toBeHidden();
  }

  test('a phone turned and back keeps the step in progress in sight', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openPlan(page, columns('Three-c'), { store: null });

    await test.step('after a scroll, a turn keeps the step in progress in sight', async () => {
      await turned(page);
    });

    await test.step('with the labels hidden, the step in progress stays in sight too', async () => {
      await hide(page);
      await turned(page);
    });
  });

  test("on the roadmap, a turn keeps 'Layout code' in progress in sight", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openPlan(page, busyLayout, { store: null });
    await hide(page);
    await turned(page);
  });

  test('a new size ends a change of level where it was going', async ({ page }) => {
    // with motion, on a stopped clock: early, the move is 100 ms on its way when the size changes; late, it has ended
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const after = async (early: boolean): Promise<[number, number]> => {
      await page.setViewportSize({ width: 390, height: 664 });
      if (early) await page.clock.resume();
      await openPlan(page, columns('Three-c'), { store: null, clock: !early });
      await pause(page);
      await page.locator('.zoom').getByRole('button', { name: 'Every step', exact: true }).click();
      if (early) {
        await page.clock.runFor(100);
        await expect(page.locator('.roadmap'), 'on its way').toHaveAttribute('data-moving');
      } else await play(page, 2000);
      await resize(page, 390, 624);
      return pointOf(page, 'Three-c');
    };
    const late = await after(false), early = await after(true);
    expect(Math.hypot(early[0] - late[0], early[1] - late[1])).toBeLessThan(2);
  });

  test('a turn ends a move or a flip where it was going', async ({ page }) => {
    // with motion, on a stopped clock: each move is 100 ms on its way when the size changes, and only the new size can end it
    const host = page.locator('.roadmap');
    await openPlan(page, full, { store: null, motion: true, clock: true });
    await stopClock(page);

    await test.step('a turn during a change of level ends it at that level', async () => {
      await page.locator('.zoom').getByRole('button', { name: 'Every step', exact: true }).click();
      await page.clock.runFor(100);
      await expect(host, 'on its way').toHaveAttribute('data-moving');
      await page.setViewportSize({ width: 664, height: 390 });
      await expect(host, 'at rest').not.toHaveAttribute('data-moving');
      expect(await level(page)).toBe('Every step');
    });

    await test.step('a turn ends a flip of the labels with them hidden', async () => {
      await resize(page, 390, 664);
      await openTools(page);
      await labelsSwitch(page).click();
      await page.clock.runFor(100);
      await expect(host, 'on its way').toHaveAttribute('data-moving');
      await page.setViewportSize({ width: 664, height: 390 });
      await expect(host, 'at rest').not.toHaveAttribute('data-moving');
      await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    });
  });
});
