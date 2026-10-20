// The scale: a pinch, or Ctrl and the wheel, scales the page at the level it is at, around a point that stays where it is.
import type { ViewContext } from './context.js';
import { MAG, READ } from './frame.js';
import { clamp } from './math.js';

export function scalePart(ctx: ViewContext) {
  const { calm, PAD, stage, svg } = ctx;

  /** A scale on its way: the scale it goes to, and when it last moved. */
  let scaling: { to: number; t: number } | null = null;
  /** What runs when the scale on its way ends. */
  let after: (() => void) | null = null;
  /** Scales the page by `by`, around a point on the screen: the point of the plan under it stays under it. The level stays. */
  function scaleBy(by: number, px: number, py: number): void {
    if (!ctx.plan || !ctx.all.length) return;
    const L = ctx.views[ctx.view][ctx.target], now = L.s / READ;
    const to = clamp((scaling?.to ?? now) * by, ctx.least(L), MAG.HI);
    if (!scaling && Math.abs(to - now) < 1e-4) return;
    // the point of the plan under the pointer now, and where that is in the room
    const r = svg.getBoundingClientRect(), st = stage.getBoundingClientRect();
    scaleTo(to, (px - r.left) / ctx.scale, (py - r.top) / ctx.scale, px - st.left - PAD.l, py - st.top - PAD.t);
  }
  /** Scales the page to `to`, with a point of the plan, (x, y), going to a point of the room, (px, py), as far as the ends of the plan allow. The level stays. */
  function scaleTo(to: number, x: number, y: number, px: number, py: number, then?: () => void): void {
    ctx.hover(null);
    // the view moves: the step held last is let go
    ctx.anchor = null;
    ctx.sheetFrom = null;
    ctx.pin = { x, y, px, py };
    scaling = { to, t: scaling?.t ?? performance.now() };
    if (then) after = then;
    // the scale starts from what is drawn, and is then the one asked for at every level
    ctx.mag = ctx.views[ctx.view][ctx.target].s / READ;
    if (!ctx.sraf) ctx.sraf = requestAnimationFrame(scaleTick);
    ctx.moving();
  }
  function scaleTick(t: number): void {
    ctx.sraf = 0;
    const s = scaling;
    if (!s) return;
    // smooth: it closes most of the way in a few frames; with no motion, at once
    const k = calm.matches ? 1 : 1 - Math.exp(-Math.max(0, t - s.t) / 45);
    s.t = t;
    ctx.mag += (s.to - ctx.mag) * k;
    if (Math.abs(s.to - ctx.mag) < 0.002) ctx.mag = s.to;
    ctx.size();
    ctx.frame();
    if (ctx.mag !== s.to) ctx.sraf = requestAnimationFrame(scaleTick);
    else {
      scaling = null; ctx.pin = null; ctx.save();
      const then = after;
      after = null;
      then?.();
    }
    ctx.moving();
  }
  /** A scale that is on its way ends at once, where it was going. */
  function endScale(): void {
    if (!scaling) return;
    cancelAnimationFrame(ctx.sraf); ctx.sraf = 0;
    scaling.t = -Infinity;
    scaleTick(performance.now());
  }

  return { scaleBy, scaleTo, endScale };
}

export type ScalePart = ReturnType<typeof scalePart>;
