// The plan as the view draws it at rest, worked out in Node from the numbers of its layout: where each text, step, pill, frame and line is.
// And the checks of a plan as drawn: what clashes on it, and how far a name is from its own step and from the lane over it.
import { tabler } from '../../src/icons/tabler';
import type { Roadmap } from '../../src/roadmap/types';
import { READ } from '../../src/view/frame';
import { AURA, C, COIN, F, IC, PILL, layouts, pillW, tallyW, type Layout } from '../../src/view/layout';
import { count, levelName, readPlan, tally, type Fonts, type Plan, type TextKind, type TNode } from '../../src/view/plan';
import { isDot, lineOf, pointOf, rectOf, type Move } from '../../src/view/shapes';

// ---- the fonts: the width of each letter as the fallback fonts draw it, offline, as a part of the size of the font ----

const EM: Record<string, number> = {};
for (const [w, cs] of [
  [0.191, "'"], [0.222, 'ijl'], [0.278, 'ftI .,:;/!'], [0.333, 'r()-'], [0.5, 'cksvxyzJ'], [0.556, 'abdeghnopquL0123456789'], [0.611, 'FTZ'],
  [0.667, 'ABEKPSVXY'], [0.722, 'wCDHNRU'], [0.778, 'GOQ'], [0.833, 'mM'], [0.944, 'W'], [1, '…'],
] as const) for (const c of cs) EM[c] = w;
const em = (s: string): number => [...s].reduce((w, c) => w + (EM[c] ?? 0.556), 0);
/** Of each kind of text: the size of its font, how much wider its weight draws, and the spacing after each letter. The name of a branch is in capitals. */
const LOOK: Record<TextKind, { px: number; bold: number; gap: number }> = {
  label: { px: 13, bold: 1, gap: 0 }, bold: { px: 13, bold: 1.07, gap: 0 }, gname: { px: 13, bold: 1.07, gap: 0 }, cap: { px: 12, bold: 1.05, gap: 1.68 },
};
/** A stand-in for the fonts the view measures in the page: a width for each letter, close to what the fallback fonts draw. */
export const FONTS: Fonts = {
  width(s, kind) {
    const { px, bold, gap } = LOOK[kind], t = kind === 'cap' ? s.toUpperCase() : s;
    return px * bold * em(t) + gap * [...t].length;
  },
  line: 16,
  top: 10,
};
/** How wide the count of a top-level branch is drawn, at 11.5 px. */
const countW = (s: string): number => 11.5 * em(s);
/** How wide the count in a pill is drawn, at 12 px in bold. */
const digitsW = (s: string): number => 12 * 1.07 * em(s);

/** A roadmap read as the view reads it: with the icons of the set the theme names, in the stand-in fonts, and with a finished top-level branch hidden, as at first. */
export const planOf = (roadmap: Roadmap, shows: (tag: string, done: boolean) => boolean = (_, done) => !done): Plan => readPlan(roadmap, tabler.art, FONTS, shows);
/** The names of the levels of a plan, from far to close. */
export const levelsOf = (plan: Plan): string[] => Array.from({ length: plan.K + 1 }, (_, k) => levelName(plan.K, k));

/** Each layout of a plan: with the labels shown and hidden, across and down, in each view, at each level. */
export function* everyLayout(plan: Plan): Generator<{ where: string; L: Layout; bare: boolean; flow: 'h' | 'v'; view: number; k: number }> {
  for (const bare of [false, true]) {
    const sets = layouts(plan, bare);
    for (const flow of ['h', 'v'] as const) {
      for (const [view, levels] of sets[flow].entries()) for (const [k, L] of levels.entries()) {
        const where = `${flow === 'h' ? 'Horizontal' : 'Vertical'}, ${plan.hasIcons && view ? 'icons' : 'marks'}, '${levelName(plan.K, k)}'${bare ? ', labels hidden' : ''}`;
        yield { where, L, bare, flow, view, k };
      }
    }
  }
}

// ---- the plan as drawn ----

/** A box on the plan, in its units: from x0 to x1 across the page and from y0 to y1 down it. */
export interface Box { x0: number; y0: number; x1: number; y1: number }
/** A text that shows: what it is, as a fault names it; whose it is, so the lines of one name are one; its words; and its box,
 * across its letters and from the top of its capitals to under its baseline. */
