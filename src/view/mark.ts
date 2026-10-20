// The mark of a state: the circle of one state on its own, as the key, the side bar, the tip and the lists draw it.
import type { State } from '../roadmap/types.js';
import { el, SVG_NS } from './svg.js';

/** The radius of the circle of a state. */
const R = 7;

// the sign inside the circle of a state, as a path from the middle of the node; the other states are told by the ring alone
const SIGN: Partial<Record<State, string>> = {
  done: 'm -3.3 0.4 l 2.3 2.3 l 4.2 -4.8',
  blocked: 'm -3.4 0 h 6.8',
  canceled: 'm -2.6 -2.6 l 5.2 5.2 m 0 -5.2 l -5.2 5.2',
};

/** Draws the circle of one state on its own, around its middle. The colors come from the state's class. */
export function drawMark(state: State): SVGSVGElement {
  const half = R + 2;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'mark');
  svg.setAttribute('viewBox', `${-half} ${-half} ${2 * half} ${2 * half}`);
  svg.setAttribute('width', String(2 * half));
  svg.setAttribute('height', String(2 * half));
  svg.setAttribute('aria-hidden', 'true');
  const g = el(svg, 'g', { class: `node ${state}` });
  el(g, 'circle', { class: 'ring', cx: 0, cy: 0, r: R });
  if (state === 'in-progress') el(g, 'circle', { class: 'dot', cx: 0, cy: 0, r: 3 });
  const sign = SIGN[state];
  if (sign) el(g, 'path', { class: 'sign', d: `M 0 0 ${sign}` });
  return svg;
}
