// Zoom: the ways to move between the levels, what each level draws, reading size, the scale a pinch sets, and what keeps the level and the scale.
// The levels a plan has are checked where each plan is first drawn, in smoke.spec.ts.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import type { Item, RoadNode, Roadmap } from '../src/roadmap/types';
import { edit, flat, full, nodeOf, nodesOf, plain, wordy } from './plans';
import { caption, drawnSteps, expect, group, labels, level, levels, nameOf, nameSize, openApp, openPlan, pill, play, READ_PX, reload, save, settle, side, step, stopClock, stored, test, zoomTo } from './helpers';

/** The plan 'plain' with a group inside its group, in the track 'Left'. It has the same three levels. */
const deeper = edit(plain, p => {
  const pair = p.branches[0].items[1];
  if (!('split' in pair)) throw new Error("'Pair' is not a group");
  pair.split[0].items.push({ name: 'Inner', split: [{ name: 'In A', items: [{ id: 'p-in', name: 'Inner one' }] }, { name: 'In B', items: [{ id: 'p-in-b', name: 'Inner two' }] }] });
});

interface Box { x: number; y: number; width: number; height: number }
const inside = (a: Box, b: Box): boolean =>
  a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y + a.height <= b.y + b.height + 0.5;
const middle = (b: Box): [number, number] => [b.x + b.width / 2, b.y + b.height / 2];
const box = async (l: Locator): Promise<Box> => {
  const b = await l.boundingBox();
  if (!b) throw new Error(`${l} is not drawn`);
  return b;
};

/** The frame of an open group, found by the name that sits over its top left corner. Null when no such name is drawn. */
async function frameOf(page: Page, name: string): Promise<Box | null> {
  return page.evaluate(n => {
    const drawn = (e: Element): boolean => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
    const t = [...document.querySelectorAll('svg.plan text.gname')].find(e => e.textContent === n && drawn(e));
    if (!t) return null;
    const a = t.getBoundingClientRect();
    const under = [...document.querySelectorAll('svg.plan rect.group')].filter(drawn).map(e => e.getBoundingClientRect())
      .filter(f => f.left <= a.left + 0.5 && a.left - f.left < 30 && a.bottom <= f.top + 4 && f.top - a.bottom < 16);
    if (under.length !== 1) throw new Error(`${under.length} frames under the name '${n}'`);
    const f = under[0];
    return { x: f.x, y: f.y, width: f.width, height: f.height };
  }, name);
}
async function frame(page: Page, name: string): Promise<Box> {
  const f = await frameOf(page, name);
  expect(f, `a frame named '${name}'`).not.toBeNull();
  return f!;
}
/** The boxes on the screen of what a selector finds that is drawn, with its text and its data-bar, in the order of the page: all measured at once, in the page. */
async function drawnIn(page: Page, css: string): Promise<(Box & { text: string; bar: string | null; id: string | null })[]> {
  return page.evaluate(css => [...document.querySelectorAll(css)].flatMap(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'
      ? [{ x: r.x, y: r.y, width: r.width, height: r.height, text: (e.querySelector('text') ?? e).textContent ?? '', bar: e.getAttribute('data-bar'), id: e.getAttribute('data-id') }]
      : [];
  }), css);
}
/** The counts on the pills drawn inside a box, in reading order. */
async function pillsIn(page: Page, b: Box): Promise<string[]> {
  return (await drawnIn(page, 'svg.plan g.tally')).filter(p => inside(p, b)).map(p => p.text);
}
const stateOfPill = (p: Locator): Locator => p.locator('svg.mark g.node');
const shown = (page: Page, css: string): Locator => page.locator(css).locator('visible=true');
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

// What settle() waits on: the view says it is at rest.
test('the host of the view has data-moving while a move to a level, a change of view, a scale or a smooth scroll is on its way, and not at rest', async ({ page }) => {
  // with motion, on a stopped clock: a move that the view plays itself goes on only as the clock does.
  // The plan 'wordy' fits the window at each level, at reading size, and is wide enough that its last step is under the side bar.
  await openPlan(page, wordy, { store: null, motion: true, clock: true });
  await stopClock(page);
  const host = page.locator('.roadmap');
  /** Goes to a level by its stop, with the move played out. */
  const go = async (name: string): Promise<void> => {
    await page.locator('.zoom').getByRole('button', { name, exact: true }).click();
    await play(page, 2000);
  };
  /** Waits, a frame at a time, for the host to lose data-moving. */
  const ended = (): Promise<unknown> => page.waitForFunction(() => !document.querySelector('.roadmap')!.hasAttribute('data-moving'), null, { polling: 'raf' });
  /** The step drawn furthest right on the screen, where the side bar comes. */
  const rightmost = (): Promise<string> => page.evaluate(() => {
    const st = document.querySelector('.stage')!.getBoundingClientRect();
    return [...document.querySelectorAll<SVGGElement>('svg.plan g.zn[data-id]')].map(g => ({ id: g.dataset.id!, r: g.getBoundingClientRect().right })).filter(g => g.r > 0 && g.r < st.right).sort((a, b) => b.r - a.r)[0].id;
  });
  await expect(host, 'at rest').not.toHaveAttribute('data-moving');

  await test.step('a smooth scroll at a level that fits: the plan scrolls a step under the side bar clear of it', async () => {
    await go('Tracks');
    await expect(page.locator('.stage'), 'the level fits').toHaveCSS('overflow', 'hidden');
    await step(page, await rightmost()).click();
    await expect(host, 'on its way').toHaveAttribute('data-moving');
    await ended();
    expect(await page.locator('.stage').evaluate(s => s.scrollLeft), 'it scrolled').toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await settle(page);
  });

  for (const [what, act] of [
    ['a move to a level', () => page.keyboard.press('+')],
    ['a change of view', () => page.keyboard.press('i')],
    ['a scale', () => turnWheel(page, [720, 400], -100, 1)],
  ] as const) {
    await test.step(what, async () => {
      await act();
      await expect(host, 'on its way').toHaveAttribute('data-moving');
      await page.clock.fastForward(1000);
      await expect(host, 'at its end').not.toHaveAttribute('data-moving');
    });
  }

  await test.step('a smooth scroll: the plan scrolls a step clear of the side bar, at a level that scrolls', async () => {
    // 'Every step', scaled in a notch: wider than the window
    expect(await level(page)).toBe('Every step');
    await expect(page.locator('.stage'), 'the level scrolls').not.toHaveCSS('overflow', 'hidden');
    await page.locator('.stage').evaluate(s => { s.scrollLeft = 0; });
    await settle(page);
    await step(page, await rightmost()).click();
    await expect(host, 'on its way').toHaveAttribute('data-moving');
    await ended();
    expect(await page.locator('.stage').evaluate(s => s.scrollLeft), 'it scrolled').toBeGreaterThan(0);
  });
});

