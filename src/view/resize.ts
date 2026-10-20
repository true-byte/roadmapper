// A new size of the view: the plan is put in the room again, and takes the layout the size wants, until the user picks one.
import type { ViewContext } from './context.js';
import { clamp } from './math.js';
import { isStep, type TNode } from './plan.js';

export function resizePart(ctx: ViewContext) {
  const { fit, frozenT, PAD, readFit, stage, zoom } = ctx;

  /** Puts the plan in the room again when the view gets another size; or with `force`, as 'Show only blockers' ends, in the layout the size wants by then. `around` is the step to hold it by. */
  function resized(force = false, around?: TNode): void {
    ctx.stageSize = null;
    const padWas = { ...PAD };
    // a new size of the view may give the stage another padding, the side bar another place, or the plan another layout
    const moved = readFit();
    ctx.placePopup();
    // a scroll bar that comes or goes is not a new size
    if (!ctx.plan || (!force && !moved && stage.offsetWidth === ctx.stageWas[0] && stage.offsetHeight === ctx.stageWas[1])) return;
    ctx.stageWas = [stage.offsetWidth, stage.offsetHeight];
    ctx.been = null;
    const fresh = ctx.untouched();
    ctx.endScale();
    // a move on its way ends at once, where it was going in the room it had: the size does not take the step it holds from it
    if (ctx.raf) { cancelAnimationFrame(ctx.raf); ctx.raf = 0; ctx.z = ctx.target; ctx.u = ctx.view; ctx.t = ctx.flowT(); ctx.w = ctx.labW(); ctx.frame(); ctx.save(); }
    // Until the user picks a layout, it follows the size of the view; while only a blocked step and its blockers show, it stays. It changes at once, with no move: the screen itself just turned.
    // The picked step, or else the one in the middle of the room as it was, stays at the same part of the room; a first view the user has not moved is put again.
    let keep: { n: TNode; fx: number; fy: number } | null = null;
    const to = frozenT === null && !ctx.only ? ctx.pickFlow ?? fit.flow : ctx.flow;
    if (to !== ctx.flow) {
      if (ctx.all.length) {
        // the stage as it was, on the screen now: the scroll may be cut already as the stage got smaller
        const st = stage.getBoundingClientRect(), dx = ctx.heard[0] - stage.scrollLeft, dy = ctx.heard[1] - stage.scrollTop;
        const was = new DOMRect(st.left + PAD.l + dx - padWas.l, st.top + PAD.t + dy - padWas.t, ctx.roomWas[0] + padWas.x, ctx.roomWas[1] + padWas.y);
        const n = around ?? (ctx.picked && isStep(ctx.picked) ? ctx.picked : ctx.middle(was)), [x, y] = ctx.here(n.node.id);
        // the part of the room it was at, and in the room: a step out of sight comes in at its edge
        keep = { n, fx: clamp((x - dx) / ctx.roomWas[0], 0, 1), fy: clamp((y - dy) / ctx.roomWas[1], 0, 1) };
      }
      ctx.beyond = { near: [0, 0], far: [0, 0] };
      ctx.flow = to;
      ctx.views = ctx.sets[ctx.flow];
      ctx.t = ctx.flowT();
      ctx.controls();
    }
    ctx.anchor = null;
    // a level stays at its size; only how far it can be scaled out changes
    ctx.size();
    ctx.frame();
    if (fresh) ctx.firstView();
    else if (keep) {
      const [rw, rh] = ctx.room(), L = ctx.views[ctx.view][ctx.target];
      ctx.anchor = ctx.hold(keep.n, [keep.fx * rw, keep.fy * rh], true);
      ctx.frame();
      // down, the column of the held step stays whole, as after a change of level
      if (L.turned && !ctx.laid.fits) {
        ctx.tidyHeld(L, [L], new Set(), [Math.min(160, 0.35 * rw), Math.min(160, 0.35 * rh)]);
        ctx.frame();
      }
      ctx.anchor = null;
    }
    // the step and its blockers that show alone fit the new room
    ctx.fitOnly();
    ctx.roomWas = ctx.room();
    ctx.uncover();
    ctx.moving();
  }
  const sizer = new ResizeObserver(() => resized());
  sizer.observe(stage);
  // the zoom control gets taller where the name of a level takes two lines: the popup stays over it
  sizer.observe(zoom);

  return { resized, sizer };
}

export type ResizePart = ReturnType<typeof resizePart>;
