// What layouts() puts where, at each level, in both views and both layouts, with the labels shown and hidden: worked out in Node, in the stand-in fonts.
// No line crosses another or runs through a name, no name touches another, and each level draws what it should.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { parseRoadmap } from '../../src/roadmap/check';
import type { Roadmap } from '../../src/roadmap/types';
import { layouts, type Layout } from '../../src/view/layout';
import { CAP_W, GNAME_W, sum, type Plan } from '../../src/view/plan';
import { drawnOf, everyLayout, faults, levelsOf, line, planOf, rooms, type Box, type Drawn } from '../support/layout';
import { flat, full, long, nested, plain, plans, shownAtFirst, wordy } from '../support/plans';

const roadmap = JSON.parse(readFileSync(new URL('../fixtures/roadmap.json', import.meta.url), 'utf8')) as Roadmap;

// the checks warm up once: the tests run in order, in one worker
test.describe.configure({ mode: 'default' });

const inside = (a: Box, f: Box): boolean => a.x0 >= f.x0 - 0.5 && a.y0 >= f.y0 - 0.5 && a.x1 <= f.x1 + 0.5 && a.y1 <= f.y1 + 0.5;
const width = (b: Box): number => b.x1 - b.x0;

test('the check finds a name on a step, and stray lines', async () => {
  // as the page first draws 'full', down: at 'Main steps', with the icons shown
  const plan = planOf(full), L = layouts(plan).v[1][0], d = (): Drawn => drawnOf(plan, L);
  expect(faults(d())).toEqual([]);

  await test.step('a name moved onto another step is on it', () => {
    const moved = d(), name = moved.texts.find(t => t.who === 'label:kickoff')!, coin = moved.things.find(t => t.id === 'plan')!, y = (coin.y0 + coin.y1) / 2;
    Object.assign(name, { x0: coin.x0, x1: coin.x0 + width(name), y0: y - 10, y1: y + 3.2 });
    expect(faults(moved)).toContainEqual(expect.stringContaining("label 'Kickoff' on the step plan"));
  });

  await test.step('a line drawn across the plan crosses others', () => {
    const drawn = d(), y = L.H * 0.55;
    drawn.lines.push(line('a line across', [['M', 0, y], ['L', L.W, y - L.W * Math.tan(Math.PI / 9)]]));
    expect(faults(drawn).filter(f => f.includes('crosses')).length).toBeGreaterThan(0);
  });

  await test.step('a line through a step off its middle runs through it', () => {
    // a short line across the coin of 'Launch', a third of its radius under its middle
    const drawn = d(), { x, y: my, r } = drawn.bodies.find(b => b.k === 'the step launch')!, y = my + r / 3;
    drawn.lines.push(line('a line', [['M', x - 2 * r, y], ['L', x + 2 * r, y]]));
    expect(faults(drawn)).toContainEqual(expect.stringContaining('through the step launch'));
  });
});

for (const [name, r] of Object.entries({ ...plans, 'roadmap.json': roadmap })) {
  test(`'${name}' clashes nowhere, at any level, view or layout`, async () => {
    const plan = planOf(r), versions = shownAtFirst(r).sort();
    // a long name of a version is one line, cut with "…": it stands for the name it starts
    const whole = (w: string): string => versions.find(v => v === w || (w.endsWith('…') && v.startsWith(w.slice(0, -1)))) ?? w;
    const out: string[] = [], words: string[] = [];
    for (const { where, L, bare } of everyLayout(plan)) {
      const d = drawnOf(plan, L);
      out.push(...faults(d).map(f => `${where}: ${f}`));
      if (bare && d.words.map(whole).sort().join('\n') !== versions.join('\n')) words.push(`${where}: ${d.words.join(', ')}`);
    }
    await test.step('no line crosses another or runs through a name or a step', () => expect(out).toEqual([]));
    await test.step("with 'Hide labels', only the names of shown versions show", () => expect(words).toEqual([]));
  });
}

test('the levels of a plan are what its groups give', () => {
  const three = ['Main steps', 'Tracks', 'Every step'];
  for (const [r, stops] of [[plain, three], [nested, three], [full, three], [flat, ['Every step']]] as const) {
    expect(() => parseRoadmap(structuredClone(r)), r.title).not.toThrow();
    expect(levelsOf(planOf(r)), r.title).toEqual(stops);
  }
});

/** What a level draws: which of these steps, a group as one step and the frame of a group by its name, the counts of the pills inside a box, and the name of a branch. */
function looks(plan: Plan, L: Layout) {
  const d = drawnOf(plan, L, false);
  return {
    d,
    steps: (ids: string[]): string[] => ids.filter(id => L.geo.get(id)!.o > 0.5),
    pod: (name: string): boolean => plan.pods.some(sp => sp.name === name && L.pods.get(sp.key)!.o > 0.5),
    frame: (name: string): Box | undefined => d.frames.find(f => f.name === name),
    pills: (b: Box): string[] => d.things.filter(t => t.text !== undefined && inside(t, b)).map(t => t.text!),
    cap: (key: string): Box | undefined => d.texts.find(t => t.who === `cap:${key}`),
    box: (id: string): Box => d.things.find(t => t.id === id)!,
  };
}

