// The edit model of 'Edit on page': each change as plain code, with no page.
import { expect, test } from '@playwright/test';
import { addBranch, addItem, addTop, deleteStep, EditHistory, idFor, moveBranch, moveSplit, moveStep, setBranch, setSplit, setStep, type Edited, type StepField } from '../../src/roadmap/edit';
import { sayError } from '../../src/roadmap/errors';
import type { Branch, Item, RoadNode, Roadmap, Split } from '../../src/roadmap/types';

// b0 'Shop', with the group b0.1 of the tracks b0.1.0 'Kitchen' and b0.1.1 'Front'; b1 'Name'; b2 'Later', with the group b2.0 of one track
const PLAN: Roadmap = {
  title: 'Bakery',
  branches: [
    { name: 'Shop', items: [
      { id: 'lease', name: 'Sign the lease' },
      { name: 'Fit out', split: [
        { name: 'Kitchen', items: [{ id: 'ovens', name: 'Install ovens' }] },
        { name: 'Front', items: [{ id: 'counter', name: 'Build the counter' }] },
      ] },
      { id: 'open', name: 'Opening day', waitsFor: ['sign', 'ovens'] },
    ] },
    { name: 'Name', items: [
      { id: 'name', name: 'Pick a name' },
      { id: 'sign', name: 'Make the sign', waitsFor: ['lease'] },
    ] },
    { name: 'Later', items: [{ name: 'Party', split: [{ items: [{ id: 'party', name: 'Party' }] }] }] },
  ],
};
const KEPT = structuredClone(PLAN);

/** Each top-level branch as one line: its name, then its items, a step by its id and a split in parentheses. */
const shape = (r: Roadmap): string[] => r.branches.map(line);
const line = (b: Branch): string => `${b.name ?? ''}[${b.items.map(it => ('split' in it ? `(${it.split.map(line).join(' | ')})` : it.id)).join(' ')}]`;
const ok = (e: Edited): Roadmap => {
  if (!e.ok) throw new Error(e.errors.map(sayError).join('\n'));
  return e.roadmap;
};
const refused = (e: Edited): string[] => (e.ok ? [] : e.errors.map(x => `${x.key} ${x.error}`));
const step = (r: Roadmap, id: string): RoadNode | undefined => {
  const all = (items: Item[]): RoadNode[] => items.flatMap(it => ('split' in it ? it.split.flatMap(b => all(b.items)) : [it]));
  return all(r.branches.flatMap(b => b.items)).find(n => n.id === id);
};

test.afterEach(() => expect(PLAN).toEqual(KEPT));

test('moveStep: to any slot; a track and a group left empty go', () => {
  expect(shape(ok(moveStep(PLAN, 'lease', { branch: 'b1', index: 1 })))).toEqual(['Shop[(Kitchen[ovens] | Front[counter]) open]', 'Name[name lease sign]', 'Later[([party])]']);
  // the slot counts the items as they are before the move
  expect(shape(ok(moveStep(PLAN, 'lease', { branch: 'b0', index: 3 })))[0]).toBe('Shop[(Kitchen[ovens] | Front[counter]) open lease]');
  expect(shape(ok(moveStep(PLAN, 'name', { branch: 'b0.1.1', index: 0 }))).slice(0, 2)).toEqual(['Shop[lease (Kitchen[ovens] | Front[name counter]) open]', 'Name[sign]']);
  const out = ok(moveStep(PLAN, 'ovens', { branch: 'b0', index: 0 }));
  expect(shape(out)[0]).toBe('Shop[ovens lease (Front[counter]) open]');
  expect(shape(ok(moveStep(out, 'counter', { branch: 'b0', index: 0 })))[0]).toBe('Shop[counter ovens lease open]');
  // out of the one track of a group, to right after that group
  expect(shape(ok(moveStep(PLAN, 'party', { branch: 'b2', index: 1 })))[2]).toBe('Later[party]');
  expect(moveStep(PLAN, 'lease', { branch: 'b0', index: 1 })).toEqual({ ok: true, roadmap: PLAN, step: 'lease' });
  expect(refused(moveStep(PLAN, 'nope', { branch: 'b0', index: 0 }))).toEqual(['id Unknown id']);
  for (const to of [{ branch: 'b9', index: 0 }, { branch: 'b0.1', index: 0 }, { branch: 'b0', index: 4 }, { branch: 'b0', index: 0.5 }]) {
    expect(refused(moveStep(PLAN, 'lease', to))).toEqual([' Invalid value']);
  }
});

