// The plan as the view reads it: a tree of branches, with its steps, its groups and its branchings, and how far each part is.
// The file says `split` for a group and for a branching. A group is one item on its branch, with a name: tracks side by side that always come back together, or steps in a row.
// A split is a branching when it says so, or when one of its branches ends: a branching is where a branch parts into branches of their own, which come back together or end apart.
// Only a group closes. Zoomed all the way out, a branch shows its own steps, and each group on it as one step with a name. A branch is a line and never closes: where it parts, its branches show too.
// A top-level branch can be hidden: the plan then holds it and its steps only as what a shown step waits for.
import type { Branch, RoadNode, Roadmap, State } from '../roadmap/types.js';

export interface TNode {
  node: RoadNode;
  /** Its state: the one in the file, or 'blocked' while a step it waits for is not done, or private work the export left out. */
  state: State;
  owner: TBranch;
  /** The steps it waits for, as the file lists them. */
  waits: TNode[];
  /** A milestone has a ring around it, and a name in bold. */
  milestone: boolean;
  /** The drawing of its icon, if the plan names one that the icon set has. */
  icon?: string;
  /** Its name as the lines it is written on over the step. */
  lines: string[];
  /** Its name as the lines it is written on beside the step, in the vertical layout: as wide as the lane it is on allows (see vwidth()). */
  vlines: string[];
  /** Is it private, or in a private branch or group? */
  secret: boolean;
  /** Is its top-level branch hidden? Then it is not drawn, and only a shown step that waits for it names it. */
  hidden: boolean;
}
/** A split of the file: a group or a branching. */
export interface TSplit {
  key: string;
  /** A group: its branches are tracks. Or else a branching: its branches are branches of their own. */
  group: boolean;
  /** Of a group: its own name, or else the names of its tracks where they fit over a step, or else how many tracks it has. */
  name: string;
  /** Does the plan give it a name of its own? */
  named: boolean;
  /** Its name as one line over its frame, cut with "…" at GNAME_W. */
  gname: string;
  owner: TBranch;
  kids: TBranch[];
  joins: boolean;
  /** Every step in its branches, in reading order. */
  nodes: TNode[];
  /** Of a group: its name as the lines it is written on over the step that stands for it far out. */
  lines: string[];
  /** The same beside that step, in the vertical layout: as wide as the lane the group is on allows. */
  vlines: string[];
  /** Is it private, or in a private branch or group? */
  secret: boolean;
}
export interface TBranch {
  key: string;
  name?: string;
  /** Its name as one line on the plan, cut with "…" at CAP_W. */
  cap?: string;
  holds?: string;
  /** Is it private, or in a private branch or group? */
  secret: boolean;
  ends: boolean;
  /** 1 for a top-level branch, one more for each group above it. A branching adds none: its branches are as deep as the branch they leave. */
  depth: number;
  /** Does it hold a group, at any depth? Such a track stays open at 'Tracks'. */
  inner: boolean;
  parent?: TBranch;
  /** The outermost group that it is in: the one step that stands for it far out. */
  pod?: TSplit;
  items: (TNode | TSplit)[];
  /** Every step in the branch and in the branches under it, in reading order. */
  nodes: TNode[];
}
export const isKids = (it: TNode | TSplit | TBranch): it is TSplit => 'kids' in it;
/** What answers the pointer and can be picked: a step, a branch, or a group. */
export type Thing = TNode | TBranch | TSplit;
export const isStep = (t: Thing): t is TNode => 'node' in t;
export const isBranch = (t: Thing): t is TBranch => 'items' in t;
/** The one track of a group of steps in a row, with no name of its own: the group stands for it. */
export const sole = (b: TBranch): boolean => !b.name && !!b.pod && b.pod.kids.length === 1 && b.pod.kids[0] === b;

export interface Plan {
  roadmap: Roadmap;
  /** The top-level branches that show. */
  tops: TBranch[];
  /** Every step that shows, in reading order. */
  all: TNode[];
  byId: Map<string, TNode>;
  byKey: Map<string, TBranch>;
  /** The groups that are in no other group: each is one step far out. */
  pods: TSplit[];
  byPod: Map<string, TSplit>;
  /** Every top-level branch, shown or hidden, in the order of the file, each with the name its showing is kept under. */
  every: { top: TBranch; tag: string; shown: boolean }[];
  /** The last level. The levels run from 0, the main steps only, to K, every step. A plan with no group has one level. */
  K: number;
  /** Does any step name an icon that the set has? A plan with none is drawn with marks only. */
  hasIcons: boolean;
  /** How the theme draws the texts. */
  fonts: Fonts;
}

