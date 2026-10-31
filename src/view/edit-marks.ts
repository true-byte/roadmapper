// The marks of edit mode on the plan (edit.ts): the trash under a step that is pointed at or picked; the add mark, a gold diamond at the gap of a branch nearest the pointer,
// which opens the add choice of a step, a branching or a group; the dashed line of a new branch, where a branching or a group parts; and the '+' of a new top-level branch, past the last one.
// And the drags of the mouse: a step; a branch by its name or its line, among its sisters; a group by the step that stands for it far out, or by its frame or its name, to any branch but its own tracks.
// What is held follows the pointer, gold marks show each place it can go, the nearest grows, and a drop there moves it. Near an edge of the page, the plan scrolls.
// Where each mark goes is read from the plan as it is drawn, so the marks follow every level, zoom, turn and scroll, across and down.
// A finger does not drag: a tap puts the marks where it tapped, as the pointer would, and a tap on a mark works as a click.
import { EDIT } from '../icons/icons.js';
import { addBranch, addItem, addTop, deleteStep, moveBranch, moveSplit, moveStep, type Edited, type NewItem } from '../roadmap/edit.js';
import type { ViewContext } from './context.js';
import { HELD, html } from './dom.js';
import { drawn } from './draw.js';
import { drawMark } from './mark.js';
import { isBranch, isKids, isStep, type TBranch, type Thing, type TNode, type TSplit } from './plan.js';
import { SVG_NS } from './svg.js';

type P = [number, number];
/** A place on the page, in px from the corner of the view: a gap of a branch, where `index` is the item it comes before; a place among the branches of a split,
 * the branch it comes before; or with the key '', a place among the top-level branches that show. */
interface Spot {
  key: string;
  index: number;
  x: number;
  y: number;
}
/** A drop slot: a spot, where it is on the sheet of the plan, so a scroll moves it, and its mark. */
interface Slot extends Spot {
  sx: number;
  sy: number;
  el: HTMLElement;
}
/** A branch as its line: across it, the lane; along it, the runs where the line is drawn, not where a split has parted it; and its gaps. */
interface Lane {
  b: TBranch;
  lane: number;
  runs: [number, number][];
  gaps: Spot[];
}
/** A split as where it parts: the point it parts from, how far along its bend reaches, the lanes of its branches, and its places for a new branch across:
 * before the first, between two, after the last. */
interface Fork {
  sp: TSplit;
  p0: P;
  a1: number;
  lanes: number[];
  spots: number[];
}
/** What a drag holds. */
type Held = { step: TNode } | { branch: TBranch } | { group: TSplit };

/** A gap before the first item of a branch, or after its last, is this far from it. */
const GAP = 24;
/** The add mark shows while the pointer is this near the line of a branch. */
const NEAR = 40;
/** A place for a new branch before the first branch of a split, or after its last, is this far from it; and a slot for a top-level branch from the first or the last. */
const FORK = 44, TOPS = 32;
/** The '+' of a new branch keeps this far from the edge of the frame of its group, and from the lane next to it. */
const FRAME_IN = 16;
/** In the bend of a split, a point this near the lane of one of its branches aims at the line of that branch, not at a place for a new branch. */
const ON_LANE = 12;
/** The '+' of a new top-level branch is this far past the last one. */
const ROOT = 56;
/** A press is a drag once it moves this far; a tap is no tap once it moves this far. */
const LIFT = 6, TAP_MOVE = 8;
/** A drop goes to the slot nearest the pointer within this reach: of a step or a group, of a branch. */
const REACH = { item: 56, branch: 80 };
/** A step or a group reaches this many times farther along the line of a branch than across it: on the line, or near it, a slot lights from far along. */
const ALONG = 4;
/** Near this far from an edge of the page, a drag scrolls the plan, up to SPEED px a frame. */
const EDGE = 48, SPEED = 18;
/** The trash stays this long after the pointer leaves its step, to be reached. */
const LINGER_MS = 450;
/** The drawing of a group for the add choice: the lines that part, in the frame of an open group. */
const GROUP_ART = `<rect x="1.5" y="3" width="21" height="18" rx="4" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="1.4"/><g transform="translate(12 12) scale(0.66) translate(-12 -12)">${HELD.tracks}</g>`;