test('moveSplit: a group moves as one piece, never into itself', () => {
  const end = moveSplit(PLAN, 'b0.1', { branch: 'b0', index: 3 });
  expect(shape(ok(end))[0]).toBe('Shop[lease open (Kitchen[ovens] | Front[counter])]');
  expect(end).toMatchObject({ key: 'b0.2' });
  const away = moveSplit(PLAN, 'b2.0', { branch: 'b1', index: 1 });
  expect(shape(ok(away))).toEqual(['Shop[lease (Kitchen[ovens] | Front[counter]) open]', 'Name[name ([party]) sign]']);
  expect(away).toMatchObject({ key: 'b1.1' });
  expect(moveSplit(PLAN, 'b0.1', { branch: 'b0', index: 2 })).toEqual({ ok: true, roadmap: PLAN, key: 'b0.1' });
  expect(refused(moveSplit(PLAN, 'b0.1', { branch: 'b0.1.0', index: 0 }))).toEqual([' Invalid value']);
  expect(refused(moveSplit(PLAN, 'b0.0', { branch: 'b1', index: 0 }))).toEqual([' Invalid value']);
});

test('moveBranch: among the tracks of its group, or the top-level branches', () => {
  const track = moveBranch(PLAN, 'b0.1.1', 0);
  expect(shape(ok(track))[0]).toBe('Shop[lease (Front[counter] | Kitchen[ovens]) open]');
  expect(track).toMatchObject({ key: 'b0.1.0' });
  const top = moveBranch(PLAN, 'b0', 3);
  expect(shape(ok(top)).map(s => s.split('[')[0])).toEqual(['Name', 'Later', 'Shop']);
  expect(top).toMatchObject({ key: 'b2' });
  expect(shape(ok(moveBranch(PLAN, 'b2', 0))).map(s => s.split('[')[0])).toEqual(['Later', 'Shop', 'Name']);
  expect(moveBranch(PLAN, 'b0.1.0', 1)).toEqual({ ok: true, roadmap: PLAN, key: 'b0.1.0' });
  expect(refused(moveBranch(PLAN, 'b5', 0))).toEqual([' Invalid value']);
  expect(refused(moveBranch(PLAN, 'b0.1.0', 3))).toEqual([' Invalid value']);
});

test('addItem: a step, a branching of two, a group of one track', () => {
  const one = addItem(PLAN, { branch: 'b1', index: 1 }, 'step');
  expect(shape(ok(one))[1]).toBe('Name[name new-step sign]');
  expect(one).toMatchObject({ step: 'new-step' });
  expect(step(ok(one), 'new-step')).toEqual({ id: 'new-step', name: 'New step' });
  expect(addItem(ok(one), { branch: 'b1', index: 0 }, 'step')).toMatchObject({ step: 'new-step-2' });
  // a new step never takes an id of the roadmap at 'Edit'
  expect(addItem(PLAN, { branch: 'b1', index: 0 }, 'step', new Set(['new-step']))).toMatchObject({ step: 'new-step-2' });
  const fork = addItem(PLAN, { branch: 'b0', index: 0 }, 'branching');
  expect(ok(fork).branches[0].items[0]).toEqual({ branching: true, split: [
    { name: 'New branch', items: [{ id: 'new-step', name: 'New step' }] },
    { name: 'New branch', items: [{ id: 'new-step-2', name: 'New step' }] },
  ] });
  expect(fork).toMatchObject({ step: 'new-step' });
  expect(ok(addItem(PLAN, { branch: 'b2', index: 1 }, 'group')).branches[2].items[1]).toEqual({ name: 'New group', split: [{ items: [{ id: 'new-step', name: 'New step' }] }] });
  expect(refused(addItem(PLAN, { branch: 'b0.1', index: 0 }, 'step'))).toEqual([' Invalid value']);
});

