// The first view: 'Main steps' at reading size, on the first step in progress, or else the first that can start, or on the group step that holds it,
// with the name of its branch whole, and the count of its version whole where the end of that version fits.
import { readFileSync } from 'node:fs';
import type { Locator } from '@playwright/test';
import type { Item, RoadNode, Roadmap } from '../../src/roadmap/types';
import { drawnSteps, expect, flowOf, group, level, nameSize, openPlan, READ_PX, settle, step, test } from '../support/helpers';
import { edit, nodeOf, nodesOf } from '../support/plans';

/** The roadmap of the app page. */
const ROADMAP = JSON.parse(readFileSync(new URL('../fixtures/roadmap.json', import.meta.url), 'utf8')) as Roadmap;

interface Box { x: number; y: number; width: number; height: number }
const inside = (a: Box, b: Box): boolean =>
  a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y + a.height <= b.y + b.height + 0.5;
const box = async (l: Locator): Promise<Box> => {
  const b = await l.boundingBox();
  if (!b) throw new Error(`${l} is not drawn`);
  return b;
};

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

/** The roadmap with every step of its last version to do, as early in that version: no step in progress. */
const early = edit(ROADMAP, p => { for (const n of nodesOf({ ...p, branches: p.branches.slice(-1) })) n.state = 'todo'; });

test('the first view shows the step to work on, with whole names', async ({ page }) => {
  await test.step('at 1440x900, the count of the version it opens in is whole', async () => {
    await openPlan(page, ROADMAP, { store: null });
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

  await page.setViewportSize({ width: 1024, height: 700 });
  /** The first open, with nothing kept: 'Main steps' at reading size, on a plan wider than the window. Gives the stage. */
  const opened = async (plan?: Roadmap): Promise<Box> => {
    if (plan) await openPlan(page, plan, { store: null });
    expect(await level(page)).toBe('Main steps');
    expect(await nameSize(page)).toBeCloseTo(READ_PX, 2);
    const drawn = await box(page.locator('svg.plan')), stage = await box(page.locator('.stage'));
    expect(drawn.width, 'the plan is wider than the window').toBeGreaterThan(stage.width);
    return stage;
  };

  await test.step('at 1024x700, the step it opens on, or its group step, shows', async () => {
    // a new size puts a first view that the user has not moved again, as a new visit at that size does
    await settle(page);
    const stage = await opened();
    const now = opensOn(ROADMAP), pod = podOf(ROADMAP, now.id);
    const at = (await drawnSteps(page, [now.id])).length ? step(page, now.id) : group(page, pod!);
    expect(inside(await box(at), stage), `'${now.name}', or the group '${pod}' that holds it, is on the screen`).toBe(true);
    const on = branchOf(ROADMAP, now.id);
    if (on) {
      const cap = await box(page.locator('svg.plan text.cap').filter({ hasText: new RegExp(`^${on}$`) }));
      expect(cap.x, `the name '${on}' is whole`).toBeGreaterThanOrEqual(stage.x);
    }
  });

  await test.step("at 1024x700, with 'Layout design' in progress, the name 'Layout' is whole", async () => {
    const stage = await opened(edit(ROADMAP, p => {
      for (const n of nodesOf(p)) if (n.state === 'in-progress') n.state = 'todo';
      nodeOf(p, 'layout').state = 'in-progress';
    }));
    expect(inside(await box(step(page, 'layout').locator('.st')), stage), "'Layout design' is on the screen").toBe(true);
    const cap = await box(page.locator('svg.plan text.cap').filter({ hasText: /^Layout$/ }));
    expect(cap.x, "the name 'Layout' is whole").toBeGreaterThanOrEqual(stage.x);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await test.step('across at 1440x900, the name of the top-level branch is whole', async () => {
    await openPlan(page, early, { store: null });
    expect(await flowOf(page)).toBe('h');
    const name = early.branches.at(-1)!.name!;
    const [cap, stage] = await page.evaluate(n => {
      const st = document.querySelector('.roadmap .stage')!, s = st.getBoundingClientRect();
      const c = [...document.querySelectorAll('svg.plan text.cap')].find(t => t.textContent === n)!.getBoundingClientRect();
      return [[c.left, c.top, c.right, c.bottom], [s.left, s.top, s.left + st.clientWidth, s.top + st.clientHeight]];
    }, name);
    expect(cap[0], 'its left edge').toBeGreaterThanOrEqual(stage[0] - 0.5);
    expect(cap[1], 'its top edge').toBeGreaterThanOrEqual(stage[1] - 0.5);
    expect(cap[2], 'its right edge').toBeLessThanOrEqual(stage[2] + 0.5);
    expect(cap[3], 'its bottom edge').toBeLessThanOrEqual(stage[3] + 0.5);
  });
});
