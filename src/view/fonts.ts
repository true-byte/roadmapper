// The fonts: a name is wrapped by how wide the theme's font draws it. The fonts of the theme are put on the page once.
import type { ViewContext } from './context.js';
import type { Fonts, TextKind } from './plan.js';
import { el } from './svg.js';

/** The widths a set of fonts gives, to tell when a font that has loaded changes them. */
export const look = (f: Fonts): string => (['label', 'bold', 'cap', 'gname'] as TextKind[]).map(k => f.width('Roadmap step name 0/9', k).toFixed(2)).join(' ') + ` ${f.line}`;

/** A face of a font of the theme, with the address of its file, as the module 'virtual:theme-fonts' gives it (src/themes/fonts.ts). */
export interface Face {
  family: string;
  style: string;
  weight: string;
  display: string;
  unicodeRange: string;
  url: string;
}

/** Puts the faces of the fonts of the theme on the page once, where every view can use them: a font named only inside a shadow root does not load.
 * Each file comes from the folder fonts/ next to Roadmapper's own files, when a text on the page first needs its letters.
 * A face the page already has, by its family, style, weight and letters, is not put on again, as for a second view or a second copy of the lib. */
export function fontsOf(faces: Face[]): void {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  const key = (f: FontFace): string => [f.family.replace(/^["']|["']$/g, ''), f.style, f.weight, f.unicodeRange].join('|');
  const has = new Set<string>();
  document.fonts.forEach(f => has.add(key(f)));
  for (const { family, url, ...descriptors } of faces) {
    const face = new FontFace(family, `url(${JSON.stringify(url)}) format("woff2")`, descriptors as FontFaceDescriptors);
    if (has.has(key(face))) continue;
    has.add(key(face));
    document.fonts.add(face);
  }
}

export function fontsPart(ctx: ViewContext) {
  const { once, svg } = ctx;

  const pen = document.createElement('canvas').getContext('2d');
  /** Measures each kind of text in the font the theme sets on it: read off a text of that kind on the plan. */
  function measure(): Fonts {
    const kinds: Record<TextKind, string> = { label: 'label', bold: 'label milestone', cap: 'cap', gname: 'gname' };
    const looks = new Map<TextKind, { font: string; gap: number; upper: boolean; px: number }>();
    for (const kind of Object.keys(kinds) as TextKind[]) {
      const t = el(svg, 'text', { class: kinds[kind] }), s = getComputedStyle(t);
      looks.set(kind, { font: `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, gap: parseFloat(s.letterSpacing) || 0, upper: s.textTransform === 'uppercase', px: parseFloat(s.fontSize) || 13 });
      t.remove();
    }
    const known = new Map<string, number>(), px = looks.get('label')!.px;
    return {
      width(text: string, kind: TextKind): number {
        const key = `${kind}:${text}`;
        let w = known.get(key);
        if (w === undefined) {
          const look = looks.get(kind)!, t = look.upper ? text.toUpperCase() : text;
          if (pen) pen.font = look.font;
          // the spacing of the letters comes after each of them, as the plan draws it
          w = (pen ? pen.measureText(t).width : t.length * look.px * 0.6) + look.gap * [...t].length;
          known.set(key, w);
        }
        return w;
      },
      // 16 from line to line, and 10 for the letters over the line, for a name of 13
      line: (px * 16) / 13,
      top: (px * 10) / 13,
    };
  }
  // a font of the theme that loads after a draw: the names are measured and wrapped again, at the same level, scale and place, with the same pick
  document.fonts?.addEventListener('loadingdone', () => {
    if (ctx.plan && ctx.shown && look(measure()) !== ctx.measured) ctx.paint(ctx.shown);
  }, once);

  return { measure };
}

export type FontsPart = ReturnType<typeof fontsPart>;
