// The file check of src/roadmap/check.ts: every error of a roadmap file at once, each as its line, path, key, error name and wrong value.
// The error name is one of ERRORS, and nothing else is said. A link takes only an address that starts with https:// or http://.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { checkRoadmap, parseRoadmap } from '../../src/roadmap/check';
import { ERRORS, sayError, type FileError } from '../../src/roadmap/errors';
import { links } from '../support/plans';

/** A file with an error of most kinds, on lines of their own but the last three. */
const BROKEN = `{
  "title": "Broken",
  "branches": [
    { "name": "V1", "items": [
      { "id": "a", "name": "Design", "state": "blocked" },
      { "id": "b", "name": "Build", "waitsfor": ["a"] },
      { "branchng": true, "split": [
        { "name": "Code", "items": [ { "id": "c", "name": "Code one", "start": "2026-02-30" } ] }
      ] },
      { "id": "a", "name": "Again" },
      { "id": "d", "waitsFor": ["nope"], "state": "doing" }
    ] }
  ]
}
`;

test('the check finds every error at once, in file order', () => {
  const { roadmap, errors } = checkRoadmap(BROKEN);
  expect(roadmap).toBeUndefined();
  const want: FileError[] = [
    { line: 5, path: 'V1 › Design', key: 'state', error: 'Invalid value', value: '"blocked"' },
    { line: 5, path: 'V1 › Design', key: 'id', error: 'Duplicate id', value: '"a"' },
    { line: 6, path: 'V1 › Build', key: 'waitsfor', error: 'Unknown key', value: '' },
    { line: 7, path: 'V1', key: 'branchng', error: 'Unknown key', value: '' },
    { line: 8, path: 'V1 › Code › Code one', key: 'start', error: 'Invalid date', value: '"2026-02-30"' },
    { line: 10, path: 'V1 › Again', key: 'id', error: 'Duplicate id', value: '"a"' },
    { line: 11, path: 'V1 › d', key: 'state', error: 'Invalid value', value: '"doing"' },
    { line: 11, path: 'V1 › d', key: 'name', error: 'Missing key', value: '' },
    { line: 11, path: 'V1 › d', key: 'waitsFor', error: 'Unknown id', value: '"nope"' },
  ];
  expect(errors).toEqual(want);
});

test('an unknown key is an error on every piece, with no value', () => {
  const text = `{
  "title": "Keys",
  "subtitle": "no such key",
  "branches": [
    { "name": "Main", "item": [], "items": [
      { "name": "Group", "branchng": true, "split": [
        { "name": "Code", "items": [
          { "id": "x", "name": "X", "waitsfor": [], "Icon": "map", "color": "red" }
        ] }
      ] }
    ] }
  ]
}`;
  expect(checkRoadmap(text).errors.map(sayError)).toEqual([
    '3    subtitle  Unknown key  ',
    '5  Main  item  Unknown key  ',
    '6  Main › Group  branchng  Unknown key  ',
    '8  Main › Group › Code › X  waitsfor  Unknown key  ',
    '8  Main › Group › Code › X  Icon  Unknown key  ',
    '8  Main › Group › Code › X  color  Unknown key  ',
  ]);
});

test('a wrong type or value shows the value as written', () => {
  const text = `{
  "title": "Types",
  "branches": [
    { "name": "Main", "items": [
      7,
      { "id": "x", "name": "", "milestone": "yes", "start": 20261001, "end": "2026-10", "waitsFor": [5, "x"] },
      { "split": [] },
      { "name": "Items", "split": [ { "items": { "id": "y", "name": "Y", "why": "an object where a list goes, which is cut short" } } ] }
    ] }
  ]
}`;
  expect(checkRoadmap(text).errors.map(sayError)).toEqual([
    '5  Main    Wrong type  7',
    '6  Main › x  name  Invalid value  ""',
    '6  Main › x  milestone  Wrong type  "yes"',
    '6  Main › x  start  Wrong type  20261001',
    '6  Main › x  end  Invalid date  "2026-10"',
    '6  Main › x  waitsFor  Wrong type  5',
    // a step that waits for itself
    '6  Main › x  waitsFor  Invalid value  "x"',
    '7  Main  split  Invalid value  []',
    '8  Main › Items  items  Wrong type  {"id":"y","name":"Y","why":"an object where a list goes, wh…',
  ]);
  expect(checkRoadmap('[]').errors).toEqual([{ line: 1, path: '', key: '', error: 'Wrong type', value: '[]' }]);
  expect(checkRoadmap('{ "branches": [] }').errors.map(sayError)).toEqual(['1    title  Missing key  ', '1    branches  Invalid value  []']);
});

