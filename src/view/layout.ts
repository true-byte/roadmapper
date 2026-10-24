// Where everything of a plan sits, at each zoom level and in each of the two views: every step as its mark, or the steps as their icons.
// An open group is a soft frame around all that is in it, with its name over its top left corner.
// One zoom in from the main steps, a group opens into its tracks. A closed track is a line with one pill on it, which says how far the track is: the mark of its state, and how many of its steps are done.
// Each level after that opens the groups one layer deeper.
// Each of these comes in two layouts: across, where the lines run to the right and the names sit over the steps, and down, where the lines run down and the names sit right of the steps.
// Both are laid out by the same code, in terms of along a line and across it; across, along is x, and down, along is y.
import { count, isKids, isTrack, shutAt, tally, type Plan, type TBranch, type TextKind, type TNode, type TSplit } from './plan.js';

// ---- sizing: the numbers of an open branch, and a few more for a closed one ----

export const C = { DX: 112, STUB: 48, CSTUB: 40, HU: 50, GAP: 12, ROW: 28, R: 7, HALF: 50, PADL: 20, PADR: 70, PADT: 14, PADB: 22 };
// The frame of an open group: IN how far after the lane parts it starts, and how far before the lane is whole again it ends; PAD and LOW its room over and under what it holds;
// NAME the room for its name over it; SHUT the run between its edge and a pill that lies on the lane; RX its round corners.
export const FR = { IN: 8, PAD: 8, LOW: 8, NAME: 20, SHUT: 24, RX: 16 };
/** The widest a curve between two lanes gets. */
const CURVE_MAX = 130;
// Each view has a size set that holds all its own numbers. Of C and FR, the layout reads only what every view shares: C.R, the radius of a mark, and FR.SHUT.
// Of a closed track: BH how high its pill is, BK how big the mark and the count in it are drawn, DOWN the room below it and UP the room for the name above it.
// SIZE is how big a step is, against the size of a mark, while it waits unseen in its pill or in its group. CSTUB is the short run before and after a closed track.
// Of a step in an open branch: OPEN its size, NAME how far over it its name is written, HU the least room over its lane and HD the least room below it.
// ROWS is the room between two top-level branches.
// Of a group that is one step: PR its radius on the page, PNAME how far over it its name is written, PMARK the size of the mark of its state against the step.
// IC is 1 in the view with icons. words is 1 where the names are written, and 0 where the labels are hidden.
// DX the pitch from one step to the next, STUB the run from a step to where the lane parts and from where it is whole again, OSTUB the run before and after an open track; LGAP the room between two lanes, more where the names are written, so a name lies far nearer its own step than the step over it; HALF the room kept after branches that end beside a lane.
// PADL, PADR, PADT and PADB the room around the plan. CMS and CMO the least length of a curve to a closed track and to an open one, CMAX the most.
// AIR the room over a body with no name over it. FIN, FPAD, FLOW and FNAME are the IN, PAD, LOW and NAME of the frame of a group.
// CAPS how long a pill with no count is, before BK sizes it. TAP the radius of the clear disc that takes a finger, around a step or a group that is not a coin.
const MARKS = {
  SIZE: 5 / 7, BH: 20, BK: 1, DOWN: 14, UP: 28, CSTUB: 10, ROWS: C.ROW, OPEN: 1, NAME: 16, HU: C.HU, HD: 14, PR: 10, PNAME: 16, PMARK: 5 / 7,
  IC: 0, words: 1, DX: C.DX, STUB: C.STUB, OSTUB: C.CSTUB, LGAP: 22, HALF: C.HALF, PADL: C.PADL, PADR: C.PADR, PADT: C.PADT, PADB: C.PADB,
  CMS: 50, CMO: 70, CMAX: CURVE_MAX, AIR: 4, FIN: FR.IN, FPAD: FR.PAD, FLOW: FR.LOW, FNAME: FR.NAME, CAPS: 26, TAP: 0,
};
// An icon needs more room to be read, so the view with icons has its own numbers.
const ICONS = { ...MARKS, IC: 1, SIZE: 1.3, BH: 24, BK: 1.2, DOWN: 16, UP: 30, ROWS: 22, OPEN: 1.5, NAME: 30, HU: 40, HD: 24, PR: 20, PNAME: 30, PMARK: 0.5, LGAP: 24 };
// With the labels hidden no word is drawn but the names of the versions, so nothing keeps room for one: each view lies on a tight grid of its own.
// With icons, 56 from step to step, a coin and the room after it; with marks, 44, a mark with the disc a finger hits. A closed track is a short capsule, and a frame has no name over it.
const MARKS_B = { ...MARKS, words: 0, LGAP: C.GAP, BH: 16, DOWN: 12, UP: 12, ROWS: 16, HU: 16, HD: 16, PNAME: 0, DX: 44, STUB: 18, OSTUB: 14, HALF: 20, PADL: 16, PADR: 18, PADT: 12, PADB: 12, CMS: 24, CMO: 30, CMAX: 70, FPAD: 6, FLOW: 6, FNAME: 0, TAP: 18 };
const ICONS_B = { ...ICONS, words: 0, LGAP: C.GAP, BH: 20, DOWN: 14, UP: 14, ROWS: 20, HU: 22, HD: 22, PNAME: 0, DX: 56, STUB: 26, OSTUB: 22, HALF: 30, PADL: 16, PADR: 24, PADT: 14, PADB: 14, CMS: 30, CMO: 40, CMAX: 90, FPAD: 6, FLOW: 6, FNAME: 0, TAP: 18 };
type Sizes = typeof MARKS;
// The layout down has numbers of its own. Along is down the page, across is to the right.
// PITCH from one step to the next, at least; NGAP the least room between the names of two steps one under the other. NX how far right of its line the name of a step starts, HU the least room left of a line.
// STUB the run from the last step to where the lane parts, and from where it is whole again to the next step; RSTUB the same around the one track of a group of steps in a row. COMB how long the lane takes to part into the branches of a branching, or to come back from them.
// LEAD the run from there to the first step of a branch, with the branch's name on it, its baseline CAPB down the run and CX right of the line; CAPGAP the least room between that name and the name of the first step.
// TLEAD and TCAPB the same before a closed track, and SHUT the run after its pill. GAP the room between two branches side by side; HANG how far right of its lane the first branch of a split hangs.
// FL and FRR the room of a frame left of its lane and right of what it holds; GN the room for the name of a group over its frame, and GNB how far over the frame the name sits.
// SMIN and SMAX how long the curves of the tracks of a group are, at least and at most. HALF the room kept after branches that end beside a lane.
// TAIL the run after the last step of a version, BANDS the room between two versions, PADL, PADR, PADT and PADB the room around the plan.
const VI = { PITCH: 200 / 3, NGAP: 25 / 3, NX: 85 / 3, HU: 20, STUB: 40, RSTUB: 40, COMB: 40, LEAD: 140 / 3, CAPB: 55 / 3, CX: 10, CAPGAP: 6, TLEAD: 80 / 3, TCAPB: 17.5, SHUT: 10, GAP: 20, HANG: 80 / 3, FL: 40 / 3, FRR: 10, GN: 15, GNB: 20 / 3, SMIN: 30, SMAX: 50, HALF: 40, TAIL: 20, BANDS: 40, PADL: 20 / 3, PADR: 40 / 3, PADT: 20 / 3, PADB: 20 };
const VM = { ...VI, PITCH: 50, NX: 50 / 3, HU: 10, STUB: 30, LEAD: 110 / 3, HANG: 50 / 3 };
// With the labels hidden, down too: 56 or 44 from step to step, and no room for a name right of a line or on the run before a branch.
const VI_B = { ...VI, PITCH: 56, GAP: 16, STUB: 26, COMB: 30, LEAD: 30, TLEAD: 20, SHUT: 8, HANG: 16, FL: 8, FRR: 8, GN: 0, GNB: 0, SMIN: 24, SMAX: 36, HALF: 24, TAIL: 14, BANDS: 28, PADR: 20 / 3, PADB: 14 };
const VM_B = { ...VM, PITCH: 44, HU: 14, GAP: 16, STUB: 18, COMB: 24, LEAD: 24, TLEAD: 16, SHUT: 6, HANG: 14, FL: 6, FRR: 6, GN: 0, GNB: 0, SMIN: 18, SMAX: 28, HALF: 18, TAIL: 10, BANDS: 20, PADB: 10 };
type Turn = typeof VI;
// An icon in a step drawn at the size of a mark: SIZE its box, RING the ring of a milestone around it, BACK the clear disc that takes the pointer between the lines of the drawing.
// The mark of the state gets small and moves AT right and AT down from the middle, MARK times its size.
// HOT is the ring that lights around an icon.
export const IC = { SIZE: 16, RING: 12, BACK: 11.4, AT: 8, MARK: 0.5, HOT: 12 };
/** How far the ring that lights around a mark stands off it. A milestone lights its own ring. */
export const AURA = 3.5;
// In an open branch a step with an icon is a coin: a round body with the icon on it, so the step is big enough to point at, and its own edge is the ring that lights.
// Against the size of a mark: R the body, BIG the body of a milestone, whose icon is GROW times bigger. The mark of the state sits on the edge, ON times the radius right and down.
// LIFT is how much higher the name of a milestone is written, and AIR the room between a coin and the next thing below it.
export const COIN = { R: 40 / 3, BIG: 16, GROW: 7 / 6, ON: 0.7, LIFT: 4, AIR: 4 };
// What a pill holds, before BK sizes it: IN from its left end to the mark of the state, which is MARK times the size of a mark; GAP from the mark to the count; END after the count.
// DIGIT and BAR are the widths of a digit and of the stroke between the two numbers: counted, since the font may not be loaded yet.
export const PILL = { IN: 5, MARK: 5 / 7, GAP: 5, END: 8, DIGIT: 7.2, BAR: 5 };
/** How wide the count in a pill is, and how long the pill is, both before BK sizes them. */
export const tallyW = (b: TBranch): number => (tally(b).length - 1) * PILL.DIGIT + PILL.BAR;
export const pillW = (b: TBranch): number => PILL.IN + 2 * C.R * PILL.MARK + PILL.GAP + tallyW(b) + PILL.END;
// A milestone has a ring of radius RING around its mark.
export const F = { RING: 10.5 };

