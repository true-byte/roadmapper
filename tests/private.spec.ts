// Private items: the owner sees a 'Private' tag on each, and on all that is in one. The export cuts them, with no gap, lock or count,
// and a shown step that waits for private work not done says so, and is drawn blocked. No step keeps its days. The cut itself is checked here, with no browser; the export's page in export.spec.ts.
import { test as plain } from '@playwright/test';
import { publicRoadmap } from '../src/roadmap/public';
import { parseRoadmap } from '../src/roadmap/check';
import type { Branch, Item, RoadNode, Roadmap } from '../src/roadmap/types';
import { expect, group, openPlan, settle, side, step, test, zoomTo } from './helpers';

const R = (branches: Branch[]): Roadmap => parseRoadmap({ title: 'Plan', branches });
const n = (id: string, more: Partial<RoadNode> = {}): RoadNode => ({ id, name: id.toUpperCase(), ...more });
/** The steps of a roadmap, in reading order, as name and state: blocked where it waits for private work. */
function steps(r: Roadmap): string[] {
  const out: string[] = [];
  const walk = (items: Item[]): void => {
    for (const it of items) {
      if ('split' in it) it.split.forEach(b => walk(b.items));
      else out.push(`${it.name} ${it.waitsForPrivate ? 'blocked' : (it.state ?? 'todo')}`);
    }
  };
  r.branches.forEach(b => walk(b.items));
  return out;
}

plain.describe('the cut', () => {
  plain('takes private steps, branches, groups and branchings with all that is in them, and the groups and branches left empty', () => {
    const cut = publicRoadmap(R([
      { name: 'Main', items: [
        n('a', { state: 'done' }),
        n('b', { private: true }),
        { name: 'Build', private: true, split: [{ items: [n('c')] }, { items: [n('d')] }] },
        { name: 'Two', split: [{ name: 'Shown', items: [n('e')] }, { name: 'Hidden', private: true, items: [n('f')] }] },
        { name: 'Gone', split: [{ items: [n('g', { private: true })] }, { items: [n('h', { private: true })] }] },
        n('i', { state: 'done' }),
      ] },
      { name: 'Secret', private: true, items: [n('j')] },
      { name: 'Empty now', items: [n('k', { private: true })] },
    ]));
    // E waits for the private group before it
    expect(steps(cut)).toEqual(['A done', 'E blocked', 'I done']);
    expect(cut.branches.map(b => b.name)).toEqual(['Main']);
    // a group left with one track stays a group
    expect(cut.branches[0].items[1]).toEqual({ name: 'Two', split: [{ name: 'Shown', items: [{ id: 's2', name: 'E', waitsForPrivate: true }] }] });
  });

  plain('keeps only the keys a stranger may read, with no day, gives new ids in reading order, and waits only for shown steps', () => {
    const cut = publicRoadmap(R([
      { name: 'Main', holds: 'What it holds', items: [
        n('first-step', { state: 'done', why: 'Why', doneWhen: 'When', icon: 'bulb', milestone: true, start: '2026-01-01', end: '2026-01-02', deadline: '2026-01-03' }),
        n('hidden', { private: true, state: 'done' }),
        n('second'),
      ] },
      { name: 'Later', items: [n('third', { waitsFor: ['hidden', 'second'] }), n('fourth', { waitsFor: ['hidden'] })] },
    ]));
    expect(cut).toEqual({
      title: 'Plan',
      branches: [
        { name: 'Main', holds: 'What it holds', items: [
          { id: 's1', name: 'FIRST-STEP', state: 'done', why: 'Why', doneWhen: 'When', icon: 'bulb', milestone: true },
          { id: 's2', name: 'SECOND' },
        ] },
        { name: 'Later', items: [{ id: 's3', name: 'THIRD', waitsFor: ['s2'] }, { id: 's4', name: 'FOURTH' }] },
      ],
    });
  });

  plain('a branching left with one line that comes back is its steps in the row; one left with a line that ends stays a branching', () => {
    const cut = publicRoadmap(R([
      { name: 'Main', items: [
        { branching: true, split: [{ name: 'Shop', items: [n('a'), n('b')] }, { name: 'Ads', private: true, items: [n('c')] }] },
        { split: [{ name: 'Try', ends: true, items: [n('d')] }, { name: 'Back', private: true, items: [n('e')] }] },
        n('f'),
      ] },
    ]));
    expect(cut.branches[0].items).toEqual([
      { id: 's1', name: 'A' },
      { id: 's2', name: 'B' },
      { branching: true, split: [{ name: 'Try', ends: true, items: [{ id: 's3', name: 'D' }] }] },
      // the line that came back before it is private
      { id: 's4', name: 'F', waitsForPrivate: true },
    ]);
  });

  plain('a shown step that waits for private work not done says so: any open step by waitsFor, a step not started by its line', () => {
    const cut = publicRoadmap(R([
      { name: 'Line', items: [
        n('p1', { private: true }),
        n('next', { state: 'todo' }),
      ] },
      { name: 'Started', items: [n('p2', { private: true }), n('going', { state: 'in-progress' })] },
      { name: 'Past done', items: [n('p3', { private: true, state: 'done' }), n('free')] },
      { name: 'Past canceled', items: [n('p4', { private: true }), n('dropped', { state: 'canceled' }), n('far', { state: 'tbd' })] },
      { name: 'Shown wait too', items: [
        { split: [{ items: [n('p5', { private: true })] }, { items: [n('open')] }] },
        n('after'),
      ] },
      { name: 'By waits', items: [
        n('w1', { state: 'in-progress', waitsFor: ['p1'] }),
        n('w2', { state: 'todo', waitsFor: ['p3'] }),
      ] },
    ]));
    expect(steps(cut)).toEqual([
      'NEXT blocked',
      'GOING in-progress',
      'FREE todo',
      'DROPPED canceled', 'FAR blocked',
      'OPEN todo', 'AFTER todo',
      'W1 blocked', 'W2 todo',
    ]);
  });

  plain('a roadmap with every branch private has nothing to show', () => {
    expect(() => publicRoadmap(R([{ name: 'Mine', private: true, items: [n('a')] }]))).toThrow('everything is private: there is nothing to show');
  });
});

test.describe('for the owner', () => {
  const plan: Roadmap = {
    title: 'Owner plan',
    branches: [
      { name: 'Open', items: [{ id: 'shown', name: 'Shown step', state: 'done' }, { id: 'own', name: 'Own step', private: true }] },
      { name: 'Hidden', private: true, items: [
        { id: 'inside', name: 'Inside step' },
        { name: 'Deep group', split: [{ name: 'Code', items: [{ id: 'deep', name: 'Deep step' }] }, { name: 'Tests', items: [{ id: 'deep-2', name: 'Deep two' }] }] },
      ] },
    ],
  };
  const tags = async (page: import('@playwright/test').Page): Promise<string[]> => side(page).locator('.facts .tag').allTextContents();

  test("a private step, and each step, group and track in a private branch, has the 'Private' tag in its side bar; a shown step has none", async ({ page }) => {
    await openPlan(page, plan, { store: null });
    await group(page, 'Deep group').click();
    await settle(page);
    expect(await tags(page)).toEqual(['Private']);
    await zoomTo(page, 'Every step');
    for (const id of ['own', 'inside', 'deep']) {
      await step(page, id).click();
      await settle(page);
      expect(await tags(page), id).toEqual(['Private']);
    }
    await step(page, 'shown').click();
    await settle(page);
    expect(await tags(page)).toEqual([]);
  });
});