export interface Text extends Box { k: string; who: string; text: string }
/** A step, a group as one step, or what a pill holds: its box, as drawn. `id` is the id of a step, or the key of a group or of a track. */
export interface Thing extends Box { k: string; id: string; text?: string }
/** The body of a step, which a line runs through only at its middle: its coin, or else its mark with the ring of a milestone. */
export interface Body { k: string; x: number; y: number; r: number }
/** A line, as a point every STEP along it: x, y and how far along it each point is. n is its length. */
export interface Line { k: string; pts: [number, number, number][]; n: number }
export interface Drawn {
  texts: Text[];
  things: Thing[];
  frames: (Box & { name: string })[];
  bodies: Body[];
  lines: Line[];
  /** Every word the plan draws, the counts in its pills too. */
  words: string[];
}

// a text, from the top of its capitals to under its baseline, by its class
const INK: Record<'label' | 'cap' | 'gname' | 'count', [number, number]> = { label: [10, 3.2], cap: [8.6, 0.5], gname: [9.5, 3], count: [8.4, 2.6] };
/** The box the font of a name of 13 px gives, from its baseline, as the page measures a text: Arial's ascent and descent. */
const FONT_BOX: [number, number] = [11.8, 2.8];
/** The box of the mark of a state, from its middle: its circle of radius 7, and 2 more (mark.ts). */
const MARK = 9;
/** How far apart the points of a line are, and the run at each end where a line meets what it starts or ends at: 2 px and 3 px at reading size. */
const STEP = 2 / READ, END = 3 / READ;

const square = (cx: number, cy: number, h: number): Box => ({ x0: cx - h, y0: cy - h, x1: cx + h, y1: cy + h });
const union = (bs: Box[]): Box => ({ x0: Math.min(...bs.map(b => b.x0)), y0: Math.min(...bs.map(b => b.y0)), x1: Math.max(...bs.map(b => b.x1)), y1: Math.max(...bs.map(b => b.y1)) });
/** A box drawn k times its size around (x, y). */
const placed = (b: Box, x: number, y: number, k: number): Box => ({ x0: x + k * b.x0, y0: y + k * b.y0, x1: x + k * b.x1, y1: y + k * b.y1 });