test('a duplicate id is an error once on each of its lines', () => {
  const text = `{ "title": "Twice", "branches": [ { "items": [
  { "id": "a", "name": "One" }, { "id": "a", "name": "Two" },
  { "id": "a", "name": "Three" }
] } ] }`;
  expect(checkRoadmap(text).errors.map(sayError)).toEqual(['2  #1 › One  id  Duplicate id  "a"', '3  #1 › Three  id  Duplicate id  "a"']);
});

test('a text that is not JSON has one error, where it breaks', () => {
  const at = (text: string): [number, string] => {
    const { errors } = checkRoadmap(text);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ path: '', key: '', error: 'Invalid JSON' });
    return [errors[0].line, errors[0].value];
  };
  expect(at('{\n  "title": "T"\n  "branches": []\n}')).toEqual([2, '']);
  expect(at('{\n  "title": "T",\n  "branches": [1, 2,\n  ]\n}')).toEqual([3, ',']);
  expect(at('{\n  "title": "T\n}')).toEqual([2, '"T']);
  expect(at('{\n  title: "T"\n}')).toEqual([2, 'title']);
  expect(at('{\n  "title" "T"\n}')).toEqual([2, '']);
  expect(at('{\n  "title": "T",\n  "branches": [')).toEqual([3, '']);
  expect(at('{\n  "n": 01\n}')).toEqual([2, '01']);
  expect(at('{\n  "n": "a\\qb"\n}')).toEqual([2, '\\q']);
  expect(at('{\n  "n": nope\n}')).toEqual([2, 'nope']);
  expect(at('{}\n}')).toEqual([2, '}']);
  expect(at('')).toEqual([1, '']);
});

test('every error has a name from the one list', () => {
  const all = [BROKEN, '{', '[]', '{ "title": "T", "branches": [ { "items": [ { "id": "a", "name": "A", "waitsFor": ["b"], "end": 5 } ] } ] }'];
  for (const text of all) for (const e of checkRoadmap(text).errors) expect(ERRORS).toContain(e.error);
});

test('the sample roadmap has no error', () => {
  expect(checkRoadmap(readFileSync(new URL('../../data/sample.roadmap.json', import.meta.url), 'utf8')).errors).toEqual([]);
});

test('a roadmap given as data throws its first error, with no line', () => {
  expect(() => parseRoadmap({ title: 'T', branches: [{ items: [{ id: 'a', name: 'A', state: 'blocked' }] }] })).toThrow('#1 › A  state  Invalid value  "blocked"');
  const link = { title: 'Plan', branches: [{ name: 'Main', items: [{ id: 'a', name: 'A', links: [{ name: 'Doc', url: 'file:///home/doc.md' }] }] }] };
  expect(() => parseRoadmap(link)).toThrow('Main › A › Doc  url  Invalid URL  "file:///home/doc.md"');
});

test('links with https or http addresses pass, with or without icons', () => {
  // with a step that has no link
  expect(checkRoadmap(JSON.stringify(links)).errors).toEqual([]);
});

test('each wrong link is an error, with its name after its step', () => {
  const text = `{
  "title": "Links",
  "branches": [
    { "name": "Main", "items": [
      { "id": "a", "name": "Spec", "links": [
        { "name": "Doc", "url": "ftp://example.com/doc" },
        { "name": "Demo", "url": "javascript:alert(1)", "icon": 7 },
        { "url": "https://example.com/no-name" },
        { "name": "", "url": "https://" },
        { "name": "Page", "href": "https://example.com" },
        "https://example.com/bare",
        { "name": "Site", "url": "example.com" },
        { "name": "Number", "url": 42 }
      ] },
      { "id": "b", "name": "Build", "links": { "name": "Doc", "url": "https://example.com" } }
    ] }
  ]
}`;
  expect(checkRoadmap(text).errors.map(sayError)).toEqual([
    '6  Main › Spec › Doc  url  Invalid URL  "ftp://example.com/doc"',
    '7  Main › Spec › Demo  url  Invalid URL  "javascript:alert(1)"',
    '7  Main › Spec › Demo  icon  Wrong type  7',
    '8  Main › Spec  name  Missing key  ',
    '9  Main › Spec  name  Invalid value  ""',
    '9  Main › Spec  url  Invalid URL  "https://"',
    '10  Main › Spec › Page  href  Unknown key  ',
    '10  Main › Spec › Page  url  Missing key  ',
    '11  Main › Spec    Wrong type  "https://example.com/bare"',
    '12  Main › Spec › Site  url  Invalid URL  "example.com"',
    '13  Main › Spec › Number  url  Wrong type  42',
    '15  Main › Build  links  Wrong type  {"name":"Doc","url":"https://example.com"}',
  ]);
});
