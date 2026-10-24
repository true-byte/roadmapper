// The pointer, the keys and the wheel: a press on the stops of the zoom control, a press that closes the popup, the keys, the wheel, a double click and a drag of the plan.
import type { ViewContext } from './context.js';
import { clamp } from './math.js';
import { TAP } from './side.js';

const PAN: Record<string, [number, number] | undefined> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };

export function inputPart(ctx: ViewContext): void {
  const { errorList, head, host, keys, off, once, options, picker, popup, stage, stops, zoom } = ctx;

  // a press on the knob that is let go over another stop goes to that stop: only a press that went down on the stops, with no other pointer down on the view while it lasts.
  // A drag of the plan that is let go over the stops, or two fingers on the control, change nothing
  const downs = new Set<number>();
  let press: { id: number; many: boolean } | null = null;
  host.addEventListener('pointerdown', e => {
    downs.add(e.pointerId);
    if (press && downs.size > 1) press.many = true;
    // a press while the plan turns from one layout to the other ends the turn at once
    ctx.endTurn();
  }, { capture: true, signal: off.signal });
  for (const end of ['pointerup', 'pointercancel']) window.addEventListener(end, e => { downs.delete((e as PointerEvent).pointerId); }, { capture: true, signal: off.signal });
  stops.addEventListener('pointerdown', e => { press = { id: e.pointerId, many: downs.size > 1 }; });
  stops.addEventListener('pointercancel', e => { if (press?.id === e.pointerId) press = null; });
  stops.addEventListener('pointerup', e => {
    const p = press;
    if (p?.id === e.pointerId) press = null;
    // the click that may follow a press of two fingers goes too
    if (p?.many) ctx.noClick = performance.now() + 500;
    if (e.button !== 0 || !p || p.id !== e.pointerId || p.many || !e.isPrimary || performance.now() < ctx.noClick) return;
    const r = stops.getBoundingClientRect();
    ctx.go(Math.floor(((e.clientX - r.left) / r.width) * (ctx.K + 1)));
  });
  // A press anywhere but the popup and the zoom control closes it. The click that ends that press does nothing else on the view: no pick, no zoom.
  // A drag, a scroll or a pinch that starts there still moves the plan.
  // Only a press on the plan or the head is eaten: a press on the side bar closes the popup and does what it does.
  // A double click or a double tap whose first click was eaten is eaten whole: it picks nothing and does not zoom. One that starts after it does.
  // A press that ends with no click, such as one of the right button or a drag let go out of the view, eats nothing after it: a click from the keyboard is never eaten.
  let eat = false, pairEaten = false, eatenTap: { x: number; y: number; t: number } | null = null;
  window.addEventListener('pointerdown', e => {
    eat = false;
    if (popup.hidden && picker.hidden) return;
    const path = e.composedPath();
    if (path.includes(popup) || path.includes(picker) || path.includes(zoom)) return;
    // the second press of a double click on a heading of the popup lands out of the popup that got shorter: the popup stays open, and the press does nothing there
    if (ctx.afterFold(e)) {
      ctx.noClick = performance.now() + 500;
      return;
    }
    ctx.setPopup(false);
    ctx.setBranches(false);
    eat = path.includes(stage) || path.includes(head);
  }, { capture: true, signal: off.signal });
  window.addEventListener('contextmenu', () => { eat = false; }, { capture: true, signal: off.signal });
  host.addEventListener('click', e => {
    if (eat && e.detail > 0) {
      eat = false;
      pairEaten = true;
      // a tap: the next one as near as the second of a double tap is its second half
      eatenTap = ctx.lastPointer === 'touch' ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    const tap = eatenTap;
    eatenTap = null;
    // the second click of a pair whose first was eaten: eaten too, and the pair stays eaten for its double click
    if (pairEaten && e.detail > 0 && (e.detail === 2 || (!!tap && ctx.lastPointer === 'touch' && performance.now() - tap.t < TAP.MS && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < TAP.PX))) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    // any other click starts a pair of its own
    pairEaten = false;
  }, { capture: true, signal: off.signal });
  host.addEventListener('dblclick', e => {
    if (!pairEaten) return;
    pairEaten = false;
    e.stopPropagation();
  }, { capture: true, signal: off.signal });
  keys.addEventListener('keydown', ev => {
    const e = ev as KeyboardEvent;
    if (e.ctrlKey || e.metaKey || e.altKey || !errorList.hidden) return;
    // a key typed into a text field of the page, such as one of a project that embeds the view, belongs to that field; a field inside another element is found by its path
    const at = e.composedPath()[0];
    if (at instanceof HTMLElement && (at.isContentEditable || at.closest('input, textarea, select, [role="textbox"]'))) return;
    const pan = PAN[e.key];
    if (e.key === '+' || e.key === '=') ctx.go(ctx.target + 1);
    else if (e.key === '-' || e.key === '_') ctx.go(ctx.target - 1);
    else if ((e.key === 'i' || e.key === 'I') && !e.repeat) ctx.setIcons(ctx.view === 0);
    // Escape first closes the popup or the list of branches, then brings all back, and only then closes the side bar
    else if (e.key === 'Escape') {
      if (!popup.hidden) ctx.setPopup(false, true);
      else if (!picker.hidden) ctx.setBranches(false, true);
      else if (ctx.only) ctx.endOnly();
      else ctx.pick(null);
    }
    else if (pan) { e.preventDefault(); stage.scrollBy(pan[0], pan[1]); }
  }, once);

  // In a box on another page, the wheel up and down scrolls that page: the stage has no scroll up and down of its own there (view.css),
  // so a wheel sideways, a drag or the keys move the plan. Only a pinch, or Ctrl and the wheel, over the box is the view's.
  (options.box ? host : window).addEventListener('wheel', ev => {
    const e = ev as WheelEvent;
    // some browsers count the wheel in lines
    const dy = e.deltaY * (e.deltaMode === 1 ? 32 : 1);
    if (!e.ctrlKey && !e.metaKey) {
      if (options.box) return;
      // a plain wheel scrolls; over a plan that runs only sideways it moves the plan sideways
      // by its path, as the view can be in a shadow root, where the page sees only the element the view is in
      const over = e.composedPath().includes(stage);
      if (over && !e.shiftKey && !e.deltaX && stage.scrollHeight <= stage.clientHeight && stage.scrollWidth > stage.clientWidth) {
        e.preventDefault();
        stage.scrollLeft += dy;
      }
      return;
    }
    // A pinch, or Ctrl and the wheel, over the view scales the page around the pointer, in place of the browser's own zoom. It never changes the level.
    // A pinch comes as many small turns, each scaled as the fingers move; one notch of a wheel is cut to a fourth more or less.
    if (!e.composedPath().includes(host)) return;
    e.preventDefault();
    // a flip of the labels on its way ends at once, and the page scales; any other move on its way goes on, and the page does not
    ctx.endFlip();
    if (ctx.raf) return;
    ctx.scaleBy(Math.exp(-clamp(dy, -25, 25) / 100), e.clientX, e.clientY);
  }, { passive: false, signal: off.signal });

  // a double click goes one level in, around the point that was double clicked; its first click has picked, or let go, as a click does
  // after a finger, a double tap does it: see the taps below
  stage.addEventListener('dblclick', e => {
    if (ctx.dragged || ctx.lastPointer === 'touch' || !ctx.plan || !ctx.all.length || ctx.target === ctx.K || ctx.only || performance.now() < ctx.noClick) return;
    ctx.setPopup(false);
    ctx.go(ctx.target + 1, ctx.nearest(ctx.all, e.clientX, e.clientY));
  });
  stage.addEventListener('pointerdown', e => {
    ctx.dragged = false;
    // a finger scrolls the browser's own way, with its fling
    if (e.pointerType === 'touch') return;
    // a press on the scroll bar is the browser's own
    const r = stage.getBoundingClientRect();
    if (e.button !== 0 || e.clientX - r.left > stage.clientWidth || e.clientY - r.top > stage.clientHeight) return;
    ctx.drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop };
  });
  window.addEventListener('pointermove', e => {
    if (ctx.drag && e.buttons === 0) ctx.drag = null;
    if (!ctx.drag) return;
    const dx = e.clientX - ctx.drag.x, dy = e.clientY - ctx.drag.y;
    if (!ctx.dragged && Math.hypot(dx, dy) < 5) return;
    ctx.dragged = true;
    ctx.hover(null);
    stage.classList.add('dragging');
    stage.scrollLeft = ctx.drag.l - dx;
    stage.scrollTop = ctx.drag.t - dy;
  }, once);
  window.addEventListener('pointerup', () => { ctx.drag = null; stage.classList.remove('dragging'); }, once);
}