test('addBranch and addTop: a track, a branch, a top-level branch', () => {
  const track = ok(addBranch(PLAN, 'b0.1', 1));
  expect(shape(track)[0]).toBe('Shop[lease (Kitchen[ovens] | New track[new-step] | Front[counter]) open]');
  const fork = ok(addItem(PLAN, { branch: 'b1', index: 0 }, 'branching'));
  expect(shape(ok(addBranch(fork, 'b1.0', 2)))[1]).toBe('Name[(New branch[new-step] | New branch[new-step-2] | New branch[new-step-3]) name sign]');
  const top = addTop(PLAN);
  expect(ok(top).branches[3]).toEqual({ name: 'New branch', items: [{ id: 'new-step', name: 'New step' }] });
  expect(top).toMatchObject({ step: 'new-step' });
  expect(refused(addBranch(PLAN, 'b0.0', 0))).toEqual([' Invalid value']);
  expect(refused(addBranch(PLAN, 'b0.1', 3))).toEqual([' Invalid value']);
});

test('deleteStep: gone from every waitsFor; empty branches and splits go', () => {
  const lease = ok(deleteStep(PLAN, 'lease'));
  expect(step(lease, 'sign')).toEqual({ id: 'sign', name: 'Make the sign' });
  const ovens = ok(deleteStep(PLAN, 'ovens'));
  expect(shape(ovens)[0]).toBe('Shop[lease (Front[counter]) open]');
  expect(step(ovens, 'open')?.waitsFor).toEqual(['sign']);
  expect(shape(ok(deleteStep(ovens, 'counter')))[0]).toBe('Shop[lease open]');
  expect(shape(ok(deleteStep(PLAN, 'party')))).toHaveLength(2);
  const last: Roadmap = { title: 'One', branches: [{ items: [{ id: 'a', name: 'A' }] }] };
  expect(refused(deleteStep(last, 'a'))).toEqual(['branches Invalid value']);
  expect(refused(deleteStep(PLAN, 'nope'))).toEqual(['id Unknown id']);
});

test('setStep: every key sets, and a value that says nothing clears', () => {
  const set: [StepField, unknown][] = [
    ['name', 'Sign it'], ['state', 'done'], ['why', 'Why.'], ['doneWhen', 'Signed.'], ['icon', 'signature'], ['milestone', true],
    ['links', [{ name: 'Lease', url: 'https://example.com/lease.pdf' }]], ['private', true], ['start', '2027-03-01'], ['end', '2027-03-19'],
    ['deadline', '2027-04-01'], ['waitsFor', ['name']],
  ];
  let r = PLAN;
  for (const [key, value] of set) r = ok(setStep(r, 'lease', key, value as never));
  expect(step(r, 'lease')).toEqual({ id: 'lease', ...Object.fromEntries(set) });
  const clear: [StepField, unknown][] = [
    ['state', 'todo'], ['why', ' '], ['doneWhen', ''], ['icon', undefined], ['milestone', false], ['links', []], ['private', false],
    ['start', ''], ['end', ''], ['deadline', ''], ['waitsFor', []],
  ];
  for (const [key, value] of clear) r = ok(setStep(r, 'lease', key, value as never));
  expect(step(r, 'lease')).toEqual({ id: 'lease', name: 'Sign it' });
  expect(refused(setStep(PLAN, 'lease', 'name', ''))).toEqual(['name Missing key']);
  expect(refused(setStep(PLAN, 'lease', 'state', 'blocked' as never))).toEqual(['state Invalid value']);
  expect(refused(setStep(PLAN, 'lease', 'start', '2027-02-30'))).toEqual(['start Invalid date']);
  expect(refused(setStep(PLAN, 'lease', 'links', [{ name: 'Lease', url: 'example.com' }]))).toEqual(['url Invalid URL']);
  expect(refused(setStep(PLAN, 'lease', 'waitsFor', ['nope']))).toEqual(['waitsFor Unknown id']);
  expect(refused(setStep(PLAN, 'lease', 'waitsFor', ['lease']))).toEqual(['waitsFor Invalid value']);
  expect(refused(setStep(PLAN, 'nope', 'name', 'X'))).toEqual(['id Unknown id']);
});

