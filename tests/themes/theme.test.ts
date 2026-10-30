// No color is written outside the theme, so each color has its light and its dark value in one place, src/themes/.
// The view, the lib, the app, the export and the icons hold no hex color, no color function and no color by name.
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** What may stand where a color goes, and is not one: no color of its own, or the color the element already has. */
const NOT_A_COLOR = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert', 'none']);
/** The colors of the browser by name, which are also the names of tags and classes in the code, such as 'canvas' and 'mark': a text of the code that is one of them is not looked at. */
const SYSTEM = new Set(['canvas', 'canvastext', 'linktext', 'visitedtext', 'activetext', 'buttonface', 'buttontext', 'buttonborder', 'field', 'fieldtext', 'highlight', 'highlighttext',
  'selecteditem', 'selecteditemtext', 'mark', 'marktext', 'graytext', 'accentcolor', 'accentcolortext']);
/** Every color by name that CSS takes, as Chromium does: the named colors of CSS Color 4, its system colors, and the system colors it keeps from CSS 2. */
const NAMED = new Set([
  ...`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral
cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick
floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender
lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid
mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy
oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple
rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/),
  ...SYSTEM,
  ...`activeborder activecaption appworkspace background buttonhighlight buttonshadow captiontext inactiveborder inactivecaption inactivecaptiontext
infobackground infotext menu menutext scrollbar threeddarkshadow threedface threedhighlight threedlightshadow threedshadow window windowframe windowtext`.split(/\s+/),
]);

test('no file outside the theme writes a color', () => {
  const src = new URL('../../src/', import.meta.url);
  const files = (readdirSync(src, { recursive: true }) as string[]).filter(f => /\.(ts|css|html)$/.test(f) && !f.startsWith('themes/'));
  expect(files).toContain('view/view.css');
  const found: string[] = [];
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
    for (const w of values) if (/^[a-z]+$/i.test(w) && !NOT_A_COLOR.has(w.toLowerCase()) && NAMED.has(w.toLowerCase())) found.push(`${f}: ${w}`);
  }
  expect(found).toEqual([]);
});
