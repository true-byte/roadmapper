// What readKept() in src/view/store.ts takes from what a page kept: each part of the right kind, and nothing of the wrong kind.
import { expect, test } from '@playwright/test';
import { readKept } from '../../src/view/store';

test('reading what a page kept drops each part of the wrong kind', () => {
  for (const text of [null, 'not JSON', '[]', '{"level": 1.5}', '{"mode": "dark"}']) expect(readKept(text), String(text)).toBeNull();
  const step = { kind: 'step', key: 'a', ids: [] }, branch = { kind: 'branch', key: '0', name: 'Main', ids: ['a', 'b'] };
  expect(readKept(JSON.stringify({
    level: 1, last: 'yes', icons: false, flow: 'across', scale: 1.5, mode: 'blue', branches: { Old: true, Next: 1 }, past: { near: [4, 0], far: 'none' },
    id: 'a', fx: 0.4, fy: null, pick: step, back: [branch, { kind: 'thing', key: '1', ids: [] }, 'b'], sideTop: 120, popup: true, parts: { Key: false, View: 'open' }, list: 'no', only: 5,
  }))).toEqual({ level: 1, icons: false, scale: 1.5, branches: { Old: true }, past: { near: [4, 0] }, id: 'a', fx: 0.4, pick: step, back: [branch], sideTop: 120, popup: true, parts: { Key: false } });
  expect(readKept('{"level": 0, "pick": null, "only": null, "flow": null}')).toEqual({ level: 0, pick: null, only: null, flow: null });
});