test('setStep: a new step takes the id of its new name', () => {
  const { old } = new EditHistory(PLAN);
  let r = ok(deleteStep(PLAN, 'lease'));
  r = ok(addItem(r, { branch: 'b1', index: 2 }, 'step', old));
  r = ok(setStep(r, 'open', 'waitsFor', ['new-step'], old));
  const named = setStep(r, 'new-step', 'name', 'Book the band', old);
  expect(named).toMatchObject({ step: 'book-the-band' });
  expect(step(ok(named), 'open')?.waitsFor).toEqual(['book-the-band']);
  // never an id of the roadmap at 'Edit', even of a step deleted since
  expect(setStep(ok(named), 'book-the-band', 'name', 'Lease', old)).toMatchObject({ step: 'lease-2' });
  expect(setStep(PLAN, 'lease', 'name', 'Lease it', old)).toMatchObject({ step: 'lease' });
});

test('setBranch and setSplit: each key sets and clears', () => {
  let r = PLAN;
  for (const [key, value] of [['name', 'Naming'], ['holds', 'The name and the sign.'], ['ends', true], ['private', true]] as const) r = ok(setBranch(r, 'b1', key, value));
  expect({ ...r.branches[1], items: [] }).toEqual({ name: 'Naming', holds: 'The name and the sign.', ends: true, private: true, items: [] });
  for (const [key, value] of [['name', ''], ['holds', undefined], ['ends', false], ['private', false]] as const) r = ok(setBranch(r, 'b1', key, value));
  expect({ ...r.branches[1], items: [] }).toEqual({ items: [] });
  for (const [key, value] of [['name', 'Fit out the shop'], ['branching', true], ['private', true]] as const) r = ok(setSplit(r, 'b0.1', key, value));
  expect({ ...(r.branches[0].items[1] as Split), split: [] }).toEqual({ name: 'Fit out the shop', branching: true, private: true, split: [] });
  for (const [key, value] of [['name', ' '], ['branching', false], ['private', false]] as const) r = ok(setSplit(r, 'b0.1', key, value));
  expect({ ...(r.branches[0].items[1] as Split), split: [] }).toEqual({ split: [] });
  expect(refused(setBranch(PLAN, 'b0.1', 'name', 'X'))).toEqual([' Invalid value']);
  expect(refused(setSplit(PLAN, 'b0.0', 'name', 'X'))).toEqual([' Invalid value']);
  expect(refused(setSplit(PLAN, 'b0.1', 'name', 7 as never))).toEqual(['name Wrong type']);
});

test('idFor: lowercase words joined by a dash, unique in the file', () => {
  expect(idFor('Sign the lease', new Set())).toBe('sign-the-lease');
  expect(idFor("Owner's  plan: v2!", new Set())).toBe('owners-plan-v2');
  expect(idFor('Café crème', new Set())).toBe('café-crème');
  expect(idFor('Test bake', new Set(['test-bake', 'test-bake-2']))).toBe('test-bake-3');
  expect(idFor('?!', new Set())).toBe('step');
});

test('EditHistory: undo, redo, typing joins, no change is no step', () => {
  const h = new EditHistory(PLAN);
  expect([h.changed, h.canUndo, h.canRedo]).toEqual([false, false, false]);
  const a = ok(deleteStep(PLAN, 'party')), b = ok(moveStep(a, 'lease', { branch: 'b1', index: 0 }));
  h.push(a);
  h.push(b);
  expect([h.now, h.changed]).toEqual([b, true]);
  expect(h.undo()).toBe(a);
  expect(h.redo()).toBe(b);
  h.undo();
  expect(h.undo()).toEqual(PLAN);
  expect([h.changed, h.canUndo, h.canRedo]).toEqual([false, false, true]);
  // a change after an undo drops what could be redone; one that holds the same, in any order of keys, is none
  h.push(a);
  h.push({ branches: structuredClone(a.branches), title: a.title });
  expect([h.canUndo, h.canRedo]).toEqual([true, false]);
  expect(h.undo()).toEqual(PLAN);
  // each key typed in one field joins one change; typed back to what it was, it is none
  for (const name of ['M', 'Ma', 'Map']) h.push(ok(setStep(h.now, 'sign', 'name', name)), 'name sign');
  expect(step(h.now, 'sign')?.name).toBe('Map');
  expect(h.undo()).toEqual(PLAN);
  for (const name of ['X', 'Make the sign']) h.push(ok(setStep(h.now, 'sign', 'name', name)), 'name sign');
  expect([h.changed, h.canUndo]).toEqual([false, false]);
  expect(h.old).toEqual(new Set(['lease', 'ovens', 'counter', 'open', 'name', 'sign', 'party']));
});