/** A step: its mark around (x, y), drawn k times the size of a mark. m is 1 in an open branch, where its name is written fy over it (down: fy right of it), and 0 where the labels are hidden. ic is 1 where the step is drawn as its icon, and coin 1 where it is a coin. o is 0 where the step is not drawn: it waits in the middle of the pill of its closed track, or far out in the middle of the step that stands for its group, and m is 0 there.
 * tap is the radius of the clear disc around it that takes a finger, where the labels are hidden and it is not a coin; 0 elsewhere. */
export interface Geo {
  x: number;
  y: number;
  k: number;
  m: number;
  fy: number;
  ic: number;
  coin: number;
  o: number;
  tap: number;
}
/** A group as one step: a round body around (x, y), hw wide from its middle along its lane and drawn k times the size of a mark, with its name fy over it (down: fy right of it); m is 1 where the name is written, and 0 where the labels are hidden. o is 1 far out, where it is drawn, and 0 at the levels that draw its tracks. The mark of its state is ms times the size of a mark, at right and at down from the middle. ic is 1 where the drawing of what it holds is on it. tap is a step's. */
export interface Pod {
  x: number;
  y: number;
  hw: number;
  k: number;
  m: number;
  fy: number;
  o: number;
  ms: number;
  at: number;
  ic: number;
  tap: number;
}
// What each number of a piece is, so a hidden piece can be squashed onto a pill: x along, y across, or k for a number that is kept.
// The pieces are in terms of along and across in both layouts. The last k of a fan and a join is 1 where the layout down draws it as one curve (the tracks of a group), and 0 where it draws a comb (a branching).
// A bar is [from, to, line, how wide across, how far the line is from its edge]: across, it is as wide as it is high and lies centred on the line, so the last is 0 there.
// A tally is [x, y, how big, how far the mark of the state is right of the middle, how much the count shows]: with the labels hidden the mark is in the middle and the count is not drawn.
const AXES = { seg: 'xxy', bar: 'xxykk', tally: 'xykkk', fan: 'xyxyxk', join: 'xyxxyk', cap: 'xy', txt: 'xy', frame: 'xxyy', gname: 'xy' } as const;
export type Kind = keyof typeof AXES;
/** A line, a pill, what the pill holds, or a text of a branch: its numbers, and how much of it shows. */
export interface Piece {
  t: Kind;
  of: TBranch;
  name: string;
  v: number[];
  o: number;
  /** Of the frame of an open group, and of its name: the group. */
  sp?: TSplit;
}
export interface Layout {
  W: number;
  H: number;
  /** How big this level draws on the page. */
  s: number;
  /** The pitch from one step to the next on a lane: across DX, down PITCH. */
  dx: number;
  /** Is this the layout down? Its steps and groups as one step are where they are on the page; its pieces, ext and bands are in terms of along (y) and across (x). */
  turned: boolean;
  /** Down: the round corners of a comb, where a branching parts or comes back. Its run across sits in the middle of its length, so `far` is half of that length;
   * at the lane it leaves or comes back to, every comb of that lane shares the same corner, `lane`, so they lie on each other there. 0 across. */
  corner: { lane: number; far: number };
  geo: Map<string, Geo>;
  /** Each group that is in no other group, as one step. */
  pods: Map<string, Pod>;
  pieces: Map<string, Piece>;
  /** Where each drawn branch runs: from, to, along; and where across. */
  ext: Map<string, [number, number, number]>;
  /** The band of each top-level branch, by its key: from its top to its bottom, across the lanes (down: along them). */
  bands: Map<string, [number, number]>;
}
/** The layouts of a plan, across and down: in each, one list of levels for each view. */
export interface Layouts {
  h: Layout[][];
  v: Layout[][];
}

