// What a piece is on the screen: its line, its box or its point, from its numbers in the layout it is in; and a line as points, for the turn from one layout to the other.
// They use nothing of one view.
import type { Kind } from './layout.js';
import { clamp, r2 } from './math.js';

// ---- what a piece is on the screen: built from its numbers, along and across, in the layout it is in ----

/** A line on the screen as the moves that draw it: M to a point, L straight to one, Q and C round to one by their control points. */
export type Move = ['M' | 'L', number, number] | ['Q', number, number, number, number] | ['C', number, number, number, number, number, number];

export type Corner = { lane: number; far: number };

/** The line of a piece. Across, along runs to the right and every bend is one curve. Down, along runs down: the tracks of a group bend in one curve,
 * and the branches of a branching in a comb, a run across in the middle of its length with a round corner at each end. Every comb of a lane has the same corner where it leaves the lane, or comes back to it. */
export function lineOf(t: Kind, v: number[], turned: boolean, corner: Corner): Move[] {
  const P = (a: number, c: number): [number, number] => (turned ? [c, a] : [a, c]);
  const bend = (a0: number, c0: number, a1: number, c1: number, curve: boolean, laneFirst: boolean): Move[] => {
    if (!turned || curve) {
      const m = (a0 + a1) / 2;
      return [['C', ...P(m, c0), ...P(m, c1), ...P(a1, c1)]];
    }
    const am = (a0 + a1) / 2, half = Math.max(0, (a1 - a0) / 2), d = Math.sign(c1 - c0), dist = Math.abs(c1 - c0);
    if (dist < 0.5) return [['L', ...P(a1, c1)]];
    const rl = Math.min(corner.lane, dist / 2, half), rf = Math.min(corner.far, dist - rl, half);
    const r0 = laneFirst ? rl : rf, r1 = laneFirst ? rf : rl;
    return [['L', ...P(am - r0, c0)], ['Q', ...P(am, c0), ...P(am, c0 + d * r0)], ['L', ...P(am, c1 - d * r1)], ['Q', ...P(am, c1), ...P(am + r1, c1)], ['L', ...P(a1, c1)]];
  };
  if (t === 'seg') return [['M', ...P(v[0], v[2])], ['L', ...P(v[1], v[2])]];
  if (t === 'fan') return [['M', ...P(v[0], v[1])], ...bend(v[0], v[1], v[2], v[3], v[5] > 0.5, true), ['L', ...P(v[4], v[3])]];
  return [['M', ...P(v[0], v[1])], ['L', ...P(v[2], v[1])], ...bend(v[2], v[1], v[3], v[4], v[5] > 0.5, false)];
}

export const pathOf = (ms: Move[]): string =>
  ms.map(m => (m[0] === 'Q' ? `Q ${r2(m[1])} ${r2(m[2])}, ${r2(m[3])} ${r2(m[4])}` : m[0] === 'C' ? `C ${r2(m[1])} ${r2(m[2])}, ${r2(m[3])} ${r2(m[4])}, ${r2(m[5])} ${r2(m[6])}` : `${m[0]} ${r2(m[1])} ${r2(m[2])}`)).join(' ');

export interface Rect { x: number; y: number; w: number; h: number }

/** The box of a pill or a frame. Across, a pill lies centred on its line; down, it lies across its line, the mark of its state on the line. */
export function rectOf(t: 'bar' | 'frame' | 'rule', v: number[], turned: boolean): Rect {
  if (t === 'frame' || t === 'rule') return turned ? { x: v[2], y: v[0], w: Math.max(0, v[3] - v[2]), h: Math.max(0, v[1] - v[0]) } : { x: v[0], y: v[2], w: Math.max(0, v[1] - v[0]), h: Math.max(0, v[3] - v[2]) };
  return turned ? { x: v[2] - v[4], y: v[0], w: Math.max(0, v[3]), h: Math.max(0, v[1] - v[0]) } : { x: v[0], y: v[2] - v[3] / 2, w: Math.max(0, v[1] - v[0]), h: v[3] };
}

/** Where a text, or what a pill holds, sits on the screen. */
export const pointOf = (v: number[], turned: boolean): [number, number] => (turned ? [v[1], v[0]] : [v[0], v[1]]);

/** A line with no length draws nothing: its round end would be a dot. */
export const isDot = (t: Kind, v: number[]): boolean => (t === 'seg' && Math.abs(v[1] - v[0]) < 0.5) || (t === 'join' && Math.abs(v[3] - v[0]) < 0.5);

// ---- the turn: what is round or a box glides from where it is across to where it is down; a line turns into the other point by point; the names go and come ----

/** How many points a line is drawn by while it turns. */
const TURN_POINTS = 32;

/** A line as TURN_POINTS points the same distance apart along it, x then y of each. */
export function points(ms: Move[]): number[] {
  const xs: number[] = [], ys: number[] = [];
  let x = 0, y = 0;
  for (const m of ms) {
    if (m[0] === 'M' || m[0] === 'L') {
      x = m[1]; y = m[2];
      xs.push(x); ys.push(y);
      continue;
    }
    // a curve, in short straight steps
    const c = m.slice(1) as number[], n = 16;
    for (let i = 1; i <= n; i++) {
      const s = i / n, r = 1 - s;
      if (m[0] === 'Q') {
        xs.push(r * r * x + 2 * r * s * c[0] + s * s * c[2]);
        ys.push(r * r * y + 2 * r * s * c[1] + s * s * c[3]);
      } else {
        xs.push(r * r * r * x + 3 * r * r * s * c[0] + 3 * r * s * s * c[2] + s * s * s * c[4]);
        ys.push(r * r * r * y + 3 * r * r * s * c[1] + 3 * r * s * s * c[3] + s * s * s * c[5]);
      }
    }
    x = c[c.length - 2]; y = c[c.length - 1];
  }
  const acc = [0];
  for (let i = 1; i < xs.length; i++) acc.push(acc[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  const total = acc[acc.length - 1], out: number[] = [];
  let j = 0;
  for (let i = 0; i < TURN_POINTS; i++) {
    const want = (total * i) / (TURN_POINTS - 1);
    while (j < acc.length - 2 && acc[j + 1] < want) j++;
    const run = acc[j + 1] - acc[j], s = run > 0 ? clamp((want - acc[j]) / run, 0, 1) : 0;
    out.push(xs[j] + (xs[j + 1] - xs[j]) * s, ys[j] + (ys[j + 1] - ys[j]) * s);
  }
  return out;
}