test("each level draws its own: 'Main steps', 'Tracks' and 'Every step'", async () => {
  const plan = planOf(full), branch = (name: string) => [...plan.byKey.values()].find(b => b.name === name)!;
  for (const flow of ['h', 'v'] as const) for (const [view, levels] of layouts(plan)[flow].entries()) {
    const where = `${flow === 'h' ? 'Horizontal' : 'Vertical'}, ${view ? 'icons' : 'marks'}`, [far, mid, close] = levels.map(L => looks(plan, L));
    await test.step(where, async () => {
      await test.step('far out, each outermost group is one step with its name', () => {
        for (const name of ['Two deep', 'In a row', 'Four steps', 'Three deep']) {
          const p = levels[0].pods.get(plan.pods.find(sp => sp.name === name)!.key)!;
          expect([p.o, p.m], name).toEqual([1, 1]);
        }
        // a group inside a group is not a step of its own
        expect(plan.pods.map(sp => sp.name)).not.toContain('Inner');
        expect(far.steps(['oa-1', 'ia-1', 'ib-1', 'ob-1', 'row-1', 'q-1', 'side-2', 'l2-1', 'l4-2', 'beside-1'])).toEqual([]);
        expect(far.d.frames).toEqual([]);
        expect(far.d.things.filter(t => t.text !== undefined)).toEqual([]);
      });

      await test.step('far out, a branch of a branching keeps its own steps', () => {
        const ids = ['pa-1', 'pb-1', 'spin-1', 'dead-1'];
        for (const id of ids) expect(far.d.texts.some(t => t.who === `label:${id}`), id).toBe(true);
        for (const name of ['Path A', 'Path B', 'Spin-off', 'Dead end']) expect(far.cap(branch(name).key), name).toBeDefined();
        const kept = [...ids, 'kickoff', 'plan', 'review', 'launch', 'later-1', 'long'];
        expect(far.steps(kept)).toEqual(kept);
      });

      await test.step("at 'Tracks' groups are frames and closed tracks are pills", () => {
        const inner = mid.frame('Inner')!, bottom = mid.frame('Bottom')!;
        expect(inside(inner, mid.frame('Two deep')!)).toBe(true);
        expect(mid.pills(inner)).toEqual(['2/2', '0/1']);
        expect(mid.pills(mid.frame('In a row')!)).toEqual(['1/3']);
        expect(mid.pills(mid.frame('Four steps')!)).toEqual(['1/4', '1/1']);
        expect(inside(bottom, mid.frame('Three deep')!)).toBe(true);
        expect(mid.pills(bottom)).toEqual(['0/2']);
        for (const name of ['Two deep', 'Four steps']) expect(mid.pod(name), name).toBe(false);
      });

      await test.step('a pill shows the state of its track and done/left', () => {
        // a canceled step is not counted
        const pills = { Quad: ['1/4', 'in-progress'], Side: ['1/1', 'done'], 'Inner A': ['2/2', 'done'], 'Inner B': ['0/1', 'todo'], 'Outer B': ['0/1', 'todo'], 'Level 4': ['0/2', 'todo'], Beside: ['0/1', 'todo'] };
        for (const [track, [count, state]] of Object.entries(pills)) {
          const b = branch(track), held = mid.d.things.filter(t => t.id === b.key && t.text !== undefined);
          expect([held.map(t => t.text), sum(b), !!mid.cap(b.key)], track).toEqual([[count], state, true]);
        }
      });

      await test.step("at 'Tracks' only steps of open tracks and branches show", () => {
        expect(mid.steps(['ia-1', 'ia-2', 'ib-1', 'ob-1', 'row-2', 'q-1', 'q-4', 'side-1', 'l4-1', 'beside-1'])).toEqual([]);
        const kept = ['kickoff', 'plan', 'oa-1', 'pa-1', 'pb-1', 'review', 'spin-1', 'dead-1', 'launch', 'later-1', 'l2-1', 'l3-1', 'long'];
        expect(mid.steps(kept)).toEqual(kept);
      });

      await test.step("at 'Every step' every step shows, and no pill or group step", () => {
        const ids = plan.all.map(n => n.node.id);
        expect(close.steps(ids)).toEqual(ids);
        expect(close.d.things.filter(t => t.text !== undefined)).toEqual([]);
        expect(plan.pods.filter(sp => close.pod(sp.name)).map(sp => sp.name)).toEqual([]);
      });

      await test.step("at 'Every step' each step sits inside the frames of its groups", () => {
        const groups: Record<string, string[]> = {
          'Two deep': ['oa-1', 'ia-1', 'ia-2', 'ib-1', 'ob-1'],
          Inner: ['ia-1', 'ia-2', 'ib-1'],
          'In a row': ['row-1', 'row-2', 'row-3'],
          'Four steps': ['q-1', 'q-2', 'q-3', 'q-4', 'side-1', 'side-2'],
          'Three deep': ['l2-1', 'l3-1', 'l4-1', 'l4-2', 'beside-1'],
          Bottom: ['l4-1', 'l4-2'],
        };
        const ids = plan.all.map(n => n.node.id);
        for (const [name, held] of Object.entries(groups)) expect(ids.filter(id => inside(close.box(id), close.frame(name)!)), name).toEqual(held);
      });
    });
  }
});

