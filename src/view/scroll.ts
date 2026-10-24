// The scroll of the stage: a glide by the view, a scroll by the user, and a thing brought into sight.
// At rest: while a move to a level, a change of view, a scale, a pinch or a smooth scroll is on its way, the host carries the attribute data-moving.
// It goes when the last of them ends, so what embeds the view, or a test, can wait for the view to rest.
import type { ViewContext } from './context.js';
import { clamp } from './math.js';
import { isBranch } from './plan.js';

export function scrollPart(ctx: ViewContext) {
  const { calm, fit, host, PAD, side, stage, tip } = ctx;

  /** Puts data-moving on the host while anything moves, and takes it off once all is at rest. */
  function moving(): void {
    host.toggleAttribute('data-moving', !!ctx.raf || !!ctx.sraf || ctx.gliding || !!ctx.pinch || !!ctx.gesture);
  }
  /** Scrolls the stage by an amount: smoothly where motion is on, at once where it is not. */
  function glide(left: number, top: number): void {
    const smooth = !calm.matches;
    // a scroll stops at the ends of the stage; one that cannot move at all ends with no scrollend, so it is not waited for
    const dx = clamp(left, -stage.scrollLeft, stage.scrollWidth - stage.clientWidth - stage.scrollLeft);
    const dy = clamp(top, -stage.scrollTop, stage.scrollHeight - stage.clientHeight - stage.scrollTop);
    if (smooth && (Math.abs(dx) >= 1 || Math.abs(dy) >= 1)) { ctx.gliding = true; moving(); }
    else glid = [stage.scrollLeft + dx, stage.scrollTop + dy];
    stage.scrollBy({ left, top, behavior: smooth ? 'smooth' : 'auto' });
  }
  /** Where a glide with no motion jumped to: the next scroll that lands there is the script's, not the user's, however late the browser tells of it. */
  let glid: [number, number] | null = null;
  stage.addEventListener('scrollend', () => { if (ctx.gliding) { ctx.gliding = false; moving(); } });

  // the tip of a step or of a closed track stays with it when the plan moves under a pointer that rests
  const follow = (): void => { if (ctx.hot && (!isBranch(ctx.hot) || ctx.shut(ctx.hot)) && !tip.hidden) ctx.hover(ctx.hot); };
  stage.addEventListener('scroll', () => {
    const own = !!glid && Math.abs(stage.scrollLeft - glid[0]) < 1 && Math.abs(stage.scrollTop - glid[1]) < 1;
    glid = null;
    // a scroll the browser made as the stage got smaller, before the view hears of the new size, is not heard
    const same = stage.offsetWidth === ctx.stageWas[0] && stage.offsetHeight === ctx.stageWas[1];
    if (same) ctx.heard = [stage.scrollLeft, stage.scrollTop];
    follow();
    ctx.nameKept();
    ctx.seek();
    if (ctx.raf) return;
    // a scroll the script did not make: the user moved the plan, so the step held last is let go, and a tap that waits to pick picks nothing
    if (Math.abs(stage.scrollLeft - ctx.mine[0]) >= 1 || Math.abs(stage.scrollTop - ctx.mine[1]) >= 1) {
      ctx.anchor = null;
      if (ctx.opened && same) ctx.opened.moved = true;
      // a switch back after this does not put the plan back: the user moved it
      if (!ctx.gliding && !own) { ctx.dropTap(); if (same) ctx.been = null; }
    }
    window.clearTimeout(ctx.saving);
    ctx.saving = window.setTimeout(ctx.save, 200);
  });

  /** Scrolls a thing into the middle of the room where it is not in sight, clear of the side bar. */
  function sight(e: Element): void {
    if (stage.style.overflow === 'hidden') return;
    const r = e.getBoundingClientRect(), st = stage.getBoundingClientRect();
    const l = st.left + PAD.l, t = st.top + PAD.t, low = fit.bottom && !side.hidden;
    const b = low ? Math.min(st.bottom - (PAD.y - PAD.t), side.getBoundingClientRect().top - 24) : st.bottom - (PAD.y - PAD.t);
    const ri = side.hidden || low ? st.right - (PAD.x - PAD.l) : Math.min(st.right - (PAD.x - PAD.l), side.getBoundingClientRect().left - 24);
    if (r.left >= l && r.right <= ri && r.top >= t && r.bottom <= b) return;
    glide((r.left + r.right) / 2 - (l + ri) / 2, (r.top + r.bottom) / 2 - (t + b) / 2);
  }

  return { moving, glide, sight };
}

export type ScrollPart = ReturnType<typeof scrollPart>;