export function editMarksPart(ctx: ViewContext) {
  const { glyph, host, ICON_BOX, off, options, side, stage } = ctx;
  if (!options.save) return { marksOn: (): void => {}, marksOff: (): void => {}, marksTake: (): boolean => false };
  const signal = { signal: off.signal }, capture = { capture: true, signal: off.signal };

  // ---- the layer of the marks, over the plan and under the zoom control and the side bar ----
  const hands = html('div', 'hands');
  hands.hidden = true;
  const lines = document.createElementNS(SVG_NS, 'svg');
  lines.setAttribute('class', 'ghost-lines');
  lines.setAttribute('aria-hidden', 'true');
  const stub = document.createElementNS(SVG_NS, 'path'), rootLane = document.createElementNS(SVG_NS, 'path');
  rootLane.setAttribute('class', 'root');
  lines.append(stub, rootLane);
  /** Is the pointer on a mark or on the add choice? Then the marks stay where they are. */
  let overHands = false;
  const hand = (cls: string, icon: string, sign: string, label: string, size = 16): HTMLButtonElement => {
    const b = html('button', `hand ${cls}`);
    b.append(glyph(icon, size, sign));
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('pointerenter', () => { overHands = true; });
    b.addEventListener('pointerleave', () => { overHands = false; });
    return b;
  };
  const trash = hand('trash', EDIT.trash, '×', 'Delete'), fork = hand('fork', EDIT.add, '+', 'Add branch');
  const adder = hand('adder', EDIT.add, '+', 'Add', 14), root = hand('fork root', EDIT.add, '+', 'Add branch', 20);
  // the add choice: a step, a branching of two branches, a group of one track. Icons only
  const menu = html('div', 'add-menu');
  menu.hidden = true;
  const art24 = (inner: string): SVGElement => {
    const e = document.createElementNS(SVG_NS, 'svg');
    e.setAttribute('viewBox', '0 0 24 24');
    e.setAttribute('width', '28'); e.setAttribute('height', '28');
    e.setAttribute('aria-hidden', 'true');
    e.innerHTML = inner;
    return e;
  };
  const stepArt = (): SVGElement => {
    const m = drawMark('todo');
    m.setAttribute('width', '24'); m.setAttribute('height', '24');
    return m;
  };
  const choice = (kind: NewItem, label: string, face: SVGElement): HTMLButtonElement => {
    const b = html('button', '');
    b.append(face);
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => {
      const g = menuAt, now = ctx.editNow();
      closeMenu();
      overHands = false;
      if (g && now) change(addItem(now, { branch: g.key, index: g.index }, kind, ctx.editOld()), true);
    });
    return b;
  };
  menu.append(choice('step', 'Step', stepArt()), choice('branching', 'Branching', art24(HELD.tracks)), choice('group', 'Group', art24(GROUP_ART)));
  menu.addEventListener('pointerenter', () => { overHands = true; });
  menu.addEventListener('pointerleave', () => { overHands = false; });
  const slots = html('div', 'slots');
  hands.append(lines, slots, trash, fork, adder, root, menu);
  // what a drag holds, by the pointer
  const ghost = html('div', 'ghost');
  ghost.hidden = true;
  stage.after(hands);
  host.append(ghost);

  // ---- where things are on the page, read once for each placing of the marks ----
  let box: DOMRect | null = null;
  const H = (): DOMRect => (box ??= host.getBoundingClientRect());
  const axes = (): { down: boolean; A: 0 | 1; X: 0 | 1 } => {
    const down = ctx.isDown();
    return { down, A: down ? 1 : 0, X: down ? 0 : 1 };
  };
  const put = (e: HTMLElement, x: number, y: number): void => {
    e.style.left = `${Math.round(x)}px`;
    e.style.top = `${Math.round(y)}px`;
  };
  /** A round thing on the page: its middle and its radius. */
  function round(c: Element): [number, number, number] | null {
    const r = c.getBoundingClientRect(), h = H();
    return r.width ? [r.left + r.width / 2 - h.left, r.top + r.height / 2 - h.top, r.width / 2] : null;
  }
  /** A step as it is drawn now, or null where it is not drawn. */
  function disc(n: TNode): [number, number, number] | null {
    const e = ctx.nodeEls.get(n.node.id);
    return e && drawn(e.g) ? round(drawn(e.coin) ? e.coin : e.aura) : null;
  }
  /** A group drawn as one step, far out, or null where it is open. */
  function podDisc(sp: TSplit): [number, number, number] | null {
    const e = ctx.podEls.get(sp.key);
    return e && drawn(e.g) ? round(drawn(e.coin) ? e.coin : e.aura) : null;
  }
  /** A point of a line of the plan, at its start or its end. */
  function ofPath(p: SVGElement | undefined, end: boolean): P | null {
    if (!p || !drawn(p) || !(p instanceof SVGPathElement) || !p.getAttribute('d')) return null;
    const m = p.getScreenCTM(), h = H();
    if (!m) return null;
    const q = p.getPointAtLength(end ? p.getTotalLength() : 0), s = new DOMPoint(q.x, q.y).matrixTransform(m);
    return [s.x - h.left, s.y - h.top];
  }
  /** Where the bend of a line to a branch ends and its straight run starts: the first point of it on the lane of that branch. */
  function bendEnd(p: SVGElement | undefined): P | null {
    if (!p || !drawn(p) || !(p instanceof SVGPathElement) || !p.getAttribute('d')) return null;
    const m = p.getScreenCTM(), h = H(), L = p.getTotalLength(), { X } = axes();
    if (!m) return null;
    const at = (l: number): P => {
      const q = p.getPointAtLength(l), s = new DOMPoint(q.x, q.y).matrixTransform(m);
      return [s.x - h.left, s.y - h.top];
    };
    const end = at(L);
    for (let k = 1; k <= 32; k++) {
      const q = at((L * k) / 32);
      if (Math.abs(q[X] - end[X]) < 0.75) return q;
    }
    return end;
  }
  /** How far along an item of a branch reaches: a step, a group drawn as one step, or a split with all that is drawn of it. */
  function spanOf(it: TNode | TSplit): [number, number] | null {
    const { A } = axes(), h = H();
    if (!isKids(it)) {
      const p = disc(it);
      return p ? [p[A] - p[2], p[A] + p[2]] : null;
    }
    const pd = podDisc(it);
    if (pd) return [pd[A] - pd[2], pd[A] + pd[2]];
    // from where it parts to where it is whole again, past all that is drawn in it
    const starts = it.kids.map(c => ofPath(ctx.pieceEls.get(`${c.key}:fan`), false)?.[A]).filter((v): v is number => v !== undefined);
    if (!starts.length) return null;
    let lo = Math.min(...starts), hi = Math.max(...starts);
    for (const e of [...it.kids.flatMap(c => ctx.partsOf.get(c) ?? []), ...it.nodes.map(n => ctx.nodeEls.get(n.node.id)!.g)]) {
      if (!drawn(e)) continue;
      const r = e.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      hi = Math.max(hi, A ? r.bottom - h.top : r.right - h.left);
    }
    for (const c of it.kids) {
      const j = ofPath(ctx.pieceEls.get(`${c.key}:join`), true);
      if (j) hi = Math.max(hi, j[A]);
    }
    lo = Math.min(lo, hi);
    return [lo, hi];
  }

  /** Every branch whose line is drawn, with its gaps, where a step can go. */
  function makeLanes(): Lane[] {
    const out: Lane[] = [], { down, A, X } = axes(), h = H();
    for (const b of ctx.byKey.values()) {
      if (!b.items.length || ctx.shut(b)) continue;
      const sp = b.items.map(spanOf);
      if (sp.some(s => !s)) continue;
      const spans = sp as [number, number][];
      // the line across: by a step of its own, or where its bend meets it, or where its first split parts from it
      const own = b.items.map(it => (isKids(it) ? podDisc(it) : disc(it))).find(p => !!p);
      const first = b.items.find(isKids);
      const lane = own?.[X] ?? ofPath(ctx.pieceEls.get(`${b.key}:fan`), true)?.[X] ?? (first ? ofPath(ctx.pieceEls.get(`${first.kids[0].key}:fan`), false)?.[X] : undefined);
      if (lane === undefined) continue;
      // the gap after the last item goes past the count of a top-level branch, where the count is in its way
      let end = spans[spans.length - 1][1] + GAP;
      const cnt = ctx.pieceEls.get(`${b.key}:count`), cb = drawn(cnt) ? cnt.getBoundingClientRect() : null;
      if (cb?.width) {
        const [c0, c1, x0, x1] = down ? [cb.top - h.top, cb.bottom - h.top, cb.left - h.left, cb.right - h.left] : [cb.left - h.left, cb.right - h.left, cb.top - h.top, cb.bottom - h.top];
        if (end + 12 > c0 && end - 12 < c1 && lane + 12 > x0 && lane - 12 < x1) end = c1 + GAP;
      }
      const gaps: Spot[] = [];
      for (let i = 0; i <= spans.length; i++) {
        const along = i === 0 ? spans[0][0] - GAP : i === spans.length ? end : (spans[i - 1][1] + spans[i][0]) / 2;
        gaps.push({ key: b.key, index: i, x: down ? lane : along, y: down ? along : lane });
      }
      // the line counts from past its name, and on to where it bends back to the lane it left; but not where a split has parted it
      const runs: [number, number][] = [], back = ofPath(ctx.pieceEls.get(`${b.key}:join`), false)?.[A];
      const cap = ctx.pieceEls.get(`${b.key}:cap`), cr = drawn(cap) ? cap.getBoundingClientRect() : null;
      let from = Math.min(spans[0][0] - GAP, cr?.width ? (down ? cr.bottom - h.top : cr.right - h.left) + 12 : Infinity);
      b.items.forEach((it, i) => {
        if (!isKids(it) || podDisc(it)) return;
        runs.push([from, spans[i][0]]);
        from = spans[i][1];
      });
      runs.push([from, Math.max(end, back ?? -Infinity)]);
      out.push({ b, lane, runs, gaps });
    }
    return out;
  }
  /** Every split that parts on the page, with its places for a new branch. */
  function makeForks(): Fork[] {
    const out: Fork[] = [], { A, X } = axes();
    for (const b of ctx.byKey.values()) for (const it of b.items) {
      if (!isKids(it) || podDisc(it)) continue;
      const fans = it.kids.map(c => ctx.pieceEls.get(`${c.key}:fan`)), p0 = ofPath(fans[0], false), ends = fans.map(bendEnd);
      if (!p0 || ends.some(e => !e)) continue;
      const lanes = (ends as P[]).map(e => e[X]);
      // the place before the first branch and after the last stays inside the frame of a group, clear of its edge
      let lo = lanes[0] - FORK, hi = lanes[lanes.length - 1] + FORK;
      const fr = ctx.pieceEls.get(`${it.kids[0].key}:frame`), fb = drawn(fr) ? fr.getBoundingClientRect() : null;
      if (fb?.width) {
        const h = H(), [e0, e1] = X ? [fb.top - h.top, fb.bottom - h.top] : [fb.left - h.left, fb.right - h.left];
        lo = Math.min(lanes[0] - FRAME_IN, Math.max(lo, e0 + FRAME_IN));
        hi = Math.max(lanes[lanes.length - 1] + FRAME_IN, Math.min(hi, e1 - FRAME_IN));
      }
      const spots = [lo, ...lanes.slice(1).map((c, i) => (lanes[i] + c) / 2), hi];
      out.push({ sp: it, p0, a1: Math.max(p0[A] + 40, ...(ends as P[]).map(e => e[A])), lanes, spots });
    }
    return out;
  }
  let lanesNow: Lane[] | null = null, forksNow: Fork[] | null = null;
  const lanes = (): Lane[] => (lanesNow ??= makeLanes());
  const forks = (): Fork[] => (forksNow ??= makeForks());
  /** Forgets what was read of the page: the next read reads it again. */
  const forget = (): void => { box = null; lanesNow = null; forksNow = null; };
  const spotAt = (f: Fork, at: number): P => (ctx.isDown() ? [f.spots[at], f.a1] : [f.a1, f.spots[at]]);

  /** What a point aims at: inside the bend of a split and off the lanes of its branches, the place for a new branch nearest it; else, near the line of a branch,
   * the gap of that branch nearest it. So a group of one track, whose line runs straight, takes a step before its first one too. */
  type Aim = { gap: Spot } | { fork: Fork; at: number } | null;
  function aimAt(p: P): Aim {
    const { A, X } = axes();
    let best: Aim = null, d = Infinity;
    for (const f of forks()) {
      if (p[A] < f.p0[A] + 6 || p[A] > f.a1 + 16 || p[X] < f.spots[0] - 20 || p[X] > f.spots[f.spots.length - 1] + 20) continue;
      if (f.lanes.some(c => Math.abs(p[X] - c) < ON_LANE)) continue;
      f.spots.forEach((c, at) => {
        const k = Math.abs(p[X] - c);
        if (k < d) { d = k; best = { fork: f, at }; }
      });
    }
    if (best) return best;
    let near: Lane | null = null;
    d = NEAR;
    for (const l of lanes()) {
      const dc = Math.abs(p[X] - l.lane);
      if (dc > d) continue;
      for (const [s0, s1] of l.runs) {
        const a = p[A], k = Math.hypot(a < s0 ? s0 - a : a > s1 ? a - s1 : 0, dc);
        if (k < d) { d = k; near = l; }
      }
    }
    if (!near) return null;
    const along = (g: Spot): number => Math.abs((A ? g.y : g.x) - p[A]);
    return { gap: (near as Lane).gaps.reduce((m, g) => (along(g) < along(m) ? g : m)) };
  }
  /** The dashed line of a new branch: from where the split parts, bending to `end`. */
  function dash(p0: P, end: P): string {
    if (ctx.isDown()) {
      const mid = (p0[1] + end[1]) / 2;
      return `M ${p0[0]} ${p0[1]} C ${p0[0]} ${mid}, ${end[0]} ${mid}, ${end[0]} ${end[1]}`;
    }
    const mid = (p0[0] + end[0]) / 2;
    return `M ${p0[0]} ${p0[1]} C ${mid} ${p0[1]}, ${mid} ${end[1]}, ${end[0]} ${end[1]}`;
  }

  // ---- the marks, placed again whenever what they follow has moved ----
  let on = false, raf = 0, seen = '', planWas: unknown = null;
  /** Where the pointer is on the plan, in px from the corner of the view; null off it. A tap of a finger leaves it where the finger was. */
  let ptr: P | null = null;
  /** What the pointer aims at now, and the gap the add choice is open at. */
  let aim: Aim = null, menuAt: Spot | null = null;
  /** The step the trash was last under, and when the pointer left it. */
  let lastHot: string | null = null, lastAt = 0;
  function closeMenu(): void {
    menu.hidden = true;
    menuAt = null;
    adder.classList.remove('open');
  }
  /** The step the trash is under: the one pointed at, for a moment after the pointer leaves it for the trash; else the picked one. */
  function target(): TNode | null {
    const hot = ctx.hot && isStep(ctx.hot) ? ctx.hot : null;
    if (hot) {
      lastHot = hot.node.id;
      lastAt = performance.now();
      return hot;
    }
    const was = lastHot ? ctx.byId.get(lastHot) : undefined;
    if (was && (overHands || performance.now() - lastAt < LINGER_MS)) return was;
    return ctx.picked && isStep(ctx.picked) ? ctx.picked : null;
  }
  const keyOf = (t: unknown): string => (!t ? '' : isStep(t as TNode) ? (t as TNode).node.id : (t as TBranch).key);
  /** All that the marks follow, as one text: when it is the same as at the last frame, the marks stay. */
  const now = (): string => [stage.scrollLeft, stage.scrollTop, ctx.z, ctx.t, ctx.u, ctx.w, ctx.scale, ptr?.join(), keyOf(ctx.hot), keyOf(ctx.picked), overHands, menuAt?.key, menuAt?.index,
    host.clientWidth, host.clientHeight, side.hidden, !!lastHot && performance.now() - lastAt < LINGER_MS].join('|');

  function placeMarks(): void {
    forget();
    stub.setAttribute('d', '');
    rootLane.setAttribute('d', '');
    trash.hidden = adder.hidden = fork.hidden = root.hidden = true;
    const n = target(), at = n ? disc(n) : null, down = ctx.isDown();
    if (at) {
      const [x, y, r] = at;
      trash.hidden = false;
      // under the step, across and down alike: down, the name of the step beside it may reach to its left
      put(trash, x, y + r + 17);
    }
    // the aim stays while the pointer is on a mark, and while the add choice is open
    if (menuAt) aim = { gap: menuAt };
    else if (!overHands) aim = ptr ? aimAt(ptr) : null;
    else if (aim && 'fork' in aim) {
      // the same place, where its split is drawn now
      const key = aim.fork.sp.key, f = forks().find(x => x.sp.key === key);
      aim = f ? { fork: f, at: aim.at } : null;
    }
    if (aim && 'gap' in aim) {
      const { key, index } = aim.gap, g = lanes().find(l => l.b.key === key)?.gaps[index];
      if (g) {
        adder.hidden = false;
        put(adder, g.x, g.y);
        if (!menu.hidden) {
          const h = H(), w = menu.offsetWidth, ht = menu.offsetHeight;
          put(menu, Math.min(down ? g.x + 18 : g.x + 20, h.width - w - 8), Math.min(down ? g.y + 18 : g.y - ht / 2, h.height - ht - 8));
        }
      } else if (menuAt) closeMenu();
    }
    // the tip of a branch where a split parts would name any of the lines that lie on each other there
    host.classList.toggle('forking', !!aim && 'fork' in aim);
    if (aim && 'fork' in aim) {
      const end = spotAt(aim.fork, aim.at);
      stub.setAttribute('d', dash(aim.fork.p0, end));
      put(fork, end[0], end[1]);
      fork.hidden = false;
    }
    placeRoot();
  }
  /** The '+' of a new top-level branch: under the last top-level branch that shows, where the first step of the next one would be, on a dashed line.
   * Across and down alike, the top-level branches sit one under the other. */
  function placeRoot(): void {
    const tops = ctx.plan?.tops ?? [], last = tops[tops.length - 1];
    if (!last) return;
    const down = ctx.isDown(), h = H();
    let far = -Infinity;
    for (const e of [...(ctx.partsOf.get(last) ?? []), ...last.nodes.flatMap(n => ctx.partsOf.get(n) ?? [])]) {
      if (!drawn(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width || r.height) far = Math.max(far, r.bottom - h.top);
    }
    const first = last.items[0], d0 = first ? (isKids(first) ? podDisc(first) : disc(first)) : null;
    const g0 = lanes().find(l => l.b === last)?.gaps[0];
    const x = d0 ? d0[0] : g0 ? g0.x + (down ? 0 : GAP) : undefined;
    if (x === undefined || !Number.isFinite(far)) return;
    const y = far + ROOT;
    put(root, x, y);
    root.hidden = false;
    rootLane.setAttribute('d', down ? `M ${x} ${y - 64} L ${x} ${y + 120}` : `M ${x - 64} ${y} L ${x + 120} ${y}`);
  }

  function tick(): void {
    raf = on ? requestAnimationFrame(tick) : 0;
    if (!on) return;
    if (ctx.plan !== planWas) {
      planWas = ctx.plan;
      frames = framesOf();
      seen = '';
    }
    if (held) {
      edgeScroll();
      placeSlots();
      return;
    }
    const s = now();
    if (s === seen) return;
    seen = s;
    placeMarks();
  }
  function marksOn(): void {
    on = true;
    hands.hidden = false;
    seen = '';
    if (!raf) tick();
  }
  function marksOff(): void {
    on = false;
    cancelAnimationFrame(raf);
    raf = 0;
    if (held) endDrag();
    cand = null;
    closeMenu();
    hands.hidden = true;
    host.classList.remove('forking');
    ptr = null;
    aim = null;
    lastHot = null;
  }
  off.signal.addEventListener('abort', () => cancelAnimationFrame(raf));

  // ---- the pointer on the plan: the marks follow it; off the plan, on the side bar or on the zoom control, they go ----
  const onPlan = (e: Event): boolean => e.composedPath().includes(stage);
  const local = (e: PointerEvent): P => {
    const h = host.getBoundingClientRect();
    return [e.clientX - h.left, e.clientY - h.top];
  };
  window.addEventListener('pointermove', e => {
    if (!on || e.pointerType === 'touch') return;
    ptr = onPlan(e) ? local(e) : null;
  }, signal);
  host.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') ptr = null; }, signal);
  // a finger: a tap on the plan puts the marks where it tapped, until the next tap
  let tapFrom: P | null = null;
  host.addEventListener('pointerdown', e => { if (on && e.pointerType === 'touch') tapFrom = [e.clientX, e.clientY]; }, capture);
  host.addEventListener('pointerup', e => {
    if (!on || e.pointerType !== 'touch' || !tapFrom) return;
    const moved = Math.hypot(e.clientX - tapFrom[0], e.clientY - tapFrom[1]);
    tapFrom = null;
    if (moved > TAP_MOVE || e.composedPath().includes(hands)) return;
    ptr = onPlan(e) ? local(e) : null;
    overHands = false;
  }, capture);

  /** Makes a change of the marks: the marks let go of what they held, and the plan is drawn again. A new step is picked with its name ready to type over, but for a finger,
   * where the keyboard would cover the plan. */
  function change(e: Edited | undefined, fresh = false): void {
    overHands = false;
    lastHot = null;
    ptr = null;
    aim = null;
    if (!e || !ctx.applyEdit(e) || !fresh || ctx.lastPointer === 'touch') return;
    const name = side.querySelector<HTMLTextAreaElement>('[data-f="name"]');
    name?.focus({ preventScroll: true });
    name?.select();
  }
  trash.addEventListener('click', () => {
    const n = target(), r = ctx.editNow();
    change(n && r ? deleteStep(r, n.node.id) : undefined);
  });
  adder.addEventListener('click', () => {
    if (!menu.hidden) return closeMenu();
    if (!aim || !('gap' in aim)) return;
    menuAt = aim.gap;
    menu.hidden = false;
    adder.classList.add('open');
    seen = '';
  });
  fork.addEventListener('click', () => {
    const r = ctx.editNow();
    if (!aim || !('fork' in aim) || !r) return;
    change(addBranch(r, aim.fork.sp.key, aim.at, ctx.editOld()), true);
  });
  root.addEventListener('click', () => {
    const r = ctx.editNow();
    if (r) change(addTop(r, ctx.editOld()), true);
  });
  window.addEventListener('pointerdown', e => {
    if (!menu.hidden && !e.composedPath().some(t => t === menu || t === adder)) closeMenu();
  }, capture);
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || menu.hidden) return;
    closeMenu();
    e.stopImmediatePropagation();
  }, capture);

  // ---- a drag: a step, a branch, or a group. It lifts and follows the pointer, the drop slots show where it can go, and a drop moves it there ----
  /** The frame and the name of each open group, which a drag holds the group by. */
  let frames = new Map<Element, TSplit>();
  function framesOf(): Map<Element, TSplit> {
    const out = new Map<Element, TSplit>();
    for (const [k, e] of ctx.pieceEls) {
      const m = /^(.+)\.(\d+)\.\d+:(frame|gname)$/.exec(k);
      const sp = m ? ctx.byKey.get(m[1])?.items.find((it): it is TSplit => isKids(it) && it.key === `${m[1]}.${m[2]}`) : undefined;
      if (sp) out.set(e, sp);
    }
    return out;
  }
  let cand: { held: Held; x: number; y: number } | null = null, held: Held | null = null, list: Slot[] = [], hot: Slot | null = null;
  /** Where a step or a group was lifted from, as the gaps on each side of it and in it, where the sheet of the plan is: no slot, so a drop there leaves it where it is. */
  let homes: P[] = [];
  /** Where the pointer is while it holds something, on the screen. */
  let at: P = [0, 0];
  /** What a press on the plan would hold. */
  function heldAt(t: EventTarget | null): Held | null {
    const th = ctx.thingAt(t);
    if (th) return isStep(th) ? { step: th } : isBranch(th) ? { branch: th } : { group: th };
    const sp = t instanceof Element ? frames.get(t) : undefined;
    return sp ? { group: sp } : null;
  }
  stage.addEventListener('pointerdown', e => {
    if (!on || e.pointerType === 'touch' || e.button !== 0) return;
    const h = heldAt(e.target);
    if (!h) return;
    // the plan does not pan: the step, the branch or the group is held
    e.stopPropagation();
    ctx.dragged = false;
    cand = { held: h, x: e.clientX, y: e.clientY };
  }, capture);
  window.addEventListener('pointermove', e => {
    if (!cand) return;
    if (e.buttons === 0) {
      if (held) endDrag();
      cand = null;
      return;
    }
    at = [e.clientX, e.clientY];
    if (!held && Math.hypot(e.clientX - cand.x, e.clientY - cand.y) < LIFT) return;
    if (!held) lift(cand.held);
    follow();
  }, signal);
  window.addEventListener('pointerup', () => {
    if (held) drop();
    cand = null;
  }, signal);
  window.addEventListener('pointercancel', () => {
    if (held) endDrag();
    cand = null;
  }, signal);

  /** All that is drawn of a group, the frame and the name of an open one too. */
  function groupParts(sp: TSplit): Element[] {
    const first = sp.kids[0].key;
    return [...(ctx.partsOf.get(sp) ?? []), ...sp.kids.flatMap(c => ctx.partsOf.get(c) ?? []), ...sp.nodes.flatMap(n => ctx.partsOf.get(n) ?? []),
      ...['frame', 'gname'].flatMap(k => ctx.pieceEls.get(`${first}:${k}`) ?? [])];
  }
  function lift(h: Held): void {
    held = h;
    lifted = [stage.scrollLeft, stage.scrollTop];
    forget();
    closeMenu();
    ctx.hover(null);
    trash.hidden = adder.hidden = fork.hidden = root.hidden = true;
    rootLane.setAttribute('d', '');
    stub.setAttribute('d', '');
    let parts: Element[], spots: Spot[] = [], home: Spot[] = [];
    /** Every gap of every branch: a slot, or a place it was lifted from. */
    const gaps = (isHome: (l: Lane, g: Spot) => boolean): void => {
      for (const l of lanes()) for (const g of l.gaps) (isHome(l, g) ? home : spots).push(g);
    };
    if ('step' in h) {
      const n = h.step;
      parts = ctx.partsOf.get(n) ?? [];
      const face = html('div', 'disc');
      if (n.icon) {
        const e = document.createElementNS(SVG_NS, 'svg');
        e.setAttribute('viewBox', `0 0 ${ICON_BOX} ${ICON_BOX}`);
        e.setAttribute('width', '26'); e.setAttribute('height', '26');
        e.setAttribute('class', `ic ${n.state}`);
        e.innerHTML = n.icon;
        face.append(e);
      } else face.append(drawMark(n.state));
      ghost.className = 'ghost';
      ghost.replaceChildren(face, html('span', 'nm', n.node.name));
      // every gap of every branch, but the two on each side of the step, where it already is
      gaps((l, g) => {
        const mine = l.b.items.indexOf(n);
        return mine >= 0 && (g.index === mine || g.index === mine + 1);
      });
    } else if ('group' in h) {
      const sp = h.group;
      parts = groupParts(sp);
      const face = html('div', 'disc');
      const e = document.createElementNS(SVG_NS, 'svg');
      e.setAttribute('viewBox', '0 0 24 24');
      e.setAttribute('width', '26'); e.setAttribute('height', '26');
      e.innerHTML = sp.kids.length > 1 ? HELD.tracks : HELD.row;
      face.append(e);
      ghost.className = 'ghost';
      ghost.replaceChildren(face, html('span', 'nm', sp.name));
      // every gap of every branch, as for a step, but in the group itself and on each side of it, where it already is
      const mine = sp.owner.items.indexOf(sp);
      gaps((l, g) => l.b.key.startsWith(`${sp.key}.`) || (l.b === sp.owner && (g.index === mine || g.index === mine + 1)));
    } else {
      const b = h.branch;
      parts = [...(ctx.partsOf.get(b) ?? []), ...b.nodes.flatMap(x => ctx.partsOf.get(x) ?? [])];
      ghost.className = 'ghost branch';
      ghost.replaceChildren(html('span', 'nm', b.name ?? ''));
      spots = branchSpots(b);
    }
    for (const e of parts) e.classList.add('lifted');
    ghost.hidden = false;
    host.classList.add('lifting');
    const [l, t] = [stage.scrollLeft, stage.scrollTop];
    list = spots.map(s => {
      const el = html('span', 'slot');
      return { ...s, sx: s.x + l, sy: s.y + t, el };
    });
    homes = home.map(s => [s.x + l, s.y + t]);
    slots.replaceChildren(...list.map(s => s.el));
    placeSlots();
  }
  /** Where a branch can go: among its sisters only, the branches of its split or the top-level branches that show. Not on either side of itself. */
  function branchSpots(b: TBranch): Spot[] {
    if (b.parent) {
      const f = forks().find(x => x.sp.kids.includes(b));
      if (!f) return [];
      const i = f.sp.kids.indexOf(b);
      return f.spots.flatMap((_, k) => (k === i || k === i + 1 ? [] : [{ key: f.sp.key, index: k, x: spotAt(f, k)[0], y: spotAt(f, k)[1] }]));
    }
    // each top-level branch that shows as how far it reaches down the page, across and down alike; the slots lie between them, in line with their first steps
    const tops = ctx.plan?.tops ?? [], h = H(), i = tops.indexOf(b);
    const ext = tops.map(t => {
      let lo = Infinity, hi = -Infinity;
      for (const e of [...(ctx.partsOf.get(t) ?? []), ...t.nodes.flatMap(n => ctx.partsOf.get(n) ?? [])]) {
        if (!drawn(e)) continue;
        const r = e.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        lo = Math.min(lo, r.top - h.top);
        hi = Math.max(hi, r.bottom - h.top);
      }
      return [lo, hi];
    });
    const first = tops.map(t => {
      const it = t.items[0], p = it ? (isKids(it) ? podDisc(it) : disc(it)) : null;
      return p ? p[0] : NaN;
    }).find(v => !Number.isNaN(v));
    if (first === undefined) return [];
    const out: Spot[] = [];
    for (let k = 0; k <= tops.length; k++) {
      if (k === i || k === i + 1) continue;
      const c = k === 0 ? ext[0][0] - TOPS : k === tops.length ? ext[k - 1][1] + TOPS : (ext[k - 1][1] + ext[k][0]) / 2;
      out.push({ key: '', index: k, x: first, y: c });
    }
    return out;
  }
  /** The ghost by the pointer, and the slot nearest it, within reach, lit. For a step or a group, a slot along a line is nearer than one as far across it;
   * where the place it was lifted from is nearer than every slot, none lights. */
  function follow(): void {
    const h = host.getBoundingClientRect(), px = at[0] - h.left, py = at[1] - h.top;
    // a step floats over the pointer, a name to its right: the slot under the pointer stays in sight
    if (held && 'branch' in held) put(ghost, px + 16, py - 30);
    else put(ghost, px, py - 46);
    const l = stage.scrollLeft, t = stage.scrollTop, item = !!held && !('branch' in held), { A } = axes();
    const far = (sx: number, sy: number): number => {
      const dx = sx - l - px, dy = sy - t - py;
      return item ? Math.hypot((A ? dy : dx) / ALONG, A ? dx : dy) : Math.hypot(dx, dy);
    };
    let best: Slot | null = null, d = item ? REACH.item : REACH.branch;
    for (const s of list) {
      const k = far(s.sx, s.sy);
      if (k < d) { d = k; best = s; }
    }
    if (best && homes.some(([x, y]) => far(x, y) < d)) best = null;
    if (best === hot) return;
    hot?.el.classList.remove('on');
    hot = best;
    hot?.el.classList.add('on');
  }
  /** The slots where the sheet of the plan is now; for a branch, the dashed line from where its split parts to the slot that is lit. */
  function placeSlots(): void {
    const l = stage.scrollLeft, t = stage.scrollTop;
    for (const s of list) put(s.el, s.sx - l, s.sy - t);
    stub.setAttribute('d', '');
    if (!held || !('branch' in held) || !hot || !hot.key) return;
    const f = forksNow?.find(x => x.sp.key === hot!.key);
    if (f) stub.setAttribute('d', dash([f.p0[0] - (l - lifted[0]), f.p0[1] - (t - lifted[1])], [hot.sx - l, hot.sy - t]));
  }
  /** The scroll when the drag lifted, which the dashed line is measured at. */
  let lifted: P = [0, 0];
  /** Near an edge of the page, the plan scrolls toward it, faster the nearer the pointer is. */
  function edgeScroll(): void {
    const st = stage.getBoundingClientRect();
    const speed = (d: number): number => (d < EDGE ? Math.ceil(((EDGE - Math.max(0, d)) / EDGE) * SPEED) : 0);
    const dx = speed(at[0] - st.left) ? -speed(at[0] - st.left) : speed(st.right - at[0]);
    const dy = speed(at[1] - st.top) ? -speed(at[1] - st.top) : speed(st.bottom - at[1]);
    if (!dx && !dy) return;
    const was = [stage.scrollLeft, stage.scrollTop];
    stage.scrollBy(dx, dy);
    if (stage.scrollLeft !== was[0] || stage.scrollTop !== was[1]) follow();
  }
  function endDrag(): void {
    held = null;
    hot = null;
    list = [];
    homes = [];
    ghost.hidden = true;
    host.classList.remove('lifting');
    slots.replaceChildren();
    stub.setAttribute('d', '');
    host.querySelectorAll('.lifted').forEach(e => e.classList.remove('lifted'));
    seen = '';
  }
  function drop(): void {
    const h = held, to = hot, r = ctx.editNow();
    endDrag();
    ctx.hover(null);
    // the click that ends the drag picks nothing
    ctx.dragged = true;
    if (!h || !to || !r) return;
    if ('step' in h) change(moveStep(r, h.step.node.id, { branch: to.key, index: to.index }));
    else if ('group' in h) change(moveSplit(r, h.group.key, { branch: to.key, index: to.index }));
    else if (to.key) change(moveBranch(r, h.branch.key, to.index));
    else {
      // a place among the top-level branches that show, as a place among all of them in the file
      const tops = ctx.plan?.tops ?? [], fileAt = (b: TBranch): number => Number(b.key.slice(1));
      change(moveBranch(r, h.branch.key, to.index < tops.length ? fileAt(tops[to.index]) : fileAt(tops[tops.length - 1]) + 1));
    }
  }
  /** Does a tap at a point of the page show the add mark or the dashed line there? Then it picks nothing: not the branch whose line it is on. A tap on a step still picks it. */
  function marksTake(x: number, y: number, t: Thing | null): boolean {
    if (!on || (t && isStep(t))) return false;
    forget();
    const h = H();
    return !!aimAt([x - h.left, y - h.top]);
  }
  return { marksOn, marksOff, marksTake };
}

export type EditMarksPart = ReturnType<typeof editMarksPart>;