test("on roadmap.json the group 'Zoom build' opens into its tracks at 'Tracks'", async () => {
  // its version is finished, so it is hidden at first: here every version shows
  const plan = planOf(roadmap, () => true), sp = plan.pods.find(p => p.name === 'Zoom build')!;
  for (const flow of ['h', 'v'] as const) for (const [view, levels] of layouts(plan)[flow].entries()) {
    const where = `${flow === 'h' ? 'Horizontal' : 'Vertical'}, ${view ? 'icons' : 'marks'}`, [far, mid] = levels.map(L => looks(plan, L));
    await test.step(where, async () => {
      await test.step("far out 'Zoom build' is one step, with its steps hidden", () => {
        expect(far.pod('Zoom build')).toBe(true);
        expect(far.frame('Zoom build')).toBeUndefined();
        expect(far.steps(sp.nodes.map(n => n.node.id))).toEqual([]);
      });

      await test.step("at 'Tracks' its frame holds the pills 'Code' and 'Tests'", () => {
        const f = mid.frame('Zoom build')!;
        expect(mid.pod('Zoom build')).toBe(false);
        expect(sp.kids.map(b => b.name)).toEqual(['Code', 'Tests']);
        for (const b of sp.kids) {
          expect(mid.d.things.filter(t => t.id === b.key && t.text !== undefined && inside(t, f)).map(t => t.text), b.name).toEqual([expect.stringMatching(/^\d+\/\d+$/)]);
          expect(inside(mid.cap(b.key)!, f), b.name).toBe(true);
        }
      });
    });
  }
});

test('across, names sit 3 times nearer their steps than the lanes above', () => {
  const out: string[] = [];
  for (const [name, r] of Object.entries({ full, wordy, 'roadmap.json': roadmap })) {
    const plan = planOf(r);
    for (const [view, levels] of layouts(plan).h.entries()) levels.forEach((L, k) => {
      const where = `${name}, ${view ? 'icons' : 'marks'}, '${levelsOf(plan)[k]}'`, rs = rooms(plan, L);
      if (!rs.length) out.push(`${where}: no name`);
      for (const x of rs) if (x.over < 3 * x.under) out.push(`${where}: ${x.k} has ${x.over.toFixed(1)} over it and ${x.under.toFixed(1)} under it`);
    });
  }
  expect(out).toEqual([]);
});

test('a long name of a group makes its frame no wider', () => {
  // across, at 'Every step': 'Remember the view build', 'Long text build …' and 'Tools button build' each hold one step on each of two tracks
  const plan = planOf(long);
  for (const [view, levels] of layouts(plan).h.entries()) {
    const widths = drawnOf(plan, levels[plan.K], false).frames.map(f => Math.round(width(f)));
    expect(widths, view ? 'icons' : 'marks').toHaveLength(3);
    expect(new Set(widths).size, `${view ? 'icons' : 'marks'}: the frames ${widths.join(', ')}`).toBe(1);
  }
});

test('a long branch or group name is one line, cut with "…"', () => {
  const plan = planOf(long), branches = [...plan.byKey.values()].flatMap(b => b.name ?? []), group = 'Long text build for the tree, the side bar, the tip and the picker';
  /** Is a text cut short from one of these: it ends with "…", with no space or mark such as "," right before it, and the full text starts with what is left of it? */
  const cutFrom = (drawn: string, wholes: string[]): boolean => /[^\s,;:.\-–—]…$/u.test(drawn) && wholes.some(w => w.toLowerCase().startsWith(drawn.slice(0, -1).toLowerCase()));
  const out: string[] = [];
  let caps = 0, gnames = 0;
  for (const { where, L, bare } of everyLayout(plan)) {
    if (bare) continue;
    const lines = new Map<string, number>();
    for (const t of drawnOf(plan, L, false).texts) {
      const w = width(t), cut = t.text.endsWith('…');
      if (t.k.startsWith('cap ')) {
        if (w > CAP_W) out.push(`${where}: ${t.k} is ${w.toFixed(1)} wide`);
        if (cut && (caps++, !cutFrom(t.text, branches))) out.push(`${where}: ${t.k} is not cut from a name`);
      } else if (t.k.startsWith('gname ')) {
        if (w > GNAME_W) out.push(`${where}: ${t.k} is ${w.toFixed(1)} wide`);
        if (cut && (gnames++, !cutFrom(t.text, [group]))) out.push(`${where}: ${t.k} is not cut from a name`);
      } else if (t.k.startsWith('label ')) lines.set(t.who, (lines.get(t.who) ?? 0) + 1);
    }
    for (const [who, n] of lines) if (n > 3) out.push(`${where}: ${who} has ${n} lines`);
  }
  expect(out).toEqual([]);
  expect(caps, 'names of branches cut').toBeGreaterThan(0);
  expect(gnames, 'names of groups cut').toBeGreaterThan(0);
});
