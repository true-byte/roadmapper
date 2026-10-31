// One frame of the plan: every piece and every step put where the page is, between two levels, two views, two layouts or the labels shown and hidden. And how big each level draws.
import type { ViewContext } from './context.js';
import { AURA, C, COIN, F, FR, IC, PILL, type Layout } from './layout.js';
import { clamp, r2 } from './math.js';
import { isDot, lineOf, pathOf, pointOf, points, rectOf } from './shapes.js';

// ---- the size: every level draws at reading size, the same on every screen, as text on a web page. A level that is bigger than the room pans. ----
// A pinch, or Ctrl and the wheel, scales the page at the level it is at, and the scale is kept through a change of level.

/** Reading size: a step's name is 13 × 1.2 = 15.6 px on the screen. */
export const READ = 1.2;

/** How far the page scales against reading size: out to where the whole level fits the room, but never under LO; in up to HI. */
export const MAG = { LO: 0.25, HI: 3 };

export function framePart(ctx: ViewContext) {
  const { knob, svg } = ctx;

  /** The least scale of a level: where all of it fits the room. A level that fits at reading size does not get smaller. */
  const least = (L: Layout): number => {
    const [rw, rh] = ctx.room();
    const fit = clamp(Math.min(rw / (L.W * READ), rh / (L.H * READ)), MAG.LO, 1);
    return ctx.floor === null ? fit : Math.min(fit, ctx.floor);
  };
  /** How big each level draws: reading size, times the scale asked for, as far as that level allows. */
  function size(): void {
    // both layouts, as a turn draws from one to the other, with the labels shown and hidden, as a flip does
    for (const S of ctx.setsBy) for (const levels of [...S.h, ...S.v]) for (const L of levels) L.s = READ * clamp(ctx.mag, least(L), MAG.HI);
  }

  /** The two layouts the page is between, and how far from the first to the second: two levels of one view, the two views of one level, across and down at one level of one view,
   * or the labels shown and hidden at one level of one view. */
  function span(): [Layout, Layout, number] {
    if (ctx.t > 0 && ctx.t < 1) return [ctx.sets.h[ctx.view][ctx.target], ctx.sets.v[ctx.view][ctx.target], ctx.t];
    if (ctx.u > 0 && ctx.u < 1) return [ctx.views[0][ctx.target], ctx.views[1][ctx.target], ctx.u];
    if (ctx.w > 0 && ctx.w < 1) return [ctx.setsBy[0][ctx.flow][ctx.view][ctx.target], ctx.setsBy[1][ctx.flow][ctx.view][ctx.target], ctx.w];
    // at rest, those of the labels w rests at: a flip draws its first frame from where it starts
    const levels = ctx.setsBy[ctx.w][ctx.flow][ctx.u], a = Math.max(0, Math.min(Math.floor(ctx.z), ctx.K - 1));
    return [levels[a], levels[Math.min(ctx.K, a + 1)], ctx.z - a];
  }
  /** Each line of the turn from A to Z as its points at both ends, made once for each turn (see turnLines). */
  function turnOf(A: Layout, Z: Layout): Map<string, [number[], number[]]> {
    if (ctx.turnLines?.A === A && ctx.turnLines.Z === Z) return ctx.turnLines.at;
    const at = new Map<string, [number[], number[]]>();
    for (const [k, p] of A.pieces) {
      if (p.t !== 'seg' && p.t !== 'fan' && p.t !== 'join') continue;
      const q = Z.pieces.get(k)!;
      at.set(k, [points(lineOf(p.t, p.v, A.turned, A.corner)), points(lineOf(q.t, q.v, Z.turned, Z.corner))]);
    }
    ctx.turnLines = { A, Z, at };
    return at;
  }

  /** Draws one frame: every piece, every step and every group step where the page is now (see span()), and then puts the plan in the room. */
  function frame(): void {
    const [A, Z, f] = span();
    const mix = (p: number, q: number): number => p + (q - p) * f;
    // from one line of a name to the next, and how far under the middle of a line its baseline is, down
    const line = ctx.plan!.fonts.line, low = (0.32 * line * 13) / 16;
    // a turn: across to down, or back
    const turning = A.turned !== Z.turned;
    // in a turn, the texts of the layout it leaves go in its first 30%, and those of the layout it goes to come in its last 30%
    const leave = turning ? clamp(1 - f / 0.3, 0, 1) : 1, come = turning ? clamp((f - 0.7) / 0.3, 0, 1) : 1;
    // how much the names across show, and how much those down
    const across = turning ? (A.turned ? come : leave) : A.turned ? 0 : 1, down = turning ? (A.turned ? leave : come) : A.turned ? 1 : 0;
    const corner = { lane: mix(A.corner.lane, Z.corner.lane), far: mix(A.corner.far, Z.corner.far) };
    const ends = turning ? turnOf(A, Z) : null;
    // the width on the page runs straight from one level to the next, so a move between two levels that fit never sticks out
    ctx.wide = mix(A.W, Z.W); ctx.tall = mix(A.H, Z.H);
    ctx.scale = mix(A.W * A.s, Z.W * Z.s) / ctx.wide;
    svg.setAttribute('viewBox', `0 0 ${r2(ctx.wide)} ${r2(ctx.tall)}`);
    svg.setAttribute('width', r2(ctx.wide * ctx.scale));
    svg.setAttribute('height', r2(ctx.tall * ctx.scale));

    for (const [k, e] of ctx.pieceEls) {
      const p = A.pieces.get(k)!, q = Z.pieces.get(k)!;
      const v = p.v.map((n, i) => mix(n, q.v[i]));
      // a text shows only near its own level, so two levels of text never lie on each other mid-move
      // a line with no length would still draw its round end, as a dot: after a group of steps in a row that is the last thing on its branch
      // in a turn, a line that has no length at one end grows out of a point at that end, and comes in as it grows
      const dot = !turning && isDot(p.t, v), o = turning ? mix(isDot(p.t, p.v) ? 0 : p.o, isDot(q.t, q.v) ? 0 : q.o) : mix(p.o, q.o);
      const text = p.t === 'txt' || p.t === 'cap' || p.t === 'gname';
      // what a pill holds goes first when its track opens, before the steps come out of the pill
      const show = (dot ? 0 : p.t === 'txt' ? clamp((o - 0.85) / 0.15, 0, 1) : p.t === 'cap' || p.t === 'gname' || p.t === 'tally' ? clamp((o - 0.65) / 0.35, 0, 1) : o) * (turning && text ? leave + come : 1);
      e.style.display = show < 0.01 ? 'none' : '';
      e.setAttribute('opacity', r2(show));
      if (p.t === 'seg' || p.t === 'fan' || p.t === 'join') {
        if (ends) {
          // the line as a run of points, each on its way from its place in the one layout to its place in the other
          const [a, b] = ends.get(k)!;
          let d = '';
          for (let i = 0; i < a.length; i += 2) d += `${i ? ' L' : 'M'} ${r2(mix(a[i], b[i]))} ${r2(mix(a[i + 1], b[i + 1]))}`;
          e.setAttribute('d', d);
        } else e.setAttribute('d', pathOf(lineOf(p.t, v, A.turned, corner)));
      } else if (p.t === 'tally') {
        const [x, y] = ends ? pointOf(p.v, A.turned).map((n, i) => mix(n, pointOf(q.v, Z.turned)[i])) : pointOf(v, A.turned);
        e.setAttribute('transform', `translate(${r2(x)} ${r2(y)}) scale(${v[2].toFixed(3)})`);
        // the mark of the state, left in the pill, or in the middle of a pill with no count; the count goes and comes with the names of the branches
        const mark = e.firstElementChild!, digits = e.lastElementChild as SVGElement, words = clamp((v[4] - 0.65) / 0.35, 0, 1);
        mark.setAttribute('transform', `translate(${r2(v[3])} 0) scale(${PILL.MARK.toFixed(3)})`);
        digits.style.display = words < 0.01 ? 'none' : '';
        if (words < 1) digits.setAttribute('opacity', r2(words));
        else digits.removeAttribute('opacity');
      } else if (p.t === 'frame' || p.t === 'bar' || p.t === 'rule') {
        let r = rectOf(p.t, v, A.turned);
        if (ends) {
          const a = rectOf(p.t, p.v, A.turned), b = rectOf(p.t, q.v, Z.turned);
          r = { x: mix(a.x, b.x), y: mix(a.y, b.y), w: mix(a.w, b.w), h: mix(a.h, b.h) };
        }
        e.setAttribute('x', r2(r.x)); e.setAttribute('y', r2(r.y));
        e.setAttribute('width', r2(r.w)); e.setAttribute('height', r2(r.h));
        // across, a pill is round at its ends; down, it lies across its line, round at its ends too
        e.setAttribute('rx', r2(p.t === 'rule' ? 0 : p.t === 'frame' ? Math.min(FR.RX, r.w / 2, r.h / 2) : ends || A.turned ? Math.min(r.w, r.h) / 2 : v[3] / 2));
        const halo = ctx.haloEls.get(k);
        if (halo) {
          for (const a of ['x', 'y', 'width', 'height', 'rx']) halo.setAttribute(a, e.getAttribute(a)!);
          halo.style.display = e.style.display;
        }
      } else {
        // in a turn, a name of a branch or of a group and a count glide with what they name, as the steps do
        const [x, y] = ends ? pointOf(p.v, A.turned).map((n, i) => mix(n, pointOf(q.v, Z.turned)[i])) : pointOf(v, A.turned);
        e.setAttribute('x', r2(x)); e.setAttribute('y', r2(y));
      }
      const hit = ctx.hitEls.get(k);
      if (hit) {
        hit.setAttribute('d', e.getAttribute('d')!);
        hit.style.display = show < 0.5 ? 'none' : '';
      }
    }

    /** How far from its step the name of a step or of a group is written: across fy over it, down fy right of it. In a turn each name keeps that of its own layout. */
    const fyOf = (p: { m?: number; fy: number }, q: { m?: number; fy: number }, downward: boolean): number =>
      turning ? (A.turned === downward ? p.fy : q.fy) : p.m && q.m ? mix(p.fy, q.fy) : p.m ? p.fy : q.fy;
    /** Puts the lines of a name: across over the step, the last line nearest it; down right of the step, the lines centred on it. Only those of the layout the plan is in, or turns from or to, are drawn. */
    const name = (lines: SVGElement[], vlines: SVGElement[], x: number, y: number, hy: number, vy: number, seen: number): void => {
      const h = seen * across, d = seen * down;
      lines.forEach((t, i) => {
        t.style.display = h < 0.01 ? 'none' : '';
        if (h < 0.01 && !across) return;
        t.setAttribute('x', r2(x)); t.setAttribute('y', r2(y - hy - (lines.length - 1 - i) * line));
        t.setAttribute('opacity', r2(h));
      });
      vlines.forEach((t, i) => {
        t.style.display = d < 0.01 ? 'none' : '';
        if (d < 0.01 && !down) return;
        t.setAttribute('x', r2(x + vy)); t.setAttribute('y', r2(y + (i - (vlines.length - 1) / 2) * line + low));
        t.setAttribute('opacity', r2(d));
      });
    };

    for (const n of ctx.all) {
      const id = n.node.id, p = A.geo.get(id)!, q = Z.geo.get(id)!, e = ctx.nodeEls.get(id)!;
      const x = mix(p.x, q.x), y = mix(p.y, q.y), m = mix(p.m, q.m);
      ctx.cur.set(id, { x, y });
      // a step inside a closed track, or inside a group that is one step, is not drawn; it comes out of the pill, or of that step, as it opens
      const seen = clamp((mix(p.o, q.o) - 0.4) / 0.6, 0, 1);
      e.g.style.display = seen < 0.01 ? 'none' : '';
      if (seen < 1) e.g.setAttribute('opacity', r2(seen));
      else e.g.removeAttribute('opacity');
      const k = mix(p.k, q.k);
      e.g.setAttribute('transform', `translate(${r2(x)} ${r2(y)}) scale(${k.toFixed(3)})`);
      // the disc a finger hits is as big on the page however big the step is drawn
      e.tap.setAttribute('r', r2(mix(p.tap, q.tap) / k));
      // where a step is drawn as its icon, the icon grows in the middle and the mark of the state gets small at its bottom right
      // where it is a coin, the body comes in under the icon, the ring of a milestone and the ring that lights lie on the edge of the body, and the mark of the state moves out to that edge
      const on = mix(p.ic, q.ic), coin = mix(p.coin, q.coin), body = e.ring ? COIN.BIG : COIN.R;
      const ring = e.icon ? F.RING + (IC.RING - F.RING) * on + (COIN.BIG - IC.RING) * coin : F.RING;
      if (e.icon && e.coin) {
        e.icon.style.display = on < 0.01 ? 'none' : '';
        e.icon.setAttribute('opacity', r2(on));
        e.icon.setAttribute('transform', `scale(${((0.5 + 0.5 * on) * (e.ring ? 1 + (COIN.GROW - 1) * coin : 1)).toFixed(3)})`);
        e.coin.style.display = coin < 0.01 ? 'none' : '';
        e.coin.setAttribute('opacity', r2(coin));
        const at = (IC.AT + (body * COIN.ON - IC.AT) * coin) * on;
        if (on) e.mark.setAttribute('transform', `translate(${r2(at)} ${r2(at)}) scale(${(1 - (1 - IC.MARK) * on).toFixed(3)})`);
        else e.mark.removeAttribute('transform');
        e.ring?.setAttribute('r', r2(ring));
      }
      e.aura.setAttribute('r', r2(e.ring ? ring : C.R + AURA + (e.icon ? (IC.HOT + (COIN.R - IC.HOT) * coin - C.R - AURA) * on : 0)));
      // the ring of a step that just changed starts at its mark, or at the edge of its coin
      e.halo?.setAttribute('r', r2(C.R + (e.icon ? (body - C.R) * coin : 0)));
      // the name comes in last
      name(e.lines, e.vlines, x, y, fyOf(p, q, false), fyOf(p, q, true), clamp((m - 0.8) / 0.2, 0, 1) * seen);
    }

    // down, what a group that is one step holds is drawn turned: its tracks part downward, and its steps in a row run down
    const turn = 90 * mix(A.turned ? 1 : 0, Z.turned ? 1 : 0);
    for (const sp of ctx.pods) {
      const p = A.pods.get(sp.key)!, q = Z.pods.get(sp.key)!, e = ctx.podEls.get(sp.key)!;
      const x = mix(p.x, q.x), y = mix(p.y, q.y), k = mix(p.k, q.k), r = r2(mix(p.hw, q.hw) / k);
      // it is gone by the time its tracks are half out of it
      const seen = clamp((mix(p.o, q.o) - 0.5) / 0.5, 0, 1);
      e.g.style.display = seen < 0.01 ? 'none' : '';
      e.g.setAttribute('opacity', r2(seen));
      e.g.setAttribute('transform', `translate(${r2(x)} ${r2(y)}) scale(${k.toFixed(3)})`);
      // its body is its whole size, and the ring that lights lies on its edge
      e.coin.setAttribute('r', r); e.aura.setAttribute('r', r);
      e.halo?.setAttribute('r', r);
      e.tap.setAttribute('r', r2(mix(p.tap, q.tap) / k));
      // with icons the drawing of what it holds grows in the middle, and the mark of the state gets small and moves out to the edge
      const on = mix(p.ic, q.ic), at = r2(mix(p.at, q.at));
      e.icon.style.display = on < 0.01 ? 'none' : '';
      e.icon.setAttribute('opacity', r2(on));
      e.icon.setAttribute('transform', `${turn ? `rotate(${r2(turn)}) ` : ''}scale(${(0.5 + 0.5 * on).toFixed(3)})`);
      e.mark.setAttribute('transform', `translate(${at} ${at}) scale(${mix(p.ms, q.ms).toFixed(3)})`);
      // a group's name shows with it, at once; as the labels go it goes first, as the name of a step does, and stays where it was written
      name(e.lines, e.vlines, x, y, fyOf(p, q, false), fyOf(p, q, true), clamp((mix(p.m, q.m) - 0.8) / 0.2, 0, 1) * seen);
    }

    knob.style.left = `${((ctx.z + 0.5) / (ctx.K + 1)) * 100}%`;
    ctx.place(A, Z, f);
  }

  return { least, size, frame };
}

export type FramePart = ReturnType<typeof framePart>;
