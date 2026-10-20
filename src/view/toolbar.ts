// The zoom control: its buttons, the popup by its end with the key, the switches and the pair of layouts, and the grip that hides it.
import { GRIP } from '../icons/icons.js';
import type { ViewContext } from './context.js';
import { r2 } from './math.js';

/** How far over the zoom control the popup and the list lie: clear of the grip on its top edge. */
export const OVER = 30;

export function toolbarPart(ctx: ViewContext) {
  const { fit, flows, glyph, grip, hide, hideL, host, info, into, layers, names, out, picker, popup, rule, seg, stops, zoom } = ctx;

  /** Writes the level, the view, the labels, the layout and what is open on the zoom control and the popup, for the keyboard and for the theme. */
  function controls(): void {
    // not the disabled attribute: that drops the keyboard focus from the button
    out.setAttribute('aria-disabled', String(ctx.target === 0));
    into.setAttribute('aria-disabled', String(ctx.target === ctx.K));
    ctx.stopEls.forEach((b, k) => b.setAttribute('aria-current', String(k === ctx.target)));
    hide.setAttribute('aria-checked', String(ctx.view === 0));
    hideL.setAttribute('aria-checked', String(!ctx.labels));
    info.setAttribute('aria-expanded', String(!popup.hidden));
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
  /** Opens or closes the popup. From the keyboard the focus goes into it as it opens, and back to its button as it closes. */
  function setPopup(open: boolean, focus = false): void {
    if (open === !popup.hidden) return;
    // while only a blocked step and its blockers show, the zoom control rests, and so does the popup
    if (open && ctx.only) return;
    // where the side bar is a sheet at the bottom, it gives the popup its place, as the popup gives it to the side bar
    if (open && fit.bottom && ctx.picked) ctx.pick(null);
    popup.hidden = !open;
    if (open) ctx.setBranches(false);
    placePopup();
    controls();
    if (focus) (open ? (ctx.hasIcons ? hide : hideL) : info).focus();
    ctx.seek();
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

  // ---- the grip: it hides the zoom control down to the grip alone, and brings it back. The keys of the control still work. ----

  function setTucked(on: boolean): void {
    ctx.tucked = on;
    if (on) { setPopup(false); ctx.setBranches(false); }
    host.classList.toggle('tucked', on);
    for (const e of [out, stops, into, rule, layers, info]) e.inert = on;
    const label = on ? 'Show toolbar' : 'Hide toolbar';
    grip.replaceChildren(glyph(on ? GRIP.show : GRIP.hide, 18, on ? '▴' : '▾'));
    grip.setAttribute('aria-label', label);
    grip.title = label;
    grip.setAttribute('aria-expanded', String(!on));
  }
  setTucked(false);
  grip.addEventListener('click', () => {
    setTucked(!ctx.tucked);
    // the control moves under the pointer: the second click of a double click, or of a double tap, lands on what it uncovers, and does nothing there
    ctx.noClick = performance.now() + 500;
    // where the side bar is a sheet at the bottom, it moves with the control: the picked thing stays clear of it
    ctx.uncover();
    ctx.save();
  });

  out.addEventListener('click', () => ctx.go(ctx.target - 1));
  into.addEventListener('click', () => ctx.go(ctx.target + 1));
  hide.addEventListener('click', () => ctx.setIcons(ctx.view === 0));
  hideL.addEventListener('click', () => ctx.setLabels(!ctx.labels));
  // a press from the keyboard has no pointer: the focus goes into the popup
  info.addEventListener('click', e => setPopup(popup.hidden === true, e.detail === 0));
  for (const b of flows) b.addEventListener('click', e => {
    ctx.setFlow(b.dataset.flow as 'h' | 'v');
    // a press of the pointer leaves the focus on the button of the popup, not on the pair: the arrows that come next move the plan, and do not turn it back
    if (e.detail > 0 && (host.getRootNode() as Document | ShadowRoot).activeElement === b) info.focus({ preventScroll: true });
  });
  // the arrows move between the two layouts, and choose: they do not move the plan
  seg.addEventListener('keydown', e => {
    const by = ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 } as Record<string, number | undefined>)[e.key];
    if (!by) return;
    e.preventDefault();
    e.stopPropagation();
    const to = flows[(flows.indexOf(e.target as HTMLButtonElement) + by + flows.length) % flows.length];
    to.focus();
    ctx.setFlow(to.dataset.flow as 'h' | 'v');
  });

  return { controls, setPopup, placePopup, setTucked };
}

export type ToolbarPart = ReturnType<typeof toolbarPart>;