/** A line by its moves, as the points the checks look at. */
export function line(k: string, moves: Move[]): Line {
  // the moves in short straight runs, a curve in 24
  const xy: [number, number][] = [];
  let x = 0, y = 0;
  for (const m of moves) {
    if (m[0] === 'M' || m[0] === 'L') {
      [x, y] = [m[1], m[2]];
      xy.push([x, y]);
      continue;
    }
    const c = m.slice(1) as number[];
    for (let i = 1; i <= 24; i++) {
      const s = i / 24, r = 1 - s;
      xy.push(m[0] === 'Q'
        ? [r * r * x + 2 * r * s * c[0] + s * s * c[2], r * r * y + 2 * r * s * c[1] + s * s * c[3]]
        : [r * r * r * x + 3 * r * r * s * c[0] + 3 * r * s * s * c[2] + s * s * s * c[4], r * r * r * y + 3 * r * r * s * c[1] + 3 * r * s * s * c[3] + s * s * s * c[5]]);
    }
    [x, y] = [c[c.length - 2], c[c.length - 1]];
  }
  const acc = [0];
  for (let i = 1; i < xy.length; i++) acc.push(acc[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
  const n = acc[acc.length - 1], pts: [number, number, number][] = [];
  let j = 0;
  const at = (s: number): [number, number, number] => {
    while (j < acc.length - 2 && acc[j + 1] < s) j++;
    const run = acc[j + 1] - acc[j], t = run > 0 ? Math.min(1, Math.max(0, (s - acc[j]) / run)) : 0;
    return xy.length < 2 ? [xy[0][0], xy[0][1], 0] : [xy[j][0] + (xy[j + 1][0] - xy[j][0]) * t, xy[j][1] + (xy[j + 1][1] - xy[j][1]) * t, s];
  };
  for (let s = 0; s < n; s += STEP) pts.push(at(s));
  pts.push(at(n));
  return { k, pts, n };
}

/** The plan at a layout at rest, as frame() draws it: what shows, and where. Without `lines`, no line: a check that needs none runs faster. */
export function drawnOf(plan: Plan, L: Layout, lines = true): Drawn {
  // from one line of a name to the next, and how far under the middle of a line its baseline is, down
  const { fonts } = plan, lineH = fonts.line, low = (0.32 * lineH * 13) / 16;
  const d: Drawn = { texts: [], things: [], frames: [], bodies: [], lines: [], words: [] };
  const text = (cls: keyof typeof INK, who: string, s: string, x0: number, w: number, y: number): void => {
    d.texts.push({ k: `${cls} '${s}'`, who: `${cls}:${who}`, text: s, x0, x1: x0 + w, y0: y - INK[cls][0], y1: y + INK[cls][1] });
    d.words.push(s);
  };
  /** The lines of the name of a step or a group: across over it, centred, the last line nearest it; down right of it, the lines centred on it. */
  const name = (who: string, lines: string[], vlines: string[], kind: TextKind, x: number, y: number, fy: number): void => {
    if (!L.turned) lines.forEach((s, i) => { const w = fonts.width(s, kind); text('label', who, s, x - w / 2, w, y - fy - (lines.length - 1 - i) * lineH); });
    else vlines.forEach((s, i) => text('label', who, s, x + fy, fonts.width(s, kind), y + (i - (vlines.length - 1) / 2) * lineH + low));
  };

  for (const n of plan.all) {
    const id = n.node.id, g = L.geo.get(id)!;
    if (g.o < 0.5) continue;
    const { box, body } = stepShape(n, g.ic, g.coin), b = placed(body, g.x, g.y, g.k);
    d.things.push({ k: `the step ${id}`, id, ...placed(box, g.x, g.y, g.k) });
    d.bodies.push({ k: `the step ${id}`, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, r: Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 });
    if (g.m > 0.99) name(id, n.lines, n.vlines, n.milestone ? 'bold' : 'label', g.x, g.y, g.fy);
  }
  for (const sp of plan.pods) {
    const p = L.pods.get(sp.key)!;
    if (p.o < 0.5) continue;
    // its body is its whole size; the mark of its state sits at its edge, `at` right and down from the middle, ms times the size of a mark
    const r = p.hw / p.k, box = union([square(0, 0, r), square(p.at, p.at, MARK * p.ms)]);
    d.things.push({ k: `the step ${sp.key}`, id: sp.key, ...placed(box, p.x, p.y, p.k) });
    d.bodies.push({ k: `the step ${sp.key}`, x: p.x, y: p.y, r: p.hw });
    if (p.m > 0.99) name(sp.key, sp.lines, sp.vlines, 'label', p.x, p.y, p.fy);
  }
  for (const [key, p] of L.pieces) {
    if (p.o < 0.5) continue;
    const b = p.of;
    if (p.t === 'cap' || p.t === 'gname' || p.t === 'txt') {
      const [x, y] = pointOf(p.v, L.turned);
      if (p.t === 'cap') text('cap', b.key, b.cap!, x, fonts.width(b.cap!, 'cap'), y);
      else if (p.t === 'gname') text('gname', plan.byPod.has(p.sp!.key) ? p.sp!.key : p.sp!.gname, p.sp!.gname, x, fonts.width(p.sp!.gname, 'gname'), y);
      else text('count', b.key, count(b), x, countW(count(b)), y);
    } else if (p.t === 'frame') {
      const r = rectOf('frame', p.v, L.turned);
      d.frames.push({ name: p.sp!.name, x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h });
    } else if (p.t === 'tally') {
      // the mark of the state of the track, and its count where the names are written, drawn BK times their size; the count is 12 px, its baseline 4 under the middle
      const [x, y] = pointOf(p.v, L.turned), parts = [square(p.v[3], 0, MARK * PILL.MARK)], s = tally(b);
      if (p.v[4] > 0.5) {
        const mid = PILL.IN + 2 * C.R * PILL.MARK + PILL.GAP + tallyW(b) / 2 - pillW(b) / 2, w = digitsW(s);
        parts.push({ x0: mid - w / 2, x1: mid + w / 2, y0: 4 - 10.9, y1: 4 + 2.5 });
        d.words.push(s);
      }
      d.things.push({ k: `the step ${b.key}`, id: b.key, text: s, ...placed(union(parts), x, y, p.v[2]) });
    } else if (lines && (p.t === 'seg' || p.t === 'fan' || p.t === 'join') && !isDot(p.t, p.v)) {
      d.lines.push(line(`the line ${key}`, lineOf(p.t, p.v, L.turned, L.corner)));
    }
  }
  return d;
}

/** A step as frame() draws it, around its middle at the size of a mark, where on is 1 if it is drawn as its icon and coin 1 if it is a coin:
 * the box of all it draws, its body, which is its coin or else its mark with the ring of a milestone, and its mark alone. */
function stepShape(n: TNode, on: number, coin: number): { box: Box; body: Box; coin: boolean; mark: Box } {
  const icon = !!n.icon, ms = n.milestone, isCoin = icon && coin >= 0.01;
  const ring = icon ? F.RING + (IC.RING - F.RING) * on + (COIN.BIG - IC.RING) * coin : F.RING;
  // the ring that lights, the body of a coin, the ring of a milestone, and the clear disc behind an icon
  const rs = [ms ? ring : C.R + AURA + (icon ? (IC.HOT + (COIN.R - IC.HOT) * coin - C.R - AURA) * on : 0)];
  if (isCoin) rs.push(ms ? COIN.BIG : COIN.R);
  if (ms) rs.push(ring);
  if (icon && on >= 0.01) rs.push(IC.BACK * (0.5 + 0.5 * on) * (ms ? 1 + (COIN.GROW - 1) * coin : 1));
  // the mark of the state: small at the bottom right where the step is drawn as its icon
  const at = icon ? (IC.AT + ((ms ? COIN.BIG : COIN.R) * COIN.ON - IC.AT) * coin) * on : 0, mark = square(at, at, MARK * (icon ? 1 - (1 - IC.MARK) * on : 1));
  const body = isCoin ? square(0, 0, ms ? COIN.BIG : COIN.R) : ms ? union([mark, square(0, 0, ring)]) : mark;
  return { box: union([square(0, 0, Math.max(...rs)), mark]), body, coin: isCoin, mark };
}

// ---- the check ----

const on = (a: Box, b: Box, pad = 0.5): boolean => a.x0 < b.x1 - pad && b.x0 < a.x1 - pad && a.y0 < b.y1 - pad && b.y0 < a.y1 - pad;

/** A grid of cells over the plan, each with the points or pieces of lines in it, so a check looks only near a point.
 * Each is one number: the line, times 2^16, and its point, or the piece from that point to the next. */
class Grid {
  readonly cells = new Map<number, number[]>();
  constructor(readonly size: number) {}
  key = (cx: number, cy: number): number => (cx + 4096) * 8192 + (cy + 4096);
  add(x0: number, y0: number, x1: number, y1: number, t: number): void {
    for (let cx = Math.floor(x0 / this.size); cx <= Math.floor(x1 / this.size); cx++) for (let cy = Math.floor(y0 / this.size); cy <= Math.floor(y1 / this.size); cy++) {
      const k = this.key(cx, cy), c = this.cells.get(k);
      if (c) c.push(t);
      else this.cells.set(k, [t]);
    }
  }
  /** What lies in the cells a box touches, each once. */
  near(b: Box): Set<number> {
    const out = new Set<number>();
    for (let cx = Math.floor(b.x0 / this.size); cx <= Math.floor(b.x1 / this.size); cx++) for (let cy = Math.floor(b.y0 / this.size); cy <= Math.floor(b.y1 / this.size); cy++) for (const t of this.cells.get(this.key(cx, cy)) ?? []) out.add(t);
    return out;
  }
}
const LINE = 65536;

/** What is wrong with a plan as drawn: a line that crosses another, a line through a text, a line through a step other than the lane it sits on,
 * and a text on another, on a step, on a pill or across the edge of a frame. Two lines that lie on each other, as at a shared corner, do not cross. */
export function faults(d: Drawn): string[] {
  const out: string[] = [];
  d.texts.forEach((a, i) => {
    for (const b of d.texts.slice(i + 1)) if (a.who !== b.who && on(a, b)) out.push(`${a.k} on ${b.k}`);
    for (const s of d.things) if (on(a, s)) out.push(`${a.k} on ${s.k}`);
    for (const f of d.frames) {
      const across = (a.x0 < f.x0 && a.x1 > f.x0) || (a.x0 < f.x1 && a.x1 > f.x1), down = (a.y0 < f.y0 && a.y1 > f.y0) || (a.y0 < f.y1 && a.y1 > f.y1);
      if ((across && a.y1 > f.y0 && a.y0 < f.y1) || (down && a.x1 > f.x0 && a.x0 < f.x1)) out.push(`${a.k} across the edge of a frame`);
    }
  });

  // each point of each line, and each piece between two points, in a grid
  const points = new Grid(6), pieces = new Grid(4);
  d.lines.forEach((l, i) => l.pts.forEach(([x, y], j) => {
    points.add(x, y, x, y, i * LINE + j);
    const q = l.pts[j + 1];
    if (q) pieces.add(Math.min(x, q[0]), Math.min(y, q[1]), Math.max(x, q[0]), Math.max(y, q[1]), i * LINE + j);
  }));
  const pt = (t: number): [number, number, number] => d.lines[Math.floor(t / LINE)].pts[t % LINE];
  const through = new Set<string>();
  for (const t of d.texts) {
    for (const p of points.near(t)) {
      const [x, y] = pt(p);
      if (x > t.x0 + 0.8 && x < t.x1 - 0.8 && y > t.y0 + 0.8 && y < t.y1 - 0.8) through.add(`${d.lines[Math.floor(p / LINE)].k} through ${t.k}`);
    }
  }
  // a line through a body, but for the lane it sits on, which runs through its middle, makes the branches seem to part or join at it
  for (const s of d.bodies) {
    const near = new Map<number, number>();
    for (const p of points.near({ x0: s.x - s.r, y0: s.y - s.r, x1: s.x + s.r, y1: s.y + s.r })) {
      const [x, y] = pt(p), i = Math.floor(p / LINE);
      near.set(i, Math.min(near.get(i) ?? Infinity, Math.hypot(x - s.x, y - s.y)));
    }
    for (const [i, n] of near) if (n > 1.5 && n < s.r - 1.5) through.add(`${d.lines[i].k} through ${s.k}`);
  }
  out.push(...through);

  /** The angle in degrees at which the piece p-q crosses the piece r-s; 0 where they do not cross. */
  const cross = (p: number[], q: number[], r: number[], s: number[]): number => {
    const dd = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
    if (Math.abs(dd) < 1e-9) return 0;
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / dd, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / dd;
    if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return 0;
    let a = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0]) - Math.atan2(s[1] - r[1], s[0] - r[0])) % Math.PI;
    a = Math.min(a, Math.PI - a);
    return (a * 180) / Math.PI;
  };
  const far = (p: number[], a: number[], b: number[]): number => {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  /** Do the points of the line P from its `from`-th to its `to`-th all lie on the line Q? */
  const along = (P: number, from: number, to: number, Q: number): boolean => {
    const ps = d.lines[P].pts, qs = d.lines[Q].pts;
    for (let m = Math.max(0, from); m <= Math.min(ps.length - 1, to); m++) {
      const [x, y] = ps[m];
      let best = Infinity;
      for (const p of pieces.near({ x0: x - 0.8, y0: y - 0.8, x1: x + 0.8, y1: y + 0.8 })) if (Math.floor(p / LINE) === Q) best = Math.min(best, far(ps[m], qs[p % LINE], qs[(p % LINE) + 1]));
      if (best > 0.8) return false;
    }
    return true;
  };
  // where a line comes onto another and runs on along it, or leaves it, the two only touch: on one side of the point the two are one line.
  // The points cut the curve that comes onto the other line, so the piece between two points seems to cross it there
  const touch = (A: number, a: number, B: number, b: number): boolean =>
    (along(A, a + 1, a + 4, B) && along(B, b + 1, b + 4, A)) || (along(A, a - 3, a, B) && along(B, b - 3, b, A));
  const lies = (P: number, i: number, Q: number): boolean => along(P, i - 3, i + 4, Q);
  // the pieces of two lines that cross, each pair looked at once: in the cell where the boxes of the two pieces start to meet. Not the run at each end of a line
  const hits = new Set<number>();
  for (const [cell, ts] of pieces.cells) {
    // a cell holds the pieces in the order of their lines: those of one line are not looked at against each other
    const n = ts.length, of = ts.map(t => Math.floor(t / LINE));
    if (of[0] === of[n - 1]) continue;
    const next = new Array<number>(n);
    for (let x = n - 1; x >= 0; x--) next[x] = x + 1 < n && of[x + 1] === of[x] ? next[x + 1] : x + 1;
    for (let x = 0; x < n; x++) {
      const A = of[x], a = ts[x] % LINE, LA = d.lines[A], p = LA.pts[a], q = LA.pts[a + 1];
      if (p[2] < END || q[2] > LA.n - END) continue;
      for (let y = next[x]; y < n; y++) {
        const B = of[y], b = ts[y] % LINE;
        if (hits.has(A * LINE + B)) continue;
        const LB = d.lines[B], r = LB.pts[b], s = LB.pts[b + 1];
        if (r[2] < END || s[2] > LB.n - END) continue;
        const x0 = Math.max(Math.min(p[0], q[0]), Math.min(r[0], s[0])), y0 = Math.max(Math.min(p[1], q[1]), Math.min(r[1], s[1]));
        if (x0 > Math.min(Math.max(p[0], q[0]), Math.max(r[0], s[0])) || y0 > Math.min(Math.max(p[1], q[1]), Math.max(r[1], s[1]))) continue;
        if (pieces.key(Math.floor(x0 / pieces.size), Math.floor(y0 / pieces.size)) !== cell) continue;
        if (cross(p, q, r, s) > 10 && !(lies(A, a, B) && lies(B, b, A)) && !touch(A, a, B, b)) hits.add(A * LINE + B);
      }
    }
  }
  for (const pair of [...hits].sort((p, q) => p - q)) out.push(`${d.lines[Math.floor(pair / LINE)].k} crosses ${d.lines[pair % LINE].k}`);
  return out;
}

