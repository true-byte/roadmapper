// The theme: the view takes its shadows from the theme's variables and its sizes from view.css, so a new theme can change them with no change to the code.
// No color is written outside the theme, so each color has its light and its dark value in one place.
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { caption, expect, openPlan, settle, test } from './helpers';
import { full } from './plans';

/** What may stand where a color goes, and is not one: no color of its own, or the color the element already has. */
const NOT_A_COLOR = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert', 'none']);
/** The colors of the browser by name, which are also the names of tags and classes in the code, such as 'canvas' and 'mark': a text of the code that is one of them is not looked at. */
const SYSTEM = new Set(['canvas', 'canvastext', 'linktext', 'visitedtext', 'activetext', 'buttonface', 'buttontext', 'buttonborder', 'field', 'fieldtext', 'highlight', 'highlighttext',
  'selecteditem', 'selecteditemtext', 'mark', 'marktext', 'graytext', 'accentcolor', 'accentcolortext']);

test('no color is written outside the theme: the view, the lib, the app, the export and the icons hold no hex color, no color function and no color by name', async ({ page }) => {
  const src = new URL('../src/', import.meta.url);
  const files = (readdirSync(src, { recursive: true }) as string[]).filter(f => /\.(ts|css|html)$/.test(f) && !f.startsWith('themes/'));
  expect(files).toContain('view/view.css');
  const found: string[] = [], words = new Map<string, string>();
  for (const f of files) {
    const text = readFileSync(new URL(f, src), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    for (const m of text.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|light-dark)\(/gi)) found.push(`${f}: ${m[0]}`);
    // a color by name: a word of a value in CSS, or in the code a text in quotes or backticks that is one word, the value of a property in a text, such as 'fill: red',
    // or the value of an attribute in the markup of a text, such as stroke="red", except a class or an id
    const values = f.endsWith('.css')
      ? [...text.matchAll(/[a-z-]+\s*:\s*([^;{}]+)/g)].flatMap(m => m[1].match(/(?<![\w-])[a-z]+(?![\w-])/gi) ?? [])
      : [...text.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].flatMap(m => {
        const t = m[1] ?? m[2] ?? m[3];
        return [...(SYSTEM.has(t.toLowerCase()) ? [] : [t]), ...[...t.matchAll(/[a-z-]+\s*:\s*([a-z]+)/gi)].map(v => v[1]),
          ...[...t.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].filter(v => !/^(class|id)$/i.test(v[1])).map(v => v[2] ?? v[3])];
      });
    for (const w of values) if (/^[a-z]+$/i.test(w) && !NOT_A_COLOR.has(w.toLowerCase())) words.set(w.toLowerCase(), f);
  }
  const named = await page.evaluate(ws => ws.filter(w => CSS.supports('color', w)), [...words.keys()]);
  found.push(...named.map(w => `${words.get(w)}: ${w}`));
  expect(found).toEqual([]);
});

test('the theme sets the shadows of the zoom control, the side bar and the tip, and the size of the name of a branch, at every level', async ({ page }) => {
  await openPlan(page, full, { store: null });

  await test.step('the theme sets the shadows of the zoom control, the side bar and the tip', async () => {
    await page.addStyleTag({ content: ':root { --shadow: none; --tip-shadow: none; }' });
    await page.locator('svg.plan g.zn[data-id="plan"]').click();
    await page.locator('svg.plan g.zn[data-id="kickoff"]').hover();
    for (const part of ['.zoom', '.side', '.tip']) await expect(page.locator(`.roadmap ${part}`), part).toHaveCSS('box-shadow', 'none');
  });

  await test.step('the theme sets the size of the name of a branch, at every level', async () => {
    await page.addStyleTag({ content: '.cap { font-size: 20px; }' });
    await expect(caption(page, 'Main')).toHaveCSS('font-size', '20px');
    await page.keyboard.press('+');
    await settle(page);
    await expect(caption(page, 'Quad')).toHaveCSS('font-size', '20px');
  });
});
