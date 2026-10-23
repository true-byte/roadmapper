// The plans the tests draw. Each passes parseRoadmap().
import type { Branch, Item, RoadNode, Roadmap, Split } from '../src/roadmap/types.ts';

/** Every piece the view draws: groups two and three deep, a group of steps in a row, a branching that comes back together and one that ends apart,
 * known, alias and unknown icons, milestones, every state (blocked by waitsFor), why and doneWhen, days, waitsFor, private items, and the track 'Quad' with 1 of 4 done. */
export const full: Roadmap = {
  title: 'Test plan',
  about: 'A plan with every piece the view draws.',
  branches: [
    {
      name: 'Main',
      holds: 'The first top-level branch.',
      items: [
        {
          id: 'kickoff', name: 'Kickoff', state: 'done', icon: 'rocket', milestone: true,
          why: 'Every later step needs a start.', doneWhen: 'The team has met once.',
          start: '2026-01-05', end: '2026-01-09', deadline: '2026-01-10',
        },
        { id: 'plan', name: 'Plan', state: 'done', icon: 'map', why: 'Know the way first.' },
        {
          name: 'Two deep',
          split: [
            {
              name: 'Outer A',
              holds: 'A track with a group in it.',
              items: [
                { id: 'oa-1', name: 'Outer A one', state: 'in-progress', icon: 'tools' },
                {
                  name: 'Inner',
                  split: [
                    { name: 'Inner A', items: [{ id: 'ia-1', name: 'Inner A one', state: 'done' }, { id: 'ia-2', name: 'Inner A two', state: 'done' }] },
                    { name: 'Inner B', items: [{ id: 'ib-1', name: 'Inner B one', state: 'todo' }] },
                  ],
                },
              ],
            },
            { name: 'Outer B', items: [{ id: 'ob-1', name: 'Outer B one', state: 'todo', icon: 'no-such-icon' }] },
          ],
        },
        {
          name: 'In a row',
          split: [{ items: [{ id: 'row-1', name: 'Row one', state: 'done' }, { id: 'row-2', name: 'Row two', state: 'in-progress' }, { id: 'row-3', name: 'Row three' }] }],
        },
        {
          name: 'Four steps',
          split: [
            {
              name: 'Quad',
              holds: 'Four steps, one done.',
              items: [
                { id: 'q-1', name: 'Quad one', state: 'done' },
                { id: 'q-2', name: 'Quad two', state: 'todo' },
                { id: 'q-3', name: 'Quad three', state: 'todo' },
                { id: 'q-4', name: 'Quad four', state: 'todo', why: 'The last of the four.' },
              ],
            },
            { name: 'Side', items: [{ id: 'side-1', name: 'Side one', state: 'done' }, { id: 'side-2', name: 'Side two', state: 'canceled' }] },
          ],
        },
        {
          branching: true,
          split: [
            { name: 'Path A', items: [{ id: 'pa-1', name: 'Path A one', state: 'todo', icon: '24-hours' }] },
            { name: 'Path B', items: [{ id: 'pb-1', name: 'Path B one', state: 'todo' }] },
          ],
        },
        { id: 'review', name: 'Review', why: 'Both paths and the quad must be done.', waitsFor: ['q-4', 'pb-1'] },
        {
          split: [
            { name: 'Spin-off', ends: true, items: [{ id: 'spin-1', name: 'Spin-off one', state: 'tbd' }] },
            { name: 'Dead end', ends: true, items: [{ id: 'dead-1', name: 'Dead end one', state: 'canceled' }] },
          ],
        },
        { id: 'launch', name: 'Launch', state: 'todo', icon: 'flag', milestone: true, deadline: '2026-12-01', waitsFor: ['review'] },
      ],
    },
    {
      name: 'Later',
      holds: 'The second top-level branch.',
      private: true,
      items: [
        { id: 'later-1', name: 'Later one', state: 'tbd', icon: 'calendar' },
        {
          name: 'Three deep',
          split: [
            {
              name: 'Level 2',
              items: [
                { id: 'l2-1', name: 'Level 2 one' },
                {
                  split: [
                    {
                      name: 'Level 3',
                      items: [
                        { id: 'l3-1', name: 'Level 3 one' },
                        { name: 'Bottom', split: [{ name: 'Level 4', items: [{ id: 'l4-1', name: 'Deepest' }, { id: 'l4-2', name: 'Deepest two' }] }] },
                      ],
                    },
                    { name: 'Beside', items: [{ id: 'beside-1', name: 'Beside one' }] },
                  ],
                },
              ],
            },
          ],
        },
        { id: 'long', name: 'A very long step name', state: 'tbd', private: true },
      ],
    },
  ],
};

