// Hover: every step, every group that is one step and every branch answers the pointer. A hover lights it and shows a short tip. It never zooms.
import type { ViewContext } from './context.js';
import { html } from './dom.js';
import { drawn } from './draw.js';
import { facts } from './facts.js';
import { clamp, union } from './math.js';
import { isBranch, isStep, sole, text, type TSplit, type Thing } from './plan.js';

/** What a group opens into, in one line: its steps in a row, or its tracks, by name where its own name is not that list already. */
function opens(sp: TSplit): string {
  const n = sp.kids.length;
  const names = n === 1 ? sp.nodes.map(s => s.node.name) : sp.named && sp.kids.every(c => c.name) ? sp.kids.map(c => c.name!) : [];
  const few = names.slice(0, 4), more = names.length - few.length;
  const list = more ? `${few.join(', ')} and ${more} more` : few.length > 1 ? `${few.slice(0, -1).join(', ')} and ${few[few.length - 1]}` : few[0];
  return `Opens into ${list ?? (n > 1 ? `${n} tracks` : 'steps in a row')}.`;
}

export function hoverPart(ctx: ViewContext) {
  const { host, svg, tip } = ctx;

  function thingAt(t: EventTarget | null): Thing | null {
    if (!(t instanceof Element)) return null;
    const n = t.closest('[data-id]'), p = t.closest('[data-pod]'), b = t.closest('[data-bar]');
    if (n) return ctx.byId.get(n.getAttribute('data-id')!) ?? null;
    if (p) return ctx.byPod.get(p.getAttribute('data-pod')!) ?? null;
    const br = b ? ctx.byKey.get(b.getAttribute('data-bar')!) : undefined;
    // far out the tracks of a group are not drawn: what still shows of one on the way there answers for its group
    return (br?.pod && (!ctx.target || sole(br)) ? br.pod : br) ?? null;
  }
  const light = (t: Thing | null, cls: string, on: boolean): void => {
    if (t) for (const e of ctx.partsOf.get(t)!) e.classList.toggle(cls, on);
  };
  /** Puts the tip over a thing: its middle at x, or with `from`, its left edge at x. */
  function tipAt(x: number, top: number, bottom: number, from = false): void {
    // the tip stands in the view's own part of the page: x, top and bottom come in from the screen
    const o = host.getBoundingClientRect();
    x -= o.left; top -= o.top; bottom -= o.top;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.round(clamp(from ? x : x - w / 2, 8, host.clientWidth - w - 8))}px`;
    // over the thing, nearer to it where the room is tight, or under it where there is no room over it
    const over = [10, 4].map(gap => top - h - gap).find(y => y >= 2);
    tip.style.top = `${Math.round(over ?? bottom + 10)}px`;
  }
  function hover(t: Thing | null, e?: PointerEvent): void {
    const fresh = t !== ctx.hot;
    if (fresh) {
      light(ctx.hot, 'hot', false);
      ctx.hot = t;
      light(ctx.hot, 'hot', true);
    }
    // a closed track is small, so its tip stands over it, as over a step
    const track = t && isBranch(t) ? t : null, pill = track && ctx.shut(track);
    // what is picked has the side bar and needs no tip; the tip of an open branch waits for the pointer to say where it goes,
    // and in edit mode shows not at all: its line holds the add mark, and a drop on it ends with the pointer on it
    const show = !!t && t !== ctx.picked && (!isBranch(t) || (!!e && !host.classList.contains('editing')) || !!pill);
    if (t && show && (fresh || tip.hidden)) {
      const line = isStep(t) ? text(t.node.why) : isBranch(t) ? t.holds : opens(t);
      tip.replaceChildren(ctx.heading(t, 'strong', 20), facts(t), ...(line ? [html('p', '', line)] : []));
    }
    tip.hidden = !show;
    if (!t || !show) return;
    if (track && pill) {
      // over the pill, and over the name of the track where it has one
      const r = pill.getBoundingClientRect(), c = ctx.pieceEls.get(`${track.key}:cap`)?.getBoundingClientRect();
      tipAt(r.left + r.width / 2, c?.width ? Math.min(r.top, c.top) : r.top, r.bottom);
    } else if (!isBranch(t)) {
      // over the step, and over its name where that shows: the tip never lies on the name of its own step
      const els: { g: SVGElement; lines: SVGElement[]; vlines: SVGElement[] } = isStep(t) ? ctx.nodeEls.get(t.node.id)! : ctx.podEls.get(t.key)!;
      // an open group has no step to stand over: the tip stands over its name, or else over its frame
      const shown = isStep(t) ? els.g : [els.g, ctx.pieceEls.get(`${t.kids[0].key}:gname`), ctx.pieceEls.get(`${t.kids[0].key}:frame`)].find(c => c && c.style.display !== 'none') ?? els.g;
      const r = shown.getBoundingClientRect();
      // the names of the layout the plan is not in are not drawn, so they have no box
      const boxes = [...els.lines, ...els.vlines].map(x => x.getBoundingClientRect()).filter(b => b.width);
      if (ctx.isDown()) {
        // down, the name is right of the step, on its row: the tip stands over the row, from the left edge of the step, or under it where there is no room over it.
        // The first of a branch has the name of its branch just over it: the tip stands over that too, so its edge does not cut that name in two
        const owner = t.owner, cap = owner.items[0] === t ? ctx.pieceEls.get(`${owner.key}:cap`) : undefined;
        if (cap && drawn(cap)) boxes.push(cap.getBoundingClientRect());
        const row = union([r, ...boxes.filter(b => b.width)]);
        tipAt(r.left, row.top, row.bottom, true);
        return;
      }
      const tops = boxes.map(b => b.top);
      const x = r.left + r.width / 2, half = tip.offsetWidth / 2;
      let top = Math.min(r.top, ...tops);
      // and over a longer name next to it in its row, so the edge of the tip does not cut that name in two
      for (let again = true; again;) {
        again = false;
        for (const o of [...ctx.nodeEls.values(), ...ctx.podEls.values()]) for (const l of [...o.lines, ...o.vlines]) {
          const b = l.getBoundingClientRect();
          if (b.width && b.right > x - half && b.left < x + half && b.top < top && b.bottom > top - 10) { top = b.top; again = true; }
        }
      }
      tipAt(x, top, r.bottom);
    } else if (e) tipAt(e.clientX, e.clientY - 6, e.clientY + 12);
  }
  // a finger shows no tip: a tap picks
  svg.addEventListener('pointerover', e => { if (e.pointerType !== 'touch' && !ctx.raf && !ctx.sraf && !(ctx.drag && ctx.dragged)) hover(thingAt(e.target), e); });
  // the tip of a branch rides with the pointer, since a branch is long
  svg.addEventListener('pointermove', e => { if (e.pointerType !== 'touch' && ctx.hot && isBranch(ctx.hot) && !ctx.raf && !ctx.sraf && !ctx.drag) hover(ctx.hot, e); });
  svg.addEventListener('pointerleave', () => hover(null));

  return { thingAt, light, hover };
}

export type HoverPart = ReturnType<typeof hoverPart>;