interface NodeBox {
  n: TNode;
  x: number;
}
interface SplitBox {
  sp: TSplit;
  kids: Box[];
  x0: number;
  cap: number;
  maxW: number;
  joins: boolean;
  off: number[];
  curve: number;
  cstub: number;
  /** A group of steps in a row that is the last thing on its branch: the lane ends at its last step, as it would at a step. */
  ends: boolean;
  /** Of each branch: how far from kx its run ends before it comes back, and the curve it comes back in. cF is the curve of those that come back last. */
  jw: number[];
  jc: number[];
  cF: number;
  /** Down: how far right of the lane the lane of a branching runs, between its branches, from where the first branch comes back; off is from there. 0 across. */
  J: number;
  /** Down: the frame of a group, from its lane, left and right. */
  frL: number;
  frR: number;
  /** Down: the room over a group with a name, for its name. */
  gn: number;
}
/** A group as one step: it sits on the lane where a step would, x along it. */
interface PodBox {
  pod: TSplit;
  x: number;
}
interface Box {
  b: TBranch;
  closed: boolean;
  items: (NodeBox | SplitBox | PodBox)[];
  w: number;
  up: number;
  down: number;
}
const isSplitBox = (it: NodeBox | SplitBox | PodBox): it is SplitBox => 'kids' in it;
const isPodBox = (it: NodeBox | SplitBox | PodBox): it is PodBox => 'pod' in it;
/** How long the curve from a lane to a lane dy from it is, in the numbers of the set S: to a closed track, or to an open one. */
const curveW = (dy: number, shut: boolean, S: Sizes): number => Math.max(shut ? S.CMS : S.CMO, Math.min(S.CMAX, Math.round(dy * 0.5)));
/** Across: how far along its length c a curve that goes dy from its lane runs before it is h off the lane. The curve has both its handles at its middle, as the view draws it. */
function clearAt(c: number, dy: number, h: number): number {
  if (h >= dy) return c;
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2;
    if (dy * t * t * (3 - 2 * t) < h) lo = t;
    else hi = t;
  }
  return c * (1.5 * hi * (1 - hi) + hi * hi * hi);
}

/** Where the branches of a branching come back: each side of the lane, from the lane out, comes back as soon as nothing between it and the lane still runs.
 * w is how long each branch runs, off how far it is from the lane. Two joins on one side are never closer than a step and a curve, so no line crosses another.
 * S holds the numbers of the view. Down, T holds the numbers of that layout: the branches come back in a comb, and the lane between them is the one in the gap right of the first branch. */
function early(kids: Box[], w: number[], off: number[], maxW: number, shut: boolean, T: Turn | null, S: Sizes): { jw: number[]; jc: number[]; cF: number } {
  const jw = kids.map(() => maxW), jc = kids.map(() => 0);
  const gap = T ? T.GAP : S.LGAP, snap = T ? T.PITCH + T.COMB : S.DX + S.CMAX;
  // the lane runs on in the gap over the second branch, near its names: no branch comes back while a branch whose room the lane runs through still runs
  // a branch whose room ends right at the edge of that gap is not near: down, the lane runs exactly in the middle of the gap
  const near = kids.map((c, i) => off[i] - c.up < gap / 2 - 0.01 && off[i] + c.down > -gap / 2 + 0.01);
  const floor = Math.max(0, ...w.filter((_, i) => near[i]));
  for (const above of [true, false]) {
    const side = kids.map((_, i) => i).filter(i => off[i] < 0 === above);
    if (above) side.reverse();
    // the branches that run as far as each other, out from the lane, share a join
    const joins: { m: number; at: number[] }[] = [];
    let m = floor;
    for (const i of side) {
      m = Math.max(m, w[i]);
      const last = joins[joins.length - 1];
      if (last && last.m === m) last.at.push(i);
      else joins.push({ m, at: [i] });
    }
    let next = maxW;
    for (let g = joins.length - 1; g >= 0; g--) {
      const { m: mg, at } = joins[g];
      const x = next - mg < snap ? next : mg;
      const back = at.filter(i => !kids[i].b.ends);
      const curve = back.length ? (T ? T.COMB : curveW(Math.max(...back.map(i => Math.abs(off[i]))), shut, S)) : 0;
      for (const i of at) { jw[i] = x; jc[i] = curve; }
      next = x;
    }
  }
  let cF = Math.max(0, ...kids.map((c, i) => (!c.b.ends && jw[i] === maxW ? jc[i] : 0)));
  // down, the lane in the gap comes back in a comb of its own, where those that come back last do
  if (T && kids.some(c => !c.b.ends)) cF = T.COMB;
  return { jw, jc, cF };
}