/** No group, so one level, 'Every step': three steps with icons and a branching that ends. */
export const flat: Roadmap = {
  title: 'Flat plan',
  branches: [
    {
      name: 'Only',
      items: [
        { id: 'f-1', name: 'First', state: 'done', icon: 'flag' },
        { id: 'f-2', name: 'Second', state: 'in-progress', icon: 'tools' },
        { split: [{ name: 'Aside', ends: true, items: [{ id: 'f-aside', name: 'Aside one', state: 'tbd' }] }] },
        { id: 'f-3', name: 'Third', icon: 'star' },
      ],
    },
  ],
};

/** No icon, so no 'Hide node icons' switch: one group, one deep, so three levels, as his roadmap has. */
export const plain: Roadmap = {
  title: 'Plain plan',
  branches: [
    {
      name: 'Work',
      items: [
        { id: 'p-1', name: 'Start', state: 'done' },
        {
          name: 'Pair',
          split: [
            { name: 'Left', items: [{ id: 'p-2', name: 'Left one', state: 'done' }, { id: 'p-3', name: 'Left two' }] },
            { name: 'Right', items: [{ id: 'p-4', name: 'Right one', state: 'in-progress' }] },
          ],
        },
        { id: 'p-5', name: 'Finish', milestone: true },
      ],
    },
  ],
};

/** Long names: of 3 lines, of one word too wide for a line, of more than 3 lines, of narrow letters and of wide ones; on steps, a milestone, a group step, a group's frame and a track. */
export const wordy: Roadmap = {
  title: 'Wordy plan',
  branches: [
    {
      name: 'Work',
      items: [
        { id: 'w-1', name: 'Start', state: 'done' },
        { id: 'w-2', name: 'A step whose name needs all of three lines', icon: 'rocket' },
        { id: 'w-3', name: 'Internationalizationalization', state: 'in-progress' },
        { id: 'w-4', name: 'A milestone with a name far too long to be written on three lines over its step', milestone: true, icon: 'flag' },
        {
          name: 'A group with a long name over its frame',
          split: [
            { name: 'Left', items: [{ id: 'w-5', name: 'Another long step name on the left' }, { id: 'w-6', name: 'iiii iiii iiii iiii' }] },
            { name: 'Right', items: [{ id: 'w-7', name: 'WWWWW MMMMM' }] },
          ],
        },
        { id: 'w-8', name: 'After the group, a long name again' },
      ],
    },
    {
      name: 'Next',
      items: [
        { id: 'w-9', name: 'Under them, a step with a three line name', icon: 'tools' },
        { split: [{ name: 'Steps in a row with a long name', items: [{ id: 'w-10', name: 'In the row, a step with a long name' }, { id: 'w-11', name: 'And one more' }] }] },
      ],
    },
  ],
};

/** A group inside a group, one step outside them: four levels. */
export const nested: Roadmap = {
  title: 'Nested plan',
  branches: [
    {
      name: 'Work',
      items: [
        { id: 'n-1', name: 'Start', state: 'done' },
        {
          name: 'Outer',
          split: [{ name: 'Top', items: [{ id: 'n-2', name: 'Top one' }, { name: 'Inner', split: [{ name: 'Low', items: [{ id: 'n-3', name: 'Low one' }] }] }] }],
        },
      ],
    },
  ],
};

/** Four top-level branches: 'Old', finished, so hidden at first; 'Now', in progress; 'Next', whose step waits for one in 'Now'; and one with a name too long for one line of the list of branches. */
export const versions: Roadmap = {
  title: 'Versions plan',
  branches: [
    { name: 'Old', items: [{ id: 'o-1', name: 'Old one', state: 'done' }, { id: 'o-2', name: 'Old two', state: 'canceled' }] },
    { name: 'Now', items: [{ id: 'w-1', name: 'Now one', state: 'in-progress' }, { id: 'w-2', name: 'Now two' }] },
    { name: 'Next', items: [{ id: 'x-1', name: 'Next one', waitsFor: ['w-2'] }] },
    { name: 'A branch with a name so long that the list of branches wraps it onto two lines and then cuts it', items: [{ id: 'l-1', name: 'Long one' }] },
  ],
};

/** Steps with links: one with three, the first with an icon, the next with none and the last with an icon the set has not; one with a link; one with an empty list; one with none.
 * No group, so it opens at 'Every step', where each step is drawn. */