/** Across, for each name of a step or of a group as one step: the room under it to its own step, and over it to the nearest step or pill of another lane.
 * The box of a name is the one the font gives; a body is its coin where it is a coin, or else its mark. */
export function rooms(plan: Plan, L: Layout): { k: string; under: number; over: number }[] {
  const d = drawnOf(plan, L, false), bodies = new Map<string, Box>();
  for (const n of plan.all) {
    const g = L.geo.get(n.node.id)!;
    if (g.o < 0.5) continue;
    const { body, coin, mark } = stepShape(n, g.ic, g.coin);
    bodies.set(n.node.id, placed(coin ? body : mark, g.x, g.y, g.k));
  }
  for (const sp of plan.pods) {
    const p = L.pods.get(sp.key)!;
    if (p.o >= 0.5) bodies.set(sp.key, { x0: p.x - p.hw, y0: p.y - p.hw, x1: p.x + p.hw, y1: p.y + p.hw });
  }
  for (const t of d.things) if (t.text !== undefined) bodies.set(`pill ${t.id}`, t);
  const names = new Map<string, Box>();
  for (const t of d.texts) {
    const who = t.who.slice('label:'.length);
    if (!t.who.startsWith('label:') || !bodies.has(who)) continue;
    // the baseline, and the box the font gives from it
    const y = t.y0 + INK.label[0], b = { x0: t.x0, x1: t.x1, y0: y - FONT_BOX[0], y1: y + FONT_BOX[1] }, was = names.get(who);
    names.set(who, was ? { x0: Math.min(was.x0, b.x0), y0: Math.min(was.y0, b.y0), x1: Math.max(was.x1, b.x1), y1: Math.max(was.y1, b.y1) } : b);
  }
  return [...names].map(([k, n]) => {
    const above = [...bodies].filter(([o, s]) => o !== k && s.x0 < n.x1 && n.x0 < s.x1 && s.y1 <= n.y0 + 0.5).map(([, s]) => n.y0 - s.y1);
    return { k, under: bodies.get(k)!.y0 - n.y1, over: Math.min(Infinity, ...above) };
  });
}
