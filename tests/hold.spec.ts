// 'Layout tests': where the view holds the plan while it changes. The step in progress, or what stands for it, stays in sight at every level and through a turn;
// the switches in the popup, pressed and pressed back in any order, put the plan back where it was; a phone turned on its side and back keeps its place;
// a new size while a move plays ends the move where it was going; 'Show only blockers' keeps the step and its blockers in the room, also as the phone turns;
// a press that closes the popup eats its own click, and the second of a double click or tap, and nothing more; a picked pill glides clear of the sheet;
// the zoom control keeps its height at 320 px; the first view keeps the count of its version whole, and on his file early in v1.0.0 the name 'V1.0.0' inside the stage;
// a picked step holds the plan when a switch goes back;
// a turn held by the address shows the plan on its way; at the end of the plan, the first view cuts nothing at an edge, and stays where it was put.
import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { publicRoadmap } from '../src/roadmap/public';
import type { Roadmap } from '../src/roadmap/types';
import { expect, flowOf, toolsButton, labelsSwitch, level, openApp, openTools, openPlan, pickLayout, play, popup, reload, save, settle, showLabels, side, step, stopClock, test, zoomTo, iconsSwitch } from './helpers';
import { columns, edit, full, nodeOf, nodesOf, sideBySide } from './plans';

/** His roadmap with one step in progress, 'Layout code', inside the group 'Layout build': the states in his file change as the work goes on. */
const HIS = JSON.parse(readFileSync(new URL('./roadmapper.json', import.meta.url), 'utf8')) as Roadmap;
const busyHis = edit(HIS, p => {
  for (const n of nodesOf(p)) if (n.state === 'in-progress') n.state = 'todo';
  nodeOf(p, 'layout-build').state = 'in-progress';
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
/** Where the middle of a step is on the screen, drawn or not. */
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
const stop = (page: Page, name: string): Locator => page.locator('.zoom').getByRole('button', { name, exact: true });
const host = (page: Page): Locator => page.locator('.roadmap');

test.describe('the step in progress, inside a group far out and inside a closed track at Tracks', () => {
  for (const [width, height] of [[1440, 900], [844, 390], [390, 664]]) {
    test(`stays in sight at ${width}x${height}, at every level and through a turn`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openPlan(page, columns('Three-c'), { store: null });
      expect(await busyInRoom(page), 'the first view').toBe(true);
      for (const turn of [false, true]) {
        if (turn) {
          await pickLayout(page, (await flowOf(page)) === 'v' ? 'Horizontal' : 'Vertical');
          await page.keyboard.press('Escape');
          await expect(popup(page)).toBeHidden();
          expect(await busyInRoom(page), 'turned').toBe(true);
        }
        for (const at of ['Tracks', 'Every step', 'Tracks', 'Main steps']) {
          await zoomTo(page, at);
          expect(await busyInRoom(page), `${turn ? 'turned, ' : ''}'${at}'`).toBe(true);
        }
      }
    });
  }
});

test.describe('the switches in the popup, pressed and pressed back in any order, put the plan back where it was', () => {
  for (const [width, height] of [[1440, 900], [390, 664]]) {
    test(`at ${width}x${height}: labels, icons, labels, icons; then labels, the layout, labels, the layout`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openPlan(page, columns('Three-c'), { store: null });
      await openTools(page);
      const start = await pointOf(page, 'start'), first = await flowOf(page);
      const press = async (sw: Locator): Promise<void> => {
        await sw.click();
        await settle(page);
      };
      for (const sw of [labelsSwitch(page), iconsSwitch(page), labelsSwitch(page), iconsSwitch(page)]) await press(sw);
      let now = await pointOf(page, 'start');
      expect(Math.hypot(now[0] - start[0], now[1] - start[1]), 'labels, icons, labels, icons').toBeLessThan(1);
      await press(labelsSwitch(page));
      await pickLayout(page, first === 'v' ? 'Horizontal' : 'Vertical');
      await press(labelsSwitch(page));
      await pickLayout(page, first === 'v' ? 'Vertical' : 'Horizontal');
      now = await pointOf(page, 'start');
      expect(Math.hypot(now[0] - start[0], now[1] - start[1]), 'labels, the layout, labels, the layout').toBeLessThan(1);
    });
  }
});

