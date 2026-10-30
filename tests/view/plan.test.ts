// What readPlan() makes of a roadmap, in Node: the state of each step, and each name as the lines that wrap() and cutLine() write it on.
import { expect, test } from '@playwright/test';
import { checkRoadmap, parseRoadmap } from '../../src/roadmap/check';
import type { Roadmap } from '../../src/roadmap/types';
import { cutLine, NAME_W, readPlan, wrap, type Fonts } from '../../src/view/plan';
import { FONTS, planOf } from '../support/layout';
import { edit, full, nodeOf, nodesOf, wordy } from '../support/plans';

// tests of a few milliseconds: they run in order, in one worker
test.describe.configure({ mode: 'default' });

test.describe('wrap()', () => {
  // in the stand-in fonts, as the view wraps the names of 'wordy'
  const lines = planOf(wordy).byId;
  const width = (id: string): number => Math.max(...lines.get(id)!.lines.map(l => FONTS.width(l, nodeOf(wordy, id).milestone ? 'bold' : 'label')));

  test('a name wraps to 3 lines at most, none wider than NAME_W', () => {
    for (const n of nodesOf(wordy)) {
      const ls = lines.get(n.id)!.lines;
      expect(ls.length, n.id).toBeLessThanOrEqual(3);
      expect(width(n.id), `the widest line of ${n.id}`).toBeLessThanOrEqual(NAME_W);
      // a name that is not cut is all there, word for word
      if (!ls.at(-1)!.endsWith('…')) expect(ls.join('').replace(/\s/g, ''), n.id).toBe(n.name.replace(/\s/g, ''));
    }
    expect(lines.get('w-2')!.lines).toHaveLength(3);
  });

  test('a name wraps by the width of its letters, not their count', () => {
    expect(lines.get('w-6')!.lines).toEqual(['iiii iiii iiii iiii']);
    expect(lines.get('w-7')!.lines).toEqual(['WWWWW', 'MMMMM']);
  });

  test('a word too wide for a line breaks inside it', () => {
    expect(lines.get('w-3')!.lines).toHaveLength(2);
    expect(lines.get('w-3')!.lines.join('')).toBe('Internationalizationalization');
  });

  test('only a name longer than 3 lines is cut with "…"', () => {
    expect(nodesOf(wordy).filter(n => lines.get(n.id)!.lines.at(-1)!.endsWith('…')).map(n => n.id)).toEqual(['w-4']);
  });

  test('wrap() and cutLine() never cut right after a space or a mark', () => {
    // each letter is 10 units wide
    const fonts: Fonts = { width: s => 10 * s.length, line: 16, top: 12 };
    expect(wrap('aaaa bbbb cccc, dddd', fonts, 'label', 60)).toEqual({ lines: ['aaaa', 'bbbb', 'cccc…'], cut: true });
    expect(cutLine('cccc, dddd', fonts, 'cap', 60)).toBe('cccc…');
    expect(cutLine('cccc dddd', fonts, 'cap', 60)).toBe('cccc…');
    expect(cutLine('cccc: dddd', fonts, 'cap', 70)).toBe('cccc…');
    expect(cutLine('cccc dddd', fonts, 'cap', 90)).toBe('cccc dddd');
  });
});

test.describe('blocked', () => {
  const states = (r: Roadmap): Record<string, string> => Object.fromEntries(readPlan(r, () => undefined, FONTS).all.map(n => [n.node.id, n.state]));

  test('no file says it: the check refuses the state "blocked"', () => {
    const [error] = checkRoadmap('{ "title": "T", "branches": [ { "items": [ { "id": "a", "name": "A", "state": "blocked" } ] } ] }').errors;
    expect(error).toEqual({ line: 1, path: '#1 › A', key: 'state', error: 'Invalid value', value: '"blocked"' });
  });

  test('a step is blocked while one it waits for is not done', () => {
    // the file says 'todo', and 'launch' waits for 'review', which is not done
    expect(nodeOf(full, 'launch').state).toBe('todo');
    expect(states(full).launch).toBe('blocked');
    expect(states(edit(full, c => { nodeOf(c, 'review').state = 'done'; })).launch).toBe('todo');
    // a step that is done stays done, so the side bar lists no 'Blocked by'
    expect(states(edit(full, c => { nodeOf(c, 'kickoff').waitsFor = ['launch']; })).kickoff).toBe('done');
  });

  test('in an export, a step that waits for private work is blocked', () => {
    const r: Roadmap = {
      title: 'T',
      branches: [
        { name: 'Partner', items: [{ id: 'signs', name: 'Partner signs', state: 'in-progress' }] },
        { name: 'Ours', items: [
          { id: 'deal', name: 'Deal', waitsFor: ['signs'] },
          { id: 'cut', name: 'Cut', waitsForPrivate: true },
          { id: 'over', name: 'Over', state: 'done', waitsForPrivate: true },
        ] },
      ],
    };
    expect(states(parseRoadmap(r))).toEqual({ signs: 'in-progress', deal: 'blocked', cut: 'blocked', over: 'done' });
    r.branches[0].items[0] = { id: 'signs', name: 'Partner signs', state: 'done' };
    expect(states(r).deal).toBe('todo');
  });
});