export const links: Roadmap = {
  title: 'Links plan',
  branches: [
    { name: 'Main', items: [
      { id: 'spec', name: 'Spec', state: 'done', why: 'The build needs a spec.', links: [
        { name: 'Spec doc', url: 'https://example.com/spec', icon: 'file-text' },
        { name: 'Demo', url: 'http://example.com/demo' },
        { name: 'Mock', url: 'https://example.com/mock?v=2#top', icon: 'no-such-icon' },
      ] },
      { id: 'build', name: 'Build', state: 'in-progress', links: [{ name: 'Branch', url: 'https://example.com/branch' }] },
      { id: 'ship', name: 'Ship', why: 'People get it.', links: [] },
      { id: 'party', name: 'Party' },
    ] },
  ],
};

export const plans = { full, flat, plain, wordy, nested, versions, links };

/** A long first branch, then four branches side by side, each a design step and a build of two tracks, with icons; `busy` is the step in progress.
 * At 'Tracks' and 'Every step' one column fits a phone, two do not. A step in progress in a build is drawn far out as its group, and at 'Tracks' as the pill of its track. */
export function columns(busy: string): Roadmap {
  const build = (k: string): Split => ({
    name: `${k} build`,
    split: [{ name: 'Code', items: [{ id: `${k}-c`, name: `${k} code`, icon: 'tools' }] }, { name: 'Tests', items: [{ id: `${k}-t`, name: `${k} tests`, icon: 'tools' }] }],
  });
  const col = (k: string): Branch => ({ name: k, items: [{ id: `${k}-d`, name: `${k} design`, icon: 'map', state: 'todo' }, build(k)] });
  const long: Branch = { name: 'Long', items: ['Spec', 'Lib', 'Export', 'Private'].flatMap(k => [{ id: `${k}-d`, name: `${k} design`, icon: 'map', state: 'done' as const }, build(k)]) };
  const plan: Roadmap = {
    title: 'Columns',
    branches: [{ name: 'Main', items: [{ id: 'start', name: 'Start', state: 'done' }, { branching: true, split: [long, ...['One', 'Two', 'Three', 'Four'].map(col)] }, { id: 'end', name: 'Finish' }] }],
  };
  return edit(plan, p => { nodeOf(p, busy).state = 'in-progress'; });
}

/** Two branches side by side, each a design step and a build of two tracks, with icons. The code of the second waits for both tracks of the first:
 * at 'Every step' down, it and the two steps that block it lie on one row. */
export const sideBySide: Roadmap = {
  title: 'Side by side',
  branches: [
    {
      name: 'Main',
      items: [
        { id: 'start', name: 'Start', state: 'done' },
        {
          branching: true,
          split: [
            {
              name: 'Layout',
              items: [
                { id: 'l-d', name: 'Layout design', state: 'done', icon: 'map' },
                { name: 'Layout build', split: [{ name: 'Code', items: [{ id: 'l-c', name: 'Layout code', state: 'in-progress', icon: 'tools' }] }, { name: 'Tests', items: [{ id: 'l-t', name: 'Layout tests', icon: 'tools' }] }] },
              ],
            },
            {
              name: 'Looks',
              items: [
                { id: 'k-d', name: 'Looks design', icon: 'map' },
                { name: 'Looks build', split: [{ name: 'Code', items: [{ id: 'k-c', name: 'Looks code', icon: 'tools', waitsFor: ['l-c', 'l-t'] }] }, { name: 'Tests', items: [{ id: 'k-t', name: 'Looks tests', icon: 'tools' }] }] },
              ],
            },
          ],
        },
        { id: 'end', name: 'Finish' },
      ],
    },
  ],
};

/** Every node of a plan, in reading order. */
export function nodesOf(plan: Roadmap): RoadNode[] {
  const out: RoadNode[] = [];
  const walk = (b: Branch): void => b.items.forEach((it: Item) => ('split' in it ? it.split.forEach(walk) : out.push(it)));
  plan.branches.forEach(walk);
  return out;
}

/** The names of the top-level branches a plan shows at first: each one that has a step not done or canceled, or no step; or else the last. */
export function shownAtFirst(plan: Roadmap): string[] {
  const open = plan.branches.filter(b => {
    const ns = nodesOf({ ...plan, branches: [b] });
    return !ns.length || ns.some(n => n.state !== 'done' && n.state !== 'canceled');
  });
  return (open.length ? open : plan.branches.slice(-1)).map(b => b.name ?? '');
}

/** A node of a plan, by its id, to read or to change in a copy made by edit(). */
export function nodeOf(plan: Roadmap, id: string): RoadNode {
  const n = nodesOf(plan).find(s => s.id === id);
  if (!n) throw new Error(`no step "${id}" in "${plan.title}"`);
  return n;
}

/** A changed copy of a plan; the plan itself is left as it is. */
export function edit(plan: Roadmap, change: (copy: Roadmap) => void): Roadmap {
  const copy = structuredClone(plan);
  change(copy);
  return copy;
}
