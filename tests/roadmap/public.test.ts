// The cut for strangers of src/roadmap/public.ts: it takes each private item with all that is in it, with no gap, lock or count, and no step keeps its days.
// A shown step that waits for private work not done says so, with waitsForPrivate.
import { expect, test } from '@playwright/test';
import { parseRoadmap } from '../../src/roadmap/check';
import { publicRoadmap } from '../../src/roadmap/public';
import type { Branch, Item, RoadNode, Roadmap } from '../../src/roadmap/types';

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

test('the cut takes private items, and the groups and branches left empty', () => {
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

test('the cut keeps only what a stranger may read, with new ids', () => {
  const cut = publicRoadmap(R([
    { name: 'Main', holds: 'What it holds', items: [
      n('first-step', { state: 'done', why: 'Why', doneWhen: 'When', icon: 'bulb', milestone: true, start: '2026-01-01', end: '2026-01-02', deadline: '2026-01-03' }),
      n('hidden', { private: true, state: 'done' }),
      n('second'),
    ] },
    { name: 'Later', items: [n('third', { waitsFor: ['hidden', 'second'] }), n('fourth', { waitsFor: ['hidden'] })] },
  ]));
  // no day, ids in reading order, and waits only for shown steps
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

test('a branching left with one line joins the row, unless it ends', () => {
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

test('a shown step that waits for private work not done is blocked', () => {
  // any open step by waitsFor, and a step not started by its line
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

test('a roadmap with every branch private has nothing to show', () => {
  expect(() => publicRoadmap(R([{ name: 'Mine', private: true, items: [n('a')] }]))).toThrow('everything is private: there is nothing to show');
});

test('the cut keeps links of shown steps and drops private ones', () => {
  const cut = publicRoadmap(R([{ name: 'Main', items: [
    { id: 'a', name: 'A', links: [{ name: 'Doc', url: 'https://example.com/doc', icon: 'file-text' }] },
    { id: 'b', name: 'B', private: true, links: [{ name: 'Secret', url: 'https://example.com/secret' }] },
  ] }]));
  // as written
  expect(cut.branches[0].items).toEqual([{ id: 's1', name: 'A', links: [{ name: 'Doc', url: 'https://example.com/doc', icon: 'file-text' }] }]);
  expect(JSON.stringify(cut)).not.toContain('secret');
});
