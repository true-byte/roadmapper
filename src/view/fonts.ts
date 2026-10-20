// The fonts: a name is wrapped by how wide the theme's font draws it. The web fonts the theme names are put on the page once.
import type { ViewContext } from './context.js';
import type { Fonts, TextKind } from './plan.js';
import { el } from './svg.js';

/** The widths a set of fonts gives, to tell when a font that has loaded changes them. */
export const look = (f: Fonts): string => (['label', 'bold', 'cap', 'gname'] as TextKind[]).map(k => f.width('Roadmap step name 0/9', k).toFixed(2)).join(' ') + ` ${f.line}`;

/** The theme names the web fonts it draws in, as the address of their style sheet in --fonts. They are put on the page once, where every view can use them:
 * a font named only inside a shadow root does not load. */
export function fontsOf(host: HTMLElement): void {
  const sheet = getComputedStyle(host).getPropertyValue('--fonts').trim().replace(/^["']|["']$/g, '');
  if (!sheet || [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].some(l => l.href === sheet)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = sheet;
  document.head.append(link);
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
  // a web font of the theme that loads after a draw: the names are measured and wrapped again, at the same level, scale and place, with the same pick
  document.fonts?.addEventListener('loadingdone', () => {
    if (ctx.plan && ctx.shown && look(measure()) !== ctx.measured) ctx.paint(ctx.shown);
  }, once);

  return { measure };
}

export type FontsPart = ReturnType<typeof fontsPart>;