test.describe('the zoom control', () => {
  test('+ and − move one level, and are marked off at the ends', async ({ page }) => {
    await openPlan(page, plain);
    const out = page.getByRole('button', { name: 'Zoom out' }), into = page.getByRole('button', { name: 'Zoom in' });
    await expect(out).toHaveAttribute('aria-disabled', 'true');
    await expect(into).toHaveAttribute('aria-disabled', 'false');
    // a button that is marked off can still be pressed: it does nothing
    await out.click({ force: true });
    await settle(page);
    expect(await level(page)).toBe('Main steps');
    for (const name of ['Tracks', 'Every step']) {
      await into.click();
      await settle(page);
      expect(await level(page)).toBe(name);
    }
    await expect(into).toHaveAttribute('aria-disabled', 'true');
    await expect(out).toHaveAttribute('aria-disabled', 'false');
    await into.click({ force: true });
    await settle(page);
    expect(await level(page)).toBe('Every step');
    await out.click();
    await settle(page);
    expect(await level(page)).toBe('Tracks');
    await expect(into).toHaveAttribute('aria-disabled', 'false');
  });

  test('a click on a stop goes to that level, and only that stop is current', async ({ page }) => {
    await openPlan(page, full);
    const names = await levels(page);
    for (const name of [...names].reverse()) {
      await zoomTo(page, name);
      for (const other of names) {
        await expect(page.locator('.zoom').getByRole('button', { name: other, exact: true })).toHaveAttribute('aria-current', String(other === name));
      }
    }
  });

  test('a plan with one level has one stop, and both + and − are off', async ({ page }) => {
    await openPlan(page, flat);
    await expect(page.locator('.zoom .stop')).toHaveText(['Every step']);
    await expect(page.locator('.zoom .stop')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('button', { name: 'Zoom out' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Zoom in' })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Zoom in' }).click({ force: true });
    await settle(page);
    expect(await level(page)).toBe('Every step');
  });

  test('the + and − keys zoom in and out one level', async ({ page }) => {
    // with motion, on a stopped clock: each move plays in the time the clock is moved on by
    await openPlan(page, full, { motion: true, clock: true });
    await stopClock(page);
    const press = async (key: string): Promise<void> => {
      await page.keyboard.press(key);
      await play(page, 1000);
    };
    await press('+');
    expect(await level(page)).toBe('Tracks');
    await press('+');
    expect(await level(page)).toBe('Every step');
    await press('-');
    expect(await level(page)).toBe('Tracks');
    // a key pressed while a move is on its way goes one level on from where that move goes, and no further than the end
    for (const [key, to] of [['-', 'Main steps'], ['+', 'Every step']]) {
      await page.keyboard.press(key);
      await page.clock.fastForward(200);
      await expect(page.locator('.roadmap')).toHaveAttribute('data-moving');
      await press(key);
      expect(await level(page)).toBe(to);
    }
  });

  test('+ and − hold the view by the step in progress that is drawn nearest the middle, not by one hidden in a group', async ({ page }) => {
    // 'hid' sits where its group is, and the group opens wider at 'Tracks': a view held by 'hid' would move 'b-3' by as much as the group opens.
    // At a new level the page may tidy the place a little, so nothing is cut in two at an edge; back at 'Main steps', 'b-3' is where it was
    await openPlan(page, busy, { store: null });
    const x = (await markAt(page, 'b-3'))[0];
    for (const key of ['+', '+', '-', '-']) {
      await page.keyboard.press(key);
      await settle(page);
      const at = await level(page);
      expect(Math.abs((await markAt(page, 'b-3'))[0] - x), `after ${key}, at '${at}'`).toBeLessThan(at === 'Main steps' ? 1 : 40);
    }
  });

  test('keys typed into a text field of the page belong to that field: no zoom, and the arrows move the caret', async ({ page }) => {
    await openPlan(page, full, { store: null });
    // a text field of a project that embeds the view
    await page.evaluate(() => {
      const i = document.createElement('input');
      i.id = 'field';
      i.style.cssText = 'position: fixed; top: 4px; left: 600px; z-index: 9';
      document.body.append(i);
    });
    await page.locator('#field').click();
    await page.keyboard.type('hi+');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('X-i');
    await settle(page);
    await expect(page.locator('#field')).toHaveValue('hX-ii+');
    expect(await level(page)).toBe('Main steps');
    await expect(page.getByRole('switch', { name: 'Hide node icons', includeHidden: true })).toHaveAttribute('aria-checked', 'false');
  });
});

/** Turns the wheel with Ctrl held, as a pinch does, at a point. One turn of 100 is one notch. The page has heard each turn when wheel() returns. */
async function turnWheel(page: Page, at: [number, number], dy: number, turns: number): Promise<void> {
  await page.mouse.move(at[0], at[1]);
  await page.keyboard.down('Control');
  for (let i = 0; i < turns; i++) await page.mouse.wheel(0, dy);
  await page.keyboard.up('Control');
}
/** Turns the wheel with Ctrl held, and waits for the page to rest at its new scale. */
async function ctrlWheel(page: Page, at: [number, number], dy: number, turns = 1): Promise<void> {
  await turnWheel(page, at, dy, turns);
  await settle(page);
}
/** The step drawn nearest the middle of the stage, and where its middle is on the screen. */
async function stepNearMiddle(page: Page): Promise<{ id: string; at: [number, number] }> {
  return page.evaluate(() => {
    const st = document.querySelector('.stage')!.getBoundingClientRect(), mx = st.left + st.width / 2, my = st.top + (st.height - 112) / 2;
    let best = { id: '', at: [0, 0] as [number, number], d: Infinity };
    for (const g of document.querySelectorAll<SVGGElement>('svg.plan g.zn[data-id]')) {
      if (getComputedStyle(g).display === 'none') continue;
      const r = g.querySelector('.st')!.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, d = Math.hypot(x - mx, y - my);
      if (d < best.d) best = { id: g.dataset.id!, at: [x, y], d };
    }
    return { id: best.id, at: best.at };
  });
}
/** Where the middle of the mark of a step is on the screen. */
const markAt = async (page: Page, id: string): Promise<[number, number]> => middle(await box(step(page, id).locator('.st')));
const near = (a: [number, number], b: [number, number], by = 1): void => {
  expect(Math.abs(a[0] - b[0]), `x: ${a[0]} against ${b[0]}`).toBeLessThan(by);
  expect(Math.abs(a[1] - b[1]), `y: ${a[1]} against ${b[1]}`).toBeLessThan(by);
};
/** His roadmap, as the app draws it. */
const HIS = JSON.parse(readFileSync(new URL('./roadmapper.json', import.meta.url), 'utf8')) as Roadmap;
/** What the app keeps when he shows every top-level branch of his roadmap, the finished ones too, which start hidden. */
const ALL_SHOWN = { level: 0, branches: Object.fromEntries(HIS.branches.map(b => [b.name, true])) };
/** The name of the outermost group a step is in, which 'Main steps' draws as one step; undefined for a step in no group. A branching is not a group. */
function podOf(plan: Roadmap, id: string): string | undefined {
  const find = (items: Item[], pod?: string): { pod?: string } | null => {
    for (const it of items) {
      if (!('split' in it)) {
        if (it.id === id) return { pod };
        continue;
      }
      for (const b of it.split) {
        const f = find(b.items, pod ?? (it.branching ? undefined : it.name));
        if (f) return f;
      }
    }
    return null;
  };
  return find(plan.branches.flatMap(b => b.items))?.pod;
}
/** The step a plan opens on, by the rule of the view: the first in progress; or else the first to do that can start, first on its branch or after an item that is done or canceled; or else the first not done or canceled; or else the last. */
function opensOn(plan: Roadmap): RoadNode {
  const state = (n: RoadNode): string => n.state ?? 'todo', over = (n: RoadNode): boolean => state(n) === 'done' || state(n) === 'canceled';
  const ready = new Set<RoadNode>();
  const walk = (items: Item[]): void => items.forEach((it, i) => {
    if ('split' in it) return it.split.forEach(b => walk(b.items));
    const before = items[i - 1];
    // a group or a branching counts as over when all its steps are
    if (!before || ('split' in before ? nodesOf({ title: '', branches: before.split }).every(over) : over(before))) ready.add(it);
  });
  plan.branches.forEach(b => walk(b.items));
  const all = nodesOf(plan);
  return all.find(n => state(n) === 'in-progress') ?? all.find(n => state(n) === 'todo' && ready.has(n)) ?? all.find(n => !over(n)) ?? all[all.length - 1];
}
/** The name of the branch of a branching that a step is on, also inside a group on it. */
function branchOf(plan: Roadmap, id: string): string | undefined {
  const find = (items: Item[], on?: string): { on?: string } | null => {
    for (const it of items) {
      if (!('split' in it)) {
        if (it.id === id) return { on };
        continue;
      }
      for (const b of it.split) {
        const f = find(b.items, it.branching ? b.name : on);
        if (f) return f;
      }
    }
    return null;
  };
  return find(plan.branches.flatMap(b => b.items))?.on;
}
/** A plan of one branch with many steps: too long to fit the window even at a quarter of reading size. */
const long: Roadmap = { title: 'Long plan', branches: [{ name: 'Row', items: Array.from({ length: 90 }, (_, i) => ({ id: `s-${i}`, name: `Step ${i}` })) }] };

test.describe('reading size', () => {
  for (const [w, h] of [[1024, 700], [1920, 1080]]) {
    test(`on his page every level draws a name at the same size on the screen, ${READ_PX} px, in a window of ${w} by ${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openApp(page);
      for (const view of ['icons', 'marks']) {
        if (view === 'marks') {
          await page.keyboard.press('i');
          await settle(page);
        }
        for (const name of await levels(page)) {
          await zoomTo(page, name);
          expect(await nameSize(page), `${view}, '${name}'`).toBeCloseTo(READ_PX, 2);
        }
      }
    });
  }

  test("the first open, with nothing kept, is 'Main steps' at reading size, on the first step in progress or else the first that can start, or on the group step that holds it, with the name of the branch it is on whole", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 700 });
    /** Opens a plan with nothing kept, and gives the stage. */
    const opened = async (): Promise<Box> => {
      expect(await level(page)).toBe('Main steps');
      expect(await nameSize(page)).toBeCloseTo(READ_PX, 2);
      const plan = await box(page.locator('svg.plan')), stage = await box(page.locator('.stage'));
      expect(plan.width, 'the plan is wider than the window').toBeGreaterThan(stage.width);
      return stage;
    };

    await test.step('on his page', async () => {
      await openApp(page);
      const stage = await opened();
      const now = opensOn(HIS), pod = podOf(HIS, now.id);
      const at = (await drawnSteps(page, [now.id])).length ? step(page, now.id) : group(page, pod!);
      expect(inside(await box(at), stage), `'${now.name}', or the group '${pod}' that holds it, is on the screen`).toBe(true);
      const on = branchOf(HIS, now.id);
      if (on) {
        const cap = await box(page.locator('svg.plan text.cap').filter({ hasText: new RegExp(`^${on}$`) }));
        expect(cap.x, `the name '${on}' is whole`).toBeGreaterThanOrEqual(stage.x);
      }
    });

    await test.step("on his roadmap with the first step of 'Layout' in progress, 'Layout design': the name 'Layout' is whole", async () => {
      await openPlan(page, edit(HIS, p => {
        for (const n of nodesOf(p)) if (n.state === 'in-progress') n.state = 'todo';
        nodeOf(p, 'layout').state = 'in-progress';
      }), { store: null });
      const stage = await opened();
      expect(inside(await box(step(page, 'layout').locator('.st')), stage), "'Layout design' is on the screen").toBe(true);
      const cap = await box(page.locator('svg.plan text.cap').filter({ hasText: /^Layout$/ }));
      expect(cap.x, "the name 'Layout' is whole").toBeGreaterThanOrEqual(stage.x);
    });
  });

  test('a level is as big in a small window as in a big one: no level is sized to fit the window', async ({ page }) => {
    const widths: Record<string, string | null> = {};
    for (const [w, h] of [[1024, 700], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h });
      await openPlan(page, full, { store: null });
      for (const name of await levels(page)) {
        await zoomTo(page, name);
        const width = await page.locator('svg.plan').getAttribute('width');
        if (name in widths) expect(width, name).toBe(widths[name]);
        else widths[name] = width;
      }
    }
  });
});

test.describe('the scale: a pinch, or Ctrl and the wheel', () => {
  test('scales the page around the pointer: the point under it stays, and the level stays', async ({ page }) => {
    await openApp(page);
    await zoomTo(page, 'Every step');
    // his plan is bigger than the window both ways: in its middle, no end of it stops the point
    await page.locator('.stage').evaluate(s => s.scrollTo((s.scrollWidth - s.clientWidth) / 2, (s.scrollHeight - s.clientHeight) / 2));
    await settle(page);
    const { id, at } = await stepNearMiddle(page);
    // in, one notch: about a fourth more
    await ctrlWheel(page, at, -100);
    expect(await nameSize(page)).toBeCloseTo(READ_PX * Math.exp(0.25), 2);
    near(await markAt(page, id), at);
    expect(await level(page)).toBe('Every step');
    // and out again, back to reading size
    await ctrlWheel(page, at, 100);
    expect(await nameSize(page)).toBeCloseTo(READ_PX, 2);
    near(await markAt(page, id), at);
    expect(await level(page)).toBe('Every step');
  });

  test('a pinch of many small turns scales smoothly, with motion, and the point under the fingers stays', async ({ page }) => {
    // with motion, on a stopped clock: the scale moves on as the clock does
    await openApp(page, { motion: true, clock: true, kept: ALL_SHOWN });
    await stopClock(page);
    expect(await level(page)).toBe('Main steps');
    const { id, at } = await stepNearMiddle(page);
    await turnWheel(page, at, -4, 8);
    // two frames on, it is part of the way there
    await page.clock.runFor(32);
    const part = await nameSize(page);
    expect(part).toBeGreaterThan(READ_PX * 1.05);
    expect(part).toBeLessThan(READ_PX * Math.exp(0.32) * 0.97);
    await play(page, 1000);
    expect(await nameSize(page)).toBeCloseTo(READ_PX * Math.exp(0.32), 2);
    near(await markAt(page, id), at);
    expect(await level(page)).toBe('Main steps');
  });

  // A notch scales by a fourth more or less, so 5 notches go from reading size to 3 times it. Each check turns about twice as far as it needs to.
  test("takes the place of the browser's own zoom over the plan, never changes the level, however far it turns, and scales in up to 3 times reading size and out to where the whole level fits", async ({ page }) => {
    await openPlan(page, full, { store: null });
    const at = middle(await box(page.locator('.stage')));
    await test.step("takes the place of the browser's own zoom over the plan", async () => {
      // a listener after the view's own: it sees whether the view stopped the browser's zoom
      await page.evaluate(() => window.addEventListener('wheel', e => { (window as unknown as { stopped: boolean }).stopped = e.defaultPrevented; }, { passive: true }));
      await ctrlWheel(page, at, -100);
      expect(await page.evaluate(() => (window as unknown as { stopped: boolean }).stopped)).toBe(true);
      expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
    });

    await test.step('never changes the level, however far it turns', async () => {
      await ctrlWheel(page, at, -100, 8);
      expect(await level(page)).toBe('Main steps');
      await ctrlWheel(page, at, 100, 10);
      expect(await level(page)).toBe('Main steps');
    });

    await test.step('scales in up to 3 times reading size, and out to where the whole level fits', async () => {
      await zoomTo(page, 'Every step');
      await ctrlWheel(page, at, -100, 10);
      expect(await nameSize(page)).toBeCloseTo(READ_PX * 3, 2);
      await ctrlWheel(page, at, 100, 16);
      const plan = await box(page.locator('svg.plan')), stage = await page.locator('.stage').evaluate((s: HTMLElement) => {
        const c = getComputedStyle(s);
        return { w: s.offsetWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight), h: s.offsetHeight - parseFloat(c.paddingTop) - parseFloat(c.paddingBottom) };
      });
      // it fits, and on one side it fills the room
      expect(plan.width).toBeLessThanOrEqual(stage.w + 0.5);
      expect(plan.height).toBeLessThanOrEqual(stage.h + 0.5);
      expect(Math.max(plan.width / stage.w, plan.height / stage.h)).toBeGreaterThan(0.99);
      expect(await level(page)).toBe('Every step');
    });
  });

  test('never scales out under a fourth of reading size, even where the level does not fit there', async ({ page }) => {
    await openPlan(page, long, { store: null });
    // a fourth is 6 notches out
    await ctrlWheel(page, middle(await box(page.locator('.stage'))), 100, 12);
    expect(await nameSize(page)).toBeCloseTo(READ_PX / 4, 2);
    expect((await box(page.locator('svg.plan'))).width).toBeGreaterThan((await box(page.locator('.stage'))).width);
  });

  test('is kept when the level changes, and comes back after a reload', async ({ page }) => {
    await openPlan(page, full, { store: 'scale.keep' });
    await zoomTo(page, 'Tracks');
    const at = middle(await box(page.locator('.stage')));
    await ctrlWheel(page, at, -100);
    const big = READ_PX * Math.exp(0.25);
    expect(await nameSize(page)).toBeCloseTo(big, 2);
    await page.keyboard.press('+');
    await settle(page);
    expect(await level(page)).toBe('Every step');
    expect(await nameSize(page)).toBeCloseTo(big, 2);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await settle(page);
    expect(await nameSize(page)).toBeCloseTo(big, 2);
    expect((await stored(page, 'scale.keep'))?.scale).toBeCloseTo(Math.exp(0.25), 2);
    await reload(page);
    expect(await level(page)).toBe('Tracks');
    expect(await nameSize(page)).toBeCloseTo(big, 2);
  });

  test('what an older page kept, with no scale, opens at reading size', async ({ page }) => {
    await openPlan(page, full, { store: 'scale.old', kept: { level: 1, icons: true, id: 'review', fx: 0.5, fy: 0.5 } });
    expect(await level(page)).toBe('Tracks');
    expect(await nameSize(page)).toBeCloseTo(READ_PX, 2);
  });
});

test.describe('a double click', () => {
  test('goes one level in, and the step double clicked stays put; its first click picks the step; at the last level it does nothing', async ({ page }) => {
    // a window lower than the plan at 'Tracks', so the plan does not stop the step from staying put
    await page.setViewportSize({ width: 1440, height: 600 });
    await openPlan(page, full, { store: null });
    await test.step('goes one level in, and the step double clicked stays put; its first click picks the step', async () => {
      const at = await markAt(page, 'plan');
      await page.mouse.dblclick(at[0], at[1]);
      await settle(page);
      expect(await level(page)).toBe('Tracks');
      near(await markAt(page, 'plan'), at);
      await expect(side(page).locator('h2')).toHaveText('Plan');
      // again, from the new level
      await page.mouse.dblclick(at[0], at[1]);
      await settle(page);
      expect(await level(page)).toBe('Every step');
      near(await markAt(page, 'plan'), at);
    });

    await test.step('at the last level does nothing', async () => {
      await zoomTo(page, 'Every step');
      const width = await page.locator('svg.plan').getAttribute('width'), at = await markAt(page, 'review');
      await page.mouse.dblclick(at[0], at[1]);
      await settle(page);
      expect(await level(page)).toBe('Every step');
      expect(await page.locator('svg.plan').getAttribute('width')).toBe(width);
    });
  });

  test('on a group step goes in around it: the group opens where it was', async ({ page }) => {
    await openPlan(page, plain, { store: null });
    const at = middle(await box(group(page, 'Pair').locator('.st')));
    await page.mouse.dblclick(at[0], at[1]);
    await settle(page);
    expect(await level(page)).toBe('Tracks');
    await expect(side(page).locator('h2')).toHaveText('Pair');
    // the first track of the group, which was in the group step, sits on the lane after the step before it, around where the group step was
    const f = await frame(page, 'Pair');
    expect(f.x).toBeLessThan(at[0]);
    expect(f.x + f.width).toBeGreaterThan(at[0]);
  });

  test('on empty space goes one level in, and closes the side bar as a click does', async ({ page }) => {
    // a window lower than the plan at 'Tracks', so the plan does not stop the step from staying put
    await page.setViewportSize({ width: 1440, height: 600 });
    await openPlan(page, full, { store: null });
    await step(page, 'kickoff').click();
    await expect(side(page)).toBeVisible();
    const k = await markAt(page, 'kickoff');
    // a little under the step, where nothing is drawn
    await page.mouse.dblclick(k[0], k[1] + 40);
    await settle(page);
    await expect(side(page)).toBeHidden();
    expect(await level(page)).toBe('Tracks');
    near(await markAt(page, 'kickoff'), k);
  });
});

// What each level draws, on one page of the plan 'full' from the far level in. Each check is a step of its own.
test("what each level draws: 'Main steps', 'Tracks' and 'Every step', however deep the groups are", async ({ page }) => {
  await openPlan(page, full);

  await test.step("'Main steps': each outermost group is one step with its name, and the steps of its tracks are not drawn", async () => {
    for (const name of ['Two deep', 'In a row', 'Four steps', 'Three deep']) {
      await expect(group(page, name), name).toBeVisible();
      await expect(page.locator(labels('[data-pod]')).getByText(name, { exact: true })).toBeVisible();
    }
    // a group inside a group is not a step of its own
    await expect(group(page, 'Inner')).toHaveCount(0);
    expect(await drawnSteps(page, ['oa-1', 'ia-1', 'ib-1', 'ob-1', 'row-1', 'q-1', 'side-2', 'l2-1', 'l4-2', 'beside-1']), 'steps drawn').toEqual([]);
    await expect(shown(page, 'svg.plan rect.group')).toHaveCount(0);
    await expect(shown(page, 'svg.plan g.tally')).toHaveCount(0);
  });

  await test.step("'Main steps': a branch of a branching keeps its own steps, whether it comes back or ends apart", async () => {
    const ids = ['pa-1', 'pb-1', 'spin-1', 'dead-1'];
    for (const id of ids) await expect(nameOf(page, id), id).toBeVisible();
    for (const name of ['Path A', 'Path B', 'Spin-off', 'Dead end']) await expect(caption(page, name), name).toBeVisible();
    const kept = [...ids, 'kickoff', 'plan', 'review', 'launch', 'later-1', 'long'];
    expect(await drawnSteps(page, kept), 'steps drawn').toEqual(kept);
  });

  await zoomTo(page, 'Tracks');

  await test.step("'Tracks': every group is open, at every depth, as a frame with its name over it; only a track that holds no group is a pill", async () => {
    const outer = await frame(page, 'Two deep'), inner = await frame(page, 'Inner');
    expect(inside(inner, outer)).toBe(true);
    expect(await pillsIn(page, inner)).toEqual(['2/2', '0/1']);
    expect(await pillsIn(page, await frame(page, 'In a row'))).toEqual(['1/3']);
    expect(await pillsIn(page, await frame(page, 'Four steps'))).toEqual(['1/4', '1/1']);
    const deep = await frame(page, 'Three deep'), bottom = await frame(page, 'Bottom');
    expect(inside(bottom, deep)).toBe(true);
    expect(await pillsIn(page, bottom)).toEqual(['0/2']);
    for (const name of ['Two deep', 'Four steps']) await expect(group(page, name), name).toBeHidden();
  });

  await test.step("'Tracks': a closed track is a pill with the mark of its state and done/left, canceled steps not counted", async () => {
    const pills = [
      { track: 'Quad', count: '1/4', state: 'in-progress' },
      { track: 'Side', count: '1/1', state: 'done' },
      { track: 'Inner A', count: '2/2', state: 'done' },
      { track: 'Inner B', count: '0/1', state: 'todo' },
      { track: 'Outer B', count: '0/1', state: 'todo' },
      { track: 'Level 4', count: '0/2', state: 'todo' },
      { track: 'Beside', count: '0/1', state: 'todo' },
    ];
    // each pill of a track, as pill() finds it: is it drawn, its count, the state on its mark; and is the name of the track drawn
    const seen = await page.evaluate(tracks => {
      const drawn = (e: Element | null | undefined): boolean => {
        const r = e?.getBoundingClientRect();
        return !!e && !!r && r.width > 0 && r.height > 0 && e.checkVisibility({ visibilityProperty: true });
      };
      return tracks.map(track => {
        const caps = [...document.querySelectorAll('svg.plan text.cap')].filter(c => c.textContent === track), bars = caps.map(c => c.getAttribute('data-bar'));
        const p = [...document.querySelectorAll('svg.plan g.tally')].filter(g => bars.includes(g.getAttribute('data-bar')));
        return { track, pills: p.length, drawn: p.length === 1 && drawn(p[0]), count: p[0]?.querySelector('text')?.textContent, state: [...(p[0]?.querySelector('svg.mark g.node')?.classList ?? [])], named: caps.length === 1 && drawn(caps[0]) };
      });
    }, pills.map(p => p.track));
    for (const { track, count, state } of pills) {
      expect(seen.find(s => s.track === track), track).toEqual({ track, pills: 1, drawn: true, count, state: expect.arrayContaining([state]), named: true });
    }
  });

  await test.step("'Tracks': the steps of closed tracks are not drawn; the steps outside groups, and those of a track that holds a group, are", async () => {
    expect(await drawnSteps(page, ['ia-1', 'ia-2', 'ib-1', 'ob-1', 'row-2', 'q-1', 'q-4', 'side-1', 'l4-1', 'beside-1']), 'steps drawn').toEqual([]);
    const kept = ['kickoff', 'plan', 'oa-1', 'pa-1', 'pb-1', 'review', 'spin-1', 'dead-1', 'launch', 'later-1', 'l2-1', 'l3-1', 'long'];
    expect(await drawnSteps(page, kept), 'steps drawn').toEqual(kept);
  });

  await zoomTo(page, 'Every step');

  await test.step("'Every step': every step is drawn, and no pill and no group step", async () => {
    const ids = nodesOf(full).map(n => n.id);
    expect(await drawnSteps(page, ids), 'steps drawn').toEqual(ids);
    await expect(shown(page, 'svg.plan g.tally')).toHaveCount(0);
    await expect(shown(page, 'svg.plan g.zn[data-pod]')).toHaveCount(0);
  });

  await test.step("'Every step': each step sits inside the frames of its groups, and outside the others", async () => {
    const groups: Record<string, string[]> = {
      'Two deep': ['oa-1', 'ia-1', 'ia-2', 'ib-1', 'ob-1'],
      Inner: ['ia-1', 'ia-2', 'ib-1'],
      'In a row': ['row-1', 'row-2', 'row-3'],
      'Four steps': ['q-1', 'q-2', 'q-3', 'q-4', 'side-1', 'side-2'],
      'Three deep': ['l2-1', 'l3-1', 'l4-1', 'l4-2', 'beside-1'],
      Bottom: ['l4-1', 'l4-2'],
    };
    const ids = nodesOf(full).map(n => n.id), boxes = await Promise.all(ids.map(id => box(step(page, id))));
    for (const [name, held] of Object.entries(groups)) {
      const f = await frame(page, name);
      expect(ids.filter((_, i) => inside(boxes[i], f)), `the steps in the frame '${name}'`).toEqual(ids.filter(id => held.includes(id)));
    }
  });
});

test.describe('what keeps the level', () => {
  test('the level comes back after a reload, kept under the store key', async ({ page }) => {
    await openPlan(page, full, { store: 'zoom.keep' });
    await zoomTo(page, 'Tracks');
    expect((await stored(page, 'zoom.keep'))?.level).toBe(1);
    await reload(page);
    expect(await level(page)).toBe('Tracks');
    await expect(page.locator('.zoom').getByRole('button', { name: 'Tracks', exact: true })).toHaveAttribute('aria-current', 'true');
  });

  test("'Every step' stays 'Every step' when a save adds a group inside a group, and the new step is drawn", async ({ page }) => {
    await openPlan(page, plain);
    await zoomTo(page, 'Every step');
    await save(page, deeper);
    expect(await levels(page)).toEqual(['Main steps', 'Tracks', 'Every step']);
    expect(await level(page)).toBe('Every step');
    await expect(step(page, 'p-in')).toBeVisible();
  });

  test("a page left at 'Every step' opens there, when the file has a level more by the next visit", async ({ page }) => {
    await openPlan(page, plain, { store: 'zoom.last' });
    await zoomTo(page, 'Every step');
    expect(await stored(page, 'zoom.last')).toMatchObject({ level: 2, last: true });
    await openPlan(page, deeper, { store: 'zoom.last' });
    expect(await level(page)).toBe('Every step');
  });

  test('a page held still by its address stays held through a save', async ({ page }) => {
    await openPlan(page, full, { hash: 'z=1.5', store: null });
    const held = await page.locator('svg.plan').evaluate(e => e.outerHTML);
    await save(page, full);
    expect(await page.locator('svg.plan').evaluate(e => e.outerHTML)).toBe(held);
    // away first, since a new address that differs only after its # does not load the page again
    await page.goto('about:blank');
    await openPlan(page, full, { hash: 'u=0.5', store: null });
    const half = await page.locator('svg.plan').evaluate(e => e.outerHTML);
    await save(page, full);
    expect(await page.locator('svg.plan').evaluate(e => e.outerHTML)).toBe(half);
  });

  test('with no store, a reload starts at the first level', async ({ page }) => {
    await openPlan(page, plain, { store: null });
    await zoomTo(page, 'Every step');
    await reload(page);
    expect(await level(page)).toBe('Main steps');
  });

  test('a click on a step, a group step or a pill never zooms', async ({ page }) => {
    await openPlan(page, plain);
    await group(page, 'Pair').click();
    await settle(page);
    await expect(side(page)).toBeVisible();
    expect(await level(page)).toBe('Main steps');
    await zoomTo(page, 'Tracks');
    await step(page, 'p-1').click();
    await settle(page);
    expect(await level(page)).toBe('Tracks');
    await pill(page, 'Left').click();
    await settle(page);
    expect(await level(page)).toBe('Tracks');
  });

  test('a save keeps the level, and a pill shows its new count', async ({ page }) => {
    await openPlan(page, plain);
    await zoomTo(page, 'Tracks');
    await save(page, edit(plain, p => { nodeOf(p, 'p-3').state = 'done'; }));
    expect(await level(page)).toBe('Tracks');
    await expect(page.locator('.zoom').getByRole('button', { name: 'Tracks', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(pill(page, 'Left').locator('text')).toHaveText('2/2');
    await expect(stateOfPill(pill(page, 'Left'))).toHaveClass(/(^| )done( |$)/);
  });

  test('a changed step in a closed track puts the just-changed ring on its pill', async ({ page }) => {
    await openPlan(page, plain);
    await zoomTo(page, 'Tracks');
    await save(page, edit(plain, p => { nodeOf(p, 'p-3').state = 'in-progress'; }));
    await expect(step(page, 'p-3')).toBeHidden();
    const bar = page.locator(`svg.plan rect.zbar[data-bar="${await pill(page, 'Left').getAttribute('data-bar')}"]`);
    const rings = shown(page, 'svg.plan .halo');
    await expect(rings).toHaveCount(1);
    // the bar of the pill takes the pointer a little past its edge, so its box is bigger than what shows: the ring is checked around what the pill holds, on the middle of the bar
    const ring = await box(rings), at = await box(bar);
    expect(inside(await box(pill(page, 'Left')), ring), 'the ring is around the pill').toBe(true);
    const [rx, ry] = middle(ring), [px, py] = middle(at);
    expect(Math.abs(rx - px)).toBeLessThan(1.5);
    expect(Math.abs(ry - py)).toBeLessThan(1.5);
  });

  test("a changed step in a group puts the just-changed ring on its group step at 'Main steps'", async ({ page }) => {
    await openPlan(page, plain);
    await save(page, edit(plain, p => { nodeOf(p, 'p-4').state = 'done'; }));
    expect(await level(page)).toBe('Main steps');
    await expect(step(page, 'p-4')).toBeHidden();
    const rings = shown(page, 'svg.plan .halo');
    await expect(rings).toHaveCount(1);
    await expect(group(page, 'Pair').locator('.halo')).toBeVisible();
    const [rx, ry] = middle(await box(rings)), [gx, gy] = middle(await box(group(page, 'Pair').locator('.coin, .aura').first()));
    expect(Math.abs(rx - gx)).toBeLessThan(1.5);
    expect(Math.abs(ry - gy)).toBeLessThan(1.5);
  });

  test('a second save soon after goes on with the just-changed look of the first step, which ends 3 s after its own change', async ({ page }) => {
    await openPlan(page, plain, { store: null, clock: true });
    await zoomTo(page, 'Every step');
    // with motion, so the ring plays; on a stopped clock, so the look lasts as long as the clock is moved on
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClock(page);
    const once = edit(plain, p => { nodeOf(p, 'p-3').state = 'in-progress'; });
    await save(page, once);
    await play(page, 1000);
    await save(page, edit(once, p => { nodeOf(p, 'p-5').state = 'done'; }));
    // the ring of the first step goes on from where it was: it does not start again
    const ringAt = await step(page, 'p-3').locator('.halo').evaluate(e => {
      const a = e.getAnimations()[0];
      // how long it has run: since it was drawn again, plus the time before that, which its delay gives back
      return a ? Number(a.currentTime) - Number(a.effect?.getTiming().delay ?? 0) : 0;
    });
    expect(ringAt, 'the ring of the first step has run for about 1 s').toBeGreaterThan(600);
    const fresh = (id: string): Promise<boolean> => step(page, id).evaluate(e => e.classList.contains('fresh'));
    await play(page, 1999);
    expect(await fresh('p-3'), 'the first step keeps its look until 3 s after its change').toBe(true);
    await play(page, 1);
    expect(await fresh('p-3'), 'and loses it then').toBe(false);
    expect(await fresh('p-5'), 'the second step still has its look').toBe(true);
    await expect(step(page, 'p-3').locator('.halo')).toHaveCount(0);
    await play(page, 1000);
    expect(await fresh('p-5'), 'the second step loses its look 3 s after its own change').toBe(false);
    await expect(page.locator('svg.plan .halo, svg.plan .fresh')).toHaveCount(0);
  });
});

// His stops are checked where his page is first drawn, in smoke.spec.ts.
test("on his page the group 'Zoom build' is one step at 'Main steps', and at 'Tracks' a frame around the tracks 'Code' and 'Tests'", async ({ page }) => {
  // its version is finished, so it starts hidden
  await openApp(page, { kept: ALL_SHOWN });

  await test.step("at 'Main steps' the group 'Zoom build' is one step, and its steps are not drawn", async () => {
    // its steps: the ones inside its frame at 'Every step'
    await zoomTo(page, 'Every step');
    const f = await frame(page, 'Zoom build');
    const ids = (await drawnIn(page, 'svg.plan g.zn[data-id]')).filter(s => inside(s, f)).map(s => s.id!);
    expect(ids.length).toBeGreaterThan(0);
    await zoomTo(page, 'Main steps');
    await expect(group(page, 'Zoom build')).toBeVisible();
    expect(await frameOf(page, 'Zoom build')).toBeNull();
    expect(await drawnSteps(page, ids), 'steps drawn').toEqual([]);
  });

  await test.step("at 'Tracks' 'Zoom build' is a frame around the tracks 'Code' and 'Tests'", async () => {
    await zoomTo(page, 'Tracks');
    const f = await frame(page, 'Zoom build');
    await expect(group(page, 'Zoom build')).toBeHidden();
    const caps = await drawnIn(page, 'svg.plan text.cap'), tallies = await drawnIn(page, 'svg.plan g.tally');
    for (const track of ['Code', 'Tests']) {
      // the pills of the tracks of that name, as pill() finds them, that are drawn in the frame
      const bars = new Set((await page.locator('svg.plan text.cap').evaluateAll((cs, t) => cs.filter(c => c.textContent === t).map(c => c.getAttribute('data-bar')), track)));
      const held = tallies.filter(p => bars.has(p.bar) && inside(p, f));
      expect(held, `one pill '${track}' in the frame`).toHaveLength(1);
      expect(held[0].text).toMatch(/^\d+\/\d+$/);
      expect(caps.filter(c => c.text === track && inside(c, f)), `the name '${track}' in the frame`).toHaveLength(1);
    }
  });
});