test('a picked step holds the plan when a switch goes back: after a flip of the labels, or a turn, and a pick, it stays on the stage', async ({ page }) => {
  await openApp(page, { kept: { level: 2, icons: true, labels: true, flow: 'h', scale: 1, id: '-', fx: 0, fy: 0 } });
  const swap: [() => Promise<void>, () => Promise<void>][] = [
    [() => showLabels(page, false), () => showLabels(page, true)],
    [() => pickLayout(page, 'Vertical'), () => pickLayout(page, 'Horizontal')],
  ];
  for (const [go, back] of swap) {
    await go();
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
    expect(await inRoom(page, [id]), `${id} after the switch back`).toEqual([id]);
    await page.keyboard.press('Escape');
    await settle(page);
  }
});

test('a press that ends with no click, such as a right click, eats nothing after it: the keyboard acts at once', async ({ page }) => {
  await openPlan(page, full, { store: null });
  const r = (await page.locator('.roadmap .stage').boundingBox())!;
  await openTools(page);
  await page.mouse.click(r.x + 20, r.y + r.height - 20, { button: 'right' });
  await expect(popup(page)).toBeHidden();
  await toolsButton(page).press('Enter');
  await expect(popup(page), 'the first Enter opens it').toBeVisible();
  await page.mouse.click(r.x + 20, r.y + r.height - 20, { button: 'right' });
  await expect(popup(page)).toBeHidden();
  await stop(page, 'Every step').press('Enter');
  await settle(page);
  expect(await level(page), 'the first Enter zooms').toBe('Every step');
});

test('with the popup open, a double click on a step shuts it and does nothing else: no pick and no zoom', async ({ page }) => {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Tracks');
  await openTools(page);
  await step(page, 'kickoff').dblclick();
  await settle(page);
  await expect(popup(page)).toBeHidden();
  await expect(side(page), 'no pick').toBeHidden();
  expect(await level(page), 'no zoom').toBe('Tracks');
});

test("on his page at 1440x900, the first view keeps the count of the version it opens in whole, where the end of that version fits", async ({ page }) => {
  await openApp(page);
  const cut = await page.evaluate(() => {
    const stage = document.querySelector('.roadmap .stage')!, st = stage.getBoundingClientRect(), right = st.left + stage.clientWidth;
    return [...document.querySelectorAll<SVGTextElement>('svg.plan text.count')].filter(t => {
      const b = t.getBoundingClientRect();
      // 2 px or less of it in sight is out of sight, as the view takes it; and so is a count over the top or under the bottom of the stage
      return getComputedStyle(t).display !== 'none' && b.width > 0 && b.left < right - 2 && b.right > right + 0.5 && b.bottom > st.top + 2 && b.top < st.bottom - 2;
    }).map(t => t.textContent);
  });
  expect(cut, 'cut at the right edge').toEqual([]);
});

/** His roadmap file as it was early in v1.0.0, with no step in progress: a copy, as the states in his file change as the work goes on. */
const EARLY = JSON.parse(readFileSync(new URL('./roadmapper-v1.json', import.meta.url), 'utf8')) as Roadmap;

test("on his roadmap file early in v1.0.0, across at 1440x900, the first view shows the name 'V1.0.0' of the top-level branch whole, inside the stage", async ({ page }) => {
  await openPlan(page, EARLY, { store: null });
  expect(await flowOf(page)).toBe('h');
  const [cap, stage] = await page.evaluate(() => {
    const st = document.querySelector('.roadmap .stage')!, s = st.getBoundingClientRect();
    // the name 'V1.0.0', which the file writes 'v1.0.0'
    const c = [...document.querySelectorAll('svg.plan text.cap')].find(t => t.textContent === 'v1.0.0')!.getBoundingClientRect();
    return [[c.left, c.top, c.right, c.bottom], [s.left, s.top, s.left + st.clientWidth, s.top + st.clientHeight]];
  });
  expect(cap[0], 'its left edge').toBeGreaterThanOrEqual(stage[0] - 0.5);
  expect(cap[1], 'its top edge').toBeGreaterThanOrEqual(stage[1] - 0.5);
  expect(cap[2], 'its right edge').toBeLessThanOrEqual(stage[2] + 0.5);
  expect(cap[3], 'its bottom edge').toBeLessThanOrEqual(stage[3] + 0.5);
});

