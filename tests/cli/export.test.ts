// What src/cli/export.ts writes for a roadmap file: roadmap.json, the roadmap a stranger sees with the icons it names, and roadmap.html, which holds a copy of it.
// No private item and no day is in either file, and no text of the roadmap can end the copy in the page. The page as it draws: tests/lib/export-script.spec.ts.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { exportSource, ROOT } from '../support/cli';

/** A roadmap with private items, days, and a step whose name holds `</script><!--`. */
const FIXTURE = readFileSync(join(ROOT, 'tests/fixtures/export.json'), 'utf8');
/** What only the owner may read: the names, ids, icons, links and keys of the private items of the fixture. */
const PRIVATE = ['Pricing track', 'Secret price', 'secret-price', 'Only the owner reads', 'coin', 'Price sheet', 'price-sheet', 'receipt', 'Internal branch', 'Payroll', 'payroll', 'cash',
  'Hidden prep', 'hidden-prep', 'ghost', '"private"'];
/** The days of 'Code one' in the fixture, which would tell a stranger it is late. */
const DAYS = ['"start"', '"end"', '"deadline"', '2026-01-05', '2026-01-09', '2026-01-20'];

/** The copy of roadmap.json that the page holds, as its text. With no "<" in it, no text of the roadmap can end it. */
const heldIn = (page: string): string | undefined => /<script type="application\/json">([^<]*)<\/script>/.exec(page)?.[1];

// one load of the source for the file: its tests run in order, in one worker
test.describe.configure({ mode: 'default' });

test('roadmap.json holds only the icons the public roadmap names, with their license', async () => {
  const { exportFiles } = await exportSource();
  const own = JSON.parse((await exportFiles(FIXTURE)).roadmap).icons;
  expect(own.set).toBe('tabler');
  // with the glyphs the view draws itself: the arrows, the gear of the tools button and the chevron of each part of its popup, the button of the list of branches,
  // its search, the pill of a hidden branch, the grip and the mode; with those of the links of a shown step, and the icon of a link, the arrow and the chevron
  // of 'Links'; and with none of the icons of a private step or of its links
  expect(Object.keys(own.icons)).toEqual(['arrow-left', 'arrow-right', 'book', 'bulb', 'chevron-down', 'chevron-up', 'code', 'confetti', 'device-desktop', 'external-link', 'eye-off',
    'link', 'moon', 'rocket', 'search', 'settings', 'stack-2', 'sun', 'test-pipe']);
  expect(own.license).toContain('Permission is hereby granted');
  expect(own.license).toContain('Paweł Kuna');
});

test('no private name, id, icon or key is in either file', async () => {
  const { exportFiles } = await exportSource();
  const { page, roadmap } = await exportFiles(FIXTURE);
  for (const word of PRIVATE) for (const text of [page, roadmap]) expect(text, word).not.toContain(word);
});

test('no step keeps its days', async () => {
  const { exportFiles } = await exportSource();
  const { page, roadmap } = await exportFiles(FIXTURE);
  for (const day of DAYS) for (const text of [page, roadmap]) expect(text, day).not.toContain(day);
});

test('with private kept, both files hold the whole roadmap as written', async () => {
  const { exportFiles } = await exportSource();
  const { page, roadmap } = await exportFiles(FIXTURE, { private: true });
  for (const word of [...PRIVATE, ...DAYS]) expect(roadmap, word).toContain(word);
  const { icons, ...rest } = JSON.parse(roadmap);
  expect(rest).toEqual(JSON.parse(FIXTURE));
  expect(Object.keys(icons.icons)).toEqual(expect.arrayContaining(['cash', 'coin', 'ghost', 'receipt']));
  expect(JSON.parse(heldIn(page) ?? ''), 'the page holds the whole roadmap too').toEqual(JSON.parse(roadmap));
  // where everything is private, it all goes out
  const all = await exportFiles(JSON.stringify({ title: 'All mine', branches: [{ name: 'Mine', private: true, items: [{ id: 'a', name: 'A' }] }] }), { private: true });
  expect(JSON.parse(all.roadmap).branches[0].name).toBe('Mine');
});

test('no text of the roadmap can end the copy the page holds', async () => {
  const { exportFiles } = await exportSource();
  const title = '</script><script>window.ran = 1</script>';
  const names = ['Ends </SCRIPT > here', 'Opens <!--<script> here', 'Ends </roadmapper-view> here'];
  const tricky = JSON.stringify({ title, about: 'A "quote", <tags> & more', branches: [{ name: 'Main', items: names.map((name, i) => ({ id: `n${i}`, name })) }] });
  for (const text of [FIXTURE, tricky]) {
    const { page, roadmap } = await exportFiles(text);
    // the copy is roadmap.json, whole, with each "<" as <
    expect(JSON.parse(heldIn(page) ?? '')).toEqual(JSON.parse(roadmap));
    // the tags of the page are its own: the lib, the copy, and the tag that holds it, each once
    expect(page.match(/<\/?(script|roadmapper-view)\b/gi)).toEqual(['<script', '</script', '<roadmapper-view', '<script', '</script', '</roadmapper-view']);
    expect(page).not.toContain('<!--<');
  }
  const { page } = await exportFiles(tricky);
  // the title and the about line stay text in the head
  expect(page).toContain('<title>&lt;/script&gt;&lt;script&gt;window.ran = 1&lt;/script&gt; · roadmap</title>');
  expect(page).toContain('<meta name="description" content="A &quot;quote&quot;, &lt;tags&gt; &amp; more">');
});
