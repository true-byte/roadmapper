// Touch: one finger is the browser's own scroll, with its fling. Two fingers pinch the page and move it, at the level it is at. And Safari's own pinch.
import type { ViewContext } from './context.js';
import { MAG, READ } from './frame.js';
import { clamp } from './math.js';

export function touchPart(ctx: ViewContext): void {
  const { host, off, once, PAD, picker, popup, side, stage, svg, zoom } = ctx;

  host.addEventListener('pointerdown', e => { ctx.lastPointer = e.pointerType; ctx.pressedAt = performance.now(); }, { capture: true, signal: off.signal });
  /** Each finger on the view, by its id: did it come down on the side bar or the zoom control, which keep their own touch? */
  const fingers = new Map<number, boolean>();
  /** Where the two fingers were last: drawn once a frame. */
  let pinchAt: { d: number; mx: number; my: number } | null = null;
  /** A gesture the browser took as a scroll stays one until all its fingers are up. */
  let panned = false;
  const two = (e: TouchEvent, a?: number, b?: number): [Touch, Touch] | null => {
    const ts = [...e.touches];
    const p = a === undefined ? ts[0] : ts.find(t => t.identifier === a), q = b === undefined ? ts[1] : ts.find(t => t.identifier === b);
    return p && q ? [p, q] : null;
  };
  const apart = ([p, q]: [Touch, Touch]): { d: number; mx: number; my: number } => ({ d: Math.hypot(p.clientX - q.clientX, p.clientY - q.clientY), mx: (p.clientX + q.clientX) / 2, my: (p.clientY + q.clientY) / 2 });
  /** Where each finger was at the last touch event before this one: a pinch starts from where its fingers were, so it follows them from their first move. */
  const lastAt = new Map<number, [number, number]>();
  const mark = (e: TouchEvent): void => { for (const t of e.touches) lastAt.set(t.identifier, [t.clientX, t.clientY]); };
  /** The finger left on the glass after the other of a pinch is up: the plan follows it, since the browser's own scroll does not start again in that touch. */
  let lone: { id: number; x: number; y: number } | null = null;
  host.addEventListener('touchstart', ev => {
    const e = ev as TouchEvent, path = e.composedPath(), own = path.includes(side) || path.includes(zoom) || path.includes(popup) || path.includes(picker);
    for (const t of e.changedTouches) fingers.set(t.identifier, own);
    lone = null;
    mark(e);
  }, { passive: true, signal: off.signal });
  host.addEventListener('touchmove', ev => {
    const e = ev as TouchEvent;
    try {
      if (ctx.pinch) {
        // a third finger changes nothing; a pinch ends when one of its two is up
        const f = two(e, ctx.pinch.a, ctx.pinch.b);
        if (!f) return endPinch();
        if (e.cancelable) e.preventDefault();
        pinchAt = apart(f);
        if (!ctx.praf) ctx.praf = requestAnimationFrame(pinchTick);
        return;
      }
      if (lone) {
        const t = [...e.touches].find(f => f.identifier === lone!.id);
        if (!t || e.touches.length !== 1 || !e.cancelable) { lone = null; return; }
        e.preventDefault();
        stage.scrollBy(lone.x - t.clientX, lone.y - t.clientY);
        lone.x = t.clientX; lone.y = t.clientY;
        return;
      }
      // exactly two fingers, both on the plan or the head
      if (panned || e.touches.length !== 2 || [...e.touches].some(t => fingers.get(t.identifier) !== false)) return;
      // the browser has started a scroll with them: it stays a scroll
      if (!e.cancelable) { panned = true; return; }
      // a flip of the labels on its way ends at once, and the pinch starts
      ctx.endFlip();
      // while the level changes, or only some steps show, two fingers do nothing
      if (ctx.raf || !ctx.plan || !ctx.all.length || ctx.only) { e.preventDefault(); return; }
      e.preventDefault();
      ctx.endScale();
      ctx.hover(null);
      ctx.dropTap();
      // from where the fingers were before this move, so the first frame catches up with it
      const f = two(e)!, start = f.map(t => lastAt.get(t.identifier) ?? [t.clientX, t.clientY]);
      const was = { d: Math.hypot(start[0][0] - start[1][0], start[0][1] - start[1][1]), mx: (start[0][0] + start[1][0]) / 2, my: (start[0][1] + start[1][1]) / 2 };
      const r = svg.getBoundingClientRect();
      ctx.pinch = { a: f[0].identifier, b: f[1].identifier, d0: Math.max(1, was.d), mag0: ctx.views[ctx.view][ctx.target].s / READ, x: (was.mx - r.left) / ctx.scale, y: (was.my - r.top) / ctx.scale };
      pinchAt = apart(f);
      if (!ctx.praf) ctx.praf = requestAnimationFrame(pinchTick);
      ctx.moving();
    } finally {
      mark(e);
    }
  }, { passive: false, signal: off.signal });
  const lift = (ev: Event): void => {
    const e = ev as TouchEvent;
    for (const t of e.changedTouches) { fingers.delete(t.identifier); lastAt.delete(t.identifier); }
    if (ctx.pinch && !two(e, ctx.pinch.a, ctx.pinch.b)) {
      // the finger of the pinch that is still down
      const still = [...e.touches].find(t => t.identifier === ctx.pinch!.a || t.identifier === ctx.pinch!.b);
      endPinch();
      lone = still && e.touches.length === 1 ? { id: still.identifier, x: still.clientX, y: still.clientY } : null;
    }
    if (!e.touches.length) { panned = false; lone = null; }
  };
  host.addEventListener('touchend', lift, once);
  host.addEventListener('touchcancel', lift, once);
  /** The scale follows how far apart the fingers are, and the plan moves with the point between them. */
  function pinchTick(): void {
    ctx.praf = 0;
    if (!ctx.pinch || !pinchAt) return;
    const st = stage.getBoundingClientRect();
    scaleNow((ctx.pinch.mag0 * pinchAt.d) / ctx.pinch.d0, ctx.pinch.x, ctx.pinch.y, pinchAt.mx - st.left - PAD.l, pinchAt.my - st.top - PAD.t);
  }
  function endPinch(): void {
    if (!ctx.pinch) return;
    cancelAnimationFrame(ctx.praf);
    pinchTick();
    ctx.pinch = null; pinchAt = null; ctx.pin = null;
    ctx.save();
    ctx.moving();
  }
  /** Scales the page at once, for a pinch, which follows the fingers with no ease: the point (x, y) of the plan goes to (px, py) of the room, as far as the ends of the plan allow. The level stays. */
  function scaleNow(to: number, x: number, y: number, px: number, py: number): void {
    ctx.anchor = null;
    ctx.sheetFrom = null;
    ctx.mag = clamp(to, ctx.least(ctx.views[ctx.view][ctx.target]), MAG.HI);
    ctx.pin = { x, y, px, py };
    ctx.size();
    ctx.frame();
  }

  // Safari's own pinch. On a Mac it is the trackpad, and it scales the page around the pointer. On a phone the touches above do it, and the page itself must never zoom.
  const phone = navigator.maxTouchPoints > 0;
  let pointerAt: [number, number] | null = null;
  host.addEventListener('pointermove', e => { pointerAt = [e.clientX, e.clientY]; }, once);
  host.addEventListener('gesturestart', ev => {
    ev.preventDefault();
    if (!phone) ctx.endFlip();
    if (phone || !ctx.plan || !ctx.all.length || ctx.raf || ctx.only) return;
    ctx.endScale();
    ctx.hover(null);
    const r = svg.getBoundingClientRect(), st = stage.getBoundingClientRect(), [px, py] = pointerAt ?? [st.left + st.width / 2, st.top + st.height / 2];
    ctx.gesture = { mag0: ctx.views[ctx.view][ctx.target].s / READ, x: (px - r.left) / ctx.scale, y: (py - r.top) / ctx.scale, px: px - st.left - PAD.l, py: py - st.top - PAD.t };
    ctx.moving();
  }, { passive: false, signal: off.signal });
  host.addEventListener('gesturechange', ev => {
    ev.preventDefault();
    if (ctx.gesture) scaleNow(ctx.gesture.mag0 * (ev as unknown as { scale: number }).scale, ctx.gesture.x, ctx.gesture.y, ctx.gesture.px, ctx.gesture.py);
  }, { passive: false, signal: off.signal });
  host.addEventListener('gestureend', ev => {
    ev.preventDefault();
    if (!ctx.gesture) return;
    ctx.gesture = null; ctx.pin = null;
    ctx.save();
    ctx.moving();
  }, { passive: false, signal: off.signal });
}
