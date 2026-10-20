// What the tip and the side bar show at their top: the name of a step, a group or a branch, with the icon of a step, and its facts in a row.
import { STATE_NAME } from '../roadmap/types.js';
import type { ViewContext } from './context.js';
import { html } from './dom.js';
import { drawMark } from './mark.js';
import { count, counted, done, isBranch, isStep, sum, type TNode, type Thing } from './plan.js';
import { SVG_NS } from './svg.js';

/** The state of a step or of a group, a milestone and a private item, as small facts in one row. */
export function facts(t: Thing): HTMLElement {
  const row = html('div', 'facts');
  if (!isBranch(t)) {
    const state = isStep(t) ? t.state : sum(t), st = html('span', `fact ${state}`);
    st.append(drawMark(state), STATE_NAME[state]);
    row.append(st);
    if (isStep(t) && t.milestone) row.append(html('span', 'fact tag', 'Milestone'));
  }
  if (!isStep(t)) {
    // how far the branch or the group is, as a bar and in words
    const bar = html('span', 'meter');
    bar.style.setProperty('--done', `${Math.round((100 * done(t)) / Math.max(1, counted(t)))}%`);
    row.append(bar, html('span', 'fact', count(t)));
  }
  if (t.secret) row.append(html('span', 'fact tag', 'Private'));
  return row;
}

export function factsPart(ctx: ViewContext) {
  const { ICON_BOX } = ctx;

  /** A step as a small picture: its icon. */
  function face(n: TNode, size: number): SVGElement {
    const e = document.createElementNS(SVG_NS, 'svg');
    e.setAttribute('class', `face ic ${n.state}`);
    e.setAttribute('viewBox', `0 0 ${ICON_BOX} ${ICON_BOX}`);
    e.setAttribute('width', String(size)); e.setAttribute('height', String(size));
    e.setAttribute('aria-hidden', 'true');
    e.innerHTML = n.icon ?? '';
    return e;
  }
  /** The name of a step, a group or a branch, with the icon of a step that has one. */
  function heading(t: Thing, tag: 'strong' | 'h2', size: number): HTMLElement {
    const top = html('div', isBranch(t) ? 'name branch' : 'name');
    if (isStep(t) && t.icon) top.append(face(t, size));
    top.append(html(tag, '', isStep(t) ? t.node.name : t.name ?? 'Branch'));
    return top;
  }

  return { heading };
}

export type FactsPart = ReturnType<typeof factsPart>;
