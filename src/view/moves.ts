// The four moves: to another level (z), to the other view (u), to the other layout (t), and the labels shown or hidden (w). Each runs from where the page is to where it rests.
// The ways to change the level: the zoom control, the + and − keys, and a double click. A click never does: it is kept for picking a step or a branch.
import type { ViewContext } from './context.js';
import { clamp, ease } from './math.js';
import type { Hold } from './place.js';
import { isStep, type TNode } from './plan.js';

export function movesPart(ctx: ViewContext) {
  const { calm } = ctx;

  /** Where t rests in the layout that is asked for. */
  const flowT = (): number => (ctx.flow === 'v' ? 1 : 0);
  /** Is the plan drawn down, or nearer down than across? */
  const isDown = (): boolean => ctx.t >= 0.5;
  /** Where w rests for the labels that are asked for. */
  const labW = (): number => (ctx.labels ? 0 : 1);

  /** Draws the plan in the layout the user picks: across or down. The pick holds for the visit, also when the view changes size, and the app keeps it. */
  function setFlow(to: 'h' | 'v'): void {
    // while only a blocked step and its blockers show, the layout stays
    if (!ctx.plan || ctx.only) return;
    ctx.pickFlow = to;
    if (to === ctx.flow) { ctx.controls(); ctx.save(); return; }
    turnTo(to, calm.matches ? 0 : 600);
  }
  /** Turns the plan from one layout to the other in one move: the picked step, or else the one in the middle, stays where it is on the screen.
   * The level, the view, the scale, the pick and its side bar, and the popup stay as they are. */
  function turnTo(to: 'h' | 'v', dur: number): void {
    ctx.endScale();
    ctx.hover(null);
    // a zoom, a change of view, a turn or a flip of the labels that is still on its way ends at once
    if (ctx.raf || ctx.z !== ctx.target || ctx.u !== ctx.view || ctx.t !== flowT() || ctx.w !== labW()) { cancelAnimationFrame(ctx.raf); ctx.raf = 0; ctx.z = ctx.target; ctx.u = ctx.view; ctx.t = flowT(); ctx.w = labW(); ctx.frame(); }
    // held where it is now, in the layout the plan is in, before the layouts change; the other layout has its own ends, with nothing past them
    ctx.beyond = { near: [0, 0], far: [0, 0] };
    if (ctx.all.length) ctx.anchor = ctx.hold(switchHold(() => (ctx.picked && isStep(ctx.picked) ? ctx.picked : ctx.middle())));
    ctx.flow = to;
    ctx.views = ctx.sets[ctx.flow];
    ctx.controls();
    // A turn to a layout the switches left the plan in a moment ago puts the plan back where it was in it, as out and back in does.
    // Else in the other layout nothing is cut in two at an edge, as far as a short move keeps the held step near its place: tidied there before the move starts.
    // Down, the column of the held step stays whole
    const h = ctx.anchor, back = backTo(h);
    if (h) {
      const was = ctx.t;
      ctx.t = flowT();
      ctx.frame();
      if (!back && !ctx.laid.fits) {
        const [rw, rh] = ctx.room();
        ctx.tidyHeld(ctx.views[ctx.view][ctx.target], ctx.views.map(v => v[ctx.target]).filter(M => !!M), new Set(), [Math.min(120, 0.3 * rw), Math.min(120, 0.3 * rh)], 0);
      }
      for (const v of ctx.views) if (v[ctx.target]) h.tidy.add(v[ctx.target]);
      ctx.t = was;
      ctx.frame();
    }
    ctx.sheetFrom = null;
    ctx.save();
    const from = ctx.t, goal = flowT(), t0 = performance.now();
    const tick = (now: number): void => {
      const p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      ctx.t = from + (goal - from) * ease(p);
      ctx.frame();
      if (p < 1) ctx.raf = requestAnimationFrame(tick);
      else { ctx.raf = 0; ctx.t = goal; ctx.save(); ctx.uncover(); ctx.moving(); }
    };
    cancelAnimationFrame(ctx.raf);
    ctx.raf = requestAnimationFrame(tick);
    ctx.moving();
  }
  /** The mix of the labels, a view and the layout the plan is in. */
  const mixOf = (v = ctx.view): string => `${ctx.labels ? 'l' : '-'}${v}${ctx.flow}`;
  /** The step a switch holds the plan by: the one it held the plan by last, while the switches are all that moved it at this level and scale and no other step is picked; or else `first()`.
   * Where the plan is now is kept for the mix it is in. */
  function switchHold(first: () => TNode): TNode {
    const p = ctx.picked && isStep(ctx.picked) ? ctx.picked : null;
    if (!ctx.been || ctx.been.target !== ctx.target || ctx.been.mag !== ctx.mag || !ctx.byId.has(ctx.been.id) || (p && p.node.id !== ctx.been.id)) ctx.been = { id: first().node.id, target: ctx.target, mag: ctx.mag, at: new Map() };
    if (!ctx.raf && !ctx.been.at.has(mixOf())) ctx.been.at.set(mixOf(), ctx.here(ctx.been.id));
    return ctx.byId.get(ctx.been.id)!;
  }
  /** After a switch: where the switches left the plan before in the mix it goes to, if they did. Then the held step goes back there, in both views of the layout and labels it goes to. */
  function backTo(h: Hold | null): [number, number] | undefined {
    const b = h && ctx.been?.id === h.id ? ctx.been.at.get(mixOf()) : undefined;
    if (b) ctx.views.forEach((v, i) => { if (v[ctx.target]) h!.at.set(v[ctx.target], [...(ctx.been!.at.get(mixOf(i)) ?? b)]); });
    return b;
  }
  /** A turn that is on its way ends at once, where it was going: a press during it. */
  function endTurn(): void {
    if (!ctx.raf || ctx.t === flowT() || ctx.z !== ctx.target || ctx.u !== ctx.view) return;
    cancelAnimationFrame(ctx.raf); ctx.raf = 0;
    ctx.t = flowT(); ctx.w = labW();
    ctx.frame();
    ctx.save();
    ctx.uncover();
    ctx.moving();
  }

  /** Moves to a level. `around` is the step that stays put, also where the level fits the room; with none it is the step held last, or else see middle(), and the page tidies where it goes.
   * With `keepPick` false, the move does not end with the glide that keeps the picked thing clear of the side bar: a double tap, which picks nothing, keeps the step under the finger put. */
  function go(to: number, around?: TNode, keepPick = true): void {
    // while only a blocked step and its blockers show, the level stays
    if (!ctx.plan || ctx.only) return;
    to = clamp(to, 0, ctx.K);
    if (to === ctx.target) return;
    ctx.endScale();
    ctx.hover(null);
    // a change of view, a turn or a flip of the labels that is still on its way ends at once
    if (ctx.u !== ctx.view || ctx.t !== flowT() || ctx.w !== labW()) { cancelAnimationFrame(ctx.raf); ctx.raf = 0; ctx.u = ctx.view; ctx.t = flowT(); ctx.w = labW(); ctx.frame(); }
    const was = ctx.target;
    ctx.target = to;
    ctx.asked = to;
    ctx.askedLast = to === ctx.K;
    ctx.controls();
    if ((around || !ctx.anchor) && ctx.all.length) ctx.anchor = around ? ctx.hold(around, undefined, true) : ctx.hold(ctx.middle());
    // a step the user pointed at stays put across; else, and down, nothing is cut in two at the new level, as far as the held step stays in sight.
    // Down, the column of a step the user pointed at stays whole too: it slides in a little where an edge would cut it
    if (ctx.anchor && (!around || ctx.views[ctx.view][to].turned)) ctx.tidyAt(to, was);
    ctx.sheetFrom = null;
    // the level is kept from the moment it is chosen
    ctx.save();
    const from = ctx.z, t0 = performance.now(), dur = calm.matches ? 0 : 420 + 260 * Math.abs(to - from);
    cancelAnimationFrame(ctx.raf);
    const tick = (now: number): void => {
      const p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      ctx.z = from + (to - from) * ease(p);
      ctx.frame();
      if (p < 1) ctx.raf = requestAnimationFrame(tick);
      else { ctx.raf = 0; ctx.z = to; ctx.save(); if (keepPick) ctx.uncover(); else ctx.clear(); ctx.moving(); }
    };
    ctx.raf = requestAnimationFrame(tick);
    ctx.moving();
  }

  /** Shows the icons or hides them. The step held last stays put, or else see middle(). */
  function setIcons(icons: boolean): void {
    const to = icons ? 1 : 0;
    if (!ctx.plan || !ctx.hasIcons || to === ctx.view || ctx.only) return;
    ctx.endScale();
    ctx.hover(null);
    // a zoom, a turn or a flip of the labels that is still on its way ends at once
    if (ctx.z !== ctx.target || ctx.t !== flowT() || ctx.w !== labW()) { cancelAnimationFrame(ctx.raf); ctx.raf = 0; ctx.z = ctx.target; ctx.t = flowT(); ctx.w = labW(); ctx.frame(); }
    // held by the step the switches hold the plan by, or else the one held last, or else the one in the middle
    if (ctx.all.length) {
      const n = switchHold(() => (ctx.anchor && ctx.byId.get(ctx.anchor.id)) || ctx.middle());
      if (ctx.anchor?.id !== n.node.id) ctx.anchor = ctx.hold(n);
    }
    ctx.view = to;
    ctx.prefer = icons;
    ctx.controls();
    // A change to a view the switches left the plan in a moment ago puts the plan back where it was in it.
    // Else down, the other view has other widths: its columns are tidied as after a change of level, once for each hold
    const h = ctx.anchor, M = ctx.views[to][ctx.target], back = backTo(h);
    if (h && M.turned && !back && !h.icons?.has(M)) {
      const uWas = ctx.u;
      ctx.u = to;
      ctx.frame();
      if (!ctx.laid.fits || h.keep) {
        const [rw, rh] = ctx.room();
        ctx.tidyHeld(M, [M], new Set(), [Math.min(160, 0.35 * rw), Math.min(160, 0.35 * rh)]);
      }
      (h.icons ??= new Set()).add(M);
      ctx.u = uWas;
      ctx.frame();
    }
    ctx.sheetFrom = null;
    // the view is kept from the moment it is chosen
    ctx.save();
    const from = ctx.u, t0 = performance.now(), dur = calm.matches ? 0 : 420;
    cancelAnimationFrame(ctx.raf);
    const tick = (now: number): void => {
      const p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      ctx.u = from + (to - from) * ease(p);
      ctx.frame();
      if (p < 1) ctx.raf = requestAnimationFrame(tick);
      else { ctx.raf = 0; ctx.u = to; ctx.save(); ctx.uncover(); ctx.moving(); }
    };
    ctx.raf = requestAnimationFrame(tick);
    ctx.moving();
  }

  /** Shows the labels or hides them. Hidden, the plan draws no word but the names of the versions, and closes up on a grid of its own.
   * The picked step, or else the one in the middle, stays put. The level, the view, the layout, the scale, the pick and its side bar, and the popup stay as they are. */
  function setLabels(on: boolean): void {
    // while only a blocked step and its blockers show, the labels stay
    if (!ctx.plan || on === ctx.labels || ctx.only) return;
    ctx.endScale();
    ctx.hover(null);
    // a zoom, a change of view or a turn that is still on its way ends at once; a flip that is on its way goes back from where it is, by the hold it has
    if (ctx.z !== ctx.target || ctx.u !== ctx.view || ctx.t !== flowT()) { cancelAnimationFrame(ctx.raf); ctx.raf = 0; ctx.z = ctx.target; ctx.u = ctx.view; ctx.t = flowT(); ctx.w = labW(); ctx.frame(); }
    const run = ctx.w !== labW() && !!ctx.anchor;
    // held where it is now, with the labels it has, before the layouts change
    if (!run && ctx.all.length) ctx.anchor = ctx.hold(switchHold(() => (ctx.picked && isStep(ctx.picked) ? ctx.picked : ctx.middle())));
    ctx.labels = on;
    ctx.sets = ctx.setsBy[labW()];
    ctx.views = ctx.sets[ctx.flow];
    ctx.controls();
    // A flip to labels the switches left the plan in a moment ago puts the plan back where it was with them, as a turn back does.
    // Else at the other end nothing is cut in two at an edge, as after a change of level: tidied there before the move starts.
    // Down, the column of the held step stays whole
    const h = ctx.anchor, back = !run && backTo(h);
    if (h && !run) {
      const was = ctx.w;
      ctx.w = labW();
      ctx.frame();
      if (!back && (!ctx.laid.fits || h.keep)) {
        const [rw, rh] = ctx.room();
        ctx.tidyHeld(ctx.views[ctx.view][ctx.target], ctx.views.map(v => v[ctx.target]).filter(M => !!M), new Set(), [Math.min(160, 0.35 * rw), Math.min(160, 0.35 * rh)]);
      }
      for (const v of ctx.views) if (v[ctx.target]) h.tidy.add(v[ctx.target]);
      ctx.w = was;
      ctx.frame();
    }
    ctx.sheetFrom = null;
    // the wish is kept from the moment it is chosen
    ctx.save();
    const from = ctx.w, to = labW(), t0 = performance.now(), dur = calm.matches ? 0 : 420;
    cancelAnimationFrame(ctx.raf);
    const tick = (now: number): void => {
      const p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      ctx.w = from + (to - from) * ease(p);
      ctx.frame();
      if (p < 1) ctx.raf = requestAnimationFrame(tick);
      else { ctx.raf = 0; ctx.w = to; ctx.save(); ctx.uncover(); ctx.moving(); }
    };
    ctx.raf = requestAnimationFrame(tick);
    ctx.moving();
  }
  /** A flip of the labels that is on its way ends at once, where it was going: a pinch during it. */
  function endFlip(): void {
    if (!ctx.raf || ctx.w === labW() || ctx.z !== ctx.target || ctx.u !== ctx.view || ctx.t !== flowT()) return;
    cancelAnimationFrame(ctx.raf); ctx.raf = 0;
    ctx.w = labW();
    ctx.frame();
    ctx.save();
    ctx.uncover();
    ctx.moving();
  }

  return { flowT, isDown, labW, setFlow, endTurn, go, setIcons, setLabels, endFlip };
}

export type MovesPart = ReturnType<typeof movesPart>;