/** What a stranger sees of his roadmap as V1 goes out: all done but 'Release v1', the last step of the plan, which the page opens on. The export gives each step a new id. */
const releasing = edit(publicRoadmap(HIS), p => {
  for (const n of nodesOf(p)) if (n.state !== 'canceled') n.state = n.name === 'Release v1' ? 'todo' : 'done';
});
/** What an edge of the stage or the zoom control cuts now, as the view takes it: each name, count, step, pill and tally less than 1 px past an edge, so a sliver of it may show, and more than 2 px out. */
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
      // under the zoom control in part
      const under = Math.min(r.right, bar.right) - Math.max(r.left, bar.left) > 2 && Math.min(r.bottom, bar.bottom) - Math.max(r.top, bar.top) > 2;
      return under && !(r.left >= bar.left && r.right <= bar.right && r.top >= bar.top && r.bottom <= bar.bottom);
    };
    return [...document.querySelectorAll('svg.plan text, svg.plan .coin, svg.plan g.zn > .st, svg.plan .zbar, svg.plan .tally')].filter(cut)
      .map(e => e.textContent || `${e.getAttribute('class')} ${e.closest('[data-id]')?.getAttribute('data-id') ?? e.closest('[data-bar]')?.getAttribute('data-bar') ?? ''}`);
  });

