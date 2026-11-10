// The fonts of the theme as the builds take them (src/themes/fonts.ts): the faces that fonts.css lists, their files and licenses in the folder fonts/,
// and how each build of the lib finds that folder next to itself. `npm test` builds the lib first.
/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { fontFiles, fontsFolder, readFaces, themeFaces } from '../../src/themes/fonts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LIB = join(ROOT, 'dist/lib');

test("fonts.css gives a woff2 file in fonts/ for each face, in only the weights the theme draws, with each font's license", () => {
  const faces = themeFaces();
  const weights = new Map<string, Set<string>>();
  for (const f of faces) weights.set(f.family, (weights.get(f.family) ?? new Set()).add(f.weight));
  expect(Object.fromEntries([...weights].map(([family, w]) => [family, [...w].sort()]))).toEqual({ 'Atkinson Hyperlegible': ['400', '700'], 'Chakra Petch': ['500', '600'] });
  expect(faces.every(f => f.style === 'normal' && f.display === 'swap')).toBe(true);
  // each file is a face, and each face has its file: none is missing, none ships for nothing
  const fonts = fontFiles().filter(f => f.endsWith('.woff2'));
  expect(faces.map(f => f.file).sort()).toEqual(fonts);
  for (const file of fonts) expect(readFileSync(join(fontsFolder(), file)).subarray(0, 4).toString('latin1'), file).toBe('wOF2');
  // the license text of each font, by the name of its files
  expect(fontFiles().filter(f => !f.endsWith('.woff2'))).toEqual(['atkinson-hyperlegible-OFL.txt', 'chakra-petch-OFL.txt']);
  for (const license of ['atkinson-hyperlegible-OFL.txt', 'chakra-petch-OFL.txt']) {
    expect(readFileSync(join(fontsFolder(), license), 'utf8'), license).toContain('This Font Software is licensed under the SIL Open Font License, Version 1.1.');
  }
});

test('a face of fonts.css takes only one woff2 file in fonts/', () => {
  const face = (src: string): string => `@font-face { font-family: "A"; font-weight: 500; src: ${src}; }`;
  expect(readFaces(face('url("fonts/a-b.woff2") format("woff2")'))).toEqual([{ family: 'A', style: 'normal', weight: '500', display: 'swap', unicodeRange: 'U+0-10FFFF', file: 'a-b.woff2' }]);
  expect(readFaces(`/* a note */ ${face("url('fonts/a.woff2') format('woff2')")}`).map(f => f.file)).toEqual(['a.woff2']);
  for (const src of ['url("https://fonts.gstatic.com/a.woff2") format("woff2")', 'url("a.woff2") format("woff2")', 'url("fonts/../a.woff2") format("woff2")',
    'url("fonts/a.ttf") format("truetype")', 'url("fonts/a.woff2") format("woff2"), url("fonts/a.woff") format("woff")', 'local("A")']) {
    expect(() => readFaces(face(src)), src).toThrow(/fonts\.css: each @font-face has a font-family and a src of one woff2 file in fonts\//);
  }
});

test('each build of the lib holds the folder fonts/ next to it, and finds it there', () => {
  expect(readdirSync(join(LIB, 'fonts')).sort()).toEqual(fontFiles());
  const files = themeFaces().map(f => f.file);
  const js = (name: string): string => readFileSync(join(LIB, name), 'utf8');
  // the module, for a bundler: each file by new URL(..., import.meta.url), which the bundler of an app follows and copies into the app, as a file of its own
  const module = readdirSync(LIB).filter(f => f.endsWith('.js') && !['roadmapper.js', 'roadmapper-page.js'].includes(f)).map(js).join('\n');
  for (const file of files) expect(module.split(`new URL("./fonts/${file}?no-inline", import.meta.url)`).length - 1, file).toBe(1);
  // the plain scripts: each file from where the script was loaded
  for (const script of ['roadmapper.js', 'roadmapper-page.js']) {
    expect(js(script), script).toContain('document.currentScript');
    for (const file of files) expect(js(script), `${script}: ${file}`).toContain(`fonts/${file}`);
  }
  // no font inside a script, and no font from another host, in the lib or in the app page
  for (const name of [...readdirSync(LIB).filter(f => f.endsWith('.js')).map(f => join(LIB, f)), join(ROOT, 'dist/cli/app.html')]) {
    expect(existsSync(name), name).toBe(true);
    const text = readFileSync(name, 'utf8');
    expect(text, name).not.toMatch(/data:font|fonts\.googleapis|fonts\.gstatic/);
  }
});