/** A text the plan says, or none for an empty one. */
export const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
/** A day of the file, as the page shows it. The file check has made sure it is a real day. */
export const day = (v: unknown): string | undefined => {
  const s = text(v);
  return s ? new Date(`${s}T00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined;
};

/** A text of the plan: the name of a step, of a milestone, of a branch, or of a group over its frame. */
export type TextKind = 'label' | 'bold' | 'cap' | 'gname';
/** The texts as the theme draws them, measured by the view in the theme's fonts, in the units of the plan. */
export interface Fonts {
  /** How wide a text is drawn. */
  width(s: string, kind: TextKind): number;
  /** From one line of a name to the next. */
  line: number;
  /** How far the letters of a name reach over the line they are written on. */
  top: number;
}

/** How wide a line of a name may be: the room between two steps, less a gap, so two names side by side never touch. */
export const NAME_W = 100;
/** A name is written on 3 lines at most. */
const LINES = 3;
/** How wide the name of a branch may be on the plan: the room of two names side by side. A longer name is cut with "…" on one line,
 * so it stretches the run before the branch's first step across, or its column down, no further than this. */
export const CAP_W = 2 * NAME_W;
/** How wide the name of a group may be over its frame: one line, cut with "…" past it. It fits over the frame of a group with one step on each track, across at 'Every step',
 * so a long name makes no such frame wider there. */
export const GNAME_W = 250;
/** The end of a text that is cut: "…", and never a space or a mark such as "," or ":" right before it. wrap() and cutLine() both cut this way. */
const cutEnd = (s: string): string => `${s.replace(/[\s,;:.\-–—]+$/u, '')}…`;
/** A name on one line no wider than `width`, cut with "…" where it is wider. The tip and the side bar keep the full name. */
export function cutLine(s: string, fonts: Fonts, kind: TextKind, width: number): string {
  const name = s.trim().replace(/\s+/g, ' ');
  if (fonts.width(name, kind) <= width) return name;
  let t = name;
  while (t.length > 1 && fonts.width(cutEnd(t), kind) > width) t = t.slice(0, -1);
  return cutEnd(t);
}

/** How wide a line of a name may be in the vertical layout, where the name sits beside its step: as wide as the room the lane it is on has to its right.
 * On a version's own lane the names have the room of the plan; a branch of a branching has the room between two columns, as across; a track of a group less. */
const NAME_V = { top: 232 / 1.2, branch: NAME_W, track: 80 };
/** The width a name in the vertical layout wraps to, by the lane it is on. */
const vwidth = (b: TBranch): number => (!b.parent ? NAME_V.top : b.depth > 1 ? NAME_V.track : NAME_V.branch);

/** A name as the lines it is written on, over its step: as few lines as it needs, each as wide as the others where it can be, none wider than `width`.
 * A word too wide for a line is broken in it. Only a name that needs more than 3 lines is cut, with "…" at the end of the last; the tip and the side bar keep the full name. */
export function wrap(s: string, fonts: Fonts, kind: TextKind = 'label', width = NAME_W): { lines: string[]; cut: boolean } {
  const w = (t: string): number => fonts.width(t, kind);
  const name = s.trim().replace(/\s+/g, ' ');
  if (w(name) <= width) return { lines: [name], cut: false };
  // the pieces a line is made of, each with what comes before it: a space between two words, nothing inside a word that is broken
  const bits: { t: string; gap: string }[] = [];
  for (const word of name.split(' ')) {
    let rest = word, gap = bits.length ? ' ' : '';
    while (w(rest) > width) {
      let n = rest.length - 1;
      while (n > 1 && w(rest.slice(0, n)) > width) n--;
      bits.push({ t: rest.slice(0, n), gap });
      rest = rest.slice(n); gap = '';
    }
    bits.push({ t: rest, gap });
  }
  const join = (from: number, to: number): string => bits.slice(from, to).map((b, i) => (i ? b.gap : '') + b.t).join('');
  // the fewest lines, and of those the split whose widest line is the narrowest
  let best: { m: number; lines: string[] } | null = null;
  for (let n = 2; n <= LINES && !best; n++) {
    const cuts = (start: number, left: number): number[][] =>
      left === 1 ? [[]] : Array.from({ length: Math.max(0, bits.length - start - left + 1) }, (_, i) => start + 1 + i).flatMap(c => cuts(c, left - 1).map(r => [c, ...r]));
    for (const c of cuts(0, n)) {
      const at = [0, ...c, bits.length], lines = at.slice(0, -1).map((a, i) => join(a, at[i + 1]));
      const m = Math.max(...lines.map(w));
      if (m <= width && (!best || m < best.m)) best = { m, lines };
    }
  }
  if (best) return { lines: best.lines, cut: false };
  // more than 3 lines: fill the first lines, and cut the last one where it gets too wide for its "…"
  const lines: string[] = [];
  let i = 0;
  while (lines.length < LINES - 1) {
    let j = i + 1;
    while (j < bits.length && w(join(i, j + 1)) <= width) j++;
    lines.push(join(i, j));
    i = j;
  }
  let last = join(i, bits.length);
  while (last.length > 1 && w(cutEnd(last)) > width) last = last.slice(0, -1);
  lines.push(cutEnd(last));
  return { lines, cut: true };
}

/** Is a top-level branch finished: are all its steps done or canceled? */
export const finished = (b: { nodes: TNode[] }): boolean => b.nodes.length > 0 && b.nodes.every(n => n.state === 'done' || n.state === 'canceled');
/** The name a top-level branch's showing is kept under: its name, where no other top-level branch has it, or else its place, as '#2'.
 * A name that starts with '#' takes its place too, so it never meets the place of another branch. */
export const tagOf = (roadmap: Roadmap, i: number): string => {
  const name = text(roadmap.branches[i].name);
  return name && !name.startsWith('#') && roadmap.branches.filter(b => text(b.name) === name).length === 1 ? name : `#${i + 1}`;
};

/** Reads a checked roadmap as a plan. `art` gives the drawing of an icon by its name; `fonts` measures its names as the theme draws them.
 * `shows` tells whether a top-level branch is shown, by its tag and whether it is finished; with none, all are. When it shows none, the last one shows. */
export function readPlan(roadmap: Roadmap, art: (name: string) => string | undefined, fonts: Fonts, shows?: (tag: string, done: boolean) => boolean): Plan {
  const byKey = new Map<string, TBranch>();
  const pods: TSplit[] = [];
  // what is in a private branch or group is private too
  function grow(b: Branch, key: string, depth: number, parent?: TBranch, pod?: TSplit, hidden = false): TBranch {
    const t: TBranch = { key, name: b.name, cap: b.name ? cutLine(b.name, fonts, 'cap', CAP_W) : undefined, holds: text(b.holds), secret: hidden || b.private === true, ends: !!b.ends, depth, inner: false, parent, pod, items: [], nodes: [] };
    byKey.set(key, t);
    b.items.forEach((it, i) => {
      if ('split' in it) {
        const group = it.branching !== true && it.split.every(c => !c.ends);
        const sp: TSplit = { key: `${key}.${i}`, group, name: '', named: false, gname: '', owner: t, kids: [], joins: false, nodes: [], lines: [], vlines: [], secret: t.secret || it.private === true };
        if (group && !pod) pods.push(sp);
        if (group) for (let a: TBranch | undefined = t; a; a = a.parent) a.inner = true;
        sp.kids = it.split.map((c, j) => grow(c, `${key}.${i}.${j}`, depth + (group ? 1 : 0), t, pod ?? (group ? sp : undefined), sp.secret));
        sp.joins = sp.kids.some(c => !c.ends);
        sp.nodes = sp.kids.flatMap(c => c.nodes);
        const own = text(it.name), list = sp.kids.map(c => c.name ?? '').join(', ');
        const fits = sp.kids.every(c => c.name) && !wrap(list, fonts).cut;
        sp.named = !!own;
        sp.name = own ?? (fits ? list : sp.kids.length > 1 ? `${sp.kids.length} tracks` : 'Group');
        sp.gname = cutLine(sp.name, fonts, 'gname', GNAME_W);
        sp.lines = wrap(sp.name, fonts).lines;
        // far out the group is one step on the lane of its owner
        sp.vlines = wrap(sp.name, fonts, 'label', vwidth(t)).lines;
        t.items.push(sp);
        t.nodes.push(...sp.nodes);
      } else {
        const name = text(it.icon);
        const milestone = it.milestone === true;
        const kind = milestone ? 'bold' : 'label';
        const n: TNode = { node: it, state: it.state ?? 'todo', owner: t, waits: [], milestone, icon: name ? art(name) : undefined, lines: wrap(it.name, fonts, kind).lines, vlines: wrap(it.name, fonts, kind, vwidth(t)).lines, secret: t.secret || it.private === true, hidden: false };
        t.items.push(n);
        t.nodes.push(n);
      }
    });
    return t;
  }

  const grown = roadmap.branches.map((b, i) => grow(b, `b${i}`, 1));
  const allSteps = grown.flatMap(t => t.nodes);
  const ids = new Map(allSteps.map(n => [n.node.id, n]));
  for (const n of allSteps) n.waits = (n.node.waitsFor ?? []).flatMap(id => ids.get(id) ?? []);
  // a step that waits for one not done is blocked by itself
  const held = allSteps.filter(n => n.state !== 'done' && n.state !== 'canceled' && (blockers(n).length || n.node.waitsForPrivate === true));
  for (const n of held) n.state = 'blocked';
  // the top-level branches that show; the rest stay in the plan only as what a shown step waits for
  const every = grown.map((top, i) => {
    const tag = tagOf(roadmap, i);
    return { top, tag, shown: shows ? shows(tag, finished(top)) : true };
  });
  if (!every.some(e => e.shown)) every[every.length - 1].shown = true;
  const off = new Set(every.filter(e => !e.shown).map(e => e.top.key));
  const topOf = (key: string): string => key.split('.')[0];
  for (const n of allSteps) n.hidden = off.has(topOf(n.owner.key));
  const tops = every.filter(e => e.shown).map(e => e.top);
  const all = tops.flatMap(t => t.nodes);
  const keys = new Map([...byKey].filter(([k]) => !off.has(topOf(k))));
  const shownPods = pods.filter(sp => !off.has(topOf(sp.key)));
  // A plan with a group has three levels, however deep its groups are: 'Main steps', 'Tracks' and 'Every step'. See shutAt().
  const deep = Math.max(...[...keys.values()].map(b => b.depth));
  return {
    roadmap,
    tops,
    all,
    byId: new Map(all.map(n => [n.node.id, n])),
    byKey: keys,
    pods: shownPods,
    byPod: new Map(shownPods.map(sp => [sp.key, sp])),
    every,
    K: deep > 1 ? 2 : 0,
    hasIcons: all.some(n => n.icon),
    fonts,
  };
}

/** The steps a step waits for that are not done yet. A canceled one blocks it no more. */
export const blockers = (n: TNode): TNode[] => n.waits.filter(w => w.state !== 'done' && w.state !== 'canceled');

// the middle level opens the groups into their tracks: branches show at every level, so they do not name it
export const levelName = (K: number, k: number): string => (k === K ? 'Every step' : k === 0 ? 'Main steps' : 'Tracks');
/** Is a track closed at level k, a pill on its line? At 'Tracks' every group is open, at every depth, and only a track that holds no group is a pill.
 * At 'Main steps' a group is one step, and at 'Every step' nothing is closed. A branch of a branching is never a track: it is open wherever the branch it leaves is. */
export const shutAt = (b: TBranch, k: number, K: number): boolean => k > 0 && k < K && isTrack(b) && !b.inner;

const left = (b: { nodes: TNode[] }): TNode[] => b.nodes.filter(n => n.state !== 'canceled');
/** How many steps are done, and how many are left to count: a canceled step does not count. */
export const done = (b: { nodes: TNode[] }): number => b.nodes.filter(n => n.state === 'done').length;
export const counted = (b: { nodes: TNode[] }): number => left(b).length;
export const count = (b: { nodes: TNode[] }): string => `${done(b)} of ${counted(b)} done`;
/** The same, short: what the pill of a closed track says. */
export const tally = (b: { nodes: TNode[] }): string => `${done(b)}/${counted(b)}`;
/** A track of a group: it is one deeper than the branch it is on, and it is what closes. */
export const isTrack = (b: TBranch): boolean => !!b.parent && b.depth > b.parent.depth;
/** The tracks around a branch, the nearest first: each closes into a pill. Only the pill of a closed track shows. */
export const tracksOf = (b?: TBranch): TBranch[] => {
  const out: TBranch[] = [];
  for (; b; b = b.parent) if (isTrack(b)) out.push(b);
  return out;
};
/** A group or a branch as one state: the state its steps share, in progress once any step has started, or else the nearest to a start. */
export function sum(b: { nodes: TNode[] }): State {
  const s = new Set(left(b).map(n => n.state));
  if (!s.size) return b.nodes.length ? 'canceled' : 'todo';
  if (s.size === 1) return [...s][0];
  if (s.has('done') || s.has('in-progress')) return 'in-progress';
  return s.has('todo') ? 'todo' : 'blocked';
}
