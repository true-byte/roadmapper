// The list of top-level branches: the button left of the tools button opens it and closes it. A press anywhere else closes it, and so does Escape, as for the popup.
// Each row shows or hides its branch, and the search finds rows by their names.
import type { ViewContext } from './context.js';
import { html } from './dom.js';
import { drawMark } from './mark.js';
import { r2 } from './math.js';
import { finished, sum, tally } from './plan.js';
import { OVER } from './toolbar.js';

export function branchesPart(ctx: ViewContext) {
  const { branchList, find, fit, host, layers, picker, zoom } = ctx;

  /** Fills the list: one row for each top-level branch whose name holds what the search holds, in the order of the file. The last branch that shows cannot be hidden. */
  function fillBranches(): void {
    if (!ctx.plan) return;
    const q = find.value.trim().toLocaleLowerCase(), on = ctx.plan.every.filter(e => e.shown).length;
    const root = host.getRootNode() as Document | ShadowRoot, was = (root.activeElement as HTMLElement | null)?.closest?.('.branches [data-tag]')?.getAttribute('data-tag');
    branchList.replaceChildren(...ctx.plan.every.flatMap(({ top, tag, shown: open }) => {
      const name = top.name ?? 'Branch';
      if (q && !name.toLocaleLowerCase().includes(q)) return [];
      const li = document.createElement('li'), b = html('button', 'pick');
      b.setAttribute('role', 'checkbox');
      b.setAttribute('aria-checked', String(open));
      b.setAttribute('aria-disabled', String(open && on === 1));
      b.dataset.tag = tag;
      b.title = name;
      b.append(html('span', 'box'), drawMark(sum(top)), html('span', 'name', name), html('span', 'dim', tally(top)));
      b.addEventListener('click', () => showBranch(tag, !open));
      li.append(b);
      return [li];
    }));
    // a row pressed from the keyboard keeps the focus when the list is made again
    if (was) branchList.querySelector<HTMLElement>(`[data-tag="${CSS.escape(was)}"]`)?.focus({ preventScroll: true });
  }
  /** Shows or hides a top-level branch, by its tag. The plan is drawn again, and keeps its level and its place, as after a save of the file. */
  function showBranch(tag: string, on: boolean): void {
    const e = ctx.plan?.every.find(x => x.tag === tag);
    if (!ctx.plan || !e || ctx.only || e.shown === on) return;
    if (!on && ctx.plan.every.filter(x => x.shown).length === 1) return;
    // a branch that shows only because it is the last one left stays as it is
    for (const x of ctx.plan.every) if (x.shown && !(ctx.choices.get(x.tag) ?? !finished(x.top))) ctx.choices.set(x.tag, true);
    // a choice that is what the branch gets by default is not kept, so the branch hides by itself once it is finished
    if (on === !finished(e.top)) ctx.choices.delete(tag);
    else ctx.choices.set(tag, on);
    ctx.toggling = true;
    try {
      ctx.paint(ctx.shown);
    } finally {
      ctx.toggling = false;
    }
    ctx.save();
  }
  /** Opens or closes the list of branches. Open, the search is empty, and takes the focus unless a finger opened it: a keyboard would come up over the list. */
  function setBranches(open: boolean, focus = false): void {
    if (open === !picker.hidden) return;
    // while only a blocked step and its blockers show, the zoom control rests, and so does the list
    if (open && (ctx.only || !ctx.plan)) return;
    if (open) {
      ctx.setPopup(false);
      // where the side bar is a sheet at the bottom, it gives the list its place
      if (fit.bottom && ctx.picked) ctx.pick(null);
      find.value = '';
      fillBranches();
    }
    picker.hidden = !open;
    placeBranches();
    ctx.controls();
    if (open && (focus || ctx.lastPointer !== 'touch')) find.focus({ preventScroll: true });
    else if (!open && focus) layers.focus();
  }
  /** Puts the list by the end of the zoom control, OVER it, as the popup: the width of the view less 8 px at each side where the side bar is a sheet at the bottom. */
  function placeBranches(): void {
    if (picker.hidden) return;
    const h = host.getBoundingClientRect(), z = zoom.getBoundingClientRect();
    picker.style.width = fit.bottom ? `${r2(h.width - 16)}px` : '';
    picker.style.left = `${r2(Math.max(8, z.right - h.left - picker.offsetWidth))}px`;
    picker.style.bottom = `${r2(h.bottom - z.top + OVER)}px`;
    picker.style.maxHeight = `${r2(Math.max(0, z.top - h.top - OVER - 8))}px`;
  }
  layers.addEventListener('click', e => setBranches(picker.hidden === true, e.detail === 0));
  find.addEventListener('input', fillBranches);
  find.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    setBranches(false, true);
  });

  return { fillBranches, setBranches, placeBranches };
}

export type BranchesPart = ReturnType<typeof branchesPart>;
