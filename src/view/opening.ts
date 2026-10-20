// The first view: the step the page opens on, and where it puts it, across and down.
import type { ViewContext } from './context.js';
import { drawn } from './draw.js';
import type { Layout } from './layout.js';
import { count, isKids, isTrack, type TBranch, type TNode, type TSplit } from './plan.js';

export function openingPart(ctx: ViewContext) {
  const { PAD, stage, svg } = ctx;

  /** With no pointer to zoom around: of the steps in progress that are on the screen, the one nearest the middle; or else the step nearest the middle.
   * A step in a closed track or in a group that is one step is not drawn: it sits where its pill or its group is, and is on the screen where that is.
   * `within` is the part of the screen to look in, the stage by default. */
  function middle(within?: DOMRect): TNode {
    const r = within ?? stage.getBoundingClientRect();
    const seen = (n: TNode): boolean => {
      const [x, y] = ctx.at(n.node.id);
      return !!ctx.standFor(n) && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const busy = ctx.all.filter(n => n.state === 'in-progress' && seen(n));
    if (busy.length) return ctx.nearest(busy, r.left + r.width / 2, r.top + r.height / 2);
    // or else the step the page opens on, where it is in sight
    const first = now();
    return first && seen(first) ? first : ctx.nearest(ctx.all, r.left + r.width / 2, r.top + r.height / 2);
  }
  /** The step the page opens on: the first in progress; or else the first to do that can start, first on its branch or after an item that is done or canceled; or else the first not done or canceled; or else the last. */
  function now(): TNode | undefined {
    const over = (n: TNode): boolean => n.state === 'done' || n.state === 'canceled';
    // a group or a branching counts as over when all its steps are
    const ready = (n: TNode): boolean => {
      const i = n.owner.items.indexOf(n), before = n.owner.items[i - 1];
      return i <= 0 || (isKids(before) ? before.nodes.every(over) : over(before));
    };
    return ctx.all.find(n => n.state === 'in-progress') ?? ctx.all.find(n => n.state === 'todo' && ready(n)) ?? ctx.all.find(n => !over(n)) ?? ctx.all[ctx.all.length - 1];
  }
  /** The first view; and on a turn held by the address ('#t=0.5'), the first view of the layout the turn is nearer, with the step it opens on held where it is in both layouts, as a turn holds it. */
  function firstView(): void {
    if (ctx.t <= 0 || ctx.t >= 1) return opening();
    const held = ctx.t;
    ctx.t = ctx.flowT();
    ctx.frame();
    opening();
    const n = now();
    if (n) ctx.anchor = ctx.hold(n);
    ctx.t = held;
    ctx.frame();
    ctx.anchor = null;
  }
  /** The first view: the step now() gives, at 40% across, or further left so the end of its version shows, but never so far that the name of its branch is cut.
   * A level that fits the room is in the middle of it, as it is at rest, such as 'Main steps' with the labels hidden on a laptop.
   * Down, the level in the middle where it fits the room, or else the top of the step's version at the top of the room. */
  function opening(): void {
    const n = now();
    if (!n) return;
    ctx.beyond = { near: [0, 0], far: [0, 0] };
    const L = ctx.views[ctx.view][ctx.target], s = L.s, g = L.geo.get(n.node.id)!, [rw, rh] = ctx.roomOf(L);
    if (L.turned) return openingDown(n, L);
    if (L.W * s <= rw + 0.5 && L.H * s <= rh + 0.5) {
      // whole in the room: nothing is cut, so there is nothing to tidy
      ctx.anchor = ctx.hold(n, [0, 0]);
      ctx.frame();
      ctx.anchor = null;
      ctx.opened = { target: ctx.target, view: ctx.view, mag: ctx.mag, flow: ctx.flow, labels: ctx.labels, moved: false };
      return;
    }
    let top = n.owner;
    while (top.parent) top = top.parent;
    // the end of its version: the right end of its count, or the end of its lane at a level that draws no count
    const cp = L.pieces.get(`${top.key}:count`), ce = ctx.pieceEls.get(`${top.key}:count`) as SVGTextElement | undefined;
    const end = cp && cp.o > 0.5 ? cp.v[0] + ((ce && drawn(ce) && ce.getComputedTextLength()) || count(top).length * 6.2) : (L.ext.get(top.key)?.[1] ?? g.x);
    let x = Math.min(0.4 * rw, rw - (end - g.x) * s);
    // the name of its branch stays whole, 12 px into the room: for any step on a branch of a branching, or in a group on one, and for the first step of a version
    let c = n.owner;
    while (c.parent && isTrack(c)) c = c.parent;
    const cap = c.name && (c.parent || c.items[0] === n) ? L.pieces.get(`${c.key}:cap`) : undefined;
    if (cap && cap.o > 0.5) x = Math.max(x, (g.x - cap.v[0]) * s + 12);
    x = Math.max(x, (L.dx * s) / 2);
    // the count of its version, where it is put in the room, stays whole: the tidy does not cut it to show more on the left
    const endIn = !!cp && cp.o > 0.5 && x + (end - g.x) * s <= rw + 0.5;
    const h = L.H * s, band = L.bands.get(top.key);
    let y = (rh - h) / 2 + g.y * s;
    if (h > rh + 0.5 && band) {
      y = (g.y - band[0]) * s;
      if (y > 0.7 * rh) y = 0.6 * rh;
    }
    ctx.anchor = ctx.hold(n, [x, y], true);
    ctx.frame();
    // Nothing is cut in two at an edge of the stage or at the zoom control: the plan moves a little to show it whole, or else to hide it (see tidyPlace()), past an end of the plan if need be.
    // The step and the name of its branch stay whole; it goes down no further than 75% of the room, and no further right than 60%, or 24 px past where the ends of the plan put it.
    [x, y] = ctx.here(n.node.id);
    // the name of its branch, as far into the room as the first view put it, and no less than 12 px
    const capAt = cap && cap.o > 0.5 ? (cap.v[0] - g.x) * s : null, capFloor = capAt === null ? 0 : Math.min(12, x + capAt);
    const [dx, dy] = ctx.tidyPlace(L, n.node.id, {
      reach: firstReach(L), per: 0.02, past: true,
      must: [...(capAt !== null ? [`t:${c.key}:cap`] : []), ...(endIn ? [`t:${top.key}:count`] : [])],
      ok: (hx, hy) => hy <= 0.75 * rh && hx <= Math.max(0.6 * rw, x + 24) && hx >= (L.dx * s) / 2 && (capAt === null || hx + capAt >= capFloor - 1),
    });
    tidied(n, L, [x + dx, y + dy]);
  }
  /** How far the tidy of the first view may move the plan, across and down: less across where the plan runs down, as its column stays whole. */
  function firstReach(L: Layout): [number, number] {
    const [rw, rh] = ctx.roomOf(L);
    return L.turned ? [Math.min(60, 0.15 * rw), Math.min(200, 0.3 * rh)] : [Math.min(120, 0.3 * rw), Math.min(120, 0.3 * rh)];
  }
  /** Puts the step the first view opens on at the place its tidy found, past an end of the plan if it went there, and keeps how far past. */
  function tidied(n: TNode, L: Layout, p: [number, number]): void {
    const g = L.geo.get(n.node.id)!;
    ctx.beyond = ctx.pastEnd(L, [p[0] - g.x * L.s, p[1] - g.y * L.s]);
    const [x, y] = ctx.here(n.node.id);
    if (Math.abs(p[0] - x) > 0.01 || Math.abs(p[1] - y) > 0.01) {
      ctx.anchor = ctx.hold(n, p, true);
      ctx.frame();
    }
    ctx.anchor = null;
    ctx.opened = { target: ctx.target, view: ctx.view, mag: ctx.mag, flow: ctx.flow, labels: ctx.labels, moved: false };
  }
  /** Where a branch and all that is in it are drawn, left to right, in units of the plan: its steps with their names, its groups, pills, names and frames; not its lines, since the line it parts from runs from the lane it leaves. */
  function columnOf(c: TBranch): [number, number] | null {
    const inside = (b?: TBranch): boolean => {
      for (; b; b = b.parent) if (b === c) return true;
      return false;
    };
    const es: (Element | undefined)[] = [];
    for (const m of ctx.all) if (inside(m.owner)) {
      const e = ctx.nodeEls.get(m.node.id)!;
      if (drawn(e.g)) es.push(e.coin, e.ring, e.mark, ...e.vlines, ...e.lines);
    }
    for (const sp of ctx.pods) if (inside(sp.owner)) {
      const e = ctx.podEls.get(sp.key)!;
      if (drawn(e.g)) es.push(e.coin, e.mark, ...e.vlines, ...e.lines);
    }
    for (const [k, p] of ctx.views[ctx.view][ctx.target].pieces) if (inside(p.of) && p.t !== 'seg' && p.t !== 'fan' && p.t !== 'join') es.push(ctx.pieceEls.get(k));
    const r = svg.getBoundingClientRect();
    const xs = es.filter((e): e is SVGElement => drawn(e) && Number(e.getAttribute('opacity') ?? 1) > 0.5).map(e => e.getBoundingClientRect()).filter(b => b.width || b.height);
    if (!xs.length) return null;
    return [(Math.min(...xs.map(b => b.left)) - r.left) / ctx.scale, (Math.max(...xs.map(b => b.right)) - r.left) / ctx.scale];
  }
  /** The first view, down. Across: a level that fits the width of the room is in the middle; else the column of the step now() gives is whole, 8 px in from the left,
   * with as many whole columns of its branching left of it as fit; and the next column right of them too where all fit the stage, its padding counted, in the middle of it.
   * A step on the lane of its version has the left end of the plan at the left of the room.
   * Down: the step 40% down the room, as far as the ends of the plan allow. Then nothing is cut in two at an edge, as across, with those columns whole. */
  function openingDown(n: TNode, L: Layout): void {
    const s = L.s, g = L.geo.get(n.node.id)!, [rw, rh] = ctx.roomOf(L), w = L.W * s;
    // the column it is in: the branch it is on, or the one the group it is in is on
    let c = n.owner;
    while (c.parent && isTrack(c)) c = c.parent;
    const col = c.parent ? columnOf(c) : null, whole = !!col && (col[1] - col[0]) * s + 16 <= rw;
    // the columns put whole, from left to right, in units of the plan
    let x = g.x * s, left = col?.[0] ?? 0, right = col?.[1] ?? 0;
    if (w <= rw + 0.5) x = (rw - w) / 2 + g.x * s;
    else if (col) {
      // the columns of the same branching to its left, the nearest first, as long as they and it are whole in the room
      const split = c.parent!.items.find((it): it is TSplit => isKids(it) && it.kids.includes(c)), at = split?.kids.indexOf(c) ?? 0;
      for (let i = at - 1; whole && split && i >= 0; i--) {
        const sib = columnOf(split.kids[i]);
        if (!sib || (right - sib[0]) * s + 16 > rw) break;
        left = sib[0];
      }
      x = (g.x - left) * s + 8;
      // the next one to the right, where it is cut at the right edge: whole with them where they all fit the stage, 4 px in from its edges
      const next = whole && split && split.kids[at + 1] ? columnOf(split.kids[at + 1]) : null;
      const lo = 4 - PAD.l, hi = rw + PAD.x - PAD.l - 4;
      if (next && (next[0] - left) * s + 8 < hi && (next[1] - left) * s <= hi - lo) {
        if ((next[1] - left) * s + 8 > rw) x = (g.x - left) * s + lo + (hi - lo - (next[1] - left) * s) / 2;
        right = next[1];
      }
    }
    ctx.anchor = ctx.hold(n, [x, 0.4 * rh], true);
    ctx.frame();
    let y: number;
    [x, y] = ctx.here(n.node.id);
    // where the columns put whole start and end in the room, as put
    const l0 = x + (left - g.x) * s, r0 = x + (right - g.x) * s;
    const [dx, dy] = ctx.tidyPlace(L, n.node.id, {
      reach: firstReach(L), per: 0.02, past: true,
      // the columns put whole stay whole, in the room or as far into the stage as they were put; where its own is wider than the room, its left edge stays in.
      // The step goes no higher than a quarter of the room, or 100 px in a tall one; and no lower than 60%, or 24 px under where the ends of the plan put it
      ok: (hx, hy) => hy >= Math.min(0.25 * rh, 100) && hy <= Math.max(0.6 * rh, y + 24) && (!col || w <= rw + 0.5 || (hx + (left - g.x) * s >= Math.min(0, l0) - 0.5 && (!whole || hx + (right - g.x) * s <= Math.max(rw, r0) + 0.5))),
    });
    tidied(n, L, [x + dx, y + dy]);
  }
  /** Is the first view still as it was put (see opened)? */
  const untouched = (): boolean => !!ctx.opened && !ctx.picked && !ctx.only && !ctx.raf && !ctx.sraf && ctx.opened.target === ctx.target && ctx.opened.view === ctx.view && ctx.opened.mag === ctx.mag && ctx.opened.flow === ctx.flow && ctx.opened.labels === ctx.labels && !ctx.opened.moved;

  return { middle, firstView, firstReach, columnOf, untouched };
}

export type OpeningPart = ReturnType<typeof openingPart>;
