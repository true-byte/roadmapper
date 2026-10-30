// The zoom control: its buttons, the popup of the tools button by its end with the parts 'Key', 'View' and in the app 'Export', and the grip that hides it.
import { GRIP } from '../icons/icons.js';
import type { ViewContext } from './context.js';
import type { Mode } from './dom.js';
import { r2 } from './math.js';
import { TAP } from './side.js';

/** How far over the zoom control the popup and the list lie: clear of the grip on its top edge. */
export const OVER = 30;

export function toolbarPart(ctx: ViewContext) {
  const { fit, flows, glyph, grip, hide, hideL, host, into, keepPrivate, layers, modeSeg, modes, names, out, parts, picker, popup, rule, seg, stops, tools, viewPart, zoom } = ctx;

  /** Writes the level, the view, the labels, the layout and what is open on the zoom control and the popup, for the keyboard and for the theme. */
  function controls(): void {
    // not the disabled attribute: that drops the keyboard focus from the button
    out.setAttribute('aria-disabled', String(ctx.target === 0));
    into.setAttribute('aria-disabled', String(ctx.target === ctx.K));
    ctx.stopEls.forEach((b, k) => b.setAttribute('aria-current', String(k === ctx.target)));
    hide.setAttribute('aria-checked', String(ctx.view === 0));
    hideL.setAttribute('aria-checked', String(!ctx.labels));
    keepPrivate.setAttribute('aria-checked', String(ctx.withPrivate));
    tools.setAttribute('aria-expanded', String(!popup.hidden));
    layers.setAttribute('aria-expanded', String(!picker.hidden));
    // the layout the plan is drawn in, for the theme and for what embeds the view
    host.dataset.flow = ctx.flow;
    names.classList.toggle('down', ctx.flow === 'v');
    // the layout that is chosen is the one the keyboard comes to in the pair
    flows.forEach(b => {
      const on = b.dataset.flow === ctx.flow;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }
  /** Opens or closes the popup. From the keyboard the focus goes into it as it opens: to the first switch of 'View', or to the first heading while 'View' is closed.
   * It goes back to the tools button as the popup closes. */
  function setPopup(open: boolean, focus = false): void {
    if (open === !popup.hidden) return;
    // while only a blocked step and its blockers show, the zoom control rests, and so does the popup
    if (open && ctx.only) return;
    // where the side bar is a sheet at the bottom, it gives the popup its place, as the popup gives it to the side bar
    if (open && fit.bottom && ctx.picked) ctx.pick(null);
    popup.hidden = !open;
    if (open) ctx.setBranches(false);
    // 'Saved', or an export that could not be made, is not shown again the next time the popup opens
    else ctx.resetExport();
    placePopup();
    controls();
    if (focus) (open ? (viewPart.isOpen() ? (ctx.hasIcons ? hide : hideL) : parts[0].head) : tools).focus();
    ctx.seek();
    ctx.save();
  }
  /** Puts the popup by the end of the zoom control, OVER it: as wide as the control where the side bar is a sheet at the bottom, else its own width with its right edge on the control's.
   * A control of few levels is narrower than the row of switches: there the popup is as wide as that row, and stays 8 px in from the left of the view. The list of branches goes the same way. */
  function placePopup(): void {
    ctx.placeBranches();
    if (popup.hidden) return;
    const h = host.getBoundingClientRect(), z = zoom.getBoundingClientRect();
    popup.style.width = fit.bottom ? `${r2(z.width)}px` : '';
    popup.style.left = `${r2(Math.max(8, z.right - h.left - popup.offsetWidth))}px`;
    popup.style.bottom = `${r2(h.bottom - z.top + OVER)}px`;
    // a short view: it scrolls, and never runs off the top
    popup.style.maxHeight = `${r2(Math.max(0, z.top - h.top - OVER - 8))}px`;
  }
  /** Draws the whole view in a mode: light, dark, or as the device is set, for anything else. By it, view.css sets the color-scheme of the root, which picks the light or the dark value of each color of the theme. */
  function setMode(to: unknown): void {
    const was = host.dataset.mode;
    ctx.mode = to === 'light' || to === 'dark' ? to : 'device';
    host.dataset.mode = ctx.mode;
    // the whole view turns at once: with its transitions off while the new colors are worked out, no part of it fades from the colors of the mode before
    if (was && was !== ctx.mode) {
      host.dataset.turning = '';
      void host.offsetWidth;
      delete host.dataset.turning;
    }
    // the mode that is chosen is the one the keyboard comes to in the box
    modes.forEach(b => {
      const on = b.dataset.mode === ctx.mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  /** Where and when the pointer last clicked a heading of the popup. The popup keeps its bottom edge, so what is above that part moves under the pointer. */
  let foldAt: { x: number; y: number; t: number } | null = null;
  /** Is this press, or this click, the second of a double click or of a double tap on a heading of the popup? It lands on what moved there, and does nothing there. */
  const afterFold = (e: MouseEvent): boolean =>
    !!foldAt && e.timeStamp - foldAt.t < 500 && Math.hypot(e.clientX - foldAt.x, e.clientY - foldAt.y) < TAP.PX;

  // ---- the grip: it hides the zoom control down to the grip alone, and brings it back. The keys of the control still work. ----

  function setTucked(on: boolean): void {
    ctx.tucked = on;
    if (on) { setPopup(false); ctx.setBranches(false); }
    host.classList.toggle('tucked', on);
    for (const e of [out, stops, into, rule, layers, tools]) e.inert = on;
    const label = on ? 'Show toolbar' : 'Hide toolbar';
    grip.replaceChildren(glyph(on ? GRIP.show : GRIP.hide, 18, on ? '▴' : '▾'));
    grip.setAttribute('aria-label', label);
    grip.title = label;
    grip.setAttribute('aria-expanded', String(!on));
  }
  setTucked(false);
  grip.addEventListener('click', e => {
    setTucked(!ctx.tucked);
    // the control moves under the pointer: the second click of a double click, or of a double tap, lands on what it uncovers, and does nothing there
    ctx.noClick = e.timeStamp + 500;
    // where the side bar is a sheet at the bottom, it moves with the control: the picked thing stays clear of it
    ctx.uncover();
    ctx.save();
  });

  out.addEventListener('click', () => ctx.go(ctx.target - 1));
  into.addEventListener('click', () => ctx.go(ctx.target + 1));
  hide.addEventListener('click', () => ctx.setIcons(ctx.view === 0));
  hideL.addEventListener('click', () => ctx.setLabels(!ctx.labels));
  // a press from the keyboard has no pointer: the focus goes into the popup
  tools.addEventListener('click', e => setPopup(popup.hidden === true, e.detail === 0));
  // the heading of each part of the popup closes and opens it, and the view keeps which
  for (const p of parts) p.head.addEventListener('click', e => {
    p.setOpen(!p.isOpen());
    if (e.detail > 0) foldAt = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    ctx.save();
  });
  // the second click of a double click on a heading does nothing on the button of the popup that moved under it; a click from the keyboard is never eaten
  popup.addEventListener('click', e => {
    if (e.detail === 0 || !afterFold(e)) return;
    e.stopPropagation();
    e.preventDefault();
  }, { capture: true });
  const pickMode = (b: HTMLButtonElement): void => { setMode(b.dataset.mode as Mode); ctx.save(); };
  // the pair of layouts and the mode: a click chooses, and the arrows move between the buttons of the box and choose. They do not move the plan
  for (const [box, buttons, choose] of [[seg, flows, (b: HTMLButtonElement) => ctx.setFlow(b.dataset.flow as 'h' | 'v')], [modeSeg, modes, pickMode]] as const) {
    for (const b of buttons) b.addEventListener('click', e => {
      choose(b);
      // a press of the pointer leaves the focus on the button of the popup, not on the box: the arrows that come next move the plan, and do not choose again
      if (e.detail > 0 && (host.getRootNode() as Document | ShadowRoot).activeElement === b) tools.focus({ preventScroll: true });
    });
    box.addEventListener('keydown', e => {
      const by = ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 } as Record<string, number | undefined>)[e.key];
      if (!by) return;
      e.preventDefault();
      e.stopPropagation();
      const to = buttons[(buttons.indexOf(e.target as HTMLButtonElement) + by + buttons.length) % buttons.length];
      to.focus();
      choose(to);
    });
  }

  return { controls, setPopup, placePopup, setTucked, setMode, afterFold };
}

export type ToolbarPart = ReturnType<typeof toolbarPart>;
