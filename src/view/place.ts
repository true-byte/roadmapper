// Where the plan sits in the room: the room, the place and the scroll of the plan, where a step is now, and the hold that keeps a step put while the plan moves.
import type { ViewContext } from './context.js';
import type { Layout } from './layout.js';
import { clamp, r2 } from './math.js';
import type { TNode } from './plan.js';

/** The step the view is held by while the level or the view changes, and where that step sits in each layout.
 * With `keep` it stays put also where a level fits the room, as far as the room allows: else a level that fits is in the middle. */
export interface Hold {
  id: string;
  at: Map<Layout, [number, number]>;
  keep: boolean;
  /** The layouts where the place was made tidy (see tidyPlace()), and those of the level it was made at, which stay as they are: out and back in comes back to the same place. */
  tidy: Set<Layout>;
  /** Down: the layouts of the other view that were tidied when the icons were shown or hidden. */
  icons?: Set<Layout>;
}

/** How far a plan goes past its near end and its far end, across and down, in pixels on the screen. */
export type Past = { near: [number, number]; far: [number, number] };

export function placePart(ctx: ViewContext) {
  const { BAR, fit, options, PAD, sheet, side, stage, svg } = ctx;

  /** The room for the plan: the stage with no scroll bar counted, so that a bar that comes or goes moves nothing. */
  const room = (): [number, number] => {
    ctx.stageSize ??= [stage.offsetWidth, stage.offsetHeight];
    return [ctx.stageSize[0] - PAD.x, ctx.stageSize[1] - PAD.y];
  };

  /** Puts the plan in the room: with the held step on a straight run from its place in one layout to its place in the other;
   * or while the page scales, with the pinned point where it is; or else in the middle between two layouts that both fit. */
  function place(A: Layout, Z: Layout, f: number): void {
    const [rw, rh] = room(), w = ctx.wide * ctx.scale, h = ctx.tall * ctx.scale;
    const fits = [A, Z].every(L => L.W * L.s <= rw + 0.5 && L.H * L.s <= rh + 0.5);
    // a plan bigger than the room goes as far past its ends as the first view put it (see beyond): the room before it, and the scroll past its far end
    const nx = w > rw + 0.5 ? ctx.beyond.near[0] : 0, ny = h > rh + 0.5 ? ctx.beyond.near[1] : 0, fx = w > rw + 0.5 ? ctx.beyond.far[0] : 0, fy = h > rh + 0.5 ? ctx.beyond.far[1] : 0;
    let left = (rw - w) / 2, top = (rh - h) / 2, sl = 0, sp = 0;
    if (ctx.anchor && (!fits || ctx.anchor.keep)) {
      const g = ctx.cur.get(ctx.anchor.id)!, p = ctx.anchor.at.get(A)!, q = ctx.anchor.at.get(Z)!;
      left = p[0] + (q[0] - p[0]) * f - g.x * ctx.scale;
      top = p[1] + (q[1] - p[1]) * f - g.y * ctx.scale;
      sl = Math.ceil(Math.max(0, nx - left)); sp = Math.ceil(Math.max(0, ny - top));
    } else if (ctx.pin) {
      // as far as the ends of the plan allow: a plan smaller than the room stays in it, and a bigger one leaves none of the room empty, but what the first view left
      const [pw, ph] = roomOf(f < 0.5 ? A : Z);
      left = clamp(ctx.pin.px - ctx.pin.x * ctx.scale, Math.min(0, pw - w) - fx, Math.max(0, pw - w) + nx);
      top = clamp(ctx.pin.py - ctx.pin.y * ctx.scale, Math.min(0, ph - h) - fy, Math.max(0, ph - h) + ny);
      sl = Math.ceil(Math.max(0, nx - left)); sp = Math.ceil(Math.max(0, ny - top));
    } else if (!fits) {
      // the scroll stays as the user left it
      const p = roomOf(A), q = roomOf(Z);
      left = Math.max(nx, (p[0] + (q[0] - p[0]) * f - w) / 2);
      top = Math.max(ny, (p[1] + (q[1] - p[1]) * f - h) / 2);
    }
    svg.style.margin = `${r2(top + sp)}px 0 0 ${r2(left + sl)}px`;
    // the sheet is as big as the scroll needs it to be, and its far end is where the first view put the plan, if past the end of it
    sheet.style.width = `${r2(Math.max(left + sl + w + fx, sl ? sl + rw + (fx ? 0 : PAD.x) : 0))}px`;
    sheet.style.height = `${r2(Math.max(top + sp + h + fy, sp ? sp + rh + (fy ? 0 : PAD.y) : 0))}px`;
    if (fits || ctx.anchor || ctx.pin) {
      stage.scrollLeft = sl; stage.scrollTop = sp;
      ctx.mine = [stage.scrollLeft, stage.scrollTop];
      ctx.heard = [...ctx.mine];
      // a scroll set here stops a smooth scroll that was on its way
      if (ctx.gliding) { ctx.gliding = false; ctx.moving(); }
    }
    ctx.laid = { fits, right: left + sl + w, bottom: top + sp + h };
    clear();
    ctx.nameKept();
    ctx.seek();
  }
  /** The scroll of the stage. A plan that fits the room does not scroll, so no scroll bar flashes between two layouts that fit.
   * But the side bar lies over the right of the room: a plan that runs under it scrolls, with room past its end, so it can be moved clear of it, as a plan bigger than the room can. */
  // Where the side bar is a sheet at the bottom, it lies over the bottom of the room instead, and the room past the plan is under it.
  function clear(): void {
    const [rw, rh] = room(), low = fit.bottom;
    const cover = (low ? side.offsetHeight : side.offsetWidth) + 16, under = !!ctx.picked && (low ? ctx.laid.bottom > rh - cover + 0.5 : ctx.laid.right > rw - cover + 0.5);
    const scrolls = !ctx.laid.fits || under;
    stage.style.overflow = scrolls ? '' : 'hidden';
    sheet.style.marginRight = ctx.picked && scrolls && !low ? `${cover}px` : '';
    sheet.style.marginBottom = ctx.picked && scrolls && low ? `${cover}px` : '';
    stage.classList.toggle('pans', stage.scrollWidth > stage.clientWidth || stage.scrollHeight > stage.clientHeight);
  }

  /** Where a step is on the screen right now. */
  function at(id: string): [number, number] {
    const r = svg.getBoundingClientRect(), g = ctx.cur.get(id)!;
    return [r.left + g.x * ctx.scale, r.top + g.y * ctx.scale];
  }
  function nearest(from: TNode[], x: number, y: number): TNode {
    let best = from[0], d = Infinity;
    for (const n of from) {
      const [nx, ny] = at(n.node.id), dn = Math.hypot(nx - x, ny - y);
      if (dn < d) { d = dn; best = n; }
    }
    return best;
  }
  /** The room a level has at rest: the room, less a scroll bar where the level runs out of it the other way. */
  function roomOf(L: Layout): [number, number] {
    const [rw, rh] = room(), w = L.W * L.s, h = L.H * L.s;
    // in a box the stage has no scroll bar up and down: the wheel up and down is the page's
    const tall = !options.box;
    let across = w > rw + 0.5, down = tall && h > rh + 0.5;
    if (tall && across && h > rh - BAR + 0.5) down = true;
    if (down && w > rw - BAR + 0.5) across = true;
    return [rw - (down ? BAR : 0), rh - (across ? BAR : 0)];
  }
  /** Where a step is right now, counted from the corner of the room. */
  function here(id: string): [number, number] {
    const r = stage.getBoundingClientRect(), [x, y] = at(id);
    return [x - r.left - PAD.l, y - r.top - PAD.t];
  }
  /** How far the corner of the plan can go along each axis when a level is at rest: from where its far end meets the far side of the room to where its near end meets the near side.
   * A level that fits the room stays in it, in the middle where `keep` is not asked. While the side bar is open the plan can go on past its end by as much as the side bar covers,
   * as clear() lets it scroll, so a move of the level starts where the plan is. A plan bigger than the room also goes on past its ends by `past`: by `beyond` unless asked. */
  function ends(L: Layout, keep: boolean, past = ctx.beyond): [[number, number], [number, number]] {
    const [rw, rh] = roomOf(L), w = L.W * L.s, h = L.H * L.s;
    const cover = ctx.picked ? (fit.bottom ? side.offsetHeight : side.offsetWidth) + 16 : 0;
    const axis = (size: number, rm: number, more: number, k: number): [number, number] => {
      if (size <= rm && !keep) return [(rm - size) / 2, (rm - size) / 2];
      const big = size > rm + 0.5;
      return [Math.min(0, rm - size) - more - (big ? past.far[k] : 0), Math.max(0, rm - size) + (big ? past.near[k] : 0)];
    };
    return [axis(w, rw, fit.bottom ? 0 : cover, 0), axis(h, rh, fit.bottom ? cover : 0, 1)];
  }
  /** How far past its ends, across and down, a plan bigger than the room is when its corner is at `c`. */
  function pastEnd(L: Layout, c: [number, number]): Past {
    const [ax, ay] = ends(L, true, { near: [0, 0], far: [0, 0] });
    return { near: [Math.max(0, c[0] - ax[1]), Math.max(0, c[1] - ay[1])], far: [Math.max(0, ax[0] - c[0]), Math.max(0, ay[0] - c[1])] };
  }
  /** Where the corner of the plan sits when a level is at rest: with a step as near to a wanted point as the ends of the plan allow, or in the middle where the level fits and `keep` is not asked. */
  function rest(L: Layout, id: string, want: [number, number], keep: boolean): [number, number] {
    const g = L.geo.get(id)!, [ax, ay] = ends(L, keep);
    return [clamp(want[0] - g.x * L.s, ax[0], ax[1]), clamp(want[1] - g.y * L.s, ay[0], ay[1])];
  }
  /** Holds the view by a step: in each layout the step is as near as it can be to where it is now, or to a wanted point. */
  function hold(n: TNode, want?: [number, number], keep = false): Hold {
    const id = n.node.id, p = want ?? here(id), at = new Map<Layout, [number, number]>();
    // held where it is, at rest: at the level the page is at, the step is where it is, so the first frame of a move does not jump
    const now = !want && ctx.z === Math.round(ctx.z) ? new Set(ctx.views.map(v => v[ctx.z])) : null;
    // in both layouts, so a turn from one to the other keeps the step put too; and with the labels shown and hidden, as a flip goes from one to the other
    for (const L of ctx.setsBy.flatMap(S => [...S.h.flat(), ...S.v.flat()])) {
      if (now?.has(L)) { at.set(L, [p[0], p[1]]); continue; }
      const [l, t] = rest(L, id, p, keep), g = L.geo.get(id)!;
      at.set(L, [l + g.x * L.s, t + g.y * L.s]);
    }
    return { id, at, keep, tidy: new Set(ctx.views.map(v => v[Math.round(ctx.z)])) };
  }

  return { room, place, clear, at, nearest, roomOf, here, ends, pastEnd, rest, hold };
}

export type PlacePart = ReturnType<typeof placePart>;