test.describe("at the end of the plan, as his page is when V1 goes out, the first view cuts nothing at an edge, not even a sliver: the plan goes past its end to show it whole or hide it", () => {
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [414, 896], [375, 667]]) {
    test(`at ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openPlan(page, releasing, { store: null });
      expect(await cutNow(page)).toEqual([]);
    });
  }
});

test("at 1440x900 the first view, past the end of the plan, stays there: a visit after, a redraw after a scroll, a new size and a scale with Ctrl and the wheel do not pull it back", async ({ page }) => {
  const id = nodesOf(releasing).find(n => n.name === 'Release v1')!.id!;
  await openPlan(page, releasing, { store: 'hold.end' });
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
  await page.setViewportSize({ width: 1440, height: 880 });
  await settle(page);
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

  for (const [his, hidden] of [[false, false], [false, true], [true, true]]) {
    test(`${his ? "on his roadmap with 'Layout code' in progress, " : ''}turned on its side and back after a scroll, keeps the step in progress in sight${hidden ? ', with the labels hidden' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      if (his) await openPlan(page, busyHis, { store: null });
      else await openPlan(page, columns('Three-c'), { store: null });
      if (hidden) {
        await showLabels(page, false);
        await toolsButton(page).click();
        await expect(popup(page)).toBeHidden();
      }
      // the user moves the plan, so the first view is not put again: the step in progress low in the room, where the room on its side does not reach
      await page.evaluate(() => {
        const st = document.querySelector('.roadmap .stage')!, r = st.getBoundingClientRect(), bar = document.querySelector('.roadmap .zoom')!.getBoundingClientRect();
        const m = [...document.querySelectorAll('svg.plan g.node.in-progress')].map(e => e.getBoundingClientRect()).find(b => b.width > 0)!;
        st.scrollBy(0, m.top + m.height / 2 - (r.top + 0.75 * (bar.top - r.top)));
      });
      await settle(page);
      expect(await busyInRoom(page), 'upright').toBe(true);
      await page.setViewportSize({ width: 568, height: 320 });
      await settle(page);
      expect(await flowOf(page)).toBe('h');
      expect(await busyInRoom(page), 'on its side').toBe(true);
      await page.setViewportSize({ width: 320, height: 568 });
      await settle(page);
      expect(await flowOf(page)).toBe('v');
      expect(await busyInRoom(page), 'upright again').toBe(true);
    });
  }

  test('turned on its side while a change of level or a flip of the labels plays, comes to rest where the move was going', async ({ page }) => {
    // on a stopped clock: each move is 100 ms on its way when the size changes, and only the new size can end it
    await openPlan(page, full, { store: null, motion: true, clock: true });
    await stopClock(page);
    await stop(page, 'Every step').click();
    await page.clock.runFor(100);
    await expect(host(page), 'on its way').toHaveAttribute('data-moving');
    await page.setViewportSize({ width: 664, height: 390 });
    await expect(host(page), 'at rest').not.toHaveAttribute('data-moving');
    expect(await level(page)).toBe('Every step');
    await page.setViewportSize({ width: 390, height: 664 });
    await settle(page);
    await openTools(page);
    await labelsSwitch(page).click();
    await page.clock.runFor(100);
    await expect(host(page), 'on its way').toHaveAttribute('data-moving');
    await page.setViewportSize({ width: 664, height: 390 });
    await expect(host(page), 'at rest').not.toHaveAttribute('data-moving');
    await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', 'true');
  });

  test('a new size while a change of level plays ends the move where it was going, as a new size after it does', async ({ page }) => {
    // early, on a stopped clock: the move is 100 ms on its way when the size changes
    const after = async (early: boolean): Promise<[number, number]> => {
      await page.setViewportSize({ width: 390, height: 664 });
      await openPlan(page, columns('Three-c'), { store: null, motion: true, clock: early });
      if (early) await stopClock(page);
      await stop(page, 'Every step').click();
      if (early) {
        await page.clock.runFor(100);
        await expect(host(page), 'on its way').toHaveAttribute('data-moving');
      } else await settle(page);
      await page.setViewportSize({ width: 390, height: 624 });
      await settle(page);
      return pointOf(page, 'Three-c');
    };
    const late = await after(false), early = await after(true);
    expect(Math.hypot(early[0] - late[0], early[1] - late[1])).toBeLessThan(2);
  });

  test("'Show only blockers' keeps the layout as the phone turns, with the step and its blockers in the room; when all comes back, the layout follows the size", async ({ page }) => {
    const kept = ['k-c', 'l-c', 'l-t'];
    await page.setViewportSize({ width: 360, height: 640 });
    await openPlan(page, sideBySide, { store: null });
    await showLabels(page, false);
    await toolsButton(page).click();
    await zoomTo(page, 'Every step');
    await step(page, 'k-c').click();
    await settle(page);
    await side(page).getByRole('button', { name: 'Show only blockers' }).click();
    await settle(page);
    expect(await inRoom(page, kept), 'upright').toEqual(kept);
    await page.setViewportSize({ width: 640, height: 360 });
    await settle(page);
    expect(await flowOf(page), 'on its side, the layout stays').toBe('v');
    expect(await inRoom(page, kept), 'on its side').toEqual(kept);
    await page.setViewportSize({ width: 360, height: 640 });
    await settle(page);
    expect(await inRoom(page, kept), 'upright again').toEqual(kept);
    await page.setViewportSize({ width: 640, height: 360 });
    await settle(page);
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(page.getByRole('button', { name: 'Show all' })).toBeHidden();
    expect(await flowOf(page), 'all back, the layout of the size').toBe('h');
  });

  test("'Show only blockers' down at 320 px wide keeps each of them, and each of their names, in the room", async ({ page }) => {
    const kept = ['k-c', 'l-c', 'l-t'];
    await page.setViewportSize({ width: 320, height: 568 });
    await openPlan(page, sideBySide, { store: null });
    expect(await flowOf(page)).toBe('v');
    await zoomTo(page, 'Every step');
    await step(page, 'k-c').click();
    await settle(page);
    await side(page).getByRole('button', { name: 'Show only blockers' }).click();
    await settle(page);
    expect(await inRoom(page, kept)).toEqual(kept);
    const names = await page.locator('.roadmap .names div').evaluateAll(ds => ds.map(d => { const b = d.getBoundingClientRect(); return { text: d.textContent, l: b.left, r: b.right }; }));
    expect(names).toHaveLength(3);
    for (const n of names) {
      expect(n.l, n.text!).toBeGreaterThanOrEqual(0);
      expect(n.r, n.text!).toBeLessThanOrEqual(320);
    }
  });

  test('with the popup open, a double tap on the plan shuts it and does nothing else: no sheet and no zoom', async ({ page }) => {
    // on a stopped clock: the page reads the two taps as 120 ms apart however long it takes over each, and a tap that waits to pick waits for play()
    await openPlan(page, full, { store: null, clock: true });
    await zoomTo(page, 'Tracks');
    // the plan scrolled down to its top, so that the room over the popup holds its first steps
    await page.locator('.roadmap .stage').evaluate(s => { s.scrollTop = 0; });
    await settle(page);
    await toolsButton(page).tap();
    await expect(popup(page)).toBeVisible();
    // a step, a group step or a pill in the room, over the popup
    const [x, y] = await page.evaluate(() => {
      const st = document.querySelector('.roadmap .stage')!.getBoundingClientRect(), low = document.querySelector('.roadmap .popup')!.getBoundingClientRect().top;
      for (const g of document.querySelectorAll('svg.plan g.zn, svg.plan g.tally')) {
        const b = g.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        if (getComputedStyle(g).display !== 'none' && b.width && x > st.left + 20 && x < st.right - 20 && y > st.top + 20 && y < low - 20) return [x, y];
      }
      return [0, 0];
    });
    expect(x, 'a thing to tap in the room').toBeGreaterThan(0);
    await stopClock(page);
    await page.touchscreen.tap(x, y);
    await expect(popup(page)).toBeHidden();
    await page.clock.runFor(120);
    await page.touchscreen.tap(x, y);
    // past the 300 ms that a tap waits before it picks
    await play(page, 1000);
    await expect(popup(page)).toBeHidden();
    await expect(side(page), 'no sheet').toBeHidden();
    expect(await level(page), 'no zoom').toBe('Tracks');
  });

  test('across, a tapped pill with its name clear of the sheet but itself under it glides clear of the sheet', async ({ page }) => {
    // the tracks 'Code' of four builds one under the other: their sheets are as high as each other
    await openPlan(page, columns('One-d'), { store: null });
    await pickLayout(page, 'Horizontal');
    await toolsButton(page).tap();
    await zoomTo(page, 'Tracks');
    const keys = await page.evaluate(() => {
      const shown = (e: Element | null): boolean => !!e && getComputedStyle(e).display !== 'none';
      return [...document.querySelectorAll<SVGTextElement>('svg.plan text.cap')].filter(t => t.textContent === 'Code' && shown(t) && shown(document.querySelector(`svg.plan rect.zbar[data-bar="${t.dataset.bar}"]`)))
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map(t => t.dataset.bar!);
    });
    const name = (k: string): Locator => page.locator(`svg.plan text.cap[data-bar="${k}"]`), pillOf = (k: string): Locator => page.locator(`svg.plan rect.zbar[data-bar="${k}"]`);
    const tap = async (k: string, holds: string): Promise<void> => {
      const b = (await pillOf(k).boundingBox())!;
      // on its upper part: the open sheet of the one before may lie over its lower part
      await page.touchscreen.tap(b.x + b.width / 2, b.y + 6);
      await expect(side(page)).toContainText(holds);
      await settle(page);
    };
    // the one of 'Three build', picked: its sheet says where the top of a sheet of a track 'Code' is
    const [x, y] = keys.slice(-2);
    await name(x).evaluate(e => e.scrollIntoView({ block: 'center', inline: 'center' }));
    await settle(page);
    await tap(x, 'Three code');
    const top = (await side(page).boundingBox())!.y;
    // the one of 'Four build': its name in the strip over the sheet, and its pill under the sheet, lower
    const cap = (await name(y).boundingBox())!;
    await page.locator('.roadmap .stage').evaluate((s, by) => s.scrollBy(0, by), cap.y + cap.height - (top - 26));
    await settle(page);
    const was = (await pillOf(y).boundingBox())!, capWas = (await name(y).boundingBox())!;
    expect(capWas.y + capWas.height, 'the name in the strip').toBeLessThan(top - 24);
    expect(was.y + was.height, 'the pill under the sheet').toBeGreaterThan(top);
    await tap(y, 'Four code');
    const pill = (await pillOf(y).boundingBox())!, sheet = (await side(page).boundingBox())!;
    expect(Math.abs(sheet.y - top), 'a sheet about as high').toBeLessThan(10);
    expect(pill.y + pill.height, 'the pill clear of the sheet').toBeLessThanOrEqual(sheet.y + 0.5);
  });

  test('at 320 px wide the zoom control keeps its height at every level, and the open popup stays 30 px over it, clear of the grip', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openPlan(page, full, { store: null });
    await toolsButton(page).tap();
    await expect(popup(page)).toBeVisible();
    let high: number | null = null;
    for (const at of ['Tracks', 'Every step', 'Main steps', 'Tracks']) {
      await stop(page, at).tap();
      await settle(page);
      const bar = (await page.locator('.roadmap .zoom').boundingBox())!, pop = (await popup(page).boundingBox())!;
      high ??= bar.height;
      expect(bar.height, `'${at}'`).toBeCloseTo(high, 0);
      expect(bar.y - (pop.y + pop.height), `'${at}': the popup over the control, clear of the grip`).toBeCloseTo(30, 0);
    }
  });

  test("on his roadmap with 'Layout code' in progress, a turn held by its address shows the plan on its way, around the step in progress", async ({ page }) => {
    await openPlan(page, busyHis, { store: null, hash: 't=0.5' });
    const shown = await page.evaluate(() => {
      const st = document.querySelector('.roadmap .stage')!.getBoundingClientRect();
      return [...document.querySelectorAll('svg.plan g.zn')].filter(g => {
        const b = g.getBoundingClientRect();
        return getComputedStyle(g).display !== 'none' && b.width > 0 && b.right > st.left && b.left < st.right && b.bottom > st.top && b.top < st.bottom;
      }).length;
    });
    expect(shown, 'steps on the stage').toBeGreaterThan(4);
    expect(await busyInRoom(page)).toBe(true);
  });
});