/** The layouts of a plan: across and down, one for each level, in the view with marks, then, where the plan has icons, in the view with icons. All of them hold the same pieces and steps.
 * With `bare` the labels are hidden: the same pieces, steps and groups, laid out in the bare size sets, where no name takes room. */
export function layouts(plan: Plan, bare = false): Layouts {
  const { tops, byPod, K, fonts } = plan;
  /** The room for the name of a branch, measured in the theme's font, and a little after it. */
  const capW = (s?: string): number => (s ? Math.ceil(fonts.width(s, 'cap') + 18) : 0);
  /** The room over a lane for a name of so many lines, written `at` over the lane. */
  const nameUp = (at: number, lines: number): number => at + (lines - 1) * fonts.line + fonts.top;
  /** The numbers of the view that is being laid out. */
  let B: Sizes = MARKS;
  /** The numbers of the layout down, when that is the one being laid out. */
  let T: Turn | null = null;
  /** Is this step drawn as its icon in the view that is being laid out? */
  const iconed = (n: TNode): boolean => !!B.IC && !!n.icon;
  /** Is this step a coin in the view that is being laid out, when its branch is open? */
  const coined = iconed;
  /** How far over a step in an open branch its name is written. With icons, as far over its body as over a coin, so a step drawn as its mark keeps its name near. */
  const nameAt = (n: TNode): number => B.NAME + (B.IC ? radius(n) - COIN.R * B.OPEN : 0);
  const own = (b: TBranch): TNode[] => b.items.filter((it): it is TNode => !isKids(it));
  // An open branch takes the room that its own steps need: over the lane the highest name, which may have up to 3 lines; with icons, under it the biggest coin.
  // With the labels hidden, over the lane only the biggest body and a little air.
  const over = (b: TBranch): number => Math.max(B.HU, ...own(b).map(n => (B.words ? nameUp(nameAt(n), n.lines.length) : radius(n) + B.AIR)));
  const under = (b: TBranch): number => Math.max(B.HD, ...(B.IC ? own(b).map(n => (n.milestone && coined(n) ? COIN.BIG * B.OPEN + COIN.AIR : 0)) : []));

  // ---- down: a step's name is right of it, its lines centred on the step ----
  /** How far a name of so many lines reaches up and down from the middle of its step: half its lines, and the letters of the first over it and of the last under it. With the labels hidden there is no name. */
  const reach = (lines: number): number => (B.words ? ((lines - 1) * fonts.line) / 2 + (0.57 * fonts.line * 13) / 16 : 0);
  /** How big a step is in an open branch, from its middle. */
  const radius = (n: TNode): number => (coined(n) ? (n.milestone ? COIN.BIG : COIN.R) : n.milestone ? F.RING : C.R) * B.OPEN;
  /** How far from its middle the ring that lights a step when it is pointed at reaches: the edge of a coin, the ring of a milestone, or AURA off a mark. */
  const lit = (n: TNode): number => (coined(n) ? radius(n) : n.milestone ? F.RING * B.OPEN : (C.R + AURA) * B.OPEN);
  /** How far right of a step its name starts. */
  const nameX = (n: TNode): number => T!.NX + (n.milestone && coined(n) ? COIN.LIFT : 0);
  const widest = (lines: string[], kind: TextKind): number => Math.max(0, ...lines.map(l => fonts.width(l, kind)));
  /** How wide the name of a branch is drawn. */
  const capText = (s?: string): number => (s ? fonts.width(s, 'cap') : 0);
  /** The groups on a lane that are each one step: far out only. */
  const podsOn = (b: TBranch, k: number): TSplit[] => (k ? [] : b.items.filter((it): it is TSplit => isKids(it) && it.group));
  // An open branch takes the room its own steps need: left of the lane the biggest step, right of it the widest name, and its own name.
  // With the labels hidden, right of the lane too only the biggest step.
  const vleft = (b: TBranch, k: number): number => Math.max(T!.HU, ...own(b).map(radius), ...podsOn(b, k).map(() => B.PR));
  const vright = (b: TBranch, k: number): number =>
    !B.words
      ? vleft(b, k)
      : Math.max(T!.HU, ...own(b).map(n => nameX(n) + widest(n.vlines, n.milestone ? 'bold' : 'label')), ...podsOn(b, k).map(sp => T!.NX + widest(sp.vlines, 'label')), b.name ? T!.CX + capText(b.cap) : 0);
  /** How many lines the name of a thing on a lane has: none for a split. */
  const linesOf = (it?: NodeBox | SplitBox | PodBox): number => (!it || isSplitBox(it) ? 0 : isPodBox(it) ? it.pod.vlines.length : it.n.vlines.length);
  /** Down: how far the mark in a pill is from the pill's left end. The mark sits on the line, and the pill lies right of it. A pill with no count has its mark in its middle. */
  const markAt = (): number => (B.words ? (PILL.IN + C.R * PILL.MARK) * B.BK : (B.CAPS * B.BK) / 2);
  /** How long the pill of a closed track is, before BK sizes it: with the labels hidden it holds no count. */
  const pillLen = (b: TBranch): number => (B.words ? pillW(b) : B.CAPS);
  /** What a pill holds, as the last numbers of its tally: how far the mark of the state is right of the middle of the pill, and how much the count shows. */
  const holds = (b: TBranch): number[] => (B.words ? [PILL.IN + C.R * PILL.MARK - pillW(b) / 2, 1] : [0, 0]);

  /** Sizes a branch at level k. A closed track is one pill, with its name over it: see shutAt(). At level 0 each group is one step. */
  function measure(b: TBranch, k: number): Box {
    if (shutAt(b, k, K)) {
      // down, the pill lies across its line and its name is on the run before it; with the labels hidden it has no name
      if (T) return { b, closed: true, items: [], w: B.BH, up: markAt(), down: Math.max(pillLen(b) * B.BK - markAt(), B.words ? T.CX + capText(b.cap) : 0) };
      return { b, closed: true, items: [], w: pillLen(b) * B.BK, up: B.UP, down: B.DOWN };
    }
    let x = 0, anchored = false, pending = false, up = T ? vleft(b, k) : over(b), down = T ? vright(b, k) : under(b), right = 0;
    // down: the room the lane's own names take to its right; the lines of the last name on the lane and the radius of its body; and where the next step may start, after branches that part off beside the lane
    const laneR = down;
    let prev = 0, prevR = 0, floor = -Infinity;
    /** Across, with the labels hidden: where the last branches that all end part from the lane, how long their curve is and how far the nearest of them goes from the lane. */
    let parted: { at: number; c: number; d: number } | null = null;
    const items: (NodeBox | SplitBox | PodBox)[] = [];
    /** Moves x to the next step on the lane, of a name of so many lines and a body of radius r. Down, two names one under the other keep NGAP between them; with the labels hidden, two bodies do. */
    const next = (lines: number, r: number): void => {
      if (anchored && !pending) x += T ? Math.max(T.PITCH, (B.words ? reach(prev) + reach(lines) : prevR + r) + T.NGAP) : B.DX;
      if (!T) {
        // across, with the labels hidden, the step after branches that all end stays clear of the curves they part in (see below)
        if (parted) x = Math.max(x, Math.ceil(parted.at + clearAt(parted.c, parted.d, r + B.AIR) + r));
        parted = null;
        return;
      }
      x = Math.max(x, floor + Math.max(T.NGAP + reach(lines), r + T.NGAP));
      floor = -Infinity;
      prev = lines;
      prevR = r;
    };
    for (const it of b.items) {
      if (!isKids(it)) {
        next(it.vlines.length, radius(it));
        items.push({ n: it, x });
        anchored = true; pending = false;
        continue;
      }
      if (!k && it.group) {
        // it sits on the lane, where a step would
        next(it.vlines.length, B.PR);
        items.push({ pod: it, x });
        // the room over its middle for its name; with the labels hidden, for its body and a little air
        if (!T) { up = Math.max(up, B.words ? nameUp(B.PNAME, it.lines.length) : B.PR + B.AIR); down = Math.max(down, B.PR + COIN.AIR); }
        anchored = true; pending = false;
        continue;
      }
      const kids = it.kids.map(c => measure(c, k));
      // the tracks of a group stay closed until a level opens them; the branches of a branching are open at every level
      const shut = kids[0].closed;
      // a group of steps in a row stays on the lane: its one track runs where the lane would, and its steps keep the room of a step
      const inline = it.group && kids.length === 1;
      const cstub = T ? (shut ? T.SHUT + (inline ? B.FIN : 0) : inline ? T.RSTUB : T.STUB) : shut ? (inline ? FR.SHUT : B.CSTUB) : inline ? B.DX - B.STUB : B.OSTUB;
      const last = kids.length - 1;
      // down, the name of a branch is on the run before its first step, and that run is as long as the highest first name under it needs; a group of steps in a row has it inside its frame
      // with the labels hidden there is no name, and the run is LEAD
      const lead = !T ? 0 : (shut ? T.TLEAD : !B.words ? T.LEAD : Math.max(T.LEAD, T.CAPB + T.CAPGAP + Math.max(...kids.map(c => reach(linesOf(c.items[0])))))) + (inline ? B.FIN : 0);
      // the name of an open branch sits on its lead-in line; the name of a closed one sits above its pill and may be wider than it
      // with the labels hidden the run after the curve is a short one, and the one track of a group of steps in a row has none
      const cap = T ? lead - cstub : shut ? 0 : !B.words ? (inline ? 0 : 8) : Math.max(0, ...kids.map(c => capW(c.b.cap)));
      // with the labels hidden a closed track runs as long as its pill
      const runs = kids.map(c => (shut && !T && B.words ? Math.max(c.w, capW(c.b.cap) - 14) : c.w));
      let maxW = Math.max(...runs);
      // a side branch that ended earlier still hangs below this lane: start past it, so nothing lands on it
      x = Math.max(x, right);
      const x0 = x;
      anchored = true;
      const STUB = T ? T.STUB : B.STUB, gn = T && it.group && it.named ? T.GN : 0;
      if (it.joins) {
        // stack the branches, then put the lane in the gap nearest the middle, so no branch sits on the lane itself
        const gap = T ? T.GAP : B.LGAP;
        const c = [0];
        for (let i = 1; i < kids.length; i++) c[i] = c[i - 1] + kids[i - 1].down + gap + kids[i].up;
        let rel = inline ? 0 : kids[0].down + B.LGAP + 24;
        // down, the branches hang right of the lane in columns: the tracks of a group from HANG on, and a branching's lane runs in the gap right of its first branch
        if (T) rel = inline ? 0 : it.group ? -T.HANG : c[0] + kids[0].down + T.GAP / 2;
        // a branching puts its lane under its first branch, so the lane before it stays near the branch above; the rest hang below
        else if (!it.group && kids.length > 1) rel = (c[0] + c[1]) / 2;
        else if (kids.length > 1) {
          const mid = c[last] / 2;
          let best = Infinity;
          for (let i = 1; i < c.length; i++) {
            const m = (c[i - 1] + c[i]) / 2, d = Math.abs(m - mid);
            if (d < best) { best = d; rel = m; }
          }
        }
        const off = c.map(v => v - rel);
        // down, a branching parts from the lane it leaves, and its first branch hangs HANG right of it
        const J = T && !it.group ? T.HANG - off[0] : 0;
        const curve = inline ? 0 : T ? (it.group ? Math.max(T.SMIN, Math.min(T.SMAX, 0.5 * off[last])) : T.COMB) : curveW(Math.max(-off[0], off[last]), shut, B);
        // the frame of a named group is as wide as its name over it needs; with the labels hidden it has no name
        if (!T && B.words && it.group && it.named) maxW = Math.max(maxW, Math.ceil(fonts.width(it.gname, 'gname')) + 16 + 2 * B.FIN - 2 * curve - cap - 2 * cstub);
        const ends = inline && it === b.items[b.items.length - 1];
        // the tracks of a group come back together at its end; the branches of a branching come back as soon as they can
        const { jw, jc, cF } = it.group ? { jw: kids.map(() => maxW), jc: kids.map(() => curve), cF: curve } : early(kids, runs, off, maxW, shut, T, B);
        x = x0 + STUB + gn + curve + cap + cstub + maxW + (ends ? 0 : cstub + cF + STUB);
        // the frame of a group runs on past its last step
        if (ends) right = Math.max(right, T ? x + cstub - B.FIN : x + cstub - B.FIN - B.HALF);
        pending = true;
        let frL = 0, frR = 0;
        if (T) {
          // down, a group has its frame around it, from a little left of its lane to a little right of the widest thing in it, and as wide as its name over it; with the labels hidden it has no name
          const lo = Math.min(...kids.map((c, i) => J + off[i] - c.up)), hi = Math.max(...kids.map((c, i) => J + off[i] + c.down));
          if (it.group) {
            frL = Math.min(-T.FL, lo - B.FPAD);
            frR = Math.max(hi + T.FRR, it.named && B.words ? T.CX + fonts.width(it.gname, 'gname') + T.FRR : 0);
            up = Math.max(up, -frL); down = Math.max(down, frR);
          } else { up = Math.max(up, -lo); down = Math.max(down, hi); }
        } else {
          // a group has its frame around it, and its name over the frame
          const fr = it.group ? 1 : 0;
          up = Math.max(up, kids[0].up - off[0] + fr * (B.FPAD + (it.named ? B.FNAME : 0))); down = Math.max(down, off[last] + kids[last].down + fr * B.FLOW);
        }
        items.push({ sp: it, kids, x0, cap, maxW, joins: true, off, curve, cstub, ends, jw, jc, cF, J, frL, frR, gn });
      } else {
        // branches that all end hang below the lane; the lane itself carries on. Down they hang right of the lane's own names.
        let o = T ? laneR + T.GAP : B.HD + B.LGAP;
        const off: number[] = [];
        for (const c of kids) { o += c.up; off.push(o); o += c.down + (T ? T.GAP : B.LGAP); }
        const curve = T ? T.COMB : curveW(off[last], shut, B);
        right = Math.max(right, x0 + STUB + curve + cap + cstub + maxW + (T ? T.HALF : B.HALF));
        down = Math.max(down, o - (T ? T.GAP : B.LGAP));
        // down, the comb they part in runs across the lane's names: the next step on the lane comes after it.
        // Across, with the labels hidden, the pitch is shorter than the run to where they part and their curve: the next step's body starts where the nearest curve is AIR clear of it
        if (T) floor = x0 + STUB + curve / 2;
        else if (!B.words) parted = { at: x0 + STUB, c: curve, d: off[0] };
        pending = false;
        items.push({ sp: it, kids, x0, cap, maxW, joins: false, off, curve, cstub, ends: false, jw: kids.map(() => maxW), jc: kids.map(() => curve), cF: curve, J: 0, frL: 0, frR: 0, gn: 0 });
      }
    }
    return { b, closed: false, items, w: Math.max(x, right), up, down };
  }

  // ---- one layout for each level ----

  function layout(k: number): Layout {
    // the nearest branch to a lane is HANG from it, so a corner of half that fits every comb at its lane end
    const corner = T ? { lane: Math.min(T.COMB, T.HANG) / 2, far: T.COMB / 2 } : { lane: 0, far: 0 };
    const L: Layout = { W: 0, H: 0, s: 1, dx: T ? T.PITCH : B.DX, turned: false, corner, geo: new Map(), pods: new Map(), pieces: new Map(), ext: new Map(), bands: new Map() };
    const piece = (of: TBranch, name: string, t: Kind, v: number[], o = 1, sp?: TSplit) => L.pieces.set(`${of.key}:${name}`, { t, of, name, v, o, sp });
    // With icons a group that is one step is a coin like any step, with the mark of its state on its edge. With marks it is a small body around that mark.
    // With the labels hidden its name is not written, and with marks it gets the clear disc a finger hits.
    const pod = (sp: TSplit, x: number, y: number, o: number): void => {
      const ic = B.IC;
      L.pods.set(sp.key, { x, y, hw: B.PR, k: B.OPEN, m: B.words, fy: T ? T.NX : B.PNAME, o, ms: B.PMARK, at: ic * COIN.R * COIN.ON, ic, tap: ic ? 0 : B.TAP });
    };

    // a step that is not drawn waits at (x, y), as its bare icon or its small mark, and comes out of there when its track or its group opens
    const wait = (ns: TNode[], x: number, y: number): void => {
      for (const n of ns) L.geo.set(n.node.id, { x, y, k: B.SIZE, m: 0, fy: 0, ic: iconed(n) ? 1 : 0, coin: 0, o: 0, tap: B.TAP });
    };

    function place(bx: Box, X: number, Y: number): number {
      const b = bx.b;
      if (bx.closed) {
        // the pill, and in its middle what it holds: the mark of the state of the track and its count
        const end = X + bx.w, mid = X + bx.w / 2;
        if (T) {
          // down, the pill lies across its line, with the mark of the state on the line
          const m = markAt(), wc = pillLen(b) * B.BK, cc = Y - m + wc / 2;
          piece(b, 'bar', 'bar', [X, end, Y, wc, m]);
          piece(b, 'tally', 'tally', [mid, cc, B.BK, ...holds(b)]);
          L.ext.set(b.key, [X, end, Y]);
          wait(b.nodes, mid, cc);
          return end;
        }
        piece(b, 'bar', 'bar', [X, end, Y, B.BH, 0]);
        piece(b, 'tally', 'tally', [mid, Y, B.BK, ...holds(b)]);
        L.ext.set(b.key, [X, end, Y]);
        wait(b.nodes, mid, Y);
        return end;
      }
      // the lane is drawn in runs: a run stops where a group, or a branching that comes back together, leaves the lane, and the next starts where it comes back
      let pen = X, tail = X, from = X, run = 0, back = 0;
      const lastItem = bx.items[bx.items.length - 1];
      for (const it of bx.items) {
        if (isPodBox(it)) {
          const px = X + it.x;
          pod(it.pod, px, Y, 1);
          // the steps in it are not drawn: they wait at its middle
          wait(it.pod.nodes, px, Y);
          // the lane runs under it, as under a step: one run ends at its middle and the next starts there
          piece(b, `run${run++}`, 'seg', [from, px, Y]);
          from = pen = px;
          continue;
        }
        if (!isSplitBox(it)) {
          pen = X + it.x;
          // the body of a coin is what keeps the lane from running through the icon
          // with the labels hidden its name is not written, and a step that is not a coin gets the clear disc a finger hits
          const ic = coined(it.n) ? 1 : 0;
          L.geo.set(it.n.node.id, { x: pen, y: Y, k: B.OPEN, m: B.words, fy: T ? nameX(it.n) : nameAt(it.n), ic, coin: ic, o: 1, tap: ic ? 0 : B.TAP });
          continue;
        }
        const STUB = T ? T.STUB : B.STUB;
        const x0 = X + it.x0, fx = x0 + STUB + it.gn, cx = fx + it.curve, kx = cx + it.cap + it.cstub;
        const xj = kx + it.maxW + (it.ends ? 0 : it.cstub), jx = xj + it.cF;
        pen = x0;
        // the one step that stands for a group far out is not drawn here: it waits on the lane, in the middle of its tracks
        if (byPod.has(it.sp.key)) pod(it.sp, kx + it.maxW / 2, Y, 0);
        if (it.sp.group) {
          // an open group: its frame, from where the lane parts to where it is whole again, and its name over the top left corner. Both are kept with its first track.
          // With the labels hidden the name is kept, unseen, so it comes back with them.
          if (T) {
            piece(it.kids[0].b, 'frame', 'frame', [fx + B.FIN, kx + it.maxW + it.cstub + it.curve - B.FIN, Y + it.frL, Y + it.frR], 1, it.sp);
            if (it.sp.named) piece(it.kids[0].b, 'gname', 'gname', [fx + B.FIN - T.GNB, Y + T.CX], B.words, it.sp);
          } else {
            const end = it.kids.length - 1, top = Y + it.off[0] - it.kids[0].up - B.FPAD;
            piece(it.kids[0].b, 'frame', 'frame', [fx + B.FIN, kx + it.maxW + it.cstub + it.curve - B.FIN, top, Y + it.off[end] + it.kids[end].down + B.FLOW], 1, it.sp);
            if (it.sp.named) piece(it.kids[0].b, 'gname', 'gname', [fx + B.FIN + 8, top - 7], B.words, it.sp);
          }
        }
        // the one track of a group of steps in a row has no curve, so its name starts inside the frame, past its edge
        const inside = it.sp.group && it.kids.length === 1 ? B.FIN : 0;
        it.kids.forEach((c, i) => {
          const y = Y + it.J + it.off[i];
          piece(c.b, 'fan', 'fan', [fx, Y, cx, y, kx, T && it.sp.group ? 1 : 0]);
          // the name of a branch is not written where the labels are hidden
          if (c.b.name) piece(c.b, 'cap', 'cap', T ? [cx + inside + (c.closed ? T.TCAPB : T.CAPB), y + T.CX] : c.closed ? [kx + 1, y - B.BH / 2 - 6] : [cx + 6 + inside, y - 9], B.words);
          const end = place(c, kx, y);
          // a group's tracks all come back at its end; a branch of a branching comes back where its own join is
          // down, a branch that comes back before the last ones comes back to the lane in the gap, and the last ones come back to the lane they left
          if (!c.b.ends) piece(c.b, 'join', 'join', it.sp.group ? [end, y, xj, jx, Y, T ? 1 : 0] : [end, y, kx + it.jw[i] + it.cstub, kx + it.jw[i] + it.cstub + it.jc[i], T && it.jw[i] !== it.maxW ? Y + it.J : Y, 0]);
        });
        if (it.joins) {
          piece(b, `run${run++}`, 'seg', [from, fx, Y]);
          if (!it.sp.group) {
            // down, the lane in the gap: from where the first branch comes back to it, down to where the last ones come back, and then back to the lane the branching left. Across there is none.
            const early = it.kids.map((c, i) => (c.b.ends || it.jw[i] === it.maxW ? Infinity : kx + it.jw[i] + it.cstub + it.jc[i]));
            const top = Math.min(...early), any = Number.isFinite(top);
            if (T) piece(b, `back${back++}`, 'join', [any ? top : xj, Y + it.J, xj, jx, Y, 0], any ? 1 : 0);
            else piece(b, `back${back++}`, 'join', [jx, Y, jx, jx, Y, 0], 0);
          }
          // the lane is whole again where the first branch comes back; down, where the last ones do
          from = T || it.sp.group ? jx : Math.min(...it.kids.map((c, i) => (c.b.ends ? Infinity : kx + it.jw[i] + it.cstub + it.jc[i])));
          pen = jx + (it.ends ? 0 : STUB);
          // when a side branch is the last thing on a lane, the lane runs on a little, so it does not seem to turn into it
        } else tail = Math.max(tail, fx + (it === lastItem ? STUB : 0));
      }
      const end = Math.max(pen, tail);
      piece(b, `run${run}`, 'seg', [from, end, Y]);
      // the pill of an open branch is its whole lane, thin and unseen: a closing track shrinks back into it. What the pill holds waits where the pill will start.
      piece(b, 'bar', 'bar', [X, end, Y, 2, T ? 1 : 0], 0);
      if (isTrack(b)) piece(b, 'tally', 'tally', T ? [X + B.BH / 2, Y - markAt() + (pillLen(b) * B.BK) / 2, B.BK, ...holds(b)] : [X + (pillLen(b) * B.BK) / 2, Y, B.BK, ...holds(b)], 0);
      L.ext.set(b.key, [X, end, Y]);
      return end;
    }

    if (T) {
      // down, the top-level branches sit one under the other, each lane at the same x: as far in as the widest left side of any of them needs at this level
      const D = T, rows = tops.map(t => measure(t, k)), Y = D.PADL + Math.max(D.HU, ...rows.map(r => r.up));
      let top = T.PADT, wide = 0;
      tops.forEach((t, ti) => {
        const row = rows[ti];
        // the run before the first step holds the name of the version, which is written also where the labels are hidden: there no name of a step reaches up to it
        const X0v = top + (t.name ? Math.max(D.LEAD, D.CAPB + D.CAPGAP + reach(linesOf(row.items[0]))) : D.LEAD);
        // there the run is short, and the first step, with the ring that lights it, reaches up to the name: the name is written right of them
        const first = row.items[0], r0 = !first || isSplitBox(first) ? 0 : isPodBox(first) ? B.PR : lit(first.n);
        const cx = B.words ? D.CX : Math.max(D.CX, r0 + B.AIR);
        piece(t, 'lead', 'seg', [top, X0v, Y]);
        if (t.name) piece(t, 'cap', 'cap', [top + D.CAPB, Y + cx]);
        const end = place(row, X0v, Y);
        // the lane runs on a little past its last step, and far out how far the branch is stands at the end of that run
        const lastIt = row.items[row.items.length - 1];
        const r = !lastIt || isSplitBox(lastIt) ? 0 : isPodBox(lastIt) ? B.PR : radius(lastIt.n);
        let tip = end + r + D.TAIL;
        // far out the count is written under the name of the last step, which may take 3 lines
        if (B.words && !k) tip = Math.max(tip, end + reach(linesOf(lastIt)) + D.NGAP + 9);
        // branches that part off beside the lane and run on past its end would lie on the count: the lane runs on past them
        // with the labels hidden the count is not written and takes no room
        const cw = B.words ? D.CX + count(t).length * 6.2 : 0;
        for (const it of row.items) {
          if (!isSplitBox(it) || it.joins || it.off[0] - it.kids[0].up >= cw + D.NGAP) continue;
          const last = X0v + it.x0 + D.STUB + it.curve + it.cap + it.cstub + it.maxW;
          tip = Math.max(tip, last + Math.max(D.HU, reach(3)) + D.NGAP + 9);
        }
        piece(t, 'tail', 'seg', [end, tip, Y]);
        piece(t, 'count', 'txt', [tip + 4, Y + D.CX], k || !B.words ? 0 : 1);
        const bottom = Math.max(tip + 8, X0v + row.w);
        wide = Math.max(wide, Y + row.down, Y + cx + capText(t.cap), k || !B.words ? 0 : Y + cw);
        L.bands.set(t.key, [top, bottom]);
        top = bottom + D.BANDS;
      });
      // along and across: the post-pass in build() turns them
      L.W = top - T.BANDS + T.PADB;
      L.H = wide + T.PADR;
      return L;
    }

    // the top-level branches sit one under the other and all start at the same x, after the run that holds the names of the versions
    const X0 = B.PADL + Math.max(0, ...tops.map(t => capW(t.cap))) + B.OSTUB;
    let top = B.PADT, wide = 0;
    for (const t of tops) {
      const row = measure(t, k), Y = top + row.up;
      piece(t, 'lead', 'seg', [B.PADL, X0, Y]);
      if (t.name) piece(t, 'cap', 'cap', [B.PADL + 4, Y - 9]);
      const end = place(row, X0, Y);
      // far out, how far the branch is stands after the last thing on its lane
      const on = row.items.filter((it): it is NodeBox | PodBox => !isSplitBox(it)).pop();
      const half = !on ? 0 : isPodBox(on) ? B.PR : (coined(on.n) ? (on.n.milestone ? COIN.BIG : COIN.R) : on.n.milestone ? F.RING : C.R) * B.OPEN;
      const edge = Math.max(end, on ? X0 + on.x + half : X0) - X0;
      // across the lane needs no run after its last step
      piece(t, 'tail', 'seg', [end, end, Y], 0);
      // with the labels hidden the count is not written and takes no room
      piece(t, 'count', 'txt', [X0 + (k ? row.w : edge) + 14, Y + 4], k || !B.words ? 0 : 1);
      // the page keeps PADR after the last step for its name, and the count needs a little after its last letter
      wide = Math.max(wide, row.w, k || !B.words ? 0 : edge + 14 + count(t).length * 6.2 + 24 - B.PADR);
      L.bands.set(t.key, [top, Y + row.down]);
      top = Y + row.down + B.ROWS;
    }
    L.W = X0 + wide + B.PADR;
    L.H = top - B.ROWS + B.PADB;
    return L;
  }

  /** The layouts of one view, one for each level: across, or down where T holds the numbers of that layout. */
  function build(sizes: Sizes, turn: Turn | null): Layout[] {
    B = sizes; T = turn;
    const levels = Array.from({ length: K + 1 }, (_, k) => layout(k));
    // A piece that a level does not draw sits inside a closed track. It is squashed onto that track's pill and unseen,
    // so it grows out of the pill when the track opens. Each branch in it is squashed along its own length, and nothing sticks out of the pill.
    // Far out, such a piece sits inside a group that is one step. It is squashed onto that step, so the tracks grow out of it when it opens.
    for (let k = K - 1; k >= 0; k--) {
      const lo = levels[k], hi = levels[k + 1];
      for (const [key, p] of hi.pieces) {
        if (lo.pieces.has(key)) continue;
        const far = k ? undefined : lo.pods.get(p.of.pod!.key)!;
        // the outermost closed track that it is in
        let c = p.of;
        for (let a: TBranch | undefined = p.of; a; a = a.parent) if (shutAt(a, k, K)) c = a;
        const [a, b, y] = far ? [far.x - far.hw, far.x + far.hw, far.y] : lo.ext.get(c.key)!;
        let d = p.of;
        while (!hi.ext.has(d.key)) d = d.parent!;
        const [h0, h1] = hi.ext.get(d.key)!, axes = AXES[p.t];
        const v = p.v.map((n, i) => (axes[i] === 'x' ? Math.max(a, Math.min(b, a + ((n - h0) / Math.max(1, h1 - h0)) * (b - a))) : axes[i] === 'y' ? y : n));
        lo.pieces.set(key, { ...p, o: 0, v });
      }
    }
    // down, the steps and the groups as one step go where they are on the page, and so does the size of the plan: along is y
    if (T) for (const L of levels) {
      L.turned = true;
      for (const g of L.geo.values()) [g.x, g.y] = [g.y, g.x];
      for (const p of L.pods.values()) [p.x, p.y] = [p.y, p.x];
      [L.W, L.H] = [L.H, L.W];
    }
    return levels;
  }
  // A plan that names no icon has the view with marks only. With the labels hidden each view takes its bare sets.
  const [marks, icons] = bare ? [MARKS_B, ICONS_B] : [MARKS, ICONS], [vm, vi] = bare ? [VM_B, VI_B] : [VM, VI];
  const views = (down: boolean): Layout[][] => (plan.hasIcons ? [build(marks, down ? vm : null), build(icons, down ? vi : null)] : [build(marks, down ? vm : null)]);
  return { h: views(false), v: views(true) };
}
